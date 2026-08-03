// MetricBase World — NFT community layer (Phase 1: membership drop).
//
// This is pure config + helpers. It grants STATUS and COSMETICS to holders of a
// Solana NFT collection — never power. The invariants this must never break
// (see docs/company-coin.md, docs/base-demand.md): entry stays free, holding an
// NFT never affects yield/damage/XP/drop-rate/season-points/economy, and gold
// never converts to $BASE. A holder's only edge over a non-holder is how they
// look and a badge next to their name.
//
// The whole feature is INERT until a collection address is configured on the
// server (NFT_COLLECTION_ADDRESS). With none set, holder detection returns
// nobody and nothing here has any effect — safe to ship before the collection
// or its art exists.

/** Display metadata shown in-client. The mint URL is where players buy in. */
export const NFT_COLLECTION_NAME = "MetricBase Founders";
export const NFT_SUPPLY = 1000;
export const NFT_MINT_PRICE_SOL = 0.1;

/**
 * Marketplace / mint link shown on the Membership panel. Empty means "not live
 * yet" and the client shows a coming-soon state instead of a dead link. The
 * owner fills this in when the collection deploys (Magic Eden / Tensor).
 */
export const NFT_MINT_URL = "";

/**
 * What a holder gets. Every entry is cosmetic or status only.
 * - `skinIds` are holder-exclusive character skins. They live in their OWN id
 *   namespace (`skin_holder_*`) and are NEVER added to the chest roll pool, so
 *   revoking them when a wallet sells can't strip a skin someone won elsewhere.
 * - `badge` shows on the nameplate / profile.
 * - `nameFlairColor` tints the holder's name.
 */
export interface NftHolderPerks {
  skinIds: string[];
  badge: string;
  nameFlairColor: string;
}

export const HOLDER_PERKS: NftHolderPerks = {
  skinIds: ["skin_holder_founder"],
  badge: "👑",
  nameFlairColor: "#f5c518",
};

/** Holder-exclusive skin ids — the source of truth for grant + revoke. */
export function holderSkinIds(): string[] {
  return HOLDER_PERKS.skinIds;
}

/** True for skins that can ONLY be obtained by holding — safe to revoke. */
export function isHolderSkin(skinId: string): boolean {
  return HOLDER_PERKS.skinIds.includes(skinId);
}
