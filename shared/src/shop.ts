import {
  ITEMS,
  getItemDefinition,
  normalizeInventory,
  type InventoryEntry,
  type InventoryStatePayload,
} from "./items.js";
import type { MarketStatePayload } from "./market.js";
import { CROP_MARKETS } from "./farming.js";
import { getRecipeForOutput } from "./crafting.js";
import { PET_IDS } from "./equipment.js";

export const STARTING_GOLD = 25;

export interface ShopBuyOffer {
  itemId: string;
  price: number;
}

export interface ShopDefinition {
  id: string;
  npcId: string;
  buyOffers: ShopBuyOffer[];
  sellPrices: Record<string, number>;
}

export interface ShopCatalogItem {
  itemId: string;
  name: string;
  description: string;
  price: number;
  owned: number;
}

export interface ShopOpenPayload {
  shopId: string;
  merchantName: string;
  greeting: string;
  gold: number;
  buyOffers: ShopCatalogItem[];
  sellOffers: ShopCatalogItem[];
  market?: MarketStatePayload;
}

export interface ShopResultPayload {
  ok: boolean;
  error?: string;
  gold?: number;
  inventory?: InventoryStatePayload;
  /** Updated catalogs so the client reflects dynamic prices immediately. */
  buyOffers?: ShopCatalogItem[];
  sellOffers?: ShopCatalogItem[];
}

// ---------------------------------------------------------------------------
// Item values & Pip's full catalog — every item (except gem-shop pets) can be
// bought from and sold to Pip; supply/demand pricing moves both directions on
// the server.
//
// RAW_ITEM_VALUES is THE tunables table: the vendor-pays base value of every
// item that ISN'T crafted (gathered, dropped, grown, or NPC-sourced). Crafted
// items derive their value from their recipe (CRAFT_VALUE_RATIO × input value
// + forge fee), so selling a crafted item to a vendor can never mint gold.

export const RAW_ITEM_VALUES: Record<string, number> = {
  // Gathered / dropped materials
  item_training_scrap: 8,
  item_wood: 6,
  item_hardwood: 12,
  item_ore: 9,
  item_iron_ore: 18,
  item_slime_gel: 12,
  item_slime_core: 25,
  item_amber: 55,
  item_gemstone: 60,
  item_pearl: 55,
  // Fish species by rarity (see fishSpecies.ts)
  item_fish: 8,
  item_salmon: 16,
  item_bluegill: 9,
  item_carp: 22,
  item_catfish: 26,
  item_golden_trout: 85,
  item_crystal_koi: 280,
  item_ancient_sturgeon: 1400,
  item_pike: 40,
  item_ghostfin_eel: 130,
  item_stormray: 420,
  item_abyssal_leviathan: 2000,
  // Crops & seeds
  item_wheat: 7,
  item_carrot: 12,
  item_berries: 6,
  item_wheat_seed: 2,
  item_carrot_seed: 3,
  // Non-crafted gear & starter consumables. Hand-set BELOW their legacy shop
  // prices so buy → sell-back always loses gold (bread stays the cheap 8g
  // starter food even though baking it costs more wheat than that).
  item_health_potion: 6,
  item_bread: 3,
  item_rusty_blade: 16,
  item_gel_knife: 14,
};

/** Vendor pays this fraction of a recipe's input cost for crafted items. */
export const CRAFT_VALUE_RATIO = 0.6;
/** Pip charges this multiple of an item's value when players BUY. */
export const PIP_BUY_MARKUP = 2.2;

/** Pip's original hand-tuned shop prices, kept for the starter items. */
const LEGACY_BUY_PRICES: Record<string, number> = {
  item_health_potion: 15,
  item_bread: 8,
  item_wheat_seed: 5,
  item_rusty_blade: 40,
};

const valueCache = new Map<string, number>();

/**
 * Base gold value of an item (what a vendor pays, before dynamic pricing).
 * Hand-set for raw items, derived from the recipe for crafted ones, with a
 * crop-market fallback for future crops. Also drives gather-tax valuation.
 */
export function getItemBaseValue(itemId: string): number {
  const cached = valueCache.get(itemId);
  if (cached !== undefined) return cached;
  valueCache.set(itemId, 0); // cycle guard for recursive recipe lookups
  let value = RAW_ITEM_VALUES[itemId] ?? 0;
  if (!value) {
    const recipe = getRecipeForOutput(itemId);
    if (recipe) {
      const inputCost =
        recipe.inputs.reduce((sum, input) => sum + getItemBaseValue(input.itemId) * input.quantity, 0) +
        recipe.goldCost;
      value = Math.max(1, Math.round((CRAFT_VALUE_RATIO * inputCost) / Math.max(1, recipe.output.quantity)));
    }
  }
  if (!value) {
    for (const market of Object.values(CROP_MARKETS)) {
      if (market.cropItemId === itemId) value = market.cropSellPrice;
    }
  }
  valueCache.set(itemId, value);
  return value;
}

/** Pip's base shop (buy-from-Pip) price for an item. */
export function getPipBuyPrice(itemId: string): number {
  return LEGACY_BUY_PRICES[itemId] ?? Math.max(1, Math.ceil(getItemBaseValue(itemId) * PIP_BUY_MARKUP));
}

