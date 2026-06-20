import { getItemDefinition } from "./items.js";

export interface TokenShopGrant {
  gold?: number;
  items?: Array<{ itemId: string; quantity: number }>;
}

export interface TokenShopProduct {
  id: string;
  name: string;
  description: string;
  tokenPrice: number;
  grants: TokenShopGrant;
}

export interface TokenShopCatalogItem {
  id: string;
  name: string;
  description: string;
  tokenPrice: number;
  grantsLabel: string;
}

export interface TokenShopInfo {
  enabled: boolean;
  mint: string;
  treasuryWallet: string | null;
  walletBalance: number | null;
  rpcUrl: string;
  decimals: number;
  products: TokenShopCatalogItem[];
}

export interface TokenShopResultPayload {
  ok: boolean;
  error?: string;
  gold?: number;
  inventory?: import("./items.js").InventoryStatePayload;
  tokenBalance?: number | null;
}

export const TOKEN_DECIMALS = 6;

export const TOKEN_SHOP_PRODUCTS: TokenShopProduct[] = [
  {
    id: "token_gold_100",
    name: "100 Gold",
    description: "Instant gold credited to your character.",
    tokenPrice: 25,
    grants: { gold: 100 },
  },
  {
    id: "token_gold_500",
    name: "500 Gold",
    description: "A hefty pouch of gold for bigger purchases.",
    tokenPrice: 100,
    grants: { gold: 500 },
  },
  {
    id: "token_gold_1000",
    name: "1000 Gold",
    description: "Merchant's reserve — best value per token.",
    tokenPrice: 180,
    grants: { gold: 1000 },
  },
  {
    id: "token_potions_3",
    name: "3 Health Potions",
    description: "Stock up on healing supplies.",
    tokenPrice: 20,
    grants: { items: [{ itemId: "item_health_potion", quantity: 3 }] },
  },
  {
    id: "token_rusty_blade",
    name: "Rusty Blade",
    description: "A practice sword delivered straight to your inventory.",
    tokenPrice: 50,
    grants: { items: [{ itemId: "item_rusty_blade", quantity: 1 }] },
  },
];

export function getTokenShopProduct(productId: string): TokenShopProduct {
  const product = TOKEN_SHOP_PRODUCTS.find((entry) => entry.id === productId);
  if (!product) {
    throw new Error(`Unknown token shop product: ${productId}`);
  }
  return product;
}

export function formatTokenShopGrants(grants: TokenShopGrant): string {
  const parts: string[] = [];
  if (grants.gold) {
    parts.push(`${grants.gold} gold`);
  }
  if (grants.items?.length) {
    for (const entry of grants.items) {
      const item = getItemDefinition(entry.itemId);
      parts.push(`${entry.quantity}x ${item.name}`);
    }
  }
  return parts.join(" + ") || "Rewards";
}

export function buildTokenShopCatalog(): TokenShopCatalogItem[] {
  return TOKEN_SHOP_PRODUCTS.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    tokenPrice: product.tokenPrice,
    grantsLabel: formatTokenShopGrants(product.grants),
  }));
}