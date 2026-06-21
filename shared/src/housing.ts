// Housing: players spend gold to own a land plot and place a structure on it.
// This is both a gameplay goal ("make a living in MetricBase") and the largest
// gold sink in the economy.

export type StructureType = "none" | "house" | "shop";

/** Gold cost to buy a land plot. A deliberately large long-term gold sink. */
export const PLOT_PRICE = 500;

/** How close a player must stand to interact with a plot (3x3 footprint). */
export const HOUSE_RANGE = 150;

/** A land plot occupies a 3x3 tile footprint centred on (tileX, tileY). */
export interface LandPlotNode {
  id: string;
  tileX: number;
  tileY: number;
}

export interface LandPlotState {
  plotId: string;
  ownerName?: string;
  structure: StructureType;
}

export interface HousingStatePayload {
  plots: LandPlotState[];
}

export interface HousingResultPayload {
  ok: boolean;
  error?: string;
  plotId?: string;
  gold?: number;
  ownerName?: string;
}

export function structureLabel(structure: StructureType): string {
  return structure === "shop" ? "Shop" : structure === "house" ? "House" : "Plot";
}
