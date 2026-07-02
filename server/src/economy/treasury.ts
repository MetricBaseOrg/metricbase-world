import { getPool } from "../db/pool.js";

/**
 * Credit in-game gold to the treasury under a named source (e.g. "zone_slot").
 * The gold has already been deducted from a player; this records it as treasury
 * income so it stays accountable rather than being silently burned.
 */
export async function creditTreasuryGold(source: string, gold: number): Promise<void> {
  const amount = Math.floor(gold);
  if (amount <= 0) return;
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO treasury_gold (source, gold, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (source)
       DO UPDATE SET gold = treasury_gold.gold + EXCLUDED.gold, updated_at = NOW()`,
      [source, amount],
    );
  } catch (error) {
    console.warn("[treasury] credit failed:", error);
  }
}
