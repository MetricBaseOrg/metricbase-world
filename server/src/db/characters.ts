import { getPool } from "./pool.js";

export interface CharacterRecord {
  name: string;
  zoneId: string;
  x: number;
  y: number;
  level: number;
}

export async function loadCharacter(name: string): Promise<CharacterRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<{
    name: string;
    zone_id: string;
    x: number;
    y: number;
    level: number;
  }>(
    `SELECT name, zone_id, x, y, level
     FROM characters
     WHERE name = $1`,
    [name],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    name: row.name,
    zoneId: row.zone_id,
    x: row.x,
    y: row.y,
    level: row.level,
  };
}

export async function saveCharacter(record: CharacterRecord): Promise<void> {
  const db = getPool();
  if (!db) return;

  await db.query(
    `INSERT INTO characters (name, zone_id, x, y, level, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (name)
     DO UPDATE SET
       zone_id = EXCLUDED.zone_id,
       x = EXCLUDED.x,
       y = EXCLUDED.y,
       level = EXCLUDED.level,
       updated_at = NOW()`,
    [record.name, record.zoneId, record.x, record.y, record.level],
  );
}