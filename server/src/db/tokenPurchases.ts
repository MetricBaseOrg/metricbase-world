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