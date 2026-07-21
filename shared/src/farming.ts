import type { InventoryStatePayload } from "./items.js";

// Farming introduces a time-based growth cycle: plant a seed in a plot, wait
// real time for it to grow through stages, then harvest a crop + Farming XP.

export interface FarmCrop {
  /** Seed item consumed to plant. */
  seedItemId: string;
  /** Crop item granted on harvest. */
  cropItemId: string;
  name: string;
  /** Real-time milliseconds from planting to ready-to-harvest. */
  growMs: number;
  /** Farming XP awarded on harvest. */
  skillXp: number;
  /** Crops produced per harvest. */
  yield: number;
}

/** A tilled plot's position in a zone. */
export interface FarmPlotNode {
  id: string;
  tileX: number;
  tileY: number;
  /**
   * Tile footprint (span×span), anchored top-left. Defaults to 2 for built-in
   * plots (the classic 2×2 patch) and 1 for painted `soil_` plots. Set to 1 for
   * single-tile built-in plots.
   */
  size?: number;
}

/** A plot's tile span (2×2 by default; 1 for `soil_` paint or explicit size). */
export function farmPlotSpan(plot: FarmPlotNode): number {
  return plot.size ?? (plot.id.startsWith("soil_") ? 1 : 2);
}

/**
 * Tile-space offset from the plot anchor to its visual/interaction centre.
 * A 2×2 plot centres half a tile in; a 1×1 plot centres on its own tile.
 */
export function farmPlotCenterOffset(plot: FarmPlotNode): number {
  return (farmPlotSpan(plot) - 1) / 2;
}

export type FarmPlotStage = "empty" | "growing" | "ready";

export interface FarmPlotState {
  plotId: string;
  stage: FarmPlotStage;
  cropId?: string;
  /** Epoch ms — lets the client animate growth without per-tick updates. */
  plantedAt?: number;
  readyAt?: number;
  planterName?: string;
}

/** 0..1 growth progress from the plant/ready timestamps. */
export function farmGrowthProgress(plantedAt: number, readyAt: number, now: number): number {
  if (readyAt <= plantedAt) return 1;
  return Math.max(0, Math.min(1, (now - plantedAt) / (readyAt - plantedAt)));
}

export interface FarmStatePayload {
  plots: FarmPlotState[];
}

export interface FarmResultPayload {
  ok: boolean;
  error?: string;
  plotId?: string;
  action?: "plant" | "harvest";
  skillXpGained?: number;
  farmingLevel?: number;
  inventory?: InventoryStatePayload;
  playerName?: string;
  /** Harvest only: the crop item + count harvested, for the drop-collect FX. */
  cropId?: string;
  cropQuantity?: number;
}

// Seeds are sold by Pip and at player-placed crop markets (gold sinks that
// bootstrap farming).
export const FARM_CROPS: Record<string, FarmCrop> = {
  item_wheat_seed: {
    seedItemId: "item_wheat_seed",
    cropItemId: "item_wheat",
    name: "Wheat",
    growMs: 90_000,
    skillXp: 14,
    yield: 2,
  },
  item_carrot_seed: {
    seedItemId: "item_carrot_seed",
    cropItemId: "item_carrot",
    name: "Carrot",
    growMs: 150_000,
    skillXp: 22,
    yield: 2,
  },
};

export function getFarmCropBySeed(seedItemId: string): FarmCrop | undefined {
  return FARM_CROPS[seedItemId];
}

/** The fallback seed when a player has none (also the cheapest crop). */
export const DEFAULT_FARM_SEED = "item_wheat_seed";

// ---- Crop markets ----------------------------------------------------------
// Placeable market buildings ("market-wheat" / "market-carrot" zone assets)
// double as trading posts: walk up + interact to buy that crop's seeds and
// sell its harvest. Buying burns gold; selling mints it (like the NPC shop).

export interface CropMarketDef {
  /** Zone-asset prop id that hosts this market. */
  propId: string;
  label: string;
  seedItemId: string;
  cropItemId: string;
  /** Gold to buy one seed. */
  seedPrice: number;
  /** Gold paid per crop sold. */
  cropSellPrice: number;
}

export const CROP_MARKETS: Record<string, CropMarketDef> = {
  "market-wheat": {
    propId: "market-wheat",
    label: "Wheat Market",
    seedItemId: "item_wheat_seed",
    cropItemId: "item_wheat",
    seedPrice: 5, // matches Pip's seed price
    cropSellPrice: 7, // matches the NPC shop's wheat buyback
  },
  "market-carrot": {
    propId: "market-carrot",
    label: "Carrot Market",
    seedItemId: "item_carrot_seed",
    cropItemId: "item_carrot",
    seedPrice: 9, // slower crop, pricier seed…
    cropSellPrice: 14, // …but a better payout per harvest
  },
};

export function getCropMarket(propId: string): CropMarketDef | undefined {
  return CROP_MARKETS[propId];
}
