import type { LeaderboardEntry, LeaderboardPayload } from "@metricbase/shared";
import { getPool } from "./pool.js";

const TTL_MS = 60_000;
let cache: LeaderboardPayload | null = null;
let cachedAt = 0;

interface Row {
  name: string;
  level: number;
  gold: number | null;
}

const toEntry = (row: Row): LeaderboardEntry => ({
  name: row.name,
  level: row.level,
  gold: row.gold ?? 0,
});

/** Top players by level and by gold, cached for a minute to spare the DB. */
export async function getLeaderboard(): Promise<LeaderboardPayload> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;

  const pool = getPool();
  if (!pool) return cache ?? { topLevel: [], topGold: [] };

  // Exclude deploy/health-probe accounts (names like __healthcheck__,
  // DeployCheck, WSProbe) so they don't clutter the boards.
  const FILTER = "WHERE name !~ '^__' AND name NOT IN ('DeployCheck', 'WSProbe')";

  try {
    const [byLevel, byGold] = await Promise.all([
      pool.query<Row>(
        `SELECT name, level, gold FROM characters ${FILTER} ORDER BY level DESC, xp DESC LIMIT 10`,
      ),
      pool.query<Row>(`SELECT name, level, gold FROM characters ${FILTER} ORDER BY gold DESC LIMIT 10`),
    ]);
    cache = {
      topLevel: byLevel.rows.map(toEntry),
      topGold: byGold.rows.map(toEntry),
    };
    cachedAt = now;
    return cache;
  } catch (error) {
    console.warn("[leaderboard] query failed:", error);
    return cache ?? { topLevel: [], topGold: [] };
  }
}
