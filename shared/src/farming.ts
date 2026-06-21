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
}

// One crop for v1. Seeds are sold by Pip (a gold sink that bootstraps farming).
export const FARM_CROPS: Record<string, FarmCrop> = {
  item_wheat_seed: {
    seedItemId: "item_wheat_seed",
    cropItemId: "item_wheat",
    name: "Wheat",
    growMs: 90_000,
    skillXp: 14,
    yield: 2,
  },
};

export function getFarmCropBySeed(seedItemId: string): FarmCrop | undefined {
  return FARM_CROPS[seedItemId];
}

/** The default seed a player plants (v1 has a single crop). */
export const DEFAULT_FARM_SEED = "item_wheat_seed";
