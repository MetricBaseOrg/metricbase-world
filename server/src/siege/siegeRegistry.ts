import { getPool } from "../db/pool.js";

// The reigning Sovereign guild id (winner of the last siege), cached in-memory
// and persisted to the single-row siege_state table.
let sovereignGuildId: string | null = null;

export async function initSiegeRegistry(): Promise<void> {
  sovereignGuildId = null;
  const pool = getPool();
  if (!pool) return;
  try {
    const res = await pool.query<{ sovereign_guild_id: string | null }>(
      "SELECT sovereign_guild_id FROM siege_state WHERE id = 'global'",
    );
    sovereignGuildId = res.rows[0]?.sovereign_guild_id ?? null;
  } catch (error) {
    console.warn("[siege] load failed:", error);
  }
}

export function getSovereign(): string | null {
  return sovereignGuildId;
}

export function setSovereign(guildId: string): void {
  sovereignGuildId = guildId;
  const pool = getPool();
  if (!pool) return;
  void pool
    .query(
      `INSERT INTO siege_state (id, sovereign_guild_id, won_at)
       VALUES ('global', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET sovereign_guild_id = EXCLUDED.sovereign_guild_id, won_at = NOW()`,
      [guildId],
    )
    .catch((error) => console.warn("[siege] save failed:", error));
}

/** If the reigning Sovereign guild no longer exists, clear it. */
export function clearSovereignIfMissing(exists: (id: string) => boolean): void {
  if (sovereignGuildId && !exists(sovereignGuildId)) {
    sovereignGuildId = null;
  }
}
