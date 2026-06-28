import { getPool } from "./pool.js";

export interface StoredGuild {
  id: string;
  name: string;
  tag: string;
  leaderName: string;
  members: string[];
  /** Officer names (subset of members). */
  officers: string[];
  /** Shared bank balance (gold). */
  bank: number;
  /** Income tax rate (0–GUILD_MAX_TAX_RATE). */
  taxRate: number;
  /** Guild ids this guild is at war with. */
  wars: string[];
}

function normalizeNameList(value: unknown): string[] {
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
      officers: unknown;
      bank: number | null;
      tax_rate: number | null;
      wars: unknown;
    }>("SELECT id, name, tag, leader_name, members, officers, bank, tax_rate, wars FROM guilds");
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      tag: row.tag,
      leaderName: row.leader_name,
      members: normalizeNameList(row.members),
      officers: normalizeNameList(row.officers),
      bank: Math.max(0, Math.floor(row.bank ?? 0)),
      taxRate: typeof row.tax_rate === "number" && row.tax_rate >= 0 ? row.tax_rate : 0,
      wars: normalizeNameList(row.wars),
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
      `INSERT INTO guilds (id, name, tag, leader_name, members, officers, bank, tax_rate, wars)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name, tag = EXCLUDED.tag,
                     leader_name = EXCLUDED.leader_name, members = EXCLUDED.members,
                     officers = EXCLUDED.officers, bank = EXCLUDED.bank,
                     tax_rate = EXCLUDED.tax_rate, wars = EXCLUDED.wars`,
      [
        guild.id,
        guild.name,
        guild.tag,
        guild.leaderName,
        JSON.stringify(guild.members),
        JSON.stringify(guild.officers),
        guild.bank,
        guild.taxRate,
        JSON.stringify(guild.wars),
      ],
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
