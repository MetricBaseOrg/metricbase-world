import { decaySaturation, dynamicSellPrice, type SaturationState } from "@metricbase/shared";

// Process-global vendor sell pressure, shared across all zone rooms. Tracks how
// much of each material has been sold to NPCs recently; the value decays over
// time so prices recover. (In-memory for now — resets on server restart.)
const saturation = new Map<string, SaturationState>();

export function effectiveSellPrice(itemId: string, basePrice: number, now = Date.now()): number {
  const sat = decaySaturation(saturation.get(itemId), now);
  return dynamicSellPrice(basePrice, sat);
}

export function recordSale(itemId: string, quantity: number, now = Date.now()): void {
  const sat = decaySaturation(saturation.get(itemId), now) + Math.max(0, quantity);
  saturation.set(itemId, { value: sat, updatedAt: now });
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
