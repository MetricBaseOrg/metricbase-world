import type { LandPlotState, ShopListing, StructureType } from "@metricbase/shared";
import { loadLandPlots, saveLandPlot, type StoredLandPlot } from "../db/landPlots.js";

// Process-global registry of owned land plots, shared across zone rooms and
// persisted to the DB so ownership (and shop inventory) survives restarts.
const plots = new Map<string, StoredLandPlot>();

export async function initLandRegistry(): Promise<void> {
  for (const plot of await loadLandPlots()) {
    plots.set(plot.plotId, plot);
  }
}

export function getPlotOwner(plotId: string): StoredLandPlot | undefined {
  return plots.get(plotId);
}

export function claimPlot(
  plotId: string,
  zoneId: string,
  ownerName: string,
  ownerWallet: string | null,
  structure: StructureType,
): void {
  const record: StoredLandPlot = {
    plotId,
    zoneId,
    ownerWallet,
    ownerName,
    structure,
    listings: [],
    earnings: 0,
  };
  plots.set(plotId, record);
  void saveLandPlot(record);
}

/** Replace a shop's listings and/or earnings, persisting the change. */
export function updatePlotShop(plotId: string, listings: ShopListing[], earnings: number): void {
  const record = plots.get(plotId);
  if (!record) return;
  record.listings = listings;
  record.earnings = earnings;
  void saveLandPlot(record);
}

/** Build the state payload for a zone's configured plots. */
export function buildLandPlotStates(plotIds: string[]): LandPlotState[] {
  return plotIds.map((plotId) => {
    const owned = plots.get(plotId);
    if (!owned) return { plotId, structure: "none" as const };
    return {
      plotId,
      ownerName: owned.ownerName,
      structure: owned.structure,
      listings: owned.listings,
      earnings: owned.earnings,
    };
  });
}
