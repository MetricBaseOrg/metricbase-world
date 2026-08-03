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
 * The holder-exclusive cosmetic set. Every holder is granted ALL of these while
 * they hold; they live in their OWN id namespace (`skin_holder_*`) and are NEVER
 * in the chest roll pool, so revoking on a sale can't strip a chest-won skin.
 *
 * `available` is the art gate, exactly like COSMETIC_SKINS in chests.ts: until
 * the art ships (and the shared skin render path lands) a holder "owns" the skin
 * but it shows as "art coming" rather than rendering. Add new holder cosmetics
 * here; flip `available` in the same change that lands their art.
 */
export interface HolderSkin {
  id: string;
  name: string;
  blurb: string;
  available: boolean;
}

export const HOLDER_SKINS: HolderSkin[] = [
  { id: "skin_holder_founder", name: "Founder's Regalia", blurb: "The original crest — worn only by day-one holders.", available: false },
  { id: "skin_holder_midnight", name: "Midnight Ember", blurb: "A dark set lit by a slow inner glow.", available: false },
  { id: "skin_holder_aurora", name: "Aurora Weave", blurb: "Cloth that shifts through aurora colours.", available: false },
];

/**
 * What a holder gets beyond the cosmetic set.
 * - `badge` shows on the nameplate / profile.
 * - `nameFlairColor` tints the holder's name.
 */
export interface NftHolderPerks {
  badge: string;
  nameFlairColor: string;
}

export const HOLDER_PERKS: NftHolderPerks = {
  badge: "👑",
  nameFlairColor: "#f5c518",
};

/** Holder-exclusive skin ids — the source of truth for grant + revoke. */
export function holderSkinIds(): string[] {
  return HOLDER_SKINS.map((s) => s.id);
}

/** True for skins that can ONLY be obtained by holding — safe to revoke. */
export function isHolderSkin(skinId: string): boolean {
  return HOLDER_SKINS.some((s) => s.id === skinId);
}
