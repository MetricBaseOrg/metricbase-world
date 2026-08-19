// Evaluation layer for the X growth system — the part that makes the whole
// module worth building.
//
// The account's problem is NOT reach: ~4,500 followers converting to ~54 players
// means impressions are not the scoreboard. So the headline metric here is
// impressions → signups, joined from x_posts.posted_at to characters.created_at.
// A post with 40k impressions and zero signups is a finding, and this is the
// only place that finding can appear.

import { DASHBOARD_UPDATES, GAME_VERSION } from "@metricbase/shared";
import { getPool } from "../db/pool.js";
import {
  createPost,
  knownSourceVersions,
  listPosts,
  verifiedImpressions90d,
  type XPost,
} from "../db/xContent.js";

/** Signups are attributed to a post inside this window after it went out. */
const ATTRIBUTION_HOURS = 48;

export interface PostOutcome {
  postId: number;
  ref: string | null;
  title: string;
  postedAt: number;
  format: string | null;
  slotKind: string;
  weekday: string;
  impressions: number;
  engagements: number;
  engagementRate: number;
  /** Characters created in the 48h after posting. Correlation, not proof. */
  signups48h: number;
  /** Signups per 10,000 impressions — the conversion number that matters. */
  signupsPer10k: number;
}

export interface GroupStat {
  key: string;
  posts: number;
  medianImpressions: number;
  medianEngagementRate: number;
  totalSignups: number;
  signupsPer10k: number;
}

export interface XEvaluation {
  attributionHours: number;
  outcomes: PostOutcome[];
  byFormat: GroupStat[];
  bySlotKind: GroupStat[];
  byWeekday: GroupStat[];
  totals: { posts: number; impressions: number; signups: number; signupsPer10k: number };
  /** Progress toward Original Content Rewards eligibility. */
  creatorProgram: CreatorProgramStatus;
  /** True when there is too little data to read the aggregates honestly. */
  thin: boolean;
}

/** X's Original Content Rewards Program (replaced Creator Revenue Sharing in
 *  August 2026) pays on 500,000 Home Timeline impressions from Premium
 *  subscribers over a rolling 90 days, replies excluded.
 *
 *  Deliberately NOT derived from `totals.impressions`. Verified impressions are
 *  a small and highly variable fraction of total impressions, so applying any
 *  ratio here would be a guess presented as a measurement — and the point of
 *  this whole panel is that the numbers are real. The figure is hand-entered
 *  per post, like everything else in x_post_metrics. */
export interface CreatorProgramStatus {
  threshold: number;
  /** Sum of entered verified-impression figures over the last 90 days. */
  total: number;
  /** Posts in the window that have a figure entered. */
  recorded: number;
  /** Posts in the window still missing one. The total is only as trustworthy
   *  as this is small. */
  missing: number;
  /** 0–1 against the threshold, capped at 1. */
  progress: number;
  eligible: boolean;
}

/** 500,000 verified Home Timeline impressions per rolling 90 days. */
const CREATOR_THRESHOLD = 500_000;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function per10k(signups: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Number(((signups / impressions) * 10000).toFixed(2));
}

/** One grouped query rather than one per post: for every posted post, how many
 *  characters were created in its attribution window. */
