// Magic Chests — $BASE-burning loot boxes.
//
// THE TUNABLES TABLE for the feature. Everything about what a chest costs, how
// often each rarity lands, and what can come out of it lives here as pure data,
// so balance changes never touch server logic.
//
// ── Economic rules this table must keep ────────────────────────────────────
//
// 1. CHESTS BURN $BASE. They are a sink, not a treasury transfer — the point is
//    to remove supply (docs/base-demand.md P2, "prefer burns to transfers").
//
// 2. GOLD EV MUST STAY WELL UNDER THE CHEST PRICE. Rudi's desk already sells
//    gold at 1 $BASE = 1 gold. If a chest's expected gold approached its price
//    players would buy chests *as* a gold faucet and the chest would just be a
//    worse gold desk with extra steps. Every tier below sits around 15-25% of
//    its price in expected gold; the value is in the rare drops, not the gold.
//
// 3. NO POWER IN CHESTS. No weapons, armor or tools — only materials,
//    consumables, gold, season points and cosmetics. Selling stat gear for real
//    money would distort PvP and the player-run crafting economy, which is the
//    one line docs/base-demand.md marks as non-negotiable ("sell time, status
//    and capacity — never power"). Materials are fine: they're tradeable goods
//    a player could also gather, not a stat advantage.
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
    valueMult: 1,
    odds: { common: 0.66, uncommon: 0.25, rare: 0.075, epic: 0.014, legendary: 0.001 },
  },
  {
    id: "silver",
    name: "Silver Chest",
    emoji: "🥈",
    blurb: "Banded in silver. Better odds, better hauls.",
    price: 3_000,
    rolls: 3,
    valueMult: 2.1,
    odds: { common: 0.46, uncommon: 0.34, rare: 0.15, epic: 0.045, legendary: 0.005 },
  },
  {
    id: "golden",
    name: "Golden Chest",
    emoji: "🥇",
    blurb: "Heavy with promise. Rare finds are the norm here.",
    price: 10_000,
    rolls: 4,
    valueMult: 3.5,
    odds: { common: 0.26, uncommon: 0.36, rare: 0.26, epic: 0.105, legendary: 0.015 },
  },
  {
    id: "mythic",
    name: "Mythic Chest",
    emoji: "✨",
    blurb: "Hums when you hold it. The best odds in the world.",
    price: 25_000,
    rolls: 5,
    valueMult: 4.5,
    odds: { common: 0.1, uncommon: 0.28, rare: 0.36, epic: 0.22, legendary: 0.04 },
  },
];

export function getChestTier(id: string): ChestTierDef | null {
  return CHEST_TIERS.find((t) => t.id === id) ?? null;
}

/**
 * Reward pools by rarity. Shared across tiers — the TIER changes how often you
 * reach a bucket, not what's inside it, so adding a reward benefits every tier
 * and there's only one table to balance.
 */
export const CHEST_POOLS: Record<ChestRarity, ChestRewardDef[]> = {
  common: [
    { kind: "gold", min: 120, max: 400, weight: 30 },
    { kind: "item", id: "item_wood", min: 5, max: 15, weight: 14 },
    { kind: "item", id: "item_ore", min: 5, max: 15, weight: 14 },
    { kind: "item", id: "item_wheat_seed", min: 4, max: 12, weight: 10 },
    { kind: "item", id: "item_carrot_seed", min: 4, max: 12, weight: 10 },
    { kind: "item", id: "item_bread", min: 2, max: 5, weight: 10 },
    { kind: "seasonPoints", min: 5, max: 15, weight: 12 },
  ],
  uncommon: [
    { kind: "gold", min: 400, max: 1_000, weight: 28 },
    { kind: "item", id: "item_plank", min: 4, max: 10, weight: 14 },
    { kind: "item", id: "item_copper_bar", min: 3, max: 8, weight: 14 },
    { kind: "item", id: "item_hardwood", min: 4, max: 10, weight: 12 },
    { kind: "item", id: "item_health_potion", min: 2, max: 5, weight: 12 },
    { kind: "seasonPoints", min: 15, max: 40, weight: 20 },
  ],
  rare: [
    { kind: "gold", min: 1_000, max: 2_500, weight: 26 },
    { kind: "item", id: "item_iron_bar", min: 3, max: 8, weight: 16 },
    { kind: "item", id: "item_hardwood_plank", min: 3, max: 8, weight: 14 },
    { kind: "item", id: "item_amber", min: 1, max: 3, weight: 14 },
    { kind: "item", id: "item_carrot_bread", min: 2, max: 5, weight: 10 },
    { kind: "seasonPoints", min: 40, max: 90, weight: 20 },
  ],
  epic: [
    { kind: "gold", min: 2_500, max: 6_000, weight: 24 },
    { kind: "item", id: "item_steel_bar", min: 3, max: 8, weight: 18 },
    { kind: "item", id: "item_gemstone", min: 2, max: 5, weight: 18 },
    { kind: "item", id: "item_pearl", min: 2, max: 5, weight: 16 },
    { kind: "seasonPoints", min: 90, max: 180, weight: 24 },
  ],
  legendary: [
    { kind: "gold", min: 6_000, max: 15_000, weight: 26 },
    { kind: "item", id: "item_gemstone", min: 6, max: 12, weight: 18 },
    { kind: "item", id: "item_pearl", min: 6, max: 12, weight: 18 },
    { kind: "item", id: "item_ember_core", min: 2, max: 5, weight: 14 },
    { kind: "seasonPoints", min: 180, max: 350, weight: 24 },
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
    // Skins are one-of-a-kind — the tier multiplier must never turn a cosmetic
    // into "11× Golden Knight".
    const mult = def.kind === "skin" ? 1 : tier.valueMult;
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
