import { getPool } from "./pool.js";

const redeemedInMemory = new Set<string>();

export async function isPurchaseRedeemed(signature: string): Promise<boolean> {
  if (redeemedInMemory.has(signature)) {
    return true;
  }

  const db = getPool();
  if (!db) {
    return false;
  }

  const result = await db.query<{ signature: string }>(
    `SELECT signature FROM token_purchases WHERE signature = $1`,
    [signature],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function recordTokenPurchase(
  signature: string,
  wallet: string,
  productId: string,
  tokenAmount: number,
): Promise<void> {
  redeemedInMemory.add(signature);

  const db = getPool();
  if (!db) return;

  await db.query(
    `INSERT INTO token_purchases (signature, wallet, product_id, token_amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (signature) DO NOTHING`,
    [signature, wallet, productId, tokenAmount],
  );
}

export interface GoldCreditResult {
  /** True when THIS call credited the gold; false when the signature was already redeemed. */
  credited: boolean;
  /** Resulting DB gold balance, or null when credited via pending_gold / no DB. */
  newGold: number | null;
  /** True when the character row didn't exist yet, so gold was queued in pending_gold. */
  viaPending: boolean;
}

/**
 * Record a token purchase AND credit the gold to the character in a single DB
 * transaction, keyed on the transaction signature. This guarantees:
 *  - idempotent: a repeated signature never double-credits (ON CONFLICT).
 *  - crash-safe: the purchase row and the gold update commit together or not at
 *    all — a crash can never mark a payment redeemed without crediting it.
 *  - durable: if the character row isn't persisted yet, the gold is queued in
 *    pending_gold (collected on next join) rather than lost.
 * The signature is only marked redeemed in memory AFTER a successful commit, so
 * a failed transaction leaves the payment fully retryable.
 */
export async function creditGoldForPurchase(
  signature: string,
  wallet: string,
  productId: string,
  tokenAmount: number,
  characterName: string,
  goldAmount: number,
): Promise<GoldCreditResult> {
  const db = getPool();
  if (!db) {
    // No database (dev): caller credits the in-memory session directly.
    redeemedInMemory.add(signature);
    return { credited: true, newGold: null, viaPending: false };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO token_purchases (signature, wallet, product_id, token_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (signature) DO NOTHING`,
      [signature, wallet, productId, tokenAmount],
    );
    if ((ins.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      redeemedInMemory.add(signature);
      return { credited: false, newGold: null, viaPending: false };
    }

    const upd = await client.query<{ gold: number }>(
      `UPDATE characters SET gold = COALESCE(gold, 0) + $2, updated_at = NOW()
       WHERE name = $1 RETURNING gold`,
      [characterName, goldAmount],
    );

    let newGold: number | null = null;
    let viaPending = false;
    if ((upd.rowCount ?? 0) === 0) {
      // Character not persisted yet — queue the gold so it's collected on join.
      await client.query(
        `INSERT INTO pending_gold (player_name, amount) VALUES ($1, $2)
         ON CONFLICT (player_name) DO UPDATE SET amount = pending_gold.amount + EXCLUDED.amount`,
        [characterName, goldAmount],
      );
      viaPending = true;
    } else {
      newGold = Number(upd.rows[0].gold);
    }

    await client.query("COMMIT");
    redeemedInMemory.add(signature);
    return { credited: true, newGold, viaPending };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}