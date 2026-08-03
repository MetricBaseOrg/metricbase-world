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

/**
 * Claim the one-off "shared this haul on X" bonus for a chest.
 *
 * Returns true exactly once per chest. The guard is the UPDATE's own WHERE —
 * `shared_at IS NULL` inside a single statement, so two taps racing each other
 * cannot both come back with a row. Also requires the chest to belong to the
 * claiming player, because the signature is public on-chain: without that check
 * anyone could read a signature off Solscan and claim someone else's bonus.
 *
 * NO DATABASE = NO BONUS (returns false), deliberately: with nowhere to record
 * the claim there is nothing to stop it being claimed forever, and season
 * points are a real-money-adjacent currency.
 */
export async function claimChestShare(signature: string, playerName: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      `UPDATE chest_opens SET shared_at = NOW()
        WHERE signature = $1 AND player_name = $2 AND shared_at IS NULL
       RETURNING signature`,
      [signature, playerName],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[chest] share claim failed:", error);
    return false;
  }
}

/** Whether this chest's share bonus is already spent (so the UI can say so). */
export async function isChestShared(signature: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    const res = await pool.query(
      "SELECT 1 FROM chest_opens WHERE signature = $1 AND shared_at IS NOT NULL LIMIT 1",
      [signature],
    );
    return (res.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

// ── Paid-but-unverified queue ───────────────────────────────────────────────
//
// A player's tokens leave their wallet BEFORE we can verify anything. If Solana
// is unreachable at that moment, the honest state is "we don't know yet", and
// the one thing we must never do is treat that as "no" and walk away from real
// money. These rows are the memory of a payment we still owe an answer on.

export interface PendingChestRow {
  signature: string;
  playerName: string;
  wallet: string;
  tierId: string;
  attempts: number;
}

/** Remember a payment we couldn't verify yet. Safe to call repeatedly. */
export async function recordPendingChest(
  signature: string,
  playerName: string,
  wallet: string,
  tierId: string,
  lastError: string | null,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO pending_chest_opens (signature, player_name, wallet, tier_id, last_error)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (signature) DO UPDATE SET last_error = EXCLUDED.last_error`,
      [signature, playerName, wallet, tierId, lastError],
    );
  } catch (error) {
    console.warn("[chest] could not queue pending payment:", error);
  }
}

/** Payments still owed to this player. */
export async function listPendingChests(playerName: string): Promise<PendingChestRow[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      signature: string;
      player_name: string;
      wallet: string;
      tier_id: string;
      attempts: number;
    }>(
      `SELECT signature, player_name, wallet, tier_id, attempts
         FROM pending_chest_opens
        WHERE player_name = $1
        ORDER BY created_at ASC
        LIMIT 20`,
      [playerName],
    );
    return res.rows.map((r) => ({
      signature: r.signature,
      playerName: r.player_name,
      wallet: r.wallet,
      tierId: r.tier_id,
      attempts: r.attempts,
    }));
  } catch (error) {
    console.warn("[chest] could not list pending payments:", error);
    return [];
  }
}

/** Settled — either granted, or proven never to have been a real payment. */
export async function clearPendingChest(signature: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM pending_chest_opens WHERE signature = $1", [signature]);
  } catch (error) {
    console.warn("[chest] could not clear pending payment:", error);
  }
}

/** Still unknown. Record the attempt so a stuck payment is visible, not silent. */
export async function bumpPendingChestAttempt(signature: string, lastError: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `UPDATE pending_chest_opens
          SET attempts = attempts + 1, last_tried_at = NOW(), last_error = $2
        WHERE signature = $1`,
      [signature, lastError],
    );
  } catch (error) {
    console.warn("[chest] could not bump pending attempt:", error);
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

/**
 * Remove skins a player no longer qualifies for (e.g. sold the NFT that granted
 * a holder-only skin). Only ever called with holder-exclusive skin ids, which
 * live in their own namespace and can't be won any other way — so this can't
 * strip a cosmetic someone earned from a chest.
 */
export async function revokeSkins(playerName: string, skinIds: string[]): Promise<void> {
  const pool = getPool();
  if (!pool || skinIds.length === 0) return;
  try {
    await pool.query(
      "DELETE FROM player_skins WHERE player_name = $1 AND skin_id = ANY($2)",
      [playerName, skinIds],
    );
  } catch (error) {
    console.warn("[nft] revoke skins failed:", error);
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
