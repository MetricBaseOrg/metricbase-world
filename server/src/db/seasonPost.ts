// Verified season proof-posts — the second half of the reward requirements
// (SEASON_REWARD_REQUIRES_POST in shared/src/season.ts).
//
// A row here means: this player published a public post about the season, it was
// authored by their linked X handle, and it carried their per-player code. Only
// the verifier writes rows, so the payout can treat a row as proof.

import { getPool } from "./pool.js";

export interface SeasonPostRow {
  playerName: string;
  xUsername: string;
  postUrl: string;
}

/** Record a verified post. False when this player already has one, or the URL
 * was already used for this season — both are "nothing happened", not errors. */
export async function recordSeasonPost(
  seasonId: string,
  playerName: string,
  wallet: string,
  xUsername: string,
  postUrl: string,
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      `INSERT INTO season_post (season_id, player_name, wallet, x_username, post_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (season_id, player_name) DO NOTHING
       RETURNING player_name`,
      [seasonId, playerName, wallet, xUsername, postUrl],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    // Unique violation on the URL index lands here: someone else already used
    // that post for this season.
    console.warn("[season] record post failed:", error);
    return false;
  }
}

/** Whether this player's season post is verified. */
export async function hasPostedFor(seasonId: string, playerName: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      "SELECT 1 FROM season_post WHERE season_id = $1 AND player_name = $2 LIMIT 1",
      [seasonId, playerName],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[season] posted check failed:", error);
    return false;
  }
}

/** Whether this post URL has already been claimed by someone this season. */
export async function isPostUrlUsed(seasonId: string, postUrl: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      "SELECT 1 FROM season_post WHERE season_id = $1 AND post_url = $2 LIMIT 1",
      [seasonId, postUrl],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[season] post url check failed:", error);
    return true; // fail closed — never let one post pay two players
  }
}

/** Every player with a verified post this season, for the payout gate. */
export async function loadPostedPlayers(seasonId: string): Promise<Set<string>> {
  const pool = getPool();
  if (!pool) return new Set();
  try {
    const res = await pool.query<{ player_name: string }>(
      "SELECT player_name FROM season_post WHERE season_id = $1",
      [seasonId],
    );
    return new Set(res.rows.map((r) => r.player_name));
  } catch (error) {
    console.warn("[season] load posted players failed:", error);
    return new Set();
  }
}
