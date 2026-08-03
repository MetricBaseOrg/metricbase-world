// MetricBase World — NFT community layer (membership drop + tiers + reveal).
//
// This is pure config + helpers. It grants STATUS and COSMETICS to holders of a
// Solana NFT collection — never power. The invariants this must never break
// (see docs/company-coin.md, docs/base-demand.md): entry stays free, holding an
// NFT never affects yield/damage/XP/drop-rate/season-points/economy, and gold
// never converts to $BASE. A holder's only edge is how they look, a badge, a
// bit of community access, and a modest DAO voting boost (governance is status).
//
// The whole feature is INERT until a collection address is configured on the
// server (NFT_COLLECTION_ADDRESS). With none set, holder detection returns
// nobody and nothing here has any effect.

/** Display metadata shown in-client. The mint URL is where players buy in. */
export const NFT_COLLECTION_NAME = "MetricBase Founders";
export const NFT_SUPPLY = 1000;
export const NFT_MINT_PRICE_SOL = 0.1;

/**
 * Marketplace / mint link shown on the Membership panel. Empty means "not live
 * yet" and the client shows a coming-soon state instead of a dead link.
 */
export const NFT_MINT_URL = "https://launchmynft.io/mint/founder";

// ── Tiers + reveal ───────────────────────────────────────────────────────────
//
// Each NFT carries an on-chain attribute (trait_type NFT_TIER_TRAIT) whose value
// places it in a tier. Higher-rank tiers get MORE STATUS — a distinct badge,
// name colour, cosmetic skins, and a larger DAO voting bonus — never any
// gameplay power. A wallet's effective tier is the highest it holds.
//
// REVEAL: before a collection is revealed, its metadata has no Tier attribute
// (or an "Unrevealed" placeholder). Unknown/missing values fall back to the base
// tier, so a pre-reveal holder still gets a crown and base perks, and is
// automatically upgraded to their real tier on the next holder resync (join /
// maintenance sweep) once the launchpad swaps in the revealed metadata. No
// special reveal event handling is needed in-game.

/** The metadata trait_type that carries the tier. Match your collection's art. */
export const NFT_TIER_TRAIT = "Tier";

export interface NftTier {
  /** Stable id — also stored in characters.nft_tier and sent to the client. */
  key: string;
  name: string;
  /** Nameplate / profile badge (emoji). */
  badge: string;
  /** Name-tint hex. */
  flairColor: string;
  /** Ordering — the highest rank a wallet holds wins. */
  rank: number;
  /** Extra DAO voting weight ($BASE-equivalent). Status, not power; kept below
   *  the vote floor so it never dominates. */
  daoWeightBonus: number;
  /** Holder skins unlocked at this tier (cumulative up the ladder). */
  skinIds: string[];
  /** On-chain Tier attribute values that map here (case-insensitive). Include
   *  common synonyms so the collection's trait naming is flexible. */
  match: string[];
}

/**
 * The tier ladder, ascending. Retune freely — names, count, and perks are all
 * data. Perks stay status/cosmetic/DAO-weight ONLY. `daoWeightBonus` values are
 * deliberately under DAO_MIN_VOTE_BALANCE (1,000,000) so even the top tier is a
 * boost, not a takeover.
 */
export const NFT_TIERS: NftTier[] = [
  {
    key: "bronze",
    name: "Bronze Founder",
    badge: "👑",
    flairColor: "#cd7f32",
    rank: 1,
    daoWeightBonus: 100_000,
    skinIds: ["skin_holder_founder"],
    match: ["bronze", "common", "standard", "citizen"],
  },
  {
    key: "gold",
    name: "Gold Founder",
    badge: "🌟",
    flairColor: "#f5c518",
    rank: 2,
    daoWeightBonus: 250_000,
    skinIds: ["skin_holder_founder", "skin_holder_midnight"],
    match: ["gold", "rare", "patron"],
  },
  {
    key: "ember",
    name: "Ember Founder",
    badge: "🔥",
    flairColor: "#e8705f",
    rank: 3,
    daoWeightBonus: 500_000,
    skinIds: ["skin_holder_founder", "skin_holder_midnight", "skin_holder_aurora"],
    match: ["ember", "legendary", "mythic", "obsidian"],
  },
];

/** Tier assigned before reveal, or when the Tier attribute is missing/unknown. */
export const NFT_BASE_TIER_KEY = "bronze";

export function baseTier(): NftTier {
  return NFT_TIERS.find((t) => t.key === NFT_BASE_TIER_KEY) ?? NFT_TIERS[0];
}

export function nftTierByKey(key: string | null | undefined): NftTier | null {
  if (!key) return null;
  return NFT_TIERS.find((t) => t.key === key) ?? null;
}

/** Map an on-chain Tier attribute value to a tier, base tier if unrecognised. */
export function tierFromAttribute(value: string | null | undefined): NftTier {
  const v = (value ?? "").trim().toLowerCase();
  if (v) {
    const hit = NFT_TIERS.find((t) => t.key === v || t.match.some((m) => m.toLowerCase() === v));
    if (hit) return hit;
  }
  return baseTier();
}

/** The highest-rank tier among a set of tier keys (null if none). */
export function highestTier(keys: string[]): NftTier | null {
  let best: NftTier | null = null;
  for (const k of keys) {
    const t = nftTierByKey(k);
    if (t && (!best || t.rank > best.rank)) best = t;
  }
  return best;
}

// ── Holder cosmetic set ──────────────────────────────────────────────────────
//
// Every holder is granted the skins for their tier. They live in their OWN id
// namespace (`skin_holder_*`) and are NEVER in the chest roll pool, so revoking
// on a sale/downgrade can't strip a chest-won skin. `available` is the art gate,
// exactly like COSMETIC_SKINS in chests.ts.

export interface HolderSkin {
  id: string;
  name: string;
  blurb: string;
  /** Lowest tier that unlocks this skin — shown in the wardrobe. */
  tierKey: string;
  available: boolean;
}

export const HOLDER_SKINS: HolderSkin[] = [
  { id: "skin_holder_founder", name: "Founder's Regalia", blurb: "The original crest — every Founder wears it.", tierKey: "bronze", available: false },
  { id: "skin_holder_midnight", name: "Midnight Ember", blurb: "A dark set lit by a slow inner glow.", tierKey: "gold", available: false },
  { id: "skin_holder_aurora", name: "Aurora Weave", blurb: "Cloth that shifts through aurora colours.", tierKey: "ember", available: false },
];

/** Every holder skin id across all tiers — the source of truth for revoke. */
export function holderSkinIds(): string[] {
  return [...new Set(NFT_TIERS.flatMap((t) => t.skinIds))];
}

/** True for skins that can ONLY be obtained by holding — safe to revoke. */
export function isHolderSkin(skinId: string): boolean {
  return holderSkinIds().includes(skinId);
}
