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
// Competing for the prize pool costs a $BASE DEPOSIT. This exists because the
// pool pays out continuously with essentially no matching inflow (see
// docs/base-demand.md — 2 distinct wallets have ever paid the treasury). The
// deposit couples pool outflow to token inflow without re-gating entry:
//
//  - Playing stays free. Points still accrue for everyone, and the leaderboard
//    still ranks everyone — a non-entrant simply isn't in the payout split.
//  - The deposit is the player's money throughout. It sits in a vault they
//    withdraw from themselves (see below), so it is a treasury liability for as
//    long as they leave it there — the payout's solvency check covers the whole
//    outstanding vault as well as prizes.
//  - It never mints $BASE and never converts gold → $BASE (the hard invariant
//    in docs/company-coin.md). The pool is still fixed and pre-funded; the
//    deposit decides *who* is in the split and their multiplier, never how much
//    exists to be won.

/** Minimum deposit, in $BASE, to be in a season's prize-pool split. Also the
 * denominator of the multiplier curve, so it sets the whole ladder's scale.
 * Deliberately anchored to the cheapest existing sink (VIP pass burn / first
 * bag expansion are both 10,000) — "start low" per docs/base-demand.md, so it
 * never recreates the entry gate one layer in. */
export const SEASON_STAKE_BASE = 10_000;

/** First season the deposit applies to. Season 1 ran to completion with no stake
 * and pays out under the rules its players actually competed under; changing
 * that retroactively would disqualify everyone who didn't pay, after the fact. */
export const SEASON_STAKE_FIRST_SEASON = 2;

/** Per-season stake overrides, same shape as the pool table (DAO-settable). */
export const SEASON_STAKES: Record<number, number> = {};

/** The minimum $BASE deposit for a season — 0 when that season has no stake. */
export function seasonStakeAmount(seasonNumber: number): number {
  if (seasonNumber < SEASON_STAKE_FIRST_SEASON) return 0;
  return SEASON_STAKES[seasonNumber] ?? SEASON_STAKE_BASE;
}

/** Whether a season splits its pool among staked entrants only. */
export function seasonRequiresStake(seasonNumber: number): boolean {
  return seasonStakeAmount(seasonNumber) > 0;
}

// ── Deposit vault: bigger deposit, bigger multiplier ─────────────────────────
//
// The stake is a VAULT BALANCE, not a one-shot fee. A player tops it up to
// raise their season-point multiplier, and withdraws from it (in part or in
// full) once the season it was deposited in has ended.
//
// Why a smooth curve rather than tiers: tiers create cliff edges, and a cliff
// edge is a thing to game — deposit exactly enough to clear a step and not one
// token more, and feel cheated at 1 token under. sqrt() means every token does
// something, with diminishing returns built in.
//
// Why it is capped: uncapped, the season would simply be won by whoever holds
// the most $BASE. The cap puts a ceiling on what capital alone can buy, which
// is reached at CAP² × the floor — past that, extra deposit buys nothing and
// the UI says so plainly rather than quietly taking it.
//
// INVARIANT CHECK (same reasoning as the Founder NFT multiplier in
// shared/src/nft.ts): season points decide each player's SHARE of a fixed,
// PRE-FUNDED pool. A multiplier redistributes a pot that already exists — it
// mints no $BASE, and it opens no gold → $BASE path. What is new here is that
// the deposit comes BACK, so the multiplier's real cost is the withdrawal fee
// plus the lockup, not the deposit itself.

/** Ceiling on the deposit multiplier. Reached at CAP² × the entry floor. */
export const SEASON_STAKE_MULT_CAP = 2;

/**
 * Season-point multiplier for a vault balance.
 *
 * Below the entry floor there is no multiplier — that player isn't in the
 * split at all, so there is nothing to multiply.
 */
export function seasonStakeMultiplier(balance: number, seasonNumber: number): number {
  const floor = seasonStakeAmount(seasonNumber);
  if (floor <= 0 || !Number.isFinite(balance) || balance < floor) return 1;
  return Math.min(SEASON_STAKE_MULT_CAP, Math.sqrt(balance / floor));
}

