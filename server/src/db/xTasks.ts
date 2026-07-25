import { getPool } from "./pool.js";
import { awardSeasonPointsDb } from "./season.js";
import type { XTaskType } from "@metricbase/shared";

export interface XTaskRow {
  id: string;
  type: XTaskType;
  targetUrl: string;
  title: string;
  description: string;
  hashtag: string;
  points: number;
  active: boolean;
}

function mapRow(r: {
  id: string; type: string; target_url: string; title: string;
  description: string; hashtag: string; points: number; active: boolean;
}): XTaskRow {
  return {
    id: r.id, type: (r.type === "quote" ? "quote" : "reply"), targetUrl: r.target_url,
    title: r.title, description: r.description, hashtag: r.hashtag, points: r.points, active: r.active,
  };
}

/** Active tasks, newest first. */
export async function listActiveTasks(): Promise<XTaskRow[]> {
  const db = getPool();
  if (!db) return [];
  try {
    const res = await db.query(
      `SELECT id, type, target_url, title, description, hashtag, points, active
       FROM x_tasks WHERE active = true ORDER BY created_at DESC LIMIT 25`,
    );
    return res.rows.map(mapRow);
  } catch (error) {
    console.warn("[x-tasks] list failed:", error);
    return [];
  }
}

export async function getTask(id: string): Promise<XTaskRow | null> {
  const db = getPool();
  if (!db) return null;
  try {
    const res = await db.query(
      `SELECT id, type, target_url, title, description, hashtag, points, active FROM x_tasks WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  } catch {
    return null;
  }
}

/** Task ids this wallet has already claimed. */
export async function claimedTaskIds(wallet: string): Promise<Set<string>> {
  const db = getPool();
  if (!db) return new Set();
  try {
    const res = await db.query<{ task_id: string }>(
      `SELECT task_id FROM x_task_claims WHERE wallet_address = $1`,
      [wallet],
    );
    return new Set(res.rows.map((r) => r.task_id));
  } catch {
    return new Set();
  }
}

export async function createTask(t: Omit<XTaskRow, "active">): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  try {
    await db.query(
      `INSERT INTO x_tasks (id, type, target_url, title, description, hashtag, points)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [t.id, t.type, t.targetUrl, t.title, t.description, t.hashtag, t.points],
    );
    return true;
  } catch (error) {
    console.warn("[x-tasks] create failed:", error);
    return false;
  }
}

export async function setTaskActive(id: string, active: boolean): Promise<void> {
  const db = getPool();
  if (!db) return;
  try {
    await db.query(`UPDATE x_tasks SET active = $2 WHERE id = $1`, [id, active]);
  } catch (error) {
    console.warn("[x-tasks] toggle failed:", error);
  }
}

/** Display name bonded to a wallet (needed to award season points). */
export async function nameForWallet(wallet: string): Promise<string | null> {
  const db = getPool();
  if (!db) return null;
  try {
    const res = await db.query<{ name: string }>(
      `SELECT name FROM characters WHERE wallet_address = $1 LIMIT 1`,
      [wallet],
    );
    return res.rows[0]?.name ?? null;
  } catch {
    return null;
  }
}

export type ClaimOutcome = { ok: true; points: number } | { ok: false; reason: string };

/**
 * Record a verified claim and award the points — atomically. The unique
 * (task_id, wallet) primary key means a re-submit can never double-pay: only
 * the insert that actually creates the row goes on to award.
 */
export async function recordClaim(
  taskId: string, wallet: string, playerName: string, tweetUrl: string, points: number,
): Promise<ClaimOutcome> {
  const db = getPool();
  if (!db) return { ok: false, reason: "Database unavailable." };
  try {
    const ins = await db.query(
      `INSERT INTO x_task_claims (task_id, wallet_address, player_name, tweet_url, points)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (task_id, wallet_address) DO NOTHING
       RETURNING task_id`,
      [taskId, wallet, playerName, tweetUrl, points],
    );
    if (!ins.rowCount) return { ok: false, reason: "You've already claimed this task." };
    await awardSeasonPointsDb(playerName, "xTask", points);
    return { ok: true, points };
  } catch (error) {
    console.warn("[x-tasks] claim failed:", error);
    return { ok: false, reason: "Couldn't record the claim. Try again." };
  }
}
