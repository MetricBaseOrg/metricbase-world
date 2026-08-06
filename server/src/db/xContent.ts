// X growth content store. Neon is the source of truth (the planning markdown
// used to live in one machine's OneDrive folder, which meant the calendar was
// unreachable from anywhere the operator actually was).
//
// Metrics are hand-entered: X gives nothing away free beyond oEmbed, and the
// alternatives are a $200/mo API tier or a ToS-violating scraper.

import { getPool } from "./pool.js";

export type XPostStatus = "idea" | "drafted" | "scheduled" | "posted" | "skipped";
export type XSlotKind = "mon_economy" | "wed_build" | "fri_game" | "extra";

export const X_POST_STATUSES: XPostStatus[] = ["idea", "drafted", "scheduled", "posted", "skipped"];
export const X_SLOT_KINDS: XSlotKind[] = ["mon_economy", "wed_build", "fri_game", "extra"];

export interface XPostMetrics {
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  bookmarks: number;
  profileClicks: number;
  linkClicks: number;
  capturedAt: number;
}

export interface XPost {
  id: number;
  ref: string | null;
  slotDate: string | null; // YYYY-MM-DD
  slotKind: XSlotKind;
  status: XPostStatus;
  format: string | null;
  title: string;
  hook: string;
  body: string;
  imagePrompt: string | null;
  threadOf: number | null;
  tweetUrl: string | null;
  verifiedHandle: string | null;
  postedAt: number | null;
  sourceVersion: string | null;
  createdAt: number;
  updatedAt: number;
  metrics: XPostMetrics | null;
}

const POST_COLUMNS = `p.id, p.ref, p.slot_date, p.slot_kind, p.status, p.format, p.title, p.hook, p.body,
  p.image_prompt, p.thread_of, p.tweet_url, p.verified_handle, p.posted_at, p.source_version,
  p.created_at, p.updated_at,
  m.impressions, m.likes, m.replies, m.reposts, m.bookmarks, m.profile_clicks, m.link_clicks, m.captured_at`;

function toDateString(value: unknown): string | null {
  if (!value) return null;
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  // node-postgres parses DATE into a Date at LOCAL midnight, so toISOString()
  // rewinds it a day for anyone east of UTC — "5 Aug" came back as "4 Aug" on a
  // UTC+7 machine. Read the local calendar fields instead.
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mapPost(r: Record<string, unknown>): XPost {
  const hasMetrics = r.captured_at != null;
  return {
    id: Number(r.id),
    ref: (r.ref as string | null) ?? null,
    slotDate: toDateString(r.slot_date),
    slotKind: (r.slot_kind as XSlotKind) ?? "extra",
    status: (r.status as XPostStatus) ?? "idea",
    format: (r.format as string | null) ?? null,
    title: (r.title as string) ?? "",
    hook: (r.hook as string) ?? "",
    body: (r.body as string) ?? "",
    imagePrompt: (r.image_prompt as string | null) ?? null,
    threadOf: r.thread_of == null ? null : Number(r.thread_of),
    tweetUrl: (r.tweet_url as string | null) ?? null,
    verifiedHandle: (r.verified_handle as string | null) ?? null,
    postedAt: r.posted_at ? new Date(r.posted_at as string).getTime() : null,
    sourceVersion: (r.source_version as string | null) ?? null,
    createdAt: new Date(r.created_at as string).getTime(),
    updatedAt: new Date(r.updated_at as string).getTime(),
    metrics: hasMetrics
      ? {
          impressions: Number(r.impressions ?? 0),
          likes: Number(r.likes ?? 0),
          replies: Number(r.replies ?? 0),
          reposts: Number(r.reposts ?? 0),
          bookmarks: Number(r.bookmarks ?? 0),
          profileClicks: Number(r.profile_clicks ?? 0),
          linkClicks: Number(r.link_clicks ?? 0),
          capturedAt: new Date(r.captured_at as string).getTime(),
        }
      : null,
  };
}

export async function listPosts(): Promise<XPost[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT ${POST_COLUMNS} FROM x_posts p LEFT JOIN x_post_metrics m ON m.post_id = p.id
     ORDER BY p.slot_date NULLS LAST, p.id`,
  );
  return res.rows.map(mapPost);
}

export async function getPost(id: number): Promise<XPost | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    `SELECT ${POST_COLUMNS} FROM x_posts p LEFT JOIN x_post_metrics m ON m.post_id = p.id WHERE p.id = $1`,
    [id],
  );
  return res.rows[0] ? mapPost(res.rows[0]) : null;
}

export interface XPostInput {
  ref?: string | null;
  slotDate?: string | null;
  slotKind?: XSlotKind;
  status?: XPostStatus;
  format?: string | null;
  title?: string;
  hook?: string;
  body?: string;
  imagePrompt?: string | null;
  threadOf?: number | null;
  tweetUrl?: string | null;
  sourceVersion?: string | null;
}

export async function createPost(input: XPostInput): Promise<XPost> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const res = await pool.query(
    `INSERT INTO x_posts (ref, slot_date, slot_kind, status, format, title, hook, body, image_prompt, thread_of, tweet_url, source_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      input.ref ?? null,
      input.slotDate ?? null,
      input.slotKind ?? "extra",
      input.status ?? "idea",
      input.format ?? null,
      input.title ?? "",
      input.hook ?? "",
      input.body ?? "",
      input.imagePrompt ?? null,
      input.threadOf ?? null,
      input.tweetUrl ?? null,
      input.sourceVersion ?? null,
    ],
  );
  const created = await getPost(Number(res.rows[0].id));
  if (!created) throw new Error("Post vanished after insert.");
  return created;
}

