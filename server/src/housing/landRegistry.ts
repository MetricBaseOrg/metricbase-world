import {
  normalizeDecor,
  PLOT_DECOR_SLOTS,
  type LandPlotState,
  type ShopListing,
  type StructureType,
} from "@metricbase/shared";
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
    roof: null,
    sign: null,
    decor: normalizeDecor(null),
    listings: [],
    earnings: 0,
  };
  plots.set(plotId, record);
  void saveLandPlot(record);
}

/** Set a single corner-decoration slot on an owned plot, persisting the change. */
export function setPlotDecor(plotId: string, slot: number, propId: string | null): void {
  const record = plots.get(plotId);
  if (!record) return;
  if (!Number.isInteger(slot) || slot < 0 || slot >= PLOT_DECOR_SLOTS) return;
  const decor = normalizeDecor(record.decor);
  decor[slot] = propId;
  record.decor = decor;
  void saveLandPlot(record);
}

/** Repaint an owned plot's roof, persisting the change. */
export function setPlotRoof(plotId: string, roof: string | null): void {
  const record = plots.get(plotId);
  if (!record) return;
  record.roof = roof;
  void saveLandPlot(record);
}

/** Rename an owned plot's building sign, persisting the change. */
export function setPlotSign(plotId: string, sign: string | null): void {
  const record = plots.get(plotId);
  if (!record) return;
  record.sign = sign;
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
      roof: owned.roof ?? undefined,
      sign: owned.sign ?? undefined,
      decor: owned.decor,
      listings: owned.listings,
      earnings: owned.earnings,
    };
  });
}
