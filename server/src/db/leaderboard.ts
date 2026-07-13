import {
  getPvpRank,
  getPvpSeason,
  normalizeSkills,
  totalSkillLevel,
  type LeaderboardEntry,
  type LeaderboardPayload,
} from "@metricbase/shared";
import { fetchExternalWealth, inventoryValue } from "./networth.js";
import { getPool } from "./pool.js";

const TTL_MS = 60_000;
let cache: LeaderboardPayload | null = null;
let cachedAt = 0;

interface Row {
  name: string;
  level: number;
  gold: number | null;
  skills?: unknown;
  inventory?: unknown;
  wallet_address?: string | null;
  pvp_rating?: number | null;
  pvp_kills?: number | null;
}

const EMPTY: LeaderboardPayload = {
  topLevel: [],
  topGold: [],
  topSkill: [],
  topPvp: [],
  season: 0,
};

const toEntry = (row: Row): LeaderboardEntry => ({
  name: row.name,
  level: row.level,
  gold: row.gold ?? 0,
});

/** Top players by level, net worth, skill, and PvP; cached a minute to spare the DB. */
export async function getLeaderboard(): Promise<LeaderboardPayload> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;

  const pool = getPool();
  if (!pool) return cache ?? EMPTY;

  // Exclude deploy/health-probe accounts (names like __healthcheck__,
  // DeployCheck, WSProbe) so they don't clutter the boards.
  const FILTER = "WHERE name !~ '^__' AND name NOT IN ('DeployCheck', 'WSProbe')";
  const season = getPvpSeason(now);

  try {
    const [byLevel, all, byPvp, wealth] = await Promise.all([
      pool.query<Row>(
        `SELECT name, level, gold FROM characters ${FILTER} ORDER BY level DESC, xp DESC LIMIT 10`,
      ),
      pool.query<Row>(
        `SELECT name, level, gold, skills, inventory, wallet_address FROM characters ${FILTER}`,
      ),
      // Only rank players whose rating belongs to the current season.
      pool.query<Row>(
        `SELECT name, level, gold, pvp_rating, pvp_kills FROM characters ${FILTER} AND pvp_season = $1 ORDER BY pvp_rating DESC, pvp_kills DESC LIMIT 10`,
        [season],
      ),
      fetchExternalWealth(pool),
    ]);
    const topSkill = all.rows
      .map((row) => ({ ...toEntry(row), skill: totalSkillLevel(normalizeSkills(row.skills as never)) }))
      .sort((a, b) => b.skill - a.skill || b.level - a.level)
      .slice(0, 10);
    // Richest = net worth: gold + inventory + Worlds/plots/assets owned. Rows
    // in `wealth` were credited by wallet when present, else by name, so
    // summing both lookups never double counts.
    const topRich = all.rows
      .map((row) => ({
        ...toEntry(row),
        netWorth:
          (row.gold ?? 0) +
          inventoryValue(row.inventory) +
          (row.wallet_address ? (wealth.byWallet.get(row.wallet_address) ?? 0) : 0) +
          (wealth.byName.get(row.name) ?? 0),
      }))
      .sort((a, b) => b.netWorth - a.netWorth || (b.gold ?? 0) - (a.gold ?? 0))
      .slice(0, 10);
    const topPvp = byPvp.rows.map((row) => {
      const rating = row.pvp_rating ?? 1000;
      return { ...toEntry(row), rating, rank: getPvpRank(rating) };
    });
    cache = {
      topLevel: byLevel.rows.map(toEntry),
      topGold: topRich,
      topSkill,
      topPvp,
      season,
    };
    cachedAt = now;
    return cache;
  } catch (error) {
    console.warn("[leaderboard] query failed:", error);
    return cache ?? EMPTY;
  }
}
