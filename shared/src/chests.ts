// Magic Chests — $BASE-burning loot boxes.
//
// THE TUNABLES TABLE for the feature. Everything about what a chest costs, how
// often each rarity lands, and what can come out of it lives here as pure data,
// so balance changes never touch server logic.
//
// ── Economics, as decided by the owner on 2026-07-27 ───────────────────────
//
// These three rules REVERSE the ones this file shipped with. They were changed
// deliberately; the previous rationale is kept here so nobody "fixes" them back
// without knowing what the trade was.
//
// 1. CHESTS PAY THE TREASURY — they do NOT burn. The $BASE goes to the admin
//    wallet to FUND SEASON REWARDS, which is the whole point: the season pool
//    pays out with essentially no recurring inflow (docs/base-demand.md), and
//    chest revenue is the first real inflow against it. Chest spend therefore
//    lands in `token_purchases` and shows up on /stats → Treasury flow.
//    (Previously: burned. Burning removes supply but funds nothing.)
//
// 2. GOLD EV IS ABOVE THE CHEST PRICE — a chest is a BETTER gold deal than
//    Rudi's 1 $BASE = 1 gold desk, on purpose. Consequences, accepted knowingly:
//      • The gold desk is now the worse option and will effectively retire.
//      • Chests become the game's largest gold faucet. Chest gold is minted, so
//        watch `gold.minted` and the mint-pressure gauge on /stats — with only
//        ~114k gold circulating, a few large buyers move the whole supply.
//      • This is NOT a $BASE money printer: gold only returns to $BASE via the
//        peer-to-peer gold market, where another player supplies the $BASE. The
//        hard invariant (no gold → $BASE minting) still holds.
//
// 3. CHESTS CONTAIN GEAR — weapons, armour and tools. This sells power, which
//    docs/base-demand.md previously called non-negotiable. The mitigation now
//    carrying that weight is RARITY: gear sits in the rare/epic/legendary
//    buckets and those odds were cut hard (mythic legendary 4% → 1%), so gear
//    is an occasional prize rather than a reliable purchase. If a top-tier
//    weapon ever becomes routinely buyable, PvP balance and the crafting
//    economy are the things that break first — check `chest.opened.*` against
//    the crafting mastery numbers before loosening the odds further.
//
// 4. NEVER MINT $BASE. Chests grant gold/items/points — never $BASE.

import type { SeasonCategory } from "./season.js";

export type ChestRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const CHEST_RARITY_LABEL: Record<ChestRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

/** Matches the fish-rarity colours already used across the UI. */
export const CHEST_RARITY_COLOR: Record<ChestRarity, string> = {
  common: "#7b8894",
  uncommon: "#2f9e5e",
  rare: "#2f74c0",
  epic: "#8a44c8",
  legendary: "#b8860b",
};

export type ChestRewardKind = "gold" | "item" | "seasonPoints" | "skin";

export interface ChestRewardDef {
  kind: ChestRewardKind;
  /** Item id for `item`, skin id for `skin`; unused otherwise. */
  id?: string;
  /** Inclusive quantity range (gold amount, item count, or points). */
  min: number;
  max: number;
  /** Relative weight inside its rarity bucket. */
  weight: number;
  /** Set false for equipment: a tier's valueMult must not turn one Ember Blade
   * into four. Gear is a single prize; only stacks scale. */
  scale?: boolean;
}

/** One rolled reward, as resolved by the server. */
export interface ChestReward {
  kind: ChestRewardKind;
  rarity: ChestRarity;
  /** Item/skin id when applicable. */
  id?: string;
  /** Resolved amount (gold, item quantity, or season points). */
  amount: number;
  /** Display label the client can show without another lookup. */
  label: string;
}

export interface ChestTierDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** $BASE burned to open one. */
  price: number;
  /** How many rewards roll out of a single chest. */
  rolls: number;
  /** Multiplies every rolled amount. Higher tiers pay more per roll as well as
   * rolling better rarities — without this the pools cap out and a chest 20×
   * the price returns barely 3× the value, which is just a bad deal. */
  valueMult: number;
  /** Rarity odds for each roll. Must sum to 1. */
  odds: Record<ChestRarity, number>;
}