/** Partial update. Only keys actually present in `input` are written, so the UI
 *  can PATCH one field without round-tripping the whole post. */
export async function updatePost(id: number, input: XPostInput): Promise<XPost | null> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const columns: Record<keyof XPostInput, string> = {
    ref: "ref",
    slotDate: "slot_date",
    slotKind: "slot_kind",
    status: "status",
    format: "format",
    title: "title",
    hook: "hook",
    body: "body",
    imagePrompt: "image_prompt",
    threadOf: "thread_of",
    tweetUrl: "tweet_url",
    sourceVersion: "source_version",
  };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(columns) as [keyof XPostInput, string][]) {
    if (!(key in input)) continue;
    values.push(input[key] ?? null);
    sets.push(`${column} = $${values.length}`);
  }
  // posted_at follows status rather than being set by hand — one less thing to
  // get wrong, and the evaluation join depends on it being accurate.
  if (input.status === "posted") sets.push("posted_at = COALESCE(posted_at, NOW())");
  if (input.status && input.status !== "posted") sets.push("posted_at = NULL");
  if (!sets.length) return await getPost(id);
  sets.push("updated_at = NOW()");
  await pool.query(`UPDATE x_posts SET ${sets.join(", ")} WHERE id = $1`, values);
  return await getPost(id);
}

export async function deletePost(id: number): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query("DELETE FROM x_post_metrics WHERE post_id = $1", [id]);
  await pool.query("DELETE FROM x_posts WHERE id = $1", [id]);
}

export async function setVerifiedHandle(id: number, handle: string | null): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("UPDATE x_posts SET verified_handle = $2, updated_at = NOW() WHERE id = $1", [id, handle]);
}

export async function upsertMetrics(postId: number, m: Partial<XPostMetrics>): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  await pool.query(
    `INSERT INTO x_post_metrics (post_id, impressions, likes, replies, reposts, bookmarks, profile_clicks, link_clicks, captured_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (post_id) DO UPDATE SET
       impressions = $2, likes = $3, replies = $4, reposts = $5,
       bookmarks = $6, profile_clicks = $7, link_clicks = $8, captured_at = NOW()`,
    [
      postId,
      n(m.impressions),
      n(m.likes),
      n(m.replies),
      n(m.reposts),
      n(m.bookmarks),
      n(m.profileClicks),
      n(m.linkClicks),
    ],
  );
}

/** Idempotent on `ref` — the importer can be re-run without duplicating the
 *  calendar. Existing rows keep their status and metrics; only the copy is
 *  refreshed, so a re-import never resurrects a post you already marked posted. */
