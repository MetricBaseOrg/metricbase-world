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

// ── Season entry stake ───────────────────────────────────────────────────────
//
// Competing for the prize pool costs a REFUNDABLE stake in $BASE. This exists
// because the pool pays out continuously with essentially no matching inflow
// (see docs/base-demand.md — 2 distinct wallets have ever paid the treasury).
// The stake couples pool outflow to token inflow without re-gating entry:
//
//  - Playing stays free. Points still accrue for everyone, and the leaderboard
//    still ranks everyone — a non-entrant simply isn't in the payout split.
//  - The stake is RETURNED at payout, so it is a deposit, not a fee. It is a
//    treasury liability for the length of the season, and the payout's solvency
//    check covers refunds as well as prizes.
//  - It never mints $BASE and never converts gold → $BASE (the hard invariant
//    in docs/company-coin.md). The pool is still fixed and pre-funded; the
//    stake decides *who* is in the split, never how much exists.

/** Default refundable stake, in $BASE, to compete for a season's prize pool.
 * Deliberately anchored to the cheapest existing sink (VIP pass burn / first
 * bag expansion are both 10,000) — "start low" per docs/base-demand.md, so it
 * never recreates the entry gate one layer in. */
export const SEASON_STAKE_BASE = 10_000;

/** First season the stake applies to. Season 1 ran to completion with no stake
 * and pays out under the rules its players actually competed under; changing
 * that retroactively would disqualify everyone who didn't pay, after the fact. */
export const SEASON_STAKE_FIRST_SEASON = 2;

/** Per-season stake overrides, same shape as the pool table (DAO-settable). */
export const SEASON_STAKES: Record<number, number> = {};

/** The refundable $BASE stake for a season — 0 when that season has no stake. */
export function seasonStakeAmount(seasonNumber: number): number {
  if (seasonNumber < SEASON_STAKE_FIRST_SEASON) return 0;
  return SEASON_STAKES[seasonNumber] ?? SEASON_STAKE_BASE;
}

/** Whether a season splits its pool among staked entrants only. */
export function seasonRequiresStake(seasonNumber: number): boolean {
  return seasonStakeAmount(seasonNumber) > 0;
}

/**
 * Season rewards require a connected X account.
 *
 * A distribution decision, not a gameplay one: the payout is the moment players
 * care most, so it's where a social connect converts best. Costs the player
 * nothing but an OAuth tap, and the link is already worth +50 season points.
 *
 * IMPORTANT — this gates MONEY THAT IS ALREADY OWED, so two guards exist and
 * must stay:
 *  - The server only enforces it when X connect is actually configured
 *    (X_CLIENT_ID + X_REDIRECT_URI). Enforcing it while the OAuth app is
 *    unconfigured would disqualify EVERY player and strand the whole pool —
 *    see isXLinkConfigured() in server/src/auth/xAuth.ts.
 *  - The in-game Season panel shows the requirement to anyone unlinked, well
 *    before payout day, so nobody discovers it by silently not being paid.
 *
 * Posting about a season is deliberately NOT required to be paid — that would
 * be paying for an undisclosed endorsement. It's prompted and celebrated after
 * the link lands instead.
 */
export const SEASON_REWARD_REQUIRES_X = true;

/**
 * Season rewards also require a verified PUBLIC POST about the season.
 *
 * Verified the same free way as the X engagement tasks: the player's post must
 * be authored by their linked handle and contain their unguessable per-player
 * code, read back through X's public oEmbed (no paid API) — see
 * server/src/auth/xVerify.ts.
 *
 * DISCLOSURE — this is why the required copy is not free-form. The post is
 * compensated (it is a condition of receiving $BASE), which in most advertising
 * regimes makes it an endorsement that has to be identifiable as such. The
 * suggested text therefore states plainly that the player is collecting a Season
 * reward, and `SEASON_POST_REQUIRED_TAG` must appear in it. Do not "simplify"
 * that away into a generic brag post — the disclosure is load-bearing, not
 * branding.
 *
 * Still a DELAY, not a forfeiture: an unposted player's share is held, never
 * redistributed (see the divisor note in server/src/season/payout.ts).
 */
export const SEASON_REWARD_REQUIRES_POST = true;

/** Must appear in the proof post. Doubles as the disclosure marker. */
export const SEASON_POST_REQUIRED_TAG = "#MetricBaseWorld";

/** The post copy we hand the player, with their code already in it. */
export function seasonPostText(seasonNumber: number, code: string, playUrl: string): string {
  return (
    `I'm collecting my Season ${seasonNumber} reward in MetricBase World 🏆\n\n` +
    `A player-run economy on Solana — gather, craft, trade and build.\n\n` +
    `Play free → ${playUrl}\n${SEASON_POST_REQUIRED_TAG} ${code}`
  );
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
  | "xLink"
  | "xTask"
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
  // One-time bonus for connecting an X (Twitter) account to the character.
  // A unique index on x_user_id (one X account ⇄ one character) plus a
  // once-per-character award flag keep this from being farmed with alts.
  xLink: 50,
  // Per-task reward (reply/repost campaigns); the actual amount is set per task,
  // so this per-unit default is unused (like richest).
  xTask: 0,
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
export const REFERRAL_QUALIFY_LEVEL = 3;

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
  xLink: "X account",
  xTask: "X tasks",
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
  /** Whether a connected X account is needed to be PAID this season's reward.
   * False when the server has no X app configured, so the panel never asks for
   * something that can't be done. */
  xRequiredForReward: boolean;
  /** Whether this player has connected X. */
  xLinked: boolean;
  /** Their X handle when linked, for the "you're all set" confirmation. */
  xUsername: string | null;
  /** Whether a verified public post is also needed to be paid. */
  postRequiredForReward: boolean;
  /** Whether this player's season post has been verified. */
  posted: boolean;
  /** This player's unguessable proof code, "" until X is linked. */
  postCode: string;
  /** Refundable $BASE stake to compete for the pool; 0 = no stake this season. */
  stakeAmount: number;
  /** Whether this player has staked into the current season's prize race. */
  staked: boolean;
  /** How many players have staked in. */
  entrants: number;
}

/** Estimated pool share for `points` given the total points in play.
 *
 * `totalPoints` must be the points of players who are actually in the split —
 * for a staked season that is the ENTRANTS' total, not every player's, or the
 * estimate reads low for everyone who paid. */
export function estimateReward(points: number, totalPoints: number, pool = SEASON_REWARD_POOL_BASE): number {
  if (totalPoints <= 0 || points <= 0) return 0;
  return Math.floor((points / totalPoints) * pool);
}
