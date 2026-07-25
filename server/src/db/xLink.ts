import { getPool } from "./pool.js";
import { awardSeasonPointsDb } from "./season.js";
import { SEASON_POINTS } from "@metricbase/shared";

export interface LinkedX {
  xUserId: string;
  xUsername: string;
}

export type XLinkResult =
  | { ok: true; xUsername: string; awarded: number }
  | { ok: false; reason: string };

/**
 * Attach a (verified) X account to a wallet's character and, the FIRST time any
 * X account is linked to that character, award the one-time season-point bonus.
 *
 * Refusals mirror the Telegram link:
 *  - the X account is already linked to a DIFFERENT character (one X ⇄ one hero);
 *  - no character is bonded to this wallet yet.
 *
 * The 50-point bonus is guarded by `x_reward_awarded`, flipped in the SAME
 * UPDATE that records the link. So switching X accounts, or unlink/relink, never
 * pays it twice — it's once per character, for life.
 */
export async function linkXToWallet(
  wallet: string,
  xUserId: string,
  xUsername: string,
): Promise<XLinkResult> {
  const db = getPool();
  if (!db) return { ok: false, reason: "Database unavailable." };
  // Any authenticated identity may connect X (real wallet OR a Telegram `tg:`
  // character) — unlike payouts, this never touches an on-chain address.

  try {
    // Refuse if that X account already belongs to another character.
    const existing = await db.query<{ wallet_address: string | null }>(
      "SELECT wallet_address FROM characters WHERE x_user_id = $1 LIMIT 1",
      [xUserId],
    );
    const holder = existing.rows[0]?.wallet_address ?? null;
    if (holder && holder !== wallet) {
      return { ok: false, reason: "That X account is already connected to another player." };
    }

    // Link + report whether the one-time bonus still owes. The `prev` CTE
    // snapshots the row BEFORE the UPDATE (Postgres RETURNING otherwise reflects
    // the freshly-set flag), so `awarded_now` is true exactly once per character.
    const updated = await db.query<{ name: string; awarded_now: boolean }>(
      `WITH prev AS (
         SELECT name, COALESCE(x_reward_awarded, false) AS was_awarded
         FROM characters WHERE wallet_address = $3
       )
       UPDATE characters c
         SET x_user_id = $1,
             x_username = $2,
             x_linked_at = NOW(),
             x_reward_awarded = true,
             updated_at = NOW()
       FROM prev
       WHERE c.wallet_address = $3
       RETURNING prev.name, (NOT prev.was_awarded) AS awarded_now`,
      [xUserId, xUsername, wallet],
    );
    if (updated.rowCount === 0) {
      return { ok: false, reason: "No character bonded to this wallet yet — create one first." };
    }

    const row = updated.rows[0];
    let awarded = 0;
    if (row.awarded_now) {
      awarded = SEASON_POINTS.xLink;
      await awardSeasonPointsDb(row.name, "xLink", awarded);
    }
    return { ok: true, xUsername, awarded };
  } catch (error) {
    console.warn("[x-link] link failed:", error);
    return { ok: false, reason: "Could not connect X right now. Try again." };
  }
}

/** The X account attached to this wallet's character, if any. */
export async function getLinkedX(wallet: string): Promise<LinkedX | null> {
  const db = getPool();
  if (!db) return null;
  try {
    const res = await db.query<{ x_user_id: string | null; x_username: string | null }>(
      "SELECT x_user_id, x_username FROM characters WHERE wallet_address = $1 LIMIT 1",
      [wallet],
    );
    const r = res.rows[0];
    if (!r?.x_user_id) return null;
    return { xUserId: r.x_user_id, xUsername: r.x_username ?? "" };
  } catch {
    return null;
  }
}

/**
 * Detach the X account (they can reconnect any time). The reward flag is
 * DELIBERATELY left set, so unlink/relink can't re-farm the one-time bonus.
 */
export async function unlinkX(wallet: string): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  try {
    const res = await db.query(
      "UPDATE characters SET x_user_id = NULL, x_username = NULL, x_linked_at = NULL, updated_at = NOW() WHERE wallet_address = $1",
      [wallet],
    );
    return (res.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}