/** The deposit at which the multiplier caps out (extra beyond this buys none). */
export function seasonStakeMultiplierCapAt(seasonNumber: number): number {
  return seasonStakeAmount(seasonNumber) * SEASON_STAKE_MULT_CAP * SEASON_STAKE_MULT_CAP;
}

// ── Withdrawals ──────────────────────────────────────────────────────────────
//
// Withdrawing is MANUAL and PARTIAL: a player takes out as much or as little as
// they like, whenever their deposit has unlocked, and what they leave in keeps
// working as their multiplier for the next season. Nothing is auto-returned at
// payout, so a player who wants to keep competing never has to re-deposit.
//
// The fee is what makes the multiplier cost something. Without it a large
// deposit would be free advantage — put it in, outscore everyone, take it all
// back. It is charged on the amount WITHDRAWN (not on the balance, and not on
// prize winnings, which are paid in full), and it stays in the treasury, which
// is the inflow the whole stake mechanism exists to create.

/** Percent taken from each withdrawal, kept by the treasury. */
export const SEASON_WITHDRAW_FEE_PCT = 5;

/** Split a requested withdrawal into the treasury's fee and the player's net.
 *  The fee rounds UP so rounding can never pay out more than was withdrawn. */
export function seasonWithdrawSplit(amount: number): { fee: number; net: number } {
  if (!Number.isFinite(amount) || amount <= 0) return { fee: 0, net: 0 };
  const fee = Math.ceil((amount * SEASON_WITHDRAW_FEE_PCT) / 100);
  return { fee, net: Math.max(0, amount - fee) };
}

/** A player's vault, as the season panel renders it. All in $BASE UI units. */
export interface SeasonVaultView {
  /** Everything currently deposited. Drives the multiplier and entry. */
  balance: number;
  /** Deposited during the CURRENT season — locked until it ends. */
  locked: number;
  /** balance − locked: what can be withdrawn right now. */
  withdrawable: number;
  /** Multiplier this balance is currently earning. */
  multiplier: number;
  /** Balance at which the multiplier caps out. */
  capAt: number;
  /** Fee percent charged on a withdrawal. */
  feePct: number;
  /** Lifetime fees this player has paid on withdrawals. */
  feesPaid: number;
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

/** Season points for sharing a Magic Chest haul on X.
 *
 * ⚠️ AWARDED ONCE PER CHEST, not once per tap. Season points decide how a
 * 1,000,000 $BASE pool is split, so anything that pays for a free, repeatable
 * client action is a points printer — you would tap Share in a loop. The claim
 * is keyed on the chest's payment signature (`chest_opens.shared_at`), so the
 * cost of the next 10 points is the cost of the next chest. */
export const CHEST_SHARE_SEASON_POINTS = 10;

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
  | "xShare"
  | "richest"
  | "chest";

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
  // Sharing a Magic Chest haul on X. Bounded by the CHEST, not by the click:
  // one award per chest_opens signature, so another 10 points costs another
  // chest (≥1,000 $BASE). A per-click award would be an unbounded free points
  // faucet into a pool that pays out real $BASE.
  xShare: CHEST_SHARE_SEASON_POINTS,
  // Richest is awarded on a fixed daily schedule by rank (SEASON_RICHEST_DAILY_BONUS),
  // not per-unit — this per-unit entry is unused.
  richest: 0,
  // Magic Chest rolls carry their own amount (CHEST_POOLS), so this per-unit
  // default is unused. Booked as its own category on purpose: it keeps BOUGHT
  // points separable from EARNED ones on /stats and in the breakdown, which is
  // the only way to tell later whether chests are distorting the leaderboard.
  chest: 0,
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
  xShare: "Chest shares",
  richest: "Richest bonus",
  chest: "Magic Chests",
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
  /** Minimum $BASE deposit to compete for the pool; 0 = no stake this season. */
  stakeAmount: number;
  /** Whether this player's vault balance meets the entry floor. */
  staked: boolean;
  /** How many players have staked in. */
  entrants: number;
  /** This player's deposit vault — balance, lock state and multiplier. */
  vault: SeasonVaultView;
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
