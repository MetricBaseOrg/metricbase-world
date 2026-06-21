import type { LandPlotState, StructureType } from "@metricbase/shared";
import { loadLandPlots, saveLandPlot, type StoredLandPlot } from "../db/landPlots.js";

// Process-global registry of owned land plots, shared across zone rooms and
// persisted to the DB so ownership survives restarts.
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
  const record: StoredLandPlot = { plotId, zoneId, ownerWallet, ownerName, structure };
  plots.set(plotId, record);
  void saveLandPlot(record);
}

/** Build the state payload for a zone's configured plots. */
export function buildLandPlotStates(plotIds: string[]): LandPlotState[] {
  return plotIds.map((plotId) => {
    const owned = plots.get(plotId);
    return owned
      ? { plotId, ownerName: owned.ownerName, structure: owned.structure }
      : { plotId, structure: "none" as const };
  });
}
