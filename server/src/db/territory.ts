import { getPool } from "./pool.js";

export interface StoredTerritory {
  pointId: string;
  zoneId: string;
  guildId: string;
}

export async function loadTerritories(): Promise<StoredTerritory[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ point_id: string; zone_id: string; guild_id: string }>(
      "SELECT point_id, zone_id, guild_id FROM territories",
    );
    return res.rows.map((row) => ({
      pointId: row.point_id,
      zoneId: row.zone_id,
      guildId: row.guild_id,
    }));
  } catch (error) {
    console.warn("[territory] load failed:", error);
    return [];
  }
}

export async function saveTerritory(t: StoredTerritory): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO territories (point_id, zone_id, guild_id, captured_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (point_id)
       DO UPDATE SET zone_id = EXCLUDED.zone_id, guild_id = EXCLUDED.guild_id, captured_at = NOW()`,
      [t.pointId, t.zoneId, t.guildId],
    );
  } catch (error) {
    console.warn("[territory] save failed:", error);
  }
}

export async function deleteTerritory(pointId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM territories WHERE point_id = $1", [pointId]);
  } catch (error) {
    console.warn("[territory] delete failed:", error);
  }
}
