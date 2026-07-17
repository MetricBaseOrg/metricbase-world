import { decaySaturation, sellPriceMultiplier, type SaturationState } from "@metricbase/shared";
import { loadSellPressure, saveSellPressure } from "../db/sellPressure.js";
import { itemPriceMultiplier, zoneItemPriceDeviation } from "../economy/itemFlows.js";

// Process-global vendor sell pressure, shared across all zone rooms. Tracks how
// much of each material has been sold to NPCs recently; the value decays over
// time so prices recover. Hydrated from and persisted to the DB so prices
// survive server restarts.
//
// REGIONAL BUCKETS (v0.153): each price region (the three towns) keeps its own
// saturation bucket keyed `<zoneId>|<itemId>`, so dumping planks on Pip in the
// Hub floors the HUB's plank price only — hauling the rest to the Wilderness
// merchant still pays. Everywhere else (player Worlds, interiors) shares the
// plain `<itemId>` global bucket, so hundreds of Worlds shops can't multiply
// the vendor faucet. Old DB rows have no "|" and load as the global bucket.
const saturation = new Map<string, SaturationState>();

function bucketKey(itemId: string, zone: string | null): string {
  return zone ? `${zone}|${itemId}` : itemId;
}

/** Seed the in-memory state from the database (call once at startup). */
export async function initSellPressure(): Promise<void> {
  const loaded = await loadSellPressure();
  for (const [key, state] of loaded) {
    saturation.set(key, state);
  }
}

/**
 * Effective per-unit vendor price: base × long-term supply/demand multiplier
 * (7-day produced vs used, both directions) × regional deviation (how hungry
 * THIS region is vs the world) × short-term sell-pressure decay for the
 * region's own bucket (dump discount only, recovers in minutes).
 */
export function effectiveSellPrice(
  itemId: string,
  basePrice: number,
  now = Date.now(),
  zone: string | null = null,
): number {
  const sat = decaySaturation(saturation.get(bucketKey(itemId, zone)), now);
  return Math.max(
    1,
    Math.round(
      basePrice * itemPriceMultiplier(itemId) * zoneItemPriceDeviation(itemId, zone) * sellPriceMultiplier(sat),
    ),
  );
}

/** Effective NPC price when players BUY: base × S/D × regional deviation. */
export function effectiveBuyPrice(itemId: string, basePrice: number, zone: string | null = null): number {
  return Math.max(1, Math.round(basePrice * itemPriceMultiplier(itemId) * zoneItemPriceDeviation(itemId, zone)));
}

export function dynamicBuyPrices(
  offers: { itemId: string; price: number }[],
  zone: string | null = null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const offer of offers) out[offer.itemId] = effectiveBuyPrice(offer.itemId, offer.price, zone);
  return out;
}

export function recordSale(itemId: string, quantity: number, now = Date.now(), zone: string | null = null): void {
  const key = bucketKey(itemId, zone);
  const sat = decaySaturation(saturation.get(key), now) + Math.max(0, quantity);
  const state = { value: sat, updatedAt: now };
  saturation.set(key, state);
  // Persist asynchronously; failures are logged, not fatal.
  void saveSellPressure(key, state);
}

export function dynamicSellPrices(
  basePrices: Record<string, number>,
  now = Date.now(),
  zone: string | null = null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [itemId, basePrice] of Object.entries(basePrices)) {
    out[itemId] = effectiveSellPrice(itemId, basePrice, now, zone);
  }
  return out;
}
