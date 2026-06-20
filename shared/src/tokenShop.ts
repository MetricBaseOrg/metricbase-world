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

/** @deprecated Treasury shop replaced by peer gold market. */
export const TOKEN_SHOP_PRODUCTS: TokenShopProduct[] = [];

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