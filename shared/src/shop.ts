import {
  getItemDefinition,
  normalizeInventory,
  type InventoryEntry,
  type InventoryStatePayload,
} from "./items.js";
import type { MarketStatePayload } from "./market.js";

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
}

export const SHOPS: Record<string, ShopDefinition> = {
  pip_general: {
    id: "pip_general",
    npcId: "hub_merchant",
    buyOffers: [
      { itemId: "item_health_potion", price: 15 },
      { itemId: "item_rusty_blade", price: 40 },
    ],
    sellPrices: {
      item_training_scrap: 8,
      item_wood: 6,
      item_ore: 9,
      item_fish: 8,
      item_slime_gel: 12,
      item_slime_core: 25,
    },
  },
};

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
): ShopOpenPayload {
  const normalized = normalizeInventory(inventory);

  const buyOffers: ShopCatalogItem[] = shop.buyOffers.map((offer) => {
    const item = getItemDefinition(offer.itemId);
    return {
      itemId: offer.itemId,
      name: item.name,
      description: item.description,
      price: offer.price,
      owned: getOwnedQuantity(normalized, offer.itemId),
    };
  });

  const sellOffers: ShopCatalogItem[] = Object.entries(shop.sellPrices)
    .map(([itemId, price]) => {
      const owned = getOwnedQuantity(normalized, itemId);
      if (owned <= 0) return null;
      const item = getItemDefinition(itemId);
      return {
        itemId,
        name: item.name,
        description: item.description,
        price,
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