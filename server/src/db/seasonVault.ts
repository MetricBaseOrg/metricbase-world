// Season deposit vault — the $BASE a player has staked toward a season's prize
// pool. See shared/src/season.ts for the economics and docs/base-demand.md for
// why the stake exists at all.
//
// The balance is DERIVED from two ledgers (deposits, withdrawals) rather than
// stored as a mutable number. Money that is only a number in a row can drift
// away from what actually moved on-chain; money that is a sum of recorded
// movements cannot. `characters.season_vault_units` caches the result for the
// hot points-award path, but it is a cache — these ledgers decide.
//
// The vault is a treasury LIABILITY: every unit in it is owed back to the
// player who deposited it, minus the withdrawal fee. Nothing here mints $BASE
// and nothing converts gold into it.

import { getPool } from "./pool.js";

export interface VaultBalance {
  /** Everything deposited and not yet withdrawn. */
  balance: number;
  /** Deposited during the still-running season — not withdrawable yet. */
  locked: number;
  /** balance − locked. */
  withdrawable: number;
  /** Lifetime withdrawal fees paid. */
  feesPaid: number;
}

const EMPTY: VaultBalance = { balance: 0, locked: 0, withdrawable: 0, feesPaid: 0 };

/**
 * A player's vault, derived from the ledgers.
 *
 * `currentSeasonId` is the season whose deposits are still locked. Deposits
 * carry the season they were made in, so a past season's deposits unlock
 * automatically when the season number rolls — no sweep, no scheduled job.
 *
 * Pending withdrawals count as spent: a row exists from the moment it is
 * reserved, so a second request can't be sized against money already on its
 * way out.
 */
export async function loadVault(playerName: string, currentSeasonId: string): Promise<VaultBalance> {
  const pool = getPool();
  if (!pool) return EMPTY;
  try {
    const res = await pool.query<{
      deposited: string;
      locked: string;
      withdrawn: string;
      fees: string;
    }>(
      `SELECT
         COALESCE((SELECT SUM(amount) FROM season_vault_deposit WHERE player_name = $1), 0)::text AS deposited,
         COALESCE((SELECT SUM(amount) FROM season_vault_deposit
                    WHERE player_name = $1 AND season_id = $2), 0)::text AS locked,
         COALESCE((SELECT SUM(gross) FROM season_vault_withdrawal
                    WHERE player_name = $1 AND status <> 'failed'), 0)::text AS withdrawn,
         COALESCE((SELECT SUM(fee) FROM season_vault_withdrawal
                    WHERE player_name = $1 AND status = 'sent'), 0)::text AS fees`,
      [playerName, currentSeasonId],
    );
    const row = res.rows[0];
    if (!row) return EMPTY;
    const balance = Math.max(0, Number(row.deposited) - Number(row.withdrawn));
    // A past withdrawal can leave less in the vault than this season's deposits,
    // so the lock is capped at the balance — never report locked > balance.
    const locked = Math.min(balance, Number(row.locked));
    return {
      balance,
      locked,
      withdrawable: Math.max(0, balance - locked),
      feesPaid: Number(row.fees),
    };
  } catch (error) {
    console.warn("[season] vault load failed:", error);
    // Fail CLOSED: a zero balance blocks withdrawals rather than authorising one
    // against a balance we couldn't read.
    return EMPTY;
  }
}

/** Mirror the derived balance onto the character row for the award hot path. */
export async function syncVaultCache(playerName: string, balance: number): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("UPDATE characters SET season_vault_units = $2 WHERE name = $1", [
      playerName,
      Math.max(0, Math.floor(balance)),
    ]);
  } catch (error) {
    console.warn("[season] vault cache sync failed:", error);
  }
}

/**
 * Record a verified deposit. Returns false when the signature was already
 * credited — the idempotent "nothing happened" case, never an error.
 *
 * The caller MUST have verified the on-chain transfer first; this only records,
 * and it records the amount that ACTUALLY moved, not the amount that was asked
 * for.
 */
export async function recordVaultDeposit(
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
      `INSERT INTO season_vault_deposit (season_id, player_name, wallet, amount, signature)
       VALUES ($1, $2, $3, $4::bigint, $5)
       ON CONFLICT (signature) DO NOTHING
       RETURNING id`,
      [seasonId, playerName, wallet, Math.floor(amount), signature],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[season] record deposit failed:", error);
    return false;
  }
}

