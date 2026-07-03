import { zoneAssetPrice } from "@metricbase/shared";
import {
  deleteListing,
  loadAssetListings,
  loadPendingGold,
  savePendingGold,
  saveListing,
  type StoredListing,
} from "../db/assetMarket.js";
import { adjustAsset, getAssetQty } from "./assetInventory.js";

// Open player-to-player listings of build assets for gold. Listing escrows the
// assets out of the seller's inventory; buying transfers them to the buyer and
// pays the seller; cancelling returns them.
const listings = new Map<string, StoredListing>();
const pendingGold = new Map<string, number>();

/** Max total gold price for a single listing. */
const MAX_LISTING_PRICE = 100_000_000;

export async function initAssetMarket(): Promise<void> {
  for (const l of await loadAssetListings()) listings.set(l.id, l);
  for (const p of await loadPendingGold()) pendingGold.set(p.playerName, p.amount);
}

export interface AssetListingView {
  id: string;
  sellerName: string;
  assetId: string;
  qty: number;
  price: number;
  /** Shop reference price for the same assets, so buyers can judge a deal. */
  shopPrice: number;
}

export function getAssetListings(): AssetListingView[] {
  return [...listings.values()].map((l) => ({
    id: l.id,
    sellerName: l.sellerName,
    assetId: l.assetId,
    qty: l.qty,
    price: l.price,
    shopPrice: zoneAssetPrice(l.assetId) * l.qty,
  }));
}

export function getListing(id: string): StoredListing | undefined {
  return listings.get(id);
}

function newId(): string {
  return `al_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function createListing(
  seller: string,
  assetId: string,
  qty: number,
  price: number,
): { ok: boolean; error?: string } {
  qty = Math.floor(qty);
  price = Math.floor(price);
  if (!assetId || zoneAssetPrice(assetId) <= 0) return { ok: false, error: "That asset can't be sold." };
  if (qty < 1 || qty > 999) return { ok: false, error: "Quantity must be 1–999." };
  if (price < 1 || price > MAX_LISTING_PRICE) return { ok: false, error: "Invalid price." };
  if (getAssetQty(seller, assetId) < qty) return { ok: false, error: "You don't own that many." };
  adjustAsset(seller, assetId, -qty); // escrow
  const listing: StoredListing = { id: newId(), sellerName: seller, assetId, qty, price };
  listings.set(listing.id, listing);
  void saveListing(listing);
  return { ok: true };
}

export function cancelListing(seller: string, id: string): { ok: boolean; error?: string } {
  const listing = listings.get(id);
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.sellerName !== seller) return { ok: false, error: "That isn't your listing." };
  adjustAsset(seller, listing.assetId, listing.qty); // return escrow
  listings.delete(id);
  void deleteListing(id);
  return { ok: true };
}

/** Transfer a bought listing's assets to the buyer and remove it. */
export function completeBuy(buyerName: string, id: string): void {
  const listing = listings.get(id);
  if (!listing) return;
  adjustAsset(buyerName, listing.assetId, listing.qty);
  listings.delete(id);
  void deleteListing(id);
}

export function addPendingGold(playerName: string, amount: number): void {
  if (amount <= 0) return;
  const next = (pendingGold.get(playerName) ?? 0) + Math.floor(amount);
  pendingGold.set(playerName, next);
  void savePendingGold(playerName, next);
}

/** Take (and clear) any gold owed to a player from asset sales while offline. */
export function takePendingGold(playerName: string): number {
  const amount = pendingGold.get(playerName) ?? 0;
  if (amount <= 0) return 0;
  pendingGold.delete(playerName);
  void savePendingGold(playerName, 0);
  return amount;
}
