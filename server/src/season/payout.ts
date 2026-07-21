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

import { currentSeason, seasonRewardPool, METRICBASE_TOKEN_MINT, toBaseUnits } from "@metricbase/shared";
import { getHouseWalletAddress, getHouseBalanceUi, isWithdrawEnabled, sendPayout } from "../solana/housePayout.js";
import {
  loadSeasonPayoutTargets,
  claimSeasonPayout,
  finalizeSeasonPayout,
  unclaimSeasonPayout,
  getSeasonPayoutSummary,
} from "../db/season.js";

export interface PayoutLine {
  name: string;
  wallet: string;
  points: number;
  amount: number;
  status?: "paid" | "skipped" | "failed";
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
  error?: string;
}

const resolveMint = (): string => process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;

/** Compute (and optionally execute) the payout for an ended season. */
export async function distributeSeasonRewards(seasonNumber: number, execute: boolean): Promise<PayoutReport> {
  const seasonId = `S${seasonNumber}`;
  const pool = seasonRewardPool(seasonNumber);
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
  };

  // Never distribute the current (ongoing) season.
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1 || seasonNumber >= currentSeason().number) {
    return { ...report, error: "That season hasn't ended yet." };
  }

  const targets = await loadSeasonPayoutTargets(seasonId);
  const totalPoints = targets.reduce((sum, t) => sum + t.points, 0);
  report.totalPoints = totalPoints;
  if (totalPoints <= 0) {
    return { ...report, error: "No eligible players (need season points and a bonded wallet)." };
  }

  const lines: PayoutLine[] = targets
    .map((t) => ({ name: t.name, wallet: t.wallet, points: t.points, amount: Math.floor((t.points / totalPoints) * pool) }))
    .filter((l) => l.amount >= 1);
  const totalToPay = lines.reduce((sum, l) => sum + l.amount, 0);
  report.lines = lines;
  report.eligible = lines.length;
  report.totalToPay = totalToPay;

  const house = getHouseWalletAddress();
  const houseBalance = house ? await getHouseBalanceUi(house, "base", resolveMint()) : null;
  report.houseBalance = houseBalance;
  report.solvent = houseBalance != null && totalToPay <= houseBalance;

  const summary = await getSeasonPayoutSummary(seasonId);
  report.alreadyPaid = summary.paid;

  if (!execute) return report; // dry-run preview only

  // ---- Execute guards ----
  if (!report.withdrawEnabled) return { ...report, error: "Withdrawals are disabled (no HOUSE_WALLET_SECRET)." };
  if (!report.solvent) {
    return { ...report, error: `House wallet can't cover ${totalToPay} $BASE (balance ${houseBalance ?? 0}).` };
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
