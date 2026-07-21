import { getPool } from "./pool.js";
import type { SeasonCategory, SeasonLeaderEntry } from "@metricbase/shared";

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
