import {
  deleteFarmPlot,
  loadFarmPlots,
  saveFarmPlot,
  type StoredFarmPlot,
} from "../db/farmPlots.js";

// Process-global registry of planted farm plots, shared across zone rooms and
// persisted to the DB so crops keep growing (and survive) server restarts.
// Empty plots are simply absent from the map.
export interface FarmPlotRecord extends StoredFarmPlot {
  /** Transient: have we already broadcast that this plot is ripe? */
  readyBroadcast: boolean;
}

const plots = new Map<string, FarmPlotRecord>();

export async function initFarmRegistry(): Promise<void> {
  const now = Date.now();
  for (const plot of await loadFarmPlots()) {
    plots.set(plot.plotId, { ...plot, readyBroadcast: now >= plot.readyAt });
  }
}

export function getFarmPlot(plotId: string): FarmPlotRecord | undefined {
  return plots.get(plotId);
}

export function getFarmPlotsForZone(zoneId: string): FarmPlotRecord[] {
  return [...plots.values()].filter((plot) => plot.zoneId === zoneId);
}

export function plantFarmPlot(record: StoredFarmPlot): void {
  plots.set(record.plotId, { ...record, readyBroadcast: false });
  void saveFarmPlot(record);
}

export function harvestFarmPlot(plotId: string): void {
  plots.delete(plotId);
  void deleteFarmPlot(plotId);
}

export function markReadyBroadcast(plotId: string): void {
  const record = plots.get(plotId);
  if (record) record.readyBroadcast = true;
}
