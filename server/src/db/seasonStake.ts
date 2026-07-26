// Season entry stakes — the refundable $BASE deposit that puts a player into a
// season's prize-pool split. See shared/src/season.ts for the economics and
// docs/base-demand.md for why this exists.
//
// The stake is a LIABILITY, not revenue: it sits in the treasury for the length
// of the season and is returned at payout. Everything here is written so the
// refund leg can always be reconstructed from the table alone — the refund goes
// back to the wallet that paid, recorded at stake time, never to a wallet the
// player nominated later.

import { getPool } from "./pool.js";

export interface SeasonStakeRow {
  playerName: string;
  wallet: string;
  amount: number;
  refunded: boolean;
}

/**
 * Record a verified stake. Returns false when this player already staked into
 * the season, or when the signature was already used — both are the idempotent
 * "nothing happened" case, never an error.
 *
 * The caller MUST have verified the on-chain transfer first; this only records.
 */
export async function recordSeasonStake(
  seasonId: string,
  playerName: string,
  wallet: string,
  amount: number,
  signature: string,
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      `INSERT INTO season_stake (season_id, player_name, wallet, amount, signature)
       VALUES ($1, $2, $3, $4::bigint, $5)
       ON CONFLICT (season_id, player_name) DO NOTHING
       RETURNING player_name`,
      [seasonId, playerName, wallet, amount, signature],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    // A unique violation on the signature index lands here: the transfer was
    // already spent on someone's entry. Treat as "not recorded", never a crash.
    console.warn("[season] record stake failed:", error);
    return false;
  }
}

/** Whether this transfer has already been spent on an entry (replay guard). */
export async function isStakeSignatureUsed(signature: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query("SELECT 1 FROM season_stake WHERE signature = $1 LIMIT 1", [signature]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[season] stake signature check failed:", error);
    return true; // fail closed — better to reject a good entry than to double-spend one
  }
}

/** Whether this player is in the season's prize race. */
export async function hasStakedIn(seasonId: string, playerName: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      "SELECT 1 FROM season_stake WHERE season_id = $1 AND player_name = $2 LIMIT 1",
      [seasonId, playerName],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[season] staked check failed:", error);
    return false;
  }
}

/** How many players have staked into a season. */
export async function countSeasonEntrants(seasonId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM season_stake WHERE season_id = $1",
      [seasonId],
    );
    return res.rowCount ? Number(res.rows[0].n) : 0;
  } catch (error) {
    console.warn("[season] entrant count failed:", error);
    return 0;
  }
}

/** Every stake in a season — the payout's source of truth for both who is in
 * the split and who is owed their deposit back. */
export async function loadSeasonStakes(seasonId: string): Promise<SeasonStakeRow[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      player_name: string;
      wallet: string;
      amount: string;
      refunded_at: Date | null;
    }>(
      "SELECT player_name, wallet, amount, refunded_at FROM season_stake WHERE season_id = $1",
      [seasonId],
    );
    return res.rows.map((r) => ({
      playerName: r.player_name,
      wallet: r.wallet,
      amount: Number(r.amount),
      refunded: r.refunded_at != null,
    }));
  } catch (error) {
    console.warn("[season] load stakes failed:", error);
    return [];
  }
}

/** Total $BASE currently held as stakes for a season (the open liability). */
export async function sumSeasonStakes(seasonId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(amount), 0)::text AS total FROM season_stake WHERE season_id = $1",
      [seasonId],
    );
    return res.rowCount ? Number(res.rows[0].total) : 0;
  } catch (error) {
    console.warn("[season] stake sum failed:", error);
    return 0;
  }
}

// The refund is an irreversible on-chain send, so it uses the same
// claim → send → stamp (or release) dance as season_payout: `refunded_at` is
// claimed atomically BEFORE the transfer, and only a run that actually won the
// claim may send. A crash between claim and stamp leaves a row with
// refunded_at set and refund_signature NULL — deliberately "stuck" rather than
// re-sent, since paying twice is worse than paying late. `listUnstampedRefunds`
// surfaces those for a human.

/** Atomically claim the right to refund this stake. Only the caller that gets
 * `true` may send; everyone else must skip. */
export async function claimStakeRefund(seasonId: string, playerName: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      `UPDATE season_stake SET refunded_at = NOW()
       WHERE season_id = $1 AND player_name = $2 AND refunded_at IS NULL
       RETURNING player_name`,
      [seasonId, playerName],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[season] claim refund failed:", error);
    return false;
  }
}

/** Stamp a claimed refund with its confirmed tx signature. */
export async function finalizeStakeRefund(
  seasonId: string,
  playerName: string,
  signature: string,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      "UPDATE season_stake SET refund_signature = $3 WHERE season_id = $1 AND player_name = $2",
      [seasonId, playerName, signature],
    );
  } catch (error) {
    console.warn("[season] finalize refund failed:", error);
  }
}

/** Release an unsent refund claim (the transfer failed) so a retry can take it. */
export async function releaseStakeRefund(seasonId: string, playerName: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `UPDATE season_stake SET refunded_at = NULL
       WHERE season_id = $1 AND player_name = $2 AND refund_signature IS NULL`,
      [seasonId, playerName],
    );
  } catch (error) {
    console.warn("[season] release refund failed:", error);
  }
}

/** Refunds marked sent but never stamped — i.e. a run died mid-transfer. These
 * need a human to check the chain before anything is re-sent. */
export async function listUnstampedRefunds(seasonId: string): Promise<string[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ player_name: string }>(
      `SELECT player_name FROM season_stake
       WHERE season_id = $1 AND refunded_at IS NOT NULL AND refund_signature IS NULL`,
      [seasonId],
    );
    return res.rows.map((r) => r.player_name);
  } catch (error) {
    console.warn("[season] unstamped refund scan failed:", error);
    return [];
  }
}
