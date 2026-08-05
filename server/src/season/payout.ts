// End-of-season reward distribution. Splits a season's FIXED $BASE pool
// pro-rata by points among eligible players (points > 0 + a bonded wallet) and
// pays out from the house/admin wallet via the existing sendPayout rail.
//
// Safety model (mirrors the ad payout guards):
//  - Dry-run by default: nothing moves unless `execute` is explicitly true.
//  - Only ENDED seasons can be distributed (never the current one).
//  - Idempotent: each (season, player) slot is claimed atomically BEFORE the
//    transfer and stamped with the tx signature after, so a re-run never
//    double-pays. A failed transfer releases the claim for a later retry.
//  - Solvency: refuses to execute unless the house wallet can cover the total.
//  - No minting: the pool is a fixed treasury allocation; this only divides it.

import {
  currentSeason,
  seasonRewardPool,
  seasonRequiresStake,
  seasonStakeAmount,
  SEASON_REWARD_REQUIRES_X,
  SEASON_REWARD_REQUIRES_POST,
  METRICBASE_TOKEN_MINT,
  toBaseUnits,
} from "@metricbase/shared";
import { isXLinkConfigured } from "../auth/xAuth.js";
import { loadPostedPlayers } from "../db/seasonPost.js";
import { getHouseWalletAddress, getHouseBalanceUi, isWithdrawEnabled, sendPayout } from "../solana/housePayout.js";
import {
  loadSeasonPayoutTargets,
  type PayoutTarget,
  claimSeasonPayout,
  finalizeSeasonPayout,
  unclaimSeasonPayout,
  getSeasonPayoutSummary,
} from "../db/season.js";
import { loadSeasonEntrants, sumVaultBalances, listPendingWithdrawals } from "../db/seasonVault.js";

export interface PayoutLine {
  name: string;
  wallet: string;
  points: number;
  amount: number;
  status?: "paid" | "skipped" | "failed";
  signature?: string;
  error?: string;
}

/** Retained so an older report still type-checks. Since v0.205 deposits are
 * withdrawn by the player from their vault, so the payout never fills this. */
export interface RefundLine {
  name: string;
  wallet: string;
  amount: number;
  status?: "refunded" | "skipped" | "failed";
  signature?: string;
  error?: string;
}

export interface PayoutReport {
  seasonNumber: number;
  seasonId: string;
  pool: number;
  totalPoints: number;
  eligible: number;
  totalToPay: number;
  houseBalance: number | null;
  solvent: boolean;
  withdrawEnabled: boolean;
  executed: boolean;
  alreadyPaid: number;
  lines: PayoutLine[];
  /** Whether this season splits its pool among staked entrants only. */
  staked: boolean;
  /** Players with points who never staked in, so aren't in the split. */
  notEntered: number;
  /** Whether a connected X account is being required to be paid. False when
   * SEASON_REWARD_REQUIRES_X is off OR X connect isn't configured server-side. */
  xRequired: boolean;
  /** Players with points + a payable wallet who are held back only for want of
   * an X link. Their share is NOT redistributed — see the note in the code. */
  missingX: number;
  /** Names of those players, so they can be chased before the pool is sent. */
  missingXNames: string[];
  /** Whether a verified season post is also being required. */
  postRequired: boolean;
  /** Linked but haven't posted — one step from being paid. */
  missingPost: number;
  missingPostNames: string[];
  /** $BASE held back across ALL unmet requirements — money sitting unpaid. */
  totalHeldForX: number;
  /** Always empty since v0.205 — players withdraw deposits themselves. */
  refunds: RefundLine[];
  totalToRefund: number;
  /** $BASE sitting in deposit vaults. Not paid here, but the treasury must
   *  stay able to honour it, so solvency is checked against prizes + this. */
  vaultLiability: number;
  /** Withdrawals reserved but never resolved — needs a human to check the chain. */
  stuckRefunds: string[];
  error?: string;
}

