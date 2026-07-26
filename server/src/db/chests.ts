// Magic Chest persistence — the audit trail and the skin locker.
//
// Chests pay out real value for real money, so the rolled result is recorded
// before the player is told what they got: a support question ("I opened a
// Mythic and got nothing") has to be answerable from the database, not from
// trusting a client log.

import type { ChestReward } from "@metricbase/shared";
import { getPool } from "./pool.js";

/**
 * Claim this burn signature for a chest open. Returns false when the signature
 * was already used — the idempotency guard that stops a replayed `chestOpen`
 * message from rolling a second payout off one payment.
 *
 * Claimed BEFORE the rewards are granted, then filled in by recordChestRewards.
 */
export async function claimChestOpen(
  signature: string,
  playerName: string,
  wallet: string,
  tierId: string,
  price: number,
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return true; // no DB: allow play, nothing to dedupe against
  try {
    const res = await pool.query(
      `INSERT INTO chest_opens (signature, player_name, wallet, tier_id, price)
       VALUES ($1, $2, $3, $4, $5::bigint)
       ON CONFLICT (signature) DO NOTHING
       RETURNING signature`,
      [signature, playerName, wallet, tierId, price],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[chest] claim failed:", error);
    return false; // fail closed — never pay out on a claim we couldn't record
  }
}

/** Stamp what the chest actually rolled. */
export async function recordChestRewards(signature: string, rewards: ChestReward[]): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("UPDATE chest_opens SET rewards = $2::jsonb WHERE signature = $1", [
      signature,
      JSON.stringify(rewards),
    ]);
  } catch (error) {
    console.warn("[chest] record rewards failed:", error);
  }
}

/** Release a claim when the payout failed before anything was granted. */
export async function releaseChestOpen(signature: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM chest_opens WHERE signature = $1 AND rewards = '[]'::jsonb", [signature]);
  } catch (error) {
    console.warn("[chest] release failed:", error);
  }
}

// ── Skins ───────────────────────────────────────────────────────────────────

export async function grantSkin(playerName: string, skinId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO player_skins (player_name, skin_id) VALUES ($1, $2)
       ON CONFLICT (player_name, skin_id) DO NOTHING`,
      [playerName, skinId],
    );
  } catch (error) {
    console.warn("[chest] grant skin failed:", error);
  }
}

export async function loadOwnedSkins(playerName: string): Promise<string[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ skin_id: string }>(
      "SELECT skin_id FROM player_skins WHERE player_name = $1",
      [playerName],
    );
    return res.rows.map((r) => r.skin_id);
  } catch (error) {
    console.warn("[chest] load skins failed:", error);
    return [];
  }
}
