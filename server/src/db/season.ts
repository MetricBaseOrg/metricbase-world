import { getPool } from "./pool.js";
import {
  SEASON_REWARD_POOL_BASE,
  SEASON_RICHEST_DAILY_BONUS,
  METRICBASE_TOKEN_MINT,
  currentSeason,
  type SeasonCategory,
  type SeasonLeaderEntry,
} from "@metricbase/shared";
import { getHouseWalletAddress, getHouseBalanceUi } from "../solana/housePayout.js";

/** Per-player season points, one row per player. `season_id` bumps when the
 * season rolls over (handled in code); points/breakdown reset with it. */
export interface SeasonRow {
  seasonId: string;
  points: number;
  breakdown: Partial<Record<SeasonCategory, number>>;
}

export function emptySeasonRow(seasonId: string): SeasonRow {
  return { seasonId, points: 0, breakdown: {} };
}

export async function loadSeasonState(playerName: string): Promise<SeasonRow | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const res = await pool.query<{
      season_id: string;
      points: number | null;
      breakdown: Partial<Record<SeasonCategory, number>> | null;
    }>(
      "SELECT season_id, points, breakdown FROM season_state WHERE player_name = $1",
      [playerName],
    );
    if (!res.rowCount) return null;
    const r = res.rows[0];
    return { seasonId: r.season_id, points: r.points ?? 0, breakdown: r.breakdown ?? {} };
  } catch (error) {
    console.warn("[season] load failed:", error);
    return null;
  }
}

export async function saveSeasonState(playerName: string, row: SeasonRow): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO season_state (player_name, season_id, points, breakdown)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (player_name)
       DO UPDATE SET season_id = EXCLUDED.season_id, points = EXCLUDED.points, breakdown = EXCLUDED.breakdown`,
      [playerName, row.seasonId, row.points, JSON.stringify(row.breakdown)],
    );
  } catch (error) {
    console.warn("[season] save failed:", error);
  }
}

export interface SeasonAggregate {
  leaderboard: SeasonLeaderEntry[];
  totalPlayers: number;
  totalPoints: number;
}

/** Top-N leaderboard + totals for the given season (current season only). */
export async function loadSeasonAggregate(seasonId: string, limit = 25): Promise<SeasonAggregate> {
  const empty: SeasonAggregate = { leaderboard: [], totalPlayers: 0, totalPoints: 0 };
  const pool = getPool();
  if (!pool) return empty;
  try {
    const top = await pool.query<{ player_name: string; points: number }>(
      `SELECT player_name, points FROM season_state
       WHERE season_id = $1 AND points > 0
       ORDER BY points DESC, player_name ASC
       LIMIT $2`,
      [seasonId, limit],
    );
    const totals = await pool.query<{ total_players: string; total_points: string }>(
      `SELECT COUNT(*)::text AS total_players, COALESCE(SUM(points), 0)::text AS total_points
       FROM season_state WHERE season_id = $1 AND points > 0`,
      [seasonId],
    );
    const leaderboard: SeasonLeaderEntry[] = top.rows.map((r, i) => ({
      name: r.player_name,
      points: r.points,
      rank: i + 1,
    }));
    const t = totals.rows[0];
    return {
      leaderboard,
      totalPlayers: t ? Number(t.total_players) : 0,
      totalPoints: t ? Number(t.total_points) : 0,
    };
  } catch (error) {
    console.warn("[season] aggregate failed:", error);
    return empty;
  }
}

/** The live Season reward pool: the admin (house) wallet's $BASE balance —
 * which includes accumulated ad revenue — floored at the Season-1 baseline
 * (SEASON_REWARD_POOL_BASE). Cached 5 min; getHouseBalanceUi caches too. */
let poolCache = { at: 0, value: SEASON_REWARD_POOL_BASE };
export async function getSeasonRewardPool(): Promise<number> {
  if (Date.now() - poolCache.at < 300_000) return poolCache.value;
  let pool = SEASON_REWARD_POOL_BASE;
  const house = getHouseWalletAddress();
  if (house) {
    try {
      const mint = process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;
      const bal = await getHouseBalanceUi(house, "base", mint);
      if (bal != null) pool = Math.max(SEASON_REWARD_POOL_BASE, Math.floor(bal));
    } catch (error) {
      console.warn("[season] pool balance failed:", error);
    }
  }
  poolCache = { at: Date.now(), value: pool };
  return pool;
}

/** Award season points directly in the DB (for offline players, e.g. a referrer
 * whose invitee just registered). Handles season rollover in SQL and increments
 * the category breakdown. */
export async function awardSeasonPointsDb(playerName: string, category: SeasonCategory, points: number): Promise<void> {
  const pool = getPool();
  if (!pool || points <= 0) return;
  const seasonId = currentSeason().id;
  try {
    await pool.query(
      `INSERT INTO season_state (player_name, season_id, points, breakdown)
       VALUES ($1, $2, $3, jsonb_build_object($4::text, $3))
       ON CONFLICT (player_name) DO UPDATE SET
         season_id = $2,
         points = CASE WHEN season_state.season_id = $2 THEN season_state.points + $3 ELSE $3 END,
         breakdown = CASE WHEN season_state.season_id = $2
           THEN jsonb_set(
                  COALESCE(season_state.breakdown, '{}'::jsonb),
                  ARRAY[$4::text],
                  to_jsonb(COALESCE((season_state.breakdown ->> $4)::int, 0) + $3))
           ELSE jsonb_build_object($4::text, $3) END`,
      [playerName, seasonId, points, category],
    );
  } catch (error) {
    console.warn("[season] award failed:", error);
  }
}

/** Award the fixed daily "richest" season-point bonus to the top-N players (by
 * net worth, in order). Idempotent per (season, UTC day) via an atomic marker
 * insert, so it fires once a day no matter how many rooms call it. */
export async function awardRichestDailyBonus(seasonId: string, rankedNames: string[]): Promise<void> {
  const pool = getPool();
  if (!pool || rankedNames.length === 0) return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const claim = await pool.query(
      `INSERT INTO season_richest_award (season_id, day) VALUES ($1, $2)
       ON CONFLICT (season_id, day) DO NOTHING RETURNING day`,
      [seasonId, day],
    );
    if (!claim.rowCount) return; // already awarded today
    const n = Math.min(rankedNames.length, SEASON_RICHEST_DAILY_BONUS.length);
    for (let i = 0; i < n; i++) {
      await awardSeasonPointsDb(rankedNames[i], "richest", SEASON_RICHEST_DAILY_BONUS[i]);
    }
  } catch (error) {
    console.warn("[season] richest daily bonus failed:", error);
  }
}

/** This player's 1-based rank within the season (0 if unranked / no points). */
export async function loadSeasonRank(seasonId: string, playerName: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ rank: string }>(
      `SELECT COUNT(*) + 1 AS rank FROM season_state s
       WHERE s.season_id = $1 AND s.points > (
         SELECT points FROM season_state WHERE season_id = $1 AND player_name = $2
       )`,
      [seasonId, playerName],
    );
    return res.rowCount ? Number(res.rows[0].rank) : 0;
  } catch (error) {
    console.warn("[season] rank failed:", error);
    return 0;
  }
}
