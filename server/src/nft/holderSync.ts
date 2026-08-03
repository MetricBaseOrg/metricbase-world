import { holderSkinIds, nftTierByKey } from "@metricbase/shared";
import { getPool } from "../db/pool.js";
import { grantSkin, revokeSkins } from "../db/chests.js";
import { heldNftCount, holderTierKey, isNftConfigured } from "../solana/playerHeldNfts.js";

// Ties on-chain holder detection to the game's own state: cache the holder flag
// and TIER on the character row, and grant/revoke the tier's cosmetic skins so a
// wallet that sells (or downgrades) loses the extra flair but keeps anything it
// earned elsewhere.
//
// INERT when unconfigured: isNftConfigured() short-circuits everything.

export interface HolderStatus {
  holder: boolean;
  count: number;
  /** Highest tier key held, or null. */
  tierKey: string | null;
}

/**
 * Reconcile a character's holder status + tier from the chain.
 *
 * Safe on every join and the maintenance sweep: idempotent, fails closed (an RPC
 * hiccup leaves the player a non-holder for perks, never grants power), never
 * throws into the caller. Picks up a REVEAL automatically — once the launchpad
 * swaps in tiered metadata, the next sync reads the new tier and upgrades skins.
 */
export async function syncNftHolder(
  playerName: string,
  wallet: string | null | undefined,
): Promise<HolderStatus> {
  if (!isNftConfigured() || !wallet) {
    return { holder: false, count: 0, tierKey: null };
  }

  let count = 0;
  let tierKey: string | null = null;
  try {
    count = await heldNftCount(wallet);
    tierKey = count > 0 ? await holderTierKey(wallet) : null;
  } catch (error) {
    console.warn(`[nft] sync failed for ${playerName}: ${(error as Error).message}`);
    return { holder: false, count: 0, tierKey: null };
  }
  const holder = count > 0;
  const tier = nftTierByKey(tierKey);

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        "UPDATE characters SET nft_holder = $2, nft_count = $3, nft_tier = $4, nft_checked_at = NOW() WHERE name = $1",
        [playerName, holder, count, tierKey],
      );
    } catch (error) {
      console.warn(`[nft] holder-column update failed for ${playerName}: ${(error as Error).message}`);
    }
  }

  // Grant this tier's skins; revoke any other holder skins (handles sell AND
  // downgrade). Holder skins are their own id namespace, so this can never
  // remove a chest-won cosmetic.
  try {
    const grant = holder && tier ? tier.skinIds : [];
    const revoke = holderSkinIds().filter((id) => !grant.includes(id));
    for (const skinId of grant) await grantSkin(playerName, skinId);
    if (revoke.length) await revokeSkins(playerName, revoke);
  } catch (error) {
    console.warn(`[nft] skin reconcile failed for ${playerName}: ${(error as Error).message}`);
  }

  return { holder, count, tierKey };
}
