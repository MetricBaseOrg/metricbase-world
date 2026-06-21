import type { SaturationState } from "@metricbase/shared";
import { getPool } from "./pool.js";

export async function loadSellPressure(): Promise<Map<string, SaturationState>> {
  const map = new Map<string, SaturationState>();
  const pool = getPool();
  if (!pool) return map;
  try {
    const res = await pool.query<{ item_id: string; value: string; updated_at: Date }>(
      "SELECT item_id, value, updated_at FROM vendor_sell_pressure",
    );
    for (const row of res.rows) {
      map.set(row.item_id, {
        value: Number(row.value),
        updatedAt: new Date(row.updated_at).getTime(),
      });
    }
  } catch (error) {
    console.warn("[sellPressure] load failed:", error);
  }
  return map;
}

export async function saveSellPressure(itemId: string, state: SaturationState): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO vendor_sell_pressure (item_id, value, updated_at)
       VALUES ($1, $2, to_timestamp($3 / 1000.0))
       ON CONFLICT (item_id)
       DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [itemId, state.value, state.updatedAt],
    );
  } catch (error) {
    console.warn("[sellPressure] save failed:", error);
  }
}