async function signupsByPost(posts: XPost[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const pool = getPool();
  const dated = posts.filter((p) => p.postedAt != null);
  if (!pool || !dated.length) return out;
  try {
    const ids = dated.map((p) => p.id);
    const times = dated.map((p) => new Date(p.postedAt!).toISOString());
    const res = await pool.query(
      `SELECT t.id AS post_id, COUNT(c.id)::int AS signups
       FROM UNNEST($1::bigint[], $2::timestamptz[]) AS t(id, posted_at)
       LEFT JOIN characters c
         ON c.created_at >= t.posted_at
        AND c.created_at < t.posted_at + ($3 || ' hours')::interval
       GROUP BY t.id`,
      [ids, times, String(ATTRIBUTION_HOURS)],
    );
    for (const row of res.rows) out.set(Number(row.post_id), Number(row.signups));
  } catch (error) {
    console.warn("[mission] signup attribution query failed:", error);
  }
  return out;
}

function group(outcomes: PostOutcome[], keyOf: (o: PostOutcome) => string): GroupStat[] {
  const buckets = new Map<string, PostOutcome[]>();
  for (const o of outcomes) {
    const key = keyOf(o) || "unspecified";
    const list = buckets.get(key);
    if (list) list.push(o);
    else buckets.set(key, [o]);
  }
  return [...buckets.entries()]
    .map(([key, list]) => {
      const impressions = list.reduce((s, o) => s + o.impressions, 0);
      const signups = list.reduce((s, o) => s + o.signups48h, 0);
      return {
        key,
        posts: list.length,
        medianImpressions: median(list.map((o) => o.impressions)),
        medianEngagementRate: Number(median(list.map((o) => o.engagementRate * 100)).toFixed(2)) / 100,
        totalSignups: signups,
        signupsPer10k: per10k(signups, impressions),
      };
    })
    .sort((a, b) => b.signupsPer10k - a.signupsPer10k || b.medianImpressions - a.medianImpressions);
}

export async function evaluate(): Promise<XEvaluation> {
  const posts = (await listPosts()).filter((p) => p.status === "posted" && p.postedAt != null);
  const signups = await signupsByPost(posts);
  const verified = await verifiedImpressions90d();

  const outcomes: PostOutcome[] = posts.map((p) => {
    const m = p.metrics;
    const impressions = m?.impressions ?? 0;
    const engagements = m ? m.likes + m.replies + m.reposts + m.bookmarks : 0;
    const s = signups.get(p.id) ?? 0;
    return {
      postId: p.id,
      ref: p.ref,
      title: p.title,
      postedAt: p.postedAt!,
      format: p.format,
      slotKind: p.slotKind,
      weekday: WEEKDAYS[new Date(p.postedAt!).getUTCDay()],
      impressions,
      engagements,
      engagementRate: impressions ? engagements / impressions : 0,
      signups48h: s,
      signupsPer10k: per10k(s, impressions),
    };
  });
  outcomes.sort((a, b) => b.postedAt - a.postedAt);

  const withMetrics = outcomes.filter((o) => o.impressions > 0);
  const totalImpressions = outcomes.reduce((s, o) => s + o.impressions, 0);
  const totalSignups = outcomes.reduce((s, o) => s + o.signups48h, 0);

  return {
    attributionHours: ATTRIBUTION_HOURS,
    outcomes,
    byFormat: group(withMetrics, (o) => o.format ?? ""),
    bySlotKind: group(withMetrics, (o) => o.slotKind),
    byWeekday: group(withMetrics, (o) => o.weekday),
    totals: {
      posts: outcomes.length,
      impressions: totalImpressions,
      signups: totalSignups,
      signupsPer10k: per10k(totalSignups, totalImpressions),
    },
    creatorProgram: {
      threshold: CREATOR_THRESHOLD,
      total: verified.total,
      recorded: verified.recorded,
      missing: verified.missing,
      progress: Math.min(1, verified.total / CREATOR_THRESHOLD),
      eligible: verified.total >= CREATOR_THRESHOLD,
    },
    // Under 6 measured posts the medians are noise. Say so rather than let the
    // page imply a ranking exists — the same discipline the /stats retention
    // panel uses when a cohort is too small.
    thin: withMetrics.length < 6,
  };
}

// ---------------------------------------------------------------------------
// Copy guard
// ---------------------------------------------------------------------------

export interface CopyWarning {
  severity: "block" | "warn";
  message: string;
}

/** Checks run against draft copy before it ships. Every rule here exists because
 *  the corresponding mistake actually reached players or the timeline. */
export function checkCopy(text: string): CopyWarning[] {
  const warnings: CopyWarning[] = [];
  const lower = text.toLowerCase();

  // House rule: never frame the game's chance mechanics as gambling.
  if (/\bgambl(e|ing|er|es)\b/.test(lower)) {
    warnings.push({ severity: "block", message: 'Never use "gamble"/"gambling" — say roll, chance, odds or upside.' });
  }

  // The season deposit stopped being fully refundable (5% withdrawal fee). The
  // old promise survived in six places; a stale claim about money reads as a
  // broken promise, not as history.
  if (/\brefundable\b/.test(lower) && !lower.includes("5%")) {
    warnings.push({
      severity: "block",
      message: 'The deposit is no longer fully refundable — mention the 5% withdrawal fee or drop the word.',
    });
  }

  // Point-in-time counts make a small game look empty; flow metrics don't.
  if (/\b\d+\s+(players?\s+)?online\s+(now|right now)\b/.test(lower)) {
    warnings.push({ severity: "warn", message: "Post cumulative flow metrics, not point-in-time counts like players online now." });
  }

  if (text.length > 280 && !text.includes("\n\n")) {
    warnings.push({ severity: "warn", message: `${text.length} characters — over the single-post limit, split it into a thread.` });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Auto-capture of shipped-but-unposted stories
// ---------------------------------------------------------------------------

/** "v0.205 — Deposit more, score more" → "0.205" */
function versionOf(title: string): string | null {
  return title.match(/v(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? null;
}

/**
 * The standing chore was: after every ship, write the story down before the
 * detail that made it good is gone. The server already knows GAME_VERSION and
 * carries the player-facing changelog in DASHBOARD_UPDATES, so the queue can
 * maintain itself instead of depending on anyone remembering.
 *
 * Creates an `idea` row per shipped version that has no post yet. Idempotent.
 */
export async function captureShippedStories(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const known = await knownSourceVersions();
    let created = 0;
    for (const update of DASHBOARD_UPDATES) {
      const version = versionOf(update.title) ?? GAME_VERSION;
      if (known.has(version)) continue;
      await createPost({
        status: "idea",
        slotKind: "extra",
        format: "ship_story",
        title: update.title,
        hook: update.title.replace(/^v[\d.]+\s*—\s*/, ""),
        body: update.body,
        sourceVersion: version,
      });
      known.add(version);
      created += 1;
    }
    if (created) console.log(`[mission] Captured ${created} shipped-but-unposted stor${created === 1 ? "y" : "ies"}.`);
    return created;
  } catch (error) {
    console.warn("[mission] shipped-story capture failed:", error);
    return 0;
  }
}
