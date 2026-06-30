// Custodial casino balances + an idempotent on-chain ledger. Balances are kept
// in each currency's smallest integer units (lamports / token base units), so
// there's no floating-point money math. The ledger's UNIQUE signature column is
// what makes deposit credits and withdrawals safe to retry without double-spend.

import { getPool } from "./pool.js";

export type CasinoLedgerKind = "deposit" | "withdraw" | "bet" | "payout";

/** All of a wallet's balances, base units keyed by currency id. */
export async function getCasinoBalances(wallet: string): Promise<Record<string, number>> {
  const db = getPool();
  if (!db) return {};
  const result = await db.query<{ currency_id: string; amount: string }>(
    `SELECT currency_id, amount FROM casino_balances WHERE wallet_address = $1`,
    [wallet],
  );
  const out: Record<string, number> = {};
  for (const row of result.rows) out[row.currency_id] = Number(row.amount);
  return out;
}

export async function getCasinoBalance(wallet: string, currencyId: string): Promise<number> {
  const db = getPool();
  if (!db) return 0;
  const result = await db.query<{ amount: string }>(
    `SELECT amount FROM casino_balances WHERE wallet_address = $1 AND currency_id = $2`,
    [wallet, currencyId],
  );
  return result.rowCount ? Number(result.rows[0].amount) : 0;
}

/**
 * Add `delta` base units to a balance (negative to subtract). When
 * `allowNegative` is false the update is refused if it would go below zero —
 * the returned `balance` is null in that case. Atomic via a single guarded
 * upsert so concurrent bets can't drive a balance negative.
 */
export async function adjustCasinoBalance(
  wallet: string,
  currencyId: string,
  delta: number,
  allowNegative = false,
): Promise<{ ok: boolean; balance: number | null }> {
  const db = getPool();
  if (!db) return { ok: false, balance: null };

  if (delta >= 0) {
    const result = await db.query<{ amount: string }>(
      `INSERT INTO casino_balances (wallet_address, currency_id, amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address, currency_id)
       DO UPDATE SET amount = casino_balances.amount + EXCLUDED.amount, updated_at = NOW()
       RETURNING amount`,
      [wallet, currencyId, delta],
    );
    return { ok: true, balance: Number(result.rows[0].amount) };
  }

  // Debit: refuse if it would underflow (unless explicitly allowed).
  const guard = allowNegative ? "" : "AND amount + $3 >= 0";
  const result = await db.query<{ amount: string }>(
    `UPDATE casino_balances
     SET amount = amount + $3, updated_at = NOW()
     WHERE wallet_address = $1 AND currency_id = $2 ${guard}
     RETURNING amount`,
    [wallet, currencyId, delta],
  );
  if (result.rowCount === 0) return { ok: false, balance: null };
  return { ok: true, balance: Number(result.rows[0].amount) };
}

/**
 * Credit a verified deposit exactly once. Records the tx signature in the
 * ledger first; if it was already recorded, returns credited:false and does not
 * touch the balance.
 */
export async function creditDepositOnce(
  wallet: string,
  currencyId: string,
  amount: number,
  signature: string,
): Promise<{ credited: boolean; balance: number }> {
  const db = getPool();
  if (!db) return { credited: false, balance: 0 };

  const inserted = await db.query(
    `INSERT INTO casino_ledger (signature, wallet_address, currency_id, kind, amount)
     VALUES ($1, $2, $3, 'deposit', $4)
     ON CONFLICT (signature) DO NOTHING`,
    [signature, wallet, currencyId, amount],
  );
  if (inserted.rowCount === 0) {
    return { credited: false, balance: await getCasinoBalance(wallet, currencyId) };
  }
  const adjusted = await adjustCasinoBalance(wallet, currencyId, amount);
  return { credited: true, balance: adjusted.balance ?? 0 };
}

/** UTC day index used for the daily bonus. */
export function todayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

/** Daily-bonus status for a wallet: can they claim today, and their streak. */
export async function getDailyStatus(wallet: string): Promise<{ available: boolean; streak: number }> {
  const db = getPool();
  if (!db) return { available: false, streak: 0 };
  const result = await db.query<{ day: string; streak: number }>(
    `SELECT day, streak FROM casino_daily WHERE wallet_address = $1`,
    [wallet],
  );
  const today = todayIndex();
  if (result.rowCount === 0) return { available: true, streak: 0 };
  const day = Number(result.rows[0].day);
  const streak = Number(result.rows[0].streak);
  // Available if not claimed today. If the last claim was before yesterday the
  // streak has lapsed, so show 0 (the claim will restart it at 1).
  const available = day < today;
  const shownStreak = day === today ? streak : day === today - 1 ? streak : 0;
  return { available, streak: shownStreak };
}

/**
 * Claim the daily bonus exactly once per UTC day. Returns the new streak, or
 * null if already claimed today. Atomic via a guarded upsert.
 */
export async function claimDaily(wallet: string): Promise<{ streak: number } | null> {
  const db = getPool();
  if (!db) return null;
  const today = todayIndex();
  const result = await db.query<{ streak: number }>(
    `INSERT INTO casino_daily (wallet_address, day, streak)
     VALUES ($1, $2, 1)
     ON CONFLICT (wallet_address) DO UPDATE SET
       day = EXCLUDED.day,
       streak = CASE WHEN casino_daily.day = EXCLUDED.day - 1 THEN casino_daily.streak + 1 ELSE 1 END
     WHERE casino_daily.day < EXCLUDED.day
     RETURNING streak`,
    [wallet, today],
  );
  return result.rowCount ? { streak: Number(result.rows[0].streak) } : null;
}

/** Record a completed withdrawal payout in the ledger (balance already debited). */
export async function recordWithdrawal(
  wallet: string,
  currencyId: string,
  amount: number,
  signature: string,
): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO casino_ledger (signature, wallet_address, currency_id, kind, amount)
     VALUES ($1, $2, $3, 'withdraw', $4)
     ON CONFLICT (signature) DO NOTHING`,
    [signature, wallet, currencyId, amount],
  );
}