export const CHEST_TIERS: ChestTierDef[] = [
  {
    id: "wooden",
    name: "Wooden Chest",
    emoji: "🪵",
    blurb: "A humble crate. Mostly supplies, with a chance of something better.",
    price: 1_000,
    rolls: 3,
    valueMult: 0.9,
    odds: { common: 0.8, uncommon: 0.17, rare: 0.025, epic: 0.0045, legendary: 0.0005 },
  },
  {
    id: "silver",
    name: "Silver Chest",
    emoji: "🥈",
    blurb: "Banded in silver. Better odds, better hauls.",
    price: 3_000,
    rolls: 3,
    valueMult: 2.3,
    odds: { common: 0.68, uncommon: 0.25, rare: 0.055, epic: 0.013, legendary: 0.002 },
  },
  {
    id: "golden",
    name: "Golden Chest",
    emoji: "🥇",
    blurb: "Heavy with promise. Rare finds are the norm here.",
    price: 10_000,
    rolls: 4,
    valueMult: 4.8,
    odds: { common: 0.55, uncommon: 0.31, rare: 0.11, epic: 0.025, legendary: 0.005 },
  },
  {
    id: "mythic",
    name: "Mythic Chest",
    emoji: "✨",
    blurb: "Hums when you hold it. The best odds in the world.",
    price: 25_000,
    rolls: 5,
    valueMult: 7.8,
    odds: { common: 0.42, uncommon: 0.34, rare: 0.18, epic: 0.05, legendary: 0.01 },
  },
];

export function getChestTier(id: string): ChestTierDef | null {
  return CHEST_TIERS.find((t) => t.id === id) ?? null;
}

/** Cheapest chest, i.e. the minimum a payment must cover to be recoverable. */
export function cheapestChestPrice(): number {
  return Math.min(...CHEST_TIERS.map((t) => t.price));
}

/**
 * The best chest a given payment covers.
 *
 * Used by the recover-a-paid-chest path: the ON-CHAIN amount decides the tier,
 * never the client. Someone who paid for a Mythic must not be able to lose it by
 * picking the wrong tier from a dropdown, and someone who paid for a Wooden must
 * not be able to claim a Mythic.
 */
export function bestChestTierForAmount(uiAmount: number): ChestTierDef | null {
  const affordable = CHEST_TIERS.filter((t) => uiAmount + 1e-6 >= t.price);
  if (affordable.length === 0) return null;
  return affordable.reduce((best, t) => (t.price > best.price ? t : best));
}

/**
 * Reward pools by rarity. Shared across tiers — the TIER changes how often you
 * reach a bucket, not what's inside it, so adding a reward benefits every tier
 * and there's only one table to balance.
 */
