// Fish species + rarity: every successful catch rolls WHICH fish it was.
// The two legacy loot items (River Fish / Prized Salmon) remain the common
// species of their waters, so crafting recipes and jobs keep working — rarer
// rolls simply upgrade the catch to a more valuable species.

export type FishRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Waters a species swims in, keyed off the node's base loot item. */
export type FishWaters = "river" | "deep";

export interface FishSpecies {
  /** Inventory item id (also registered in ITEMS + Pip's sell prices). */
  itemId: string;
  name: string;
  rarity: FishRarity;
  waters: FishWaters;
  /** Emoji fallback shown until the PNG art is dropped in. */
  emoji: string;
  /** Art file under client/public/assets/fish/ (transparent PNG). */
  art: string;
}

/** Base roll weights per rarity (relative, sum needn't be 100). */
export const FISH_RARITY_WEIGHTS: Record<FishRarity, number> = {
  common: 66,
  uncommon: 22,
  rare: 8.5,
  epic: 3,
  legendary: 0.5,
};

/** Luck multiplier per rarity tier: weight × (1 + tierFactor × luck). */
const LUCK_TIER_FACTOR: Record<FishRarity, number> = {
  common: 0,
  uncommon: 2,
  rare: 4,
  epic: 6,
  legendary: 8,
};

export const FISH_RARITY_ORDER: FishRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Rarity accent colors (celebration burst, banners, docs). */
export const FISH_RARITY_COLORS: Record<FishRarity, string> = {
  common: "#9aa7b0",
  uncommon: "#4bc07f",
  rare: "#4a9de8",
  epic: "#a55ce8",
  legendary: "#f3b53a",
};

export const FISH_SPECIES: FishSpecies[] = [
  // ---- River waters (Hub lake, rivers — base loot item_fish) ----
  { itemId: "item_fish", name: "River Fish", rarity: "common", waters: "river", emoji: "🐟", art: "river-fish.png" },
  { itemId: "item_bluegill", name: "Bluegill", rarity: "common", waters: "river", emoji: "🐠", art: "bluegill.png" },
  { itemId: "item_carp", name: "Striped Carp", rarity: "uncommon", waters: "river", emoji: "🐡", art: "carp.png" },
  { itemId: "item_catfish", name: "Whiskered Catfish", rarity: "uncommon", waters: "river", emoji: "🐟", art: "catfish.png" },
  { itemId: "item_golden_trout", name: "Golden Trout", rarity: "rare", waters: "river", emoji: "✨", art: "golden-trout.png" },
  { itemId: "item_crystal_koi", name: "Crystal Koi", rarity: "epic", waters: "river", emoji: "💎", art: "crystal-koi.png" },
  { itemId: "item_ancient_sturgeon", name: "Ancient Sturgeon", rarity: "legendary", waters: "river", emoji: "🐉", art: "ancient-sturgeon.png" },
  // ---- Deep waters (Wilderness / Grotto pools — base loot item_salmon) ----
  { itemId: "item_salmon", name: "Prized Salmon", rarity: "common", waters: "deep", emoji: "🐟", art: "salmon.png" },
  { itemId: "item_pike", name: "Silver Pike", rarity: "uncommon", waters: "deep", emoji: "🐠", art: "silver-pike.png" },
  { itemId: "item_ghostfin_eel", name: "Ghostfin Eel", rarity: "rare", waters: "deep", emoji: "🪸", art: "ghostfin-eel.png" },
  { itemId: "item_stormray", name: "Stormray", rarity: "epic", waters: "deep", emoji: "⚡", art: "stormray.png" },
  { itemId: "item_abyssal_leviathan", name: "Abyssal Leviathan", rarity: "legendary", waters: "deep", emoji: "🐙", art: "abyssal-leviathan.png" },
];

const SPECIES_BY_ITEM = new Map(FISH_SPECIES.map((s) => [s.itemId, s]));

export function getFishSpecies(itemId: string): FishSpecies | null {
  return SPECIES_BY_ITEM.get(itemId) ?? null;
}

/** Which waters a fishing node belongs to, from its configured base loot. */
export function fishWatersForLoot(lootItemId: string): FishWaters | null {
  if (lootItemId === "item_fish") return "river";
  if (lootItemId === "item_salmon") return "deep";
  return null;
}

/**
 * Roll the species for a successful catch.
 * `luck` (0..~0.2) comes from gear rareBonus + rain; it multiplies the weight
 * of every non-common tier so lucky anglers see rare fish noticeably more.
 */
export function rollFishSpecies(
  waters: FishWaters,
  luck = 0,
  rng: () => number = Math.random,
): FishSpecies {
  const pool = FISH_SPECIES.filter((s) => s.waters === waters);
  const weights = pool.map(
    (s) => FISH_RARITY_WEIGHTS[s.rarity] * (1 + LUCK_TIER_FACTOR[s.rarity] * Math.max(0, luck)),
  );
  // A rarity tier's weight is split across its species so adding a species
  // never inflates that tier's overall odds.
  const perTierCount = new Map<FishRarity, number>();
  for (const s of pool) perTierCount.set(s.rarity, (perTierCount.get(s.rarity) ?? 0) + 1);
  const adjusted = pool.map((s, i) => weights[i] / (perTierCount.get(s.rarity) ?? 1));
  const total = adjusted.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= adjusted[i];
    if (roll <= 0) return pool[i];
  }
  return pool[0];
}
