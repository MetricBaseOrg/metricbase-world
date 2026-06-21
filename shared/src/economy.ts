// Dynamic vendor pricing keeps the gold supply sustainable. Selling the same
// material floods the merchant's stock, so each unit pays less; the pressure
// decays over time and the price recovers. This caps the otherwise-unbounded
// "gather → sell to NPC" gold faucet and models simple supply/demand.

/** A vendor never pays below this fraction of the base price. */
export const SELL_PRICE_FLOOR = 0.4;

/** Recent units sold (across all players) that push a price to the floor. */
export const SELL_SATURATION_FULL = 120;

/** Selling pressure halves every this many ms. */
export const SELL_SATURATION_HALF_LIFE_MS = 8 * 60_000;

export interface SaturationState {
  value: number;
  updatedAt: number;
}

/** Current saturation after time-decay since it was last updated. */
export function decaySaturation(state: SaturationState | undefined, now: number): number {
  if (!state || state.value <= 0) return 0;
  const elapsed = now - state.updatedAt;
  if (elapsed <= 0) return state.value;
  return state.value * Math.pow(0.5, elapsed / SELL_SATURATION_HALF_LIFE_MS);
}

/** Price multiplier in [SELL_PRICE_FLOOR, 1] for the given saturation. */
export function sellPriceMultiplier(saturation: number): number {
  const t = Math.min(1, Math.max(0, saturation) / SELL_SATURATION_FULL);
  return SELL_PRICE_FLOOR + (1 - SELL_PRICE_FLOOR) * (1 - t);
}

/** Effective per-unit sell price for a material given current saturation. */
export function dynamicSellPrice(basePrice: number, saturation: number): number {
  return Math.max(1, Math.round(basePrice * sellPriceMultiplier(saturation)));
}
