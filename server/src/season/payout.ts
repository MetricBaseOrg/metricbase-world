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
import {
  loadSeasonStakes,
  claimStakeRefund,
  finalizeStakeRefund,
  releaseStakeRefund,
  listUnstampedRefunds,
} from "../db/seasonStake.js";

export interface PayoutLine {
  name: string;
  wallet: string;
  points: number;
  amount: number;
  status?: "paid" | "skipped" | "failed";
  signature?: string;
  error?: string;
}

/** A stake being returned. Kept separate from the prize line because it goes to
 * the wallet that PAID the stake, which is not necessarily the wallet the
 * player later nominated for prizes — a deposit goes back where it came from. */
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
  /** Stake deposits being returned, and their total. */
  refunds: RefundLine[];
  totalToRefund: number;
  /** Refunds a previous run claimed but never stamped — needs a human. */
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
    stuckRefunds: [],
  };

  // Never distribute the current (ongoing) season.
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1 || seasonNumber >= currentSeason().number) {
    return { ...report, error: "That season hasn't ended yet." };
  }

  // Stakes drive both halves of a staked season: who is in the split, and who
  // is owed their deposit back. Seasons before SEASON_STAKE_FIRST_SEASON have
  // no stakes at all, so this is empty and the split stays open to everyone.
  const stakes = await loadSeasonStakes(seasonId);
  const entrants = new Set(stakes.map((s) => s.playerName));
  report.stuckRefunds = await listUnstampedRefunds(seasonId);

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

  // Refunds are owed to every entrant who hasn't been repaid — including one
  // who scored zero points and so has no prize line at all. A deposit is not
  // contingent on performance.
  const refunds: RefundLine[] = stakes
    .filter((s) => !s.refunded && s.amount >= 1)
    .map((s) => ({ name: s.playerName, wallet: s.wallet, amount: s.amount }));
  const totalToRefund = refunds.reduce((sum, r) => sum + r.amount, 0);
  report.refunds = refunds;
  report.totalToRefund = totalToRefund;

  if (totalPoints <= 0 && totalToRefund <= 0) {
    return {
      ...report,
      error: staked
        ? "No staked entrants with points, and no deposits to return."
        : "No eligible players (need season points and a bonded wallet).",
    };
  }

  // Solvency must cover prizes AND the deposits we owe back. Checking only the
  // prizes could drain the treasury below the refund liability.
  const owed = totalToPay + totalToRefund;
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
      error: `House wallet can't cover ${owed} $BASE (${totalToPay} prizes + ${totalToRefund} deposits, balance ${houseBalance ?? 0}).`,
    };
  }

  report.executed = true;

  // Deposits first: they are other people's money, so they get paid before
  // prizes if the run is interrupted partway.
  for (const refund of refunds) {
    const claimed = await claimStakeRefund(seasonId, refund.name);
    if (!claimed) {
      refund.status = "skipped";
      continue;
    }
    const res = await sendPayout(refund.wallet, "base", toBaseUnits(refund.amount, "base"), resolveMint());
    if (res.ok) {
      refund.status = "refunded";
      refund.signature = res.signature;
      await finalizeStakeRefund(seasonId, refund.name, res.signature ?? "");
    } else {
      refund.status = "failed";
      refund.error = res.error;
      await releaseStakeRefund(seasonId, refund.name); // release for retry
    }
  }

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
