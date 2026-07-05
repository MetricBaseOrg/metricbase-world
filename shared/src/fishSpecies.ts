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

/**
 * Bait money: every cast costs this much gold, charged when the line goes in
 * (landed or escaped — the bait is spent either way). A small gold sink that
 * balances the rare-fish jackpots. Tune here.
 */
export const FISHING_CAST_GOLD = 2;

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

/**
 * Fish cooking: every species grills into a dish at the workbench.
 * ONE tunable table — items, craft recipes, HP heals, and stamina restores are
 * all generated from these rows (items.ts / crafting.ts / stamina.ts).
 * `art` files drop into client/public/assets/fish/ like the species art.
 */
export interface FishDish {
  /** Dish item id (generated into ITEMS as a stackable consumable). */
  itemId: string;
  name: string;
  description: string;
  /** The raw fish consumed by the recipe. */
  sourceItemId: string;
  /** HP restored when eaten. */
  hp: number;
  /** Stamina (energy) restored when eaten (cap 100). */
  stamina: number;
  /** Workbench gold fee (small gold sink, scales with rarity). */
  fee: number;
  emoji: string;
  art: string;
}

export const FISH_DISHES: FishDish[] = [
  // River species
  { itemId: "item_seared_bluegill", name: "Pan-Seared Bluegill", description: "A crisp little fillet, seared skin-on.", sourceItemId: "item_bluegill", hp: 45, stamina: 40, fee: 1, emoji: "🍳", art: "dish-bluegill.png" },
  { itemId: "item_carp_stew", name: "Hearty Carp Stew", description: "A rich stew simmered from striped carp.", sourceItemId: "item_carp", hp: 60, stamina: 55, fee: 2, emoji: "🍲", art: "dish-carp.png" },
  { itemId: "item_catfish_fry", name: "Crispy Catfish Fry", description: "Golden-battered catfish, fried whiskers and all.", sourceItemId: "item_catfish", hp: 70, stamina: 60, fee: 2, emoji: "🍤", art: "dish-catfish.png" },
  { itemId: "item_golden_fillet", name: "Golden Trout Fillet", description: "A gleaming fillet that melts on the tongue.", sourceItemId: "item_golden_trout", hp: 110, stamina: 80, fee: 5, emoji: "🥮", art: "dish-golden-trout.png" },
  { itemId: "item_koi_sashimi", name: "Crystal Koi Sashimi", description: "Translucent slices of epic koi. Fully restores energy.", sourceItemId: "item_crystal_koi", hp: 150, stamina: 100, fee: 8, emoji: "🍣", art: "dish-crystal-koi.png" },
  { itemId: "item_sturgeon_roast", name: "Ancient Sturgeon Roast", description: "A legendary roast fit for a whole guild hall.", sourceItemId: "item_ancient_sturgeon", hp: 220, stamina: 100, fee: 15, emoji: "🍖", art: "dish-ancient-sturgeon.png" },
  // Deep species
  { itemId: "item_pike_skewer", name: "Grilled Pike Skewer", description: "Deep-water pike char-grilled on a skewer.", sourceItemId: "item_pike", hp: 85, stamina: 65, fee: 3, emoji: "🍢", art: "dish-silver-pike.png" },
  { itemId: "item_smoked_eel", name: "Smoked Ghostfin Eel", description: "Pale eel smoked until it barely glows.", sourceItemId: "item_ghostfin_eel", hp: 130, stamina: 90, fee: 6, emoji: "🍱", art: "dish-ghostfin-eel.png" },
  { itemId: "item_stormray_steak", name: "Charged Stormray Steak", description: "A steak that still crackles faintly. Fully restores energy.", sourceItemId: "item_stormray", hp: 170, stamina: 100, fee: 10, emoji: "🥩", art: "dish-stormray.png" },
  { itemId: "item_leviathan_feast", name: "Leviathan Feast", description: "A legendary spread carved from the abyss itself.", sourceItemId: "item_abyssal_leviathan", hp: 260, stamina: 100, fee: 20, emoji: "🍽️", art: "dish-abyssal-leviathan.png" },
];

const DISH_BY_ITEM = new Map(FISH_DISHES.map((d) => [d.itemId, d]));

/**
 * Dish art lookup for icons. Includes the two legacy dishes so the whole
 * kitchen can share the dropped-art look (emoji/canvas fallback until then).
 */
const LEGACY_DISH_ART: Record<string, string> = {
  item_cooked_fish: "dish-river-fish.png",
  item_grilled_salmon: "dish-salmon.png",
};

export function getFishDishArt(itemId: string): string | null {
  return DISH_BY_ITEM.get(itemId)?.art ?? LEGACY_DISH_ART[itemId] ?? null;
}

export function getFishDish(itemId: string): FishDish | null {
  return DISH_BY_ITEM.get(itemId) ?? null;
}

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
