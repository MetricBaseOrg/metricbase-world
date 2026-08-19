// Cross-platform tracking. See schema.sql `x_crossposts`. TikTok is judged on
// profile visits, never views — the whole point of tracking it.

import { getPool } from "./pool.js";

export type Platform = "x" | "tiktok" | "instagram";
export const PLATFORMS: Platform[] = ["x", "tiktok", "instagram"];

export interface XCrosspost {
  id: number;
  postId: number | null;
  platform: Platform;
  url: string;
  publishedAt: string | null;
  views: number | null;
  profileVisits: number | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface XCrosspostInput {
  postId?: number | null;
  platform?: Platform;
  url?: string;
  publishedAt?: string | null;
  views?: number | null;
  profileVisits?: number | null;
  note?: string;
}

function toDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function mapRow(r: Record<string, unknown>): XCrosspost {
  return {
    id: Number(r.id),
    postId: r.post_id == null ? null : Number(r.post_id),
    platform: ((r.platform as string) ?? "x") as Platform,
    url: (r.url as string) ?? "",
    publishedAt: toDate(r.published_at),
    views: r.views == null ? null : Number(r.views),
    profileVisits: r.profile_visits == null ? null : Number(r.profile_visits),
    note: (r.note as string) ?? "",
    createdAt: new Date(r.created_at as string).getTime(),
    updatedAt: new Date(r.updated_at as string).getTime(),
  };
}

const COLUMNS =
  "id, post_id, platform, url, published_at, views, profile_visits, note, created_at, updated_at";

export async function listCrossposts(): Promise<XCrosspost[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT ${COLUMNS} FROM x_crossposts ORDER BY published_at DESC NULLS LAST, id DESC`,
  );
  return res.rows.map(mapRow);
}

export async function getCrosspost(id: number): Promise<XCrosspost | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(`SELECT ${COLUMNS} FROM x_crossposts WHERE id = $1`, [id]);
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function createCrosspost(input: XCrosspostInput): Promise<XCrosspost> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const res = await pool.query(
    `INSERT INTO x_crossposts (post_id, platform, url, published_at, views, profile_visits, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      input.postId ?? null,
      input.platform ?? "tiktok",
      input.url ?? "",
      input.publishedAt ?? null,
      input.views ?? null,
      input.profileVisits ?? null,
      input.note ?? "",
    ],
  );
  const created = await getCrosspost(Number(res.rows[0].id));
  if (!created) throw new Error("Crosspost vanished after insert.");
  return created;
}

export async function updateCrosspost(id: number, input: XCrosspostInput): Promise<XCrosspost | null> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const columns: Record<keyof XCrosspostInput, string> = {
    postId: "post_id",
    platform: "platform",
    url: "url",
    publishedAt: "published_at",
    views: "views",
    profileVisits: "profile_visits",
    note: "note",
  };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(columns) as [keyof XCrosspostInput, string][]) {
    if (!(key in input)) continue;
    values.push(input[key] ?? null);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) return getCrosspost(id);
  sets.push("updated_at = NOW()");
  const res = await pool.query(
    `UPDATE x_crossposts SET ${sets.join(", ")} WHERE id = $1 RETURNING id`,
    values,
  );
  if (!res.rows[0]) return null;
  return getCrosspost(id);
}

export async function deleteCrosspost(id: number): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("DELETE FROM x_crossposts WHERE id = $1", [id]);
}

export interface CrosspostStats {
  /** Total TikTok profile visits recorded — plan metric 7, the number TikTok is
   *  judged on. */
  tiktokProfileVisits: number;
  tiktokViews: number;
  tiktokPosts: number;
  igPosts: number;
}

export async function crosspostStats(): Promise<CrosspostStats> {
  const rows = await listCrossposts();
  const tik = rows.filter((r) => r.platform === "tiktok");
  return {
    tiktokProfileVisits: tik.reduce((a, r) => a + (r.profileVisits ?? 0), 0),
    tiktokViews: tik.reduce((a, r) => a + (r.views ?? 0), 0),
    tiktokPosts: tik.length,
    igPosts: rows.filter((r) => r.platform === "instagram").length,
  };
}
