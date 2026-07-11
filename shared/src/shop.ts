import {
  getItemDefinition,
  normalizeInventory,
  type InventoryEntry,
  type InventoryStatePayload,
} from "./items.js";
import type { MarketStatePayload } from "./market.js";
import { CROP_MARKETS } from "./farming.js";

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

export const SHOPS: Record<string, ShopDefinition> = {
  pip_general: {
    id: "pip_general",
    npcId: "hub_merchant",
    buyOffers: [
      { itemId: "item_health_potion", price: 15 },
      { itemId: "item_bread", price: 8 },
      { itemId: "item_wheat_seed", price: 5 },
      { itemId: "item_rusty_blade", price: 40 },
    ],
    sellPrices: {
      item_training_scrap: 8,
      item_wood: 6,
      item_hardwood: 12,
      item_ore: 9,
      item_iron_ore: 18,
      item_iron_bar: 30,
      item_steel_bar: 48,
      item_fish: 8,
      item_salmon: 16,
      // Fish species by rarity (see fishSpecies.ts)
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
      item_wheat: 7,
      item_berries: 6,
      item_slime_gel: 12,
      item_slime_core: 25,
      item_amber: 55,
      item_gemstone: 60,
      item_pearl: 55,
    },
  },
};

/** Pip's base sell price for an item (0 when Pip doesn't buy it). */
export function getPipSellPrice(itemId: string): number {
  return SHOPS.pip_general.sellPrices[itemId] ?? 0;
}

/**
 * Base gold value of an item: Pip's buyback, falling back to a crop market's
 * price for crops Pip doesn't stock (carrots). Used for gather-tax valuation.
 */
export function getItemBaseValue(itemId: string): number {
  const pip = SHOPS.pip_general.sellPrices[itemId];
  if (pip) return pip;
  for (const market of Object.values(CROP_MARKETS)) {
    if (market.cropItemId === itemId) return market.cropSellPrice;
  }
  return 0;
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