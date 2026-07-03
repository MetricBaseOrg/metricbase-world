import { getPool } from "./pool.js";

export interface StoredListing {
  id: string;
  sellerName: string;
  assetId: string;
  qty: number;
  price: number;
}

export async function loadAssetListings(): Promise<StoredListing[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ id: string; seller_name: string; asset_id: string; qty: number; price: number }>(
      "SELECT id, seller_name, asset_id, qty, price FROM asset_listings ORDER BY created_at",
    );
    return res.rows.map((r) => ({ id: r.id, sellerName: r.seller_name, assetId: r.asset_id, qty: r.qty, price: r.price }));
  } catch (error) {
    console.warn("[assetMarket] load failed:", error);
    return [];
  }
}

export async function saveListing(l: StoredListing): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO asset_listings (id, seller_name, asset_id, qty, price) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET qty = EXCLUDED.qty, price = EXCLUDED.price`,
      [l.id, l.sellerName, l.assetId, l.qty, l.price],
    );
  } catch (error) {
    console.warn("[assetMarket] save failed:", error);
  }
}

export async function deleteListing(id: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM asset_listings WHERE id = $1", [id]);
  } catch (error) {
    console.warn("[assetMarket] delete failed:", error);
  }
}

export async function loadPendingGold(): Promise<{ playerName: string; amount: number }[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ player_name: string; amount: number }>(
      "SELECT player_name, amount FROM pending_gold WHERE amount > 0",
    );
    return res.rows.map((r) => ({ playerName: r.player_name, amount: r.amount }));
  } catch (error) {
    console.warn("[assetMarket] load pending failed:", error);
    return [];
  }
}

export async function savePendingGold(playerName: string, amount: number): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    if (amount <= 0) {
      await pool.query("DELETE FROM pending_gold WHERE player_name = $1", [playerName]);
      return;
    }
    await pool.query(
      `INSERT INTO pending_gold (player_name, amount) VALUES ($1,$2)
       ON CONFLICT (player_name) DO UPDATE SET amount = EXCLUDED.amount`,
      [playerName, amount],
    );
  } catch (error) {
    console.warn("[assetMarket] save pending failed:", error);
  }
}
