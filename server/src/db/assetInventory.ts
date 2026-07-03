import { getPool } from "./pool.js";

export interface StoredAssetQty {
  playerName: string;
  assetId: string;
  qty: number;
}

export async function loadAssetInventory(): Promise<StoredAssetQty[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ player_name: string; asset_id: string; qty: number }>(
      "SELECT player_name, asset_id, qty FROM asset_inventory WHERE qty > 0",
    );
    return res.rows.map((r) => ({ playerName: r.player_name, assetId: r.asset_id, qty: r.qty }));
  } catch (error) {
    console.warn("[assetInventory] load failed:", error);
    return [];
  }
}

export async function saveAssetQty(playerName: string, assetId: string, qty: number): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    if (qty <= 0) {
      await pool.query("DELETE FROM asset_inventory WHERE player_name = $1 AND asset_id = $2", [playerName, assetId]);
      return;
    }
    await pool.query(
      `INSERT INTO asset_inventory (player_name, asset_id, qty) VALUES ($1, $2, $3)
       ON CONFLICT (player_name, asset_id) DO UPDATE SET qty = EXCLUDED.qty`,
      [playerName, assetId, qty],
    );
  } catch (error) {
    console.warn("[assetInventory] save failed:", error);
  }
}
