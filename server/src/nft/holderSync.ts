import { holderSkinIds } from "@metricbase/shared";
import { getPool } from "../db/pool.js";
import { grantSkin, revokeSkins } from "../db/chests.js";
import { heldNftCount, isNftConfigured } from "../solana/playerHeldNfts.js";

// Ties on-chain holder detection to the game's own state: cache the holder flag
// on the character row, and grant/revoke the holder-only cosmetic skins so a
// wallet that sells loses the flair (but keeps anything it earned elsewhere).
//
// INERT when unconfigured: isNftConfigured() short-circuits everything, so with
// no collection set this never touches the chain or the database.

export interface HolderStatus {
  holder: boolean;
  count: number;
}

/**
 * Reconcile a character's holder status from the chain.
 *
 * Safe to call on every join and on the maintenance sweep: it's idempotent,
 * fails closed (an RPC hiccup leaves the player a non-holder for perks, never
 * grants power — there is none to grant), and never throws into the caller.
 */
export async function syncNftHolder(
  playerName: string,
  wallet: string | null | undefined,
): Promise<HolderStatus> {
  if (!isNftConfigured() || !wallet) {
    return { holder: false, count: 0 };
  }

  let count = 0;
  try {
    count = await heldNftCount(wallet);
  } catch (error) {
    console.warn(`[nft] sync failed for ${playerName}: ${(error as Error).message}`);
    return { holder: false, count: 0 };
  }
  const holder = count > 0;

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        "UPDATE characters SET nft_holder = $2, nft_count = $3, nft_checked_at = NOW() WHERE name = $1",
        [playerName, holder, count],
      );
    } catch (error) {
      console.warn(`[nft] holder-column update failed for ${playerName}: ${(error as Error).message}`);
    }
  }

  // Grant on hold, revoke on sell. Holder skins are their own id namespace, so
  // revoking can never remove a chest-won cosmetic.
  try {
    if (holder) {
      for (const skinId of holderSkinIds()) await grantSkin(playerName, skinId);
    } else {
      await revokeSkins(playerName, holderSkinIds());
    }
  } catch (error) {
    console.warn(`[nft] skin reconcile failed for ${playerName}: ${(error as Error).message}`);
  }

  return { holder, count };
}
