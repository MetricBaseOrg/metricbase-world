import { decaySaturation, dynamicSellPrice, type SaturationState } from "@metricbase/shared";
import { loadSellPressure, saveSellPressure } from "../db/sellPressure.js";

// Process-global vendor sell pressure, shared across all zone rooms. Tracks how
// much of each material has been sold to NPCs recently; the value decays over
// time so prices recover. Hydrated from and persisted to the DB so prices
// survive server restarts.
const saturation = new Map<string, SaturationState>();

/** Seed the in-memory state from the database (call once at startup). */
export async function initSellPressure(): Promise<void> {
  const loaded = await loadSellPressure();
  for (const [itemId, state] of loaded) {
    saturation.set(itemId, state);
  }
}

export function effectiveSellPrice(itemId: string, basePrice: number, now = Date.now()): number {
  const sat = decaySaturation(saturation.get(itemId), now);
  return dynamicSellPrice(basePrice, sat);
}

export function recordSale(itemId: string, quantity: number, now = Date.now()): void {
  const sat = decaySaturation(saturation.get(itemId), now) + Math.max(0, quantity);
  const state = { value: sat, updatedAt: now };
  saturation.set(itemId, state);
  // Persist asynchronously; failures are logged, not fatal.
  void saveSellPressure(itemId, state);
}

export function dynamicSellPrices(
  basePrices: Record<string, number>,
  now = Date.now(),
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [itemId, basePrice] of Object.entries(basePrices)) {
    out[itemId] = effectiveSellPrice(itemId, basePrice, now);
  }
  return out;
}
