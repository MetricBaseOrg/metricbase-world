import { getPool } from "./pool.js";

export interface StoredGuild {
  id: string;
  name: string;
  tag: string;
  leaderName: string;
  members: string[];
}

function normalizeMembers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && entry) seen.add(entry);
  }
  return [...seen];
}

export async function loadGuilds(): Promise<StoredGuild[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      id: string;
      name: string;
      tag: string;
      leader_name: string;
      members: unknown;
    }>("SELECT id, name, tag, leader_name, members FROM guilds");
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      tag: row.tag,
      leaderName: row.leader_name,
      members: normalizeMembers(row.members),
    }));
  } catch (error) {
    console.warn("[guilds] load failed:", error);
    return [];
  }
}

export async function saveGuild(guild: StoredGuild): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO guilds (id, name, tag, leader_name, members)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name, tag = EXCLUDED.tag,
                     leader_name = EXCLUDED.leader_name, members = EXCLUDED.members`,
      [guild.id, guild.name, guild.tag, guild.leaderName, JSON.stringify(guild.members)],
    );
  } catch (error) {
    console.warn("[guilds] save failed:", error);
  }
}

export async function deleteGuild(id: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM guilds WHERE id = $1", [id]);
  } catch (error) {
    console.warn("[guilds] delete failed:", error);
  }
}