const KIND_ORDER: Record<string, number> = {
  consumable: 0,
  material: 1,
  weapon: 2,
  tool: 3,
  armor: 4,
  mount: 5,
  pet: 6,
};

/** Every tradable item id: has a value; pets stay gem-shop exclusive. */
function tradableItemIds(): string[] {
  return Object.keys(ITEMS)
    .filter((id) => !PET_IDS.has(id) && getItemBaseValue(id) > 0)
    .sort(
      (a, b) =>
        (KIND_ORDER[ITEMS[a].kind] ?? 9) - (KIND_ORDER[ITEMS[b].kind] ?? 9) ||
        getPipBuyPrice(a) - getPipBuyPrice(b),
    );
}

function buildPipShop(): ShopDefinition {
  const ids = tradableItemIds();
  return {
    id: "pip_general",
    npcId: "hub_merchant",
    buyOffers: ids.map((itemId) => ({ itemId, price: getPipBuyPrice(itemId) })),
    sellPrices: Object.fromEntries(ids.map((itemId) => [itemId, getItemBaseValue(itemId)])),
  };
}

export const SHOPS: Record<string, ShopDefinition> = {
  pip_general: buildPipShop(),
};

/** Pip's base sell price for an item (0 when Pip doesn't buy it). */
export function getPipSellPrice(itemId: string): number {
  return SHOPS.pip_general.sellPrices[itemId] ?? 0;
}

// ---- Gear repair (both sinks: gold fee + tier material) --------------------

/** A repair restoring at least this fraction of max durability needs a material. */
export const MAJOR_REPAIR_FRACTION = 0.3;

/** Repair materials for gear without a crafting recipe. */
const REPAIR_MATERIAL_FALLBACK: Record<string, string> = {
  item_rusty_blade: "item_training_scrap",
  item_gel_knife: "item_slime_gel",
};

/**
 * The material a smith needs for a major repair: the most valuable ingredient
 * of the item's recipe (the "tier material" — iron bars for iron gear, planks
 * for rods), or a themed fallback for non-crafted gear.
 */
export function repairMaterialFor(itemId: string): string | null {
  const fallback = REPAIR_MATERIAL_FALLBACK[itemId];
  if (fallback) return fallback;
  const recipe = getRecipeForOutput(itemId);
  if (!recipe || recipe.inputs.length === 0) return null;
  // Upgrade recipes take the previous-tier gear as an input (pro rod → abyssal
  // rod); repairs want the most valuable MATERIAL, never a whole piece of gear.
  const isMaterial = (id: string) => {
    const kind = ITEMS[id]?.kind;
    return kind !== "tool" && kind !== "weapon" && kind !== "armor" && kind !== "mount";
  };
  const candidates = recipe.inputs.filter((input) => isMaterial(input.itemId));
  const pool = candidates.length > 0 ? candidates : recipe.inputs;
  let best = pool[0].itemId;
  for (const input of pool) {
    if (getItemBaseValue(input.itemId) > getItemBaseValue(best)) best = input.itemId;
  }
  return best;
}

export function getShopByNpcId(npcId: string): ShopDefinition | null {
  return Object.values(SHOPS).find((shop) => shop.npcId === npcId) ?? null;
}

export function getShopDefinition(shopId: string): ShopDefinition {
  const shop = SHOPS[shopId];
  if (!shop) {
    throw new Error(`Unknown shop: ${shopId}`);
  }
  return shop;
}

function getOwnedQuantity(inventory: InventoryEntry[], itemId: string): number {
  return inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
}

export function buildShopOpenPayload(
  shop: ShopDefinition,
  merchantName: string,
  greeting: string,
  gold: number,
  inventory: InventoryEntry[],
  market?: MarketStatePayload,
  /** Effective (dynamic) per-unit sell prices; falls back to the base prices. */
  sellPriceOverrides?: Record<string, number>,
  /** Effective (dynamic) per-unit buy prices; falls back to the base prices. */
  buyPriceOverrides?: Record<string, number>,
): ShopOpenPayload {
  const normalized = normalizeInventory(inventory);

  const buyOffers: ShopCatalogItem[] = shop.buyOffers.map((offer) => {
    const item = getItemDefinition(offer.itemId);
    return {
      itemId: offer.itemId,
      name: item.name,
      description: item.description,
      price: buyPriceOverrides?.[offer.itemId] ?? offer.price,
      owned: getOwnedQuantity(normalized, offer.itemId),
    };
  });

  const sellOffers: ShopCatalogItem[] = Object.entries(shop.sellPrices)
    .map(([itemId, basePrice]) => {
      const owned = getOwnedQuantity(normalized, itemId);
      if (owned <= 0) return null;
      const item = getItemDefinition(itemId);
      return {
        itemId,
        name: item.name,
        description: item.description,
        price: sellPriceOverrides?.[itemId] ?? basePrice,
        owned,
      };
    })
    .filter((entry): entry is ShopCatalogItem => entry !== null);

  return {
    shopId: shop.id,
    merchantName,
    greeting,
    gold,
    buyOffers,
    sellOffers,
    market,
  };
}