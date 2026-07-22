import { isWalletIdentity } from "../auth/telegramAuth.js";
import { getPool } from "./pool.js";
import {
  SEASON_RICHEST_DAILY_BONUS,
  currentSeason,
  seasonRewardPool,
  type SeasonCategory,
  type SeasonLeaderEntry,
} from "@metricbase/shared";

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

/** The fixed $BASE prize pool for the current season. Season 1 = 1,000,000
 * (funded from the dev/admin wallet); later seasons are set by DAO vote via
 * SEASON_REWARD_POOLS. */
export function getSeasonRewardPool(): number {
  return seasonRewardPool(currentSeason().number);
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
      // $3 is cast to int at every use — Postgres can't infer a bind param's
      // type inside jsonb_build_object()/to_jsonb() otherwise (error 42P08).
      `INSERT INTO season_state (player_name, season_id, points, breakdown)
       VALUES ($1, $2, $3::int, jsonb_build_object($4::text, $3::int))
       ON CONFLICT (player_name) DO UPDATE SET
         season_id = $2,
         points = CASE WHEN season_state.season_id = $2 THEN season_state.points + $3::int ELSE $3::int END,
         breakdown = CASE WHEN season_state.season_id = $2
           THEN jsonb_set(
                  COALESCE(season_state.breakdown, '{}'::jsonb),
                  ARRAY[$4::text],
                  to_jsonb(COALESCE((season_state.breakdown ->> $4)::int, 0) + $3::int))
           ELSE jsonb_build_object($4::text, $3::int) END`,
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

// ── End-of-season payout ─────────────────────────────────────────────────────

export interface PayoutTarget {
  name: string;
  wallet: string;
  points: number;
}

/**
 * Players eligible for a season payout: points > 0 AND a real address to pay.
 *
 * The address is `payout_wallet` when the player nominated one, else their own
 * identity wallet. Telegram players are stored under a synthetic `tg:<id>` key
 * (see auth/telegramAuth.ts) and have no address of their own, so they become
 * payable only once they set a payout wallet on the dashboard.
 *
 * The `NOT LIKE 'tg:%'` filter plus the isWalletIdentity() pass are belt and
 * braces on purpose: this is the last point before an IRREVERSIBLE on-chain
 * transfer, and handing `tg:123` to a transfer must be impossible.
 */
export async function loadSeasonPayoutTargets(seasonId: string): Promise<PayoutTarget[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ player_name: string; wallet_address: string; points: number }>(
      `SELECT s.player_name,
              COALESCE(c.payout_wallet, c.wallet_address) AS wallet_address,
              s.points
       FROM season_state s
       JOIN characters c ON c.name = s.player_name
       WHERE s.season_id = $1 AND s.points > 0
         AND COALESCE(c.payout_wallet, c.wallet_address) IS NOT NULL
         AND COALESCE(c.payout_wallet, c.wallet_address) NOT LIKE 'tg:%'
       ORDER BY s.points DESC, s.player_name ASC`,
      [seasonId],
    );
    return res.rows
      .filter((r) => isWalletIdentity(r.wallet_address))
      .map((r) => ({ name: r.player_name, wallet: r.wallet_address, points: r.points }));
  } catch (error) {
    console.warn("[season] payout targets failed:", error);
    return [];
  }
}

/** Atomically claim the payout slot for a player. Returns true only for the
 * caller that inserted the row (idempotency guard before the on-chain send). */
export async function claimSeasonPayout(
  seasonId: string,
  playerName: string,
  wallet: string,
  amount: number,
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      `INSERT INTO season_payout (season_id, player_name, wallet, amount)
       VALUES ($1, $2, $3, $4::bigint)
       ON CONFLICT (season_id, player_name) DO NOTHING
       RETURNING player_name`,
      [seasonId, playerName, wallet, amount],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[season] claim payout failed:", error);
    return false;
  }
}

/** Stamp a claimed payout with its confirmed tx signature. */
export async function finalizeSeasonPayout(seasonId: string, playerName: string, signature: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      "UPDATE season_payout SET signature = $3, paid_at = NOW() WHERE season_id = $1 AND player_name = $2",
      [seasonId, playerName, signature],
    );
  } catch (error) {
    console.warn("[season] finalize payout failed:", error);
  }
}

/** Release an unpaid claim (payout failed) so a retry can attempt it again. */
export async function unclaimSeasonPayout(seasonId: string, playerName: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      "DELETE FROM season_payout WHERE season_id = $1 AND player_name = $2 AND signature IS NULL",
      [seasonId, playerName],
    );
  } catch (error) {
    console.warn("[season] unclaim payout failed:", error);
  }
}

/** Count + sum of already-completed payouts for a season (signature present). */
export async function getSeasonPayoutSummary(seasonId: string): Promise<{ paid: number; total: number }> {
  const pool = getPool();
  if (!pool) return { paid: 0, total: 0 };
  try {
    const res = await pool.query<{ paid: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE signature IS NOT NULL)::text AS paid,
              COALESCE(SUM(amount) FILTER (WHERE signature IS NOT NULL), 0)::text AS total
       FROM season_payout WHERE season_id = $1`,
      [seasonId],
    );
    const r = res.rows[0];
    return { paid: r ? Number(r.paid) : 0, total: r ? Number(r.total) : 0 };
  } catch (error) {
    console.warn("[season] payout summary failed:", error);
    return { paid: 0, total: 0 };
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