const resolveMint = (): string => process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;

/** Compute (and optionally execute) the payout for an ended season. */
export async function distributeSeasonRewards(seasonNumber: number, execute: boolean): Promise<PayoutReport> {
  const seasonId = `S${seasonNumber}`;
  const pool = seasonRewardPool(seasonNumber);
  const staked = seasonRequiresStake(seasonNumber);
  const report: PayoutReport = {
    seasonNumber,
    seasonId,
    pool,
    totalPoints: 0,
    eligible: 0,
    totalToPay: 0,
    houseBalance: null,
    solvent: false,
    withdrawEnabled: isWithdrawEnabled(),
    executed: false,
    alreadyPaid: 0,
    lines: [],
    staked,
    notEntered: 0,
    xRequired: false,
    missingX: 0,
    missingXNames: [],
    postRequired: false,
    missingPost: 0,
    missingPostNames: [],
    totalHeldForX: 0,
    refunds: [],
    totalToRefund: 0,
    vaultLiability: 0,
    stuckRefunds: [],
  };

  // Never distribute the current (ongoing) season.
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1 || seasonNumber >= currentSeason().number) {
    return { ...report, error: "That season hasn't ended yet." };
  }

  // Who is in the split: everyone whose deposit vault still meets the entry
  // floor. It is a LIVE balance check rather than a record of having once paid,
  // so a player who withdrew below the floor before the season ended took
  // themselves out of the split — which is the same rule the panel shows them
  // all season. Seasons before SEASON_STAKE_FIRST_SEASON have no floor, so this
  // is empty and the split stays open to everyone.
  const floor = seasonStakeAmount(seasonNumber);
  const entrants = new Set((await loadSeasonEntrants(floor)).map((e) => e.playerName));
  // Withdrawals that reserved but never resolved — a human must check the chain
  // before those players are told anything about their balance.
  report.stuckRefunds = (await listPendingWithdrawals()).map((w) => w.playerName);

  const allTargets = await loadSeasonPayoutTargets(seasonId);
  const staketargets = staked ? allTargets.filter((t) => entrants.has(t.name)) : allTargets;
  report.notEntered = allTargets.length - staketargets.length;

  // Season rewards require a connected X account AND a verified public post —
  // but ONLY when X connect is actually configured on this server. Enforcing
  // either against an unconfigured OAuth app would disqualify every player at
  // once and strand the pool, so a missing X_CLIENT_ID fails OPEN (everyone
  // stays eligible) rather than closed. Both requirements ride that same switch
  // because a player cannot post proof without first linking.
  const xConfigured = isXLinkConfigured();
  const xRequired = SEASON_REWARD_REQUIRES_X && xConfigured;
  const postRequired = SEASON_REWARD_REQUIRES_POST && xConfigured;
  report.xRequired = xRequired;
  report.postRequired = postRequired;

  const posted = postRequired ? await loadPostedPlayers(seasonId) : new Set<string>();
  const meetsRequirements = (t: PayoutTarget): boolean =>
    (!xRequired || t.xLinked) && (!postRequired || posted.has(t.name));

  const heldBack = staketargets.filter((t) => !meetsRequirements(t));
  report.missingX = heldBack.filter((t) => xRequired && !t.xLinked).length;
  report.missingXNames = heldBack.filter((t) => xRequired && !t.xLinked).map((t) => t.name);
  // Linked but hasn't posted — the group to nudge, since they're one step away.
  report.missingPost = heldBack.filter((t) => t.xLinked && postRequired && !posted.has(t.name)).length;
  report.missingPostNames = heldBack
    .filter((t) => t.xLinked && postRequired && !posted.has(t.name))
    .map((t) => t.name);
  const targets = staketargets.filter(meetsRequirements);

  // Pro-rata over the ENTRANTS' points, not everyone's — a non-entrant's points
  // must not dilute the share of the players who actually paid in.
  //
  // NOTE the divisor is `staketargets`, which still INCLUDES players held back
  // for a missing X link. That is deliberate: it makes the X requirement a
  // DELAY, not a forfeiture. Their share is computed and simply not sent, so
  // when they link and this is re-run they receive exactly the same amount, and
  // nobody else's share silently grew because a player hadn't tapped Connect.
  const totalPoints = staketargets.reduce((sum, t) => sum + t.points, 0);
  report.totalPoints = totalPoints;

  // Guard the divisor explicitly: loadSeasonPayoutTargets only returns points>0
  // rows so an empty `targets` means totalPoints is 0 and this maps over
  // nothing — but the division is one refactor away from producing Infinity.
  const lines: PayoutLine[] = (totalPoints > 0 ? targets : [])
    .map((t) => ({ name: t.name, wallet: t.wallet, points: t.points, amount: Math.floor((t.points / totalPoints) * pool) }))
    .filter((l) => l.amount >= 1);
  const totalToPay = lines.reduce((sum, l) => sum + l.amount, 0);
  report.lines = lines;
  report.eligible = lines.length;
  report.totalToPay = totalToPay;
  report.totalHeldForX =
    totalPoints > 0 ? heldBack.reduce((sum, t) => sum + Math.floor((t.points / totalPoints) * pool), 0) : 0;

  // Deposits are NOT returned here. Since v0.205 the stake is a vault the
  // player withdraws from themselves, in part or in full, once the season it
  // was deposited in has ended — so a player who wants to keep competing never
  // has to re-deposit, and nobody's capital moves without them asking.
  //
  // The deposits are still a treasury liability, though, so the solvency check
  // below must still cover them: paying out prizes down to a balance that can
  // no longer honour the vault would be spending other people's money.
  const vaultLiability = await sumVaultBalances();
  report.refunds = [];
  report.totalToRefund = 0;
  report.vaultLiability = vaultLiability;

  if (totalPoints <= 0) {
    return {
      ...report,
      error: staked
        ? "No staked entrants with points."
        : "No eligible players (need season points and a bonded wallet).",
    };
  }

  // Solvency must cover prizes AND every deposit still sitting in a vault.
  // Checking only the prizes could drain the treasury below what players are
  // owed back the moment they withdraw.
  const owed = totalToPay + vaultLiability;
  const house = getHouseWalletAddress();
  const houseBalance = house ? await getHouseBalanceUi(house, "base", resolveMint()) : null;
  report.houseBalance = houseBalance;
  report.solvent = houseBalance != null && owed <= houseBalance;

  const summary = await getSeasonPayoutSummary(seasonId);
  report.alreadyPaid = summary.paid;

  if (!execute) return report; // dry-run preview only

  // ---- Execute guards ----
  if (!report.withdrawEnabled) return { ...report, error: "Withdrawals are disabled (no HOUSE_WALLET_SECRET)." };
  if (!report.solvent) {
    return {
      ...report,
      error: `House wallet can't cover ${owed} $BASE (${totalToPay} prizes + ${vaultLiability} held in deposit vaults, balance ${houseBalance ?? 0}).`,
    };
  }

  report.executed = true;

  for (const line of lines) {
    // Claim the slot first — if another run already claimed/paid it, skip.
    const claimed = await claimSeasonPayout(seasonId, line.name, line.wallet, line.amount);
    if (!claimed) {
      line.status = "skipped";
      continue;
    }
    const res = await sendPayout(line.wallet, "base", toBaseUnits(line.amount, "base"), resolveMint());
    if (res.ok) {
      line.status = "paid";
      line.signature = res.signature;
      await finalizeSeasonPayout(seasonId, line.name, res.signature ?? "");
    } else {
      line.status = "failed";
      line.error = res.error;
      await unclaimSeasonPayout(seasonId, line.name); // release for retry
    }
  }
  return report;
}