export const CHEST_POOLS: Record<ChestRarity, ChestRewardDef[]> = {
  // Common carries the gold promise: it's ~half of every roll, so the headline
  // "better than the desk" rate is decided here more than anywhere else.
  common: [
    { kind: "gold", min: 450, max: 1_100, weight: 46 },
    { kind: "item", id: "item_wood", min: 5, max: 15, weight: 11 },
    { kind: "item", id: "item_ore", min: 5, max: 15, weight: 11 },
    { kind: "item", id: "item_wheat_seed", min: 4, max: 12, weight: 8 },
    { kind: "item", id: "item_carrot_seed", min: 4, max: 12, weight: 8 },
    { kind: "item", id: "item_bread", min: 2, max: 5, weight: 8 },
    { kind: "seasonPoints", min: 5, max: 15, weight: 8 },
  ],
  uncommon: [
    { kind: "gold", min: 900, max: 2_200, weight: 40 },
    { kind: "item", id: "item_plank", min: 4, max: 10, weight: 10 },
    { kind: "item", id: "item_copper_bar", min: 3, max: 8, weight: 10 },
    { kind: "item", id: "item_hardwood", min: 4, max: 10, weight: 9 },
    { kind: "item", id: "item_health_potion", min: 2, max: 5, weight: 9 },
    { kind: "seasonPoints", min: 15, max: 40, weight: 12 },
    // First gear rung: copper kit + starter tools.
    { kind: "item", id: "item_copper_axe", min: 1, max: 1, weight: 2, scale: false },
    { kind: "item", id: "item_copper_pickaxe", min: 1, max: 1, weight: 2, scale: false },
    { kind: "item", id: "item_copper_helm", min: 1, max: 1, weight: 2, scale: false },
    { kind: "item", id: "item_copper_boots", min: 1, max: 1, weight: 2, scale: false },
    { kind: "item", id: "item_copper_gloves", min: 1, max: 1, weight: 2, scale: false },
  ],
  rare: [
    { kind: "gold", min: 2_000, max: 4_800, weight: 36 },
    { kind: "item", id: "item_iron_bar", min: 3, max: 8, weight: 10 },
    { kind: "item", id: "item_hardwood_plank", min: 3, max: 8, weight: 9 },
    { kind: "item", id: "item_amber", min: 1, max: 3, weight: 9 },
    { kind: "seasonPoints", min: 40, max: 90, weight: 12 },
    { kind: "item", id: "item_copper_chest", min: 1, max: 1, weight: 3, scale: false },
    { kind: "item", id: "item_copper_dagger", min: 1, max: 1, weight: 3, scale: false },
    { kind: "item", id: "item_iron_axe", min: 1, max: 1, weight: 3, scale: false },
    { kind: "item", id: "item_iron_pickaxe", min: 1, max: 1, weight: 3, scale: false },
    { kind: "item", id: "item_iron_helm", min: 1, max: 1, weight: 3, scale: false },
    { kind: "item", id: "item_iron_boots", min: 1, max: 1, weight: 3, scale: false },
    { kind: "item", id: "item_iron_gloves", min: 1, max: 1, weight: 3, scale: false },
    { kind: "item", id: "item_pro_rod", min: 1, max: 1, weight: 3, scale: false },
  ],
  epic: [
    { kind: "gold", min: 4_500, max: 11_000, weight: 30 },
    { kind: "item", id: "item_steel_bar", min: 3, max: 8, weight: 9 },
    { kind: "item", id: "item_gemstone", min: 2, max: 5, weight: 9 },
    { kind: "item", id: "item_pearl", min: 2, max: 5, weight: 8 },
    { kind: "seasonPoints", min: 90, max: 180, weight: 12 },
    { kind: "item", id: "item_iron_chest", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_steel_helm", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_steel_boots", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_steel_gloves", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_steel_axe", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_steel_pickaxe", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_gem_blade", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_thorn_cleaver", min: 1, max: 1, weight: 4, scale: false },
  ],
  legendary: [
    { kind: "gold", min: 9_000, max: 22_000, weight: 26 },
    { kind: "item", id: "item_gemstone", min: 6, max: 12, weight: 8 },
    { kind: "item", id: "item_pearl", min: 6, max: 12, weight: 8 },
    { kind: "item", id: "item_ember_core", min: 2, max: 5, weight: 8 },
    { kind: "seasonPoints", min: 180, max: 350, weight: 10 },
    // Top-end gear. Deliberately the rarest thing in the game outside a skin —
    // an Obsidian Edge from a chest should be a story, not a shopping trip.
    { kind: "item", id: "item_steel_chest", min: 1, max: 1, weight: 6, scale: false },
    { kind: "item", id: "item_ember_helm", min: 1, max: 1, weight: 5, scale: false },
    { kind: "item", id: "item_ember_chest", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_ember_gloves", min: 1, max: 1, weight: 5, scale: false },
    { kind: "item", id: "item_ember_boots", min: 1, max: 1, weight: 5, scale: false },
    { kind: "item", id: "item_ember_blade", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_obsidian_blade", min: 1, max: 1, weight: 2, scale: false },
    { kind: "item", id: "item_gilded_rod", min: 1, max: 1, weight: 4, scale: false },
    { kind: "item", id: "item_abyssal_rod", min: 1, max: 1, weight: 2, scale: false },
    { kind: "item", id: "item_harvest_net", min: 1, max: 1, weight: 3, scale: false },
    // Skins slot in here once their art ships — see COSMETIC_SKINS below.
  ],
};

// ── Cosmetic skins ──────────────────────────────────────────────────────────
//
// Status/identity only, never stats — the safest thing a chest can contain and
// the whole point of P2 in docs/base-demand.md.
//
// `available` is the art gate. A skin with no art would be won, owned, and
// invisible — worse than not dropping at all — so the roller SKIPS unavailable
// skins entirely. Flip the flag in the same change that lands the art.
//
// TO BE CLEAR, because it has been asked: unfinished skins DO NOT close or
// disable chests. The roller drops the skin entry from that rarity's pool and
// picks from everything else in it, so gold, gear, materials and season points
// all still drop normally. Chests work fully with COSMETIC_SKINS empty — the
// only thing that stops a chest opening is a missing treasury wallet on the
// server (TOKEN_TREASURY_WALLET), which is what pays for it.

export interface CosmeticSkinDef {
  id: string;
  name: string;
  blurb: string;
  rarity: ChestRarity;
  /** Which base character the skin re-textures. */
  character: "boy" | "girl";
  /** Art folder under /assets/skins/<id>/ — unused until `available`. */
  available: boolean;
}

export const COSMETIC_SKINS: CosmeticSkinDef[] = [];

export function getSkin(id: string): CosmeticSkinDef | null {
  return COSMETIC_SKINS.find((s) => s.id === id) ?? null;
}

/** Skins that can actually drop (art shipped). */
export function availableSkins(): CosmeticSkinDef[] {
  return COSMETIC_SKINS.filter((s) => s.available);
}

// ── Rolling ─────────────────────────────────────────────────────────────────

function pickWeighted<T extends { weight: number }>(entries: T[], rng: () => number): T | null {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return entries[entries.length - 1] ?? null;
}

function pickRarity(tier: ChestTierDef, rng: () => number): ChestRarity {
  const order: ChestRarity[] = ["legendary", "epic", "rare", "uncommon", "common"];
  let roll = rng();
  for (const rarity of order) {
    const p = tier.odds[rarity] ?? 0;
    if (roll < p) return rarity;
    roll -= p;
  }
  return "common";
}

const intBetween = (min: number, max: number, rng: () => number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

/**
 * Roll one chest's rewards. Pure and rng-injectable so the odds can be tested;
 * the SERVER is the only caller in production — a client-side roll would be a
 * trivially forged payout.
 */
export function rollChest(
  tier: ChestTierDef,
  rng: () => number = Math.random,
  labelFor: (kind: ChestRewardKind, id: string | undefined, amount: number) => string = defaultLabel,
): ChestReward[] {
  const rewards: ChestReward[] = [];
  for (let i = 0; i < tier.rolls; i++) {
    const rarity = pickRarity(tier, rng);
    const pool = CHEST_POOLS[rarity] ?? [];
    // Skins live in the pools only once their art ships; anything referencing a
    // skin that isn't available is skipped so nobody wins an invisible cosmetic.
    const usable = pool.filter((e) => e.kind !== "skin" || (e.id != null && getSkin(e.id)?.available === true));
    const def = pickWeighted(usable, rng);
    if (!def) continue;
    // Skins and equipment are one-of-a-kind — the tier multiplier must never
    // turn a cosmetic into "11× Golden Knight" or hand out four Ember Blades.
    const mult = def.kind === "skin" || def.scale === false ? 1 : tier.valueMult;
    const amount = Math.max(1, Math.round(intBetween(def.min, def.max, rng) * mult));
    rewards.push({
      kind: def.kind,
      rarity,
      id: def.id,
      amount,
      label: labelFor(def.kind, def.id, amount),
    });
  }
  return rewards;
}

function defaultLabel(kind: ChestRewardKind, id: string | undefined, amount: number): string {
  if (kind === "gold") return `${amount.toLocaleString()} gold`;
  if (kind === "seasonPoints") return `${amount} season points`;
  if (kind === "skin") return getSkin(id ?? "")?.name ?? "Cosmetic skin";
  return `${amount}× ${id ?? "item"}`;
}

/** Season category chest points are booked under (kept out of gameplay
 * categories so /stats can separate bought points from earned ones). */
export const CHEST_SEASON_CATEGORY: SeasonCategory = "chest";

// ── Wire payloads ───────────────────────────────────────────────────────────

export interface ChestOpenResultPayload {
  ok: boolean;
  error?: string;
  tierId?: string;
  rewards?: ChestReward[];
  /** Gold total after the grant, so the HUD can update without a refetch. */
  gold?: number;
}

/** Expected gold per chest, for the odds sheet in the UI. Advisory only. */
export function expectedGold(tier: ChestTierDef): number {
  let ev = 0;
  for (const [rarity, p] of Object.entries(tier.odds) as [ChestRarity, number][]) {
    const pool = CHEST_POOLS[rarity] ?? [];
    const total = pool.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) continue;
    for (const e of pool) {
      if (e.kind !== "gold") continue;
      ev += p * (e.weight / total) * ((e.min + e.max) / 2);
    }
  }
  return Math.round(ev * tier.rolls * tier.valueMult);
}
