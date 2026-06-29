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
