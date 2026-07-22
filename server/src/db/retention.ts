import { getPool } from "./pool.js";

/**
 * Player retention — the numbers that decided P3, and the readout on whether
 * it worked.
 *
 * Measured 2026-07-22, before the fix: of 51 characters, 36 (71%) never passed
 * level 3, 14 never returned after a single session, and only 10 were active in
 * the last 7 days. The cause was that every quest was gated behind finding
 * Aria, so a new player spawned with an empty log.
 *
 * v0.178.0 auto-starts the opening quest and shows an always-on objective
 * tracker. That is a hypothesis with a prediction — the stuck-at-low-level
 * share should fall — so this splits players into cohorts either side of the
 * ship date and reports both. Without the split the old players would swamp the
 * signal for weeks.
 */

/** When the objective tracker + auto-start shipped (v0.178.0). */
const TRACKER_SHIPPED_AT = "2026-07-22T06:00:00Z";

export interface RetentionCohort {
  label: string;
  players: number;
  /** Still level 1–3 — the "never got going" bucket. */
  stuckLow: number;
  /** Percentage form of stuckLow, or null when the cohort is too small to mean
   *  anything. Small-sample percentages invite over-reading. */
  stuckLowPct: number | null;
  /** Played once and never came back (lifetime under 30 minutes). */
  oneAndDone: number;
  reachedLevel5: number;
}

export interface Retention {
  totalPlayers: number;
  active24h: number;
  active7d: number;
  active30d: number;
  /** Characters created per week, oldest first (last 8 weeks). */
  signupsByWeek: Array<{ week: string; players: number }>;
  levelBuckets: Array<{ label: string; players: number }>;
  /** Before vs after the objective tracker shipped. */
  before: RetentionCohort;
  after: RetentionCohort;
}

/** Below this a percentage is noise, so report the raw count instead. */
const MIN_COHORT_FOR_PCT = 8;

export async function getRetention(): Promise<Retention | null> {
  const db = getPool();
  if (!db) return null;

  try {
    const cohort = async (label: string, where: string): Promise<RetentionCohort> => {
      const r = await db.query<{
        players: string;
        stuck: string;
        one_and_done: string;
        lvl5: string;
      }>(
        `SELECT COUNT(*) AS players,
                COUNT(*) FILTER (WHERE level <= 3) AS stuck,
                COUNT(*) FILTER (WHERE updated_at - created_at < INTERVAL '30 minutes') AS one_and_done,
                COUNT(*) FILTER (WHERE level >= 5) AS lvl5
           FROM characters WHERE ${where}`,
        [TRACKER_SHIPPED_AT],
      );
      const row = r.rows[0];
      const players = Number(row?.players ?? 0);
      const stuckLow = Number(row?.stuck ?? 0);
      return {
        label,
        players,
        stuckLow,
        stuckLowPct:
          players >= MIN_COHORT_FOR_PCT ? Math.round((stuckLow / players) * 100) : null,
        oneAndDone: Number(row?.one_and_done ?? 0),
        reachedLevel5: Number(row?.lvl5 ?? 0),
      };
    };

    const [totals, weeks, buckets, before, after] = await Promise.all([
      db.query<{ total: string; a1: string; a7: string; a30: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') AS a1,
                COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days')  AS a7,
                COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days') AS a30
           FROM characters`,
      ),
      db.query<{ wk: Date; n: string }>(
        `SELECT date_trunc('week', created_at) AS wk, COUNT(*) AS n
           FROM characters
          WHERE created_at > NOW() - INTERVAL '8 weeks'
          GROUP BY wk ORDER BY wk`,
      ),
      db.query<{ bucket: string; n: string }>(
        `SELECT CASE
                  WHEN level <= 3 THEN '1-3 (just arrived)'
                  WHEN level <= 9 THEN '4-9 (getting going)'
                  WHEN level <= 29 THEN '10-29 (established)'
                  ELSE '30+ (veteran)' END AS bucket,
                COUNT(*) AS n
           FROM characters GROUP BY bucket`,
      ),
      cohort("Before tracker", "created_at < $1::timestamptz"),
      cohort("Since tracker", "created_at >= $1::timestamptz"),
    ]);

    const t = totals.rows[0];
    // Fixed order — SQL grouping returns them arbitrarily.
    const order = ["1-3 (just arrived)", "4-9 (getting going)", "10-29 (established)", "30+ (veteran)"];
    const bucketMap = new Map(buckets.rows.map((r) => [r.bucket, Number(r.n)]));

    return {
      totalPlayers: Number(t?.total ?? 0),
      active24h: Number(t?.a1 ?? 0),
      active7d: Number(t?.a7 ?? 0),
      active30d: Number(t?.a30 ?? 0),
      signupsByWeek: weeks.rows.map((r) => ({
        week: new Date(r.wk).toISOString().slice(0, 10),
        players: Number(r.n),
      })),
      levelBuckets: order.map((label) => ({ label, players: bucketMap.get(label) ?? 0 })),
      before,
      after,
    };
  } catch (error) {
    console.warn("[retention] query failed:", error);
    return null;
  }
}