/** Whether this transfer was already credited to a vault (replay guard). */
export async function isDepositSignatureUsed(signature: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query("SELECT 1 FROM season_vault_deposit WHERE signature = $1 LIMIT 1", [signature]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[season] deposit signature check failed:", error);
    return true; // fail closed — better to reject a good deposit than credit one twice
  }
}

/**
 * Reserve a withdrawal. The row exists before any transfer is attempted, so it
 * immediately reduces the derived balance and a concurrent request can't be
 * sized against the same money.
 *
 * Returns the row id to stamp, or null when the pool is unavailable.
 */
export async function reserveWithdrawal(
  playerName: string,
  wallet: string,
  gross: number,
  fee: number,
  net: number,
): Promise<number | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO season_vault_withdrawal (player_name, wallet, gross, fee, net)
       VALUES ($1, $2, $3::bigint, $4::bigint, $5::bigint) RETURNING id`,
      [playerName, wallet, Math.floor(gross), Math.floor(fee), Math.floor(net)],
    );
    return res.rowCount ? Number(res.rows[0].id) : null;
  } catch (error) {
    console.warn("[season] reserve withdrawal failed:", error);
    return null;
  }
}

/** Stamp a sent withdrawal with its confirmed signature. */
export async function finalizeWithdrawal(id: number, signature: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      "UPDATE season_vault_withdrawal SET status = 'sent', signature = $2 WHERE id = $1",
      [id, signature],
    );
  } catch (error) {
    console.warn("[season] finalize withdrawal failed:", error);
  }
}

/**
 * Mark a reservation failed, returning the money to the player's balance.
 *
 * Only ever call this when the transfer definitively did NOT happen. If we
 * can't tell — an RPC timeout after submitting, say — the row must stay
 * `pending`, which keeps the money out of the balance until a human checks the
 * chain. Releasing an ambiguous reservation is how you pay twice.
 */
export async function failWithdrawal(id: number): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      "UPDATE season_vault_withdrawal SET status = 'failed' WHERE id = $1 AND status = 'pending'",
      [id],
    );
  } catch (error) {
    console.warn("[season] fail withdrawal failed:", error);
  }
}

/** Withdrawals reserved but never resolved — a run died mid-transfer. These
 *  need a human to check the chain before anything is re-sent. */
export async function listPendingWithdrawals(): Promise<
  { id: number; playerName: string; wallet: string; net: number }[]
> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ id: string; player_name: string; wallet: string; net: string }>(
      `SELECT id, player_name, wallet, net FROM season_vault_withdrawal
       WHERE status = 'pending' AND created_at < NOW() - INTERVAL '5 minutes'`,
    );
    return res.rows.map((r) => ({
      id: Number(r.id),
      playerName: r.player_name,
      wallet: r.wallet,
      net: Number(r.net),
    }));
  } catch (error) {
    console.warn("[season] pending withdrawal scan failed:", error);
    return [];
  }
}

/** Everyone whose vault balance meets the entry floor — the season's split. */
export async function loadSeasonEntrants(floor: number): Promise<{ playerName: string; balance: number }[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ player_name: string; balance: string }>(
      `SELECT d.player_name,
              (d.deposited - COALESCE(w.withdrawn, 0))::text AS balance
       FROM (SELECT player_name, SUM(amount) AS deposited
               FROM season_vault_deposit GROUP BY player_name) d
       LEFT JOIN (SELECT player_name, SUM(gross) AS withdrawn
                    FROM season_vault_withdrawal WHERE status <> 'failed'
                   GROUP BY player_name) w ON w.player_name = d.player_name
       WHERE (d.deposited - COALESCE(w.withdrawn, 0)) >= $1::bigint`,
      [Math.floor(floor)],
    );
    return res.rows.map((r) => ({ playerName: r.player_name, balance: Number(r.balance) }));
  } catch (error) {
    console.warn("[season] entrant load failed:", error);
    return [];
  }
}

/** Total $BASE held across all vaults — the open treasury liability. */
export async function sumVaultBalances(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ total: string }>(
      `SELECT (
         COALESCE((SELECT SUM(amount) FROM season_vault_deposit), 0)
         - COALESCE((SELECT SUM(gross) FROM season_vault_withdrawal WHERE status <> 'failed'), 0)
       )::text AS total`,
    );
    return res.rowCount ? Math.max(0, Number(res.rows[0].total)) : 0;
  } catch (error) {
    console.warn("[season] vault sum failed:", error);
    return 0;
  }
}

/** How many players are in the prize race. */
export async function countVaultEntrants(floor: number): Promise<number> {
  return (await loadSeasonEntrants(floor)).length;
}
