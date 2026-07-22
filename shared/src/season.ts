// Season points — a recurring, fixed-length competitive season layered on top of
// normal play. Players earn points from the SAME activities the daily quests
// already track (plus PvP wins and referrals); at season end a FIXED, pre-funded
// $BASE reward pool is split pro-rata by points.
//
// Design invariant (mirrors the economy's no-emission rule): points NEVER mint
// $BASE. The reward pool is a fixed amount announced up front and paid from the
// treasury — points only decide how that fixed pool is *divided*, never how much
// exists. See docs/company-coin.md "THE HARD INVARIANT".

/** Season length + anchor. Seasons tile back-to-back from the epoch so every
 * client and server agrees on the current season with no server state. */
export const SEASON_LENGTH_DAYS = 30;
export const SEASON_LENGTH_MS = SEASON_LENGTH_DAYS * 24 * 60 * 60 * 1000;
/** Anchor: 2026-07-21T00:00:00Z is the start of Season 1. (Internal — distinct
 * from the PvP-rank season anchor in pvprank.ts.) */
const SEASON_EPOCH_MS = Date.UTC(2026, 6, 21);

/** Default $BASE reward pool for a season with no explicit override. Funded from
 * the dev/admin wallet; NOT minted — points only decide how the pool is divided
 * at season end (see the no-emission invariant in docs/company-coin.md). */
export const SEASON_REWARD_POOL_BASE = 1_000_000;

/** Per-season prize-pool overrides. Season 1 is a fixed 1,000,000 $BASE;
 * subsequent seasons' prizes are decided by DAO vote (recorded here when a
 * vote resolves). Falls back to SEASON_REWARD_POOL_BASE until then. */
export const SEASON_REWARD_POOLS: Record<number, number> = {
  1: 1_000_000,
};

/** The fixed $BASE prize pool for a given season number. */
export function seasonRewardPool(seasonNumber: number): number {
  return SEASON_REWARD_POOLS[seasonNumber] ?? SEASON_REWARD_POOL_BASE;
}

export interface SeasonInfo {
  /** 1-based season number. */
  number: number;
  /** Stable id used as the state bucket key, e.g. "S1". */
  id: string;
  startMs: number;
  endMs: number;
}

/** The season a timestamp falls in (clamped so pre-epoch reads as Season 1). */
export function currentSeason(now = Date.now()): SeasonInfo {
  const idx = Math.max(0, Math.floor((now - SEASON_EPOCH_MS) / SEASON_LENGTH_MS));
  const startMs = SEASON_EPOCH_MS + idx * SEASON_LENGTH_MS;
  return { number: idx + 1, id: `S${idx + 1}`, startMs, endMs: startMs + SEASON_LENGTH_MS };
}

/** Milliseconds until the current season ends. */
export function seasonTimeLeftMs(now = Date.now()): number {
  return Math.max(0, currentSeason(now).endMs - now);
}

/** Point-earning categories. `gather/mobs/craft/harvest/sell/visitWorld/jobs`
 * mirror the daily-quest counter keys, so one hook site feeds both systems. */
export type SeasonCategory =
  | "gather"
  | "mobs"
  | "craft"
  | "harvest"
  | "sell"
  | "visitWorld"
  | "jobs"
  | "login"
  | "pvpWin"
  | "referral"
  | "richest";

/** Points awarded per unit of each activity. Balanced so grindy actions pay
 * little and rare/social actions pay more; alt-spam of cheap actions can't
 * dominate (referrals/PvP are the real movers). */
export const SEASON_POINTS: Record<SeasonCategory, number> = {
  gather: 1,
  harvest: 1,
  sell: 1,
  mobs: 2,
  craft: 3,
  jobs: 5,
  visitWorld: 5,
  login: 5,
  pvpWin: 10,
  referral: 50,
  // Richest is awarded on a fixed daily schedule by rank (SEASON_RICHEST_DAILY_BONUS),
  // not per-unit — this per-unit entry is unused.
  richest: 0,
};

/**
 * Combat level an invitee must reach before their referrer is paid the
 * `referral` bonus.
 *
 * Referral is the highest-value category (50 pts) against a fixed $BASE prize
 * pool, so it is the most attractive thing to farm. Entry became free in
 * v0.172.0, which removed the only real cost of a throwaway invitee — so the
 * cost is now "actually play for a bit" instead. Raise this if farming shows
 * up on the invitations leaderboard.
 */
export const REFERRAL_QUALIFY_LEVEL = 5;

/** Fixed DAILY season-point bonus for the top-10 richest players, by rank
 * (index 0 = richest). Rank-based and capped — NOT gold-proportional — so
 * wealth rewards being sustainably rich without letting the uncapped gold
 * faucet farm unlimited $BASE-backed points. Max 50/day → 1,500 over a season. */
export const SEASON_RICHEST_DAILY_BONUS = [50, 40, 30, 25, 20, 15, 12, 10, 8, 5];

export const SEASON_CATEGORY_LABEL: Record<SeasonCategory, string> = {
  gather: "Gathering",
  harvest: "Harvesting",
  sell: "Trading",
  mobs: "Combat",
  craft: "Crafting",
  jobs: "Jobs",
  visitWorld: "Exploring",
  login: "Daily login",
  pvpWin: "PvP wins",
  referral: "Referrals",
  richest: "Richest bonus",
};

export interface SeasonLeaderEntry {
  name: string;
  points: number;
  rank: number;
}

/** What the client renders for the season panel. */
export interface SeasonStatePayload {
  seasonId: string;
  seasonNumber: number;
  endsAt: number;
  /** Fixed $BASE pool split by points at season end. */
  rewardPool: number;
  /** This player's points + breakdown. */
  points: number;
  breakdown: Partial<Record<SeasonCategory, number>>;
  /** This player's rank (1-based) and the total ranked players. */
  rank: number;
  totalPlayers: number;
  /** This player's estimated share of the pool if the season ended now. */
  estimatedReward: number;
  /** Top players this season. */
  leaderboard: SeasonLeaderEntry[];
}

/** Estimated pool share for `points` given the total points in play. */
export function estimateReward(points: number, totalPoints: number, pool = SEASON_REWARD_POOL_BASE): number {
  if (totalPoints <= 0 || points <= 0) return 0;
  return Math.floor((points / totalPoints) * pool);
}