export async function importPost(input: XPostInput & { ref: string }): Promise<"inserted" | "updated"> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const res = await pool.query(
    `INSERT INTO x_posts (ref, slot_date, slot_kind, status, format, title, hook, body, image_prompt)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (ref) DO UPDATE SET
       slot_date = EXCLUDED.slot_date, slot_kind = EXCLUDED.slot_kind, format = EXCLUDED.format,
       title = EXCLUDED.title, hook = EXCLUDED.hook, body = EXCLUDED.body,
       image_prompt = EXCLUDED.image_prompt, updated_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [
      input.ref,
      input.slotDate ?? null,
      input.slotKind ?? "extra",
      input.status ?? "drafted",
      input.format ?? null,
      input.title ?? "",
      input.hook ?? "",
      input.body ?? "",
      input.imagePrompt ?? null,
    ],
  );
  return res.rows[0]?.inserted ? "inserted" : "updated";
}

// ---------------------------------------------------------------------------
// Account snapshots, engagement targets, templates
// ---------------------------------------------------------------------------

export interface XSnapshot {
  day: string;
  followers: number;
  following: number;
  posts: number;
  note: string | null;
}

export async function listSnapshots(limit = 120): Promise<XSnapshot[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query("SELECT day, followers, following, posts, note FROM x_account_snapshots ORDER BY day DESC LIMIT $1", [limit]);
  return res.rows
    .map((r) => ({
      day: toDateString(r.day)!,
      followers: Number(r.followers),
      following: Number(r.following),
      posts: Number(r.posts),
      note: (r.note as string | null) ?? null,
    }))
    .reverse();
}

export async function upsertSnapshot(s: XSnapshot): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query(
    `INSERT INTO x_account_snapshots (day, followers, following, posts, note) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (day) DO UPDATE SET followers = $2, following = $3, posts = $4, note = $5`,
    [s.day, Math.max(0, Math.round(s.followers)), Math.max(0, Math.round(s.following)), Math.max(0, Math.round(s.posts)), s.note ?? null],
  );
}

export interface XTarget {
  handle: string;
  why: string;
  cadence: string;
  lastEngagedAt: number | null;
  notes: string | null;
}

export async function listTargets(): Promise<XTarget[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    "SELECT handle, why, cadence, last_engaged_at, notes FROM x_targets ORDER BY last_engaged_at ASC NULLS FIRST, handle",
  );
  return res.rows.map((r) => ({
    handle: r.handle as string,
    why: (r.why as string) ?? "",
    cadence: (r.cadence as string) ?? "",
    lastEngagedAt: r.last_engaged_at ? new Date(r.last_engaged_at as string).getTime() : null,
    notes: (r.notes as string | null) ?? null,
  }));
}

export async function upsertTarget(t: { handle: string; why?: string; cadence?: string; notes?: string | null }): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query(
    `INSERT INTO x_targets (handle, why, cadence, notes) VALUES ($1,$2,$3,$4)
     ON CONFLICT (handle) DO UPDATE SET why = $2, cadence = $3, notes = $4`,
    [t.handle.replace(/^@/, ""), t.why ?? "", t.cadence ?? "", t.notes ?? null],
  );
}

export async function markTargetEngaged(handle: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("UPDATE x_targets SET last_engaged_at = NOW() WHERE handle = $1", [handle.replace(/^@/, "")]);
}

export async function deleteTarget(handle: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("DELETE FROM x_targets WHERE handle = $1", [handle.replace(/^@/, "")]);
}

export interface XTemplate {
  id: string;
  name: string;
  format: string;
  skeleton: string;
  notes: string | null;
}

export async function listTemplates(): Promise<XTemplate[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query("SELECT id, name, format, skeleton, notes FROM x_templates ORDER BY name");
  return res.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    format: (r.format as string) ?? "",
    skeleton: (r.skeleton as string) ?? "",
    notes: (r.notes as string | null) ?? null,
  }));
}

export async function upsertTemplate(t: XTemplate): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query(
    `INSERT INTO x_templates (id, name, format, skeleton, notes) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET name = $2, format = $3, skeleton = $4, notes = $5`,
    [t.id, t.name, t.format, t.skeleton, t.notes ?? null],
  );
}

/** Newest GAME_VERSION that already has a post row. Drives the auto-capture of
 *  shipped-but-never-posted stories. */
export async function knownSourceVersions(): Promise<Set<string>> {
  const pool = getPool();
  if (!pool) return new Set();
  const res = await pool.query("SELECT DISTINCT source_version FROM x_posts WHERE source_version IS NOT NULL");
  return new Set(res.rows.map((r) => String(r.source_version)));
}
