import type { StructureType } from "@metricbase/shared";
import { getPool } from "./pool.js";

export interface StoredLandPlot {
  plotId: string;
  zoneId: string;
  ownerWallet: string | null;
  ownerName: string;
  structure: StructureType;
}

export async function loadLandPlots(): Promise<StoredLandPlot[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      plot_id: string;
      zone_id: string;
      owner_wallet: string | null;
      owner_name: string;
      structure: string;
    }>("SELECT plot_id, zone_id, owner_wallet, owner_name, structure FROM land_plots");
    return res.rows.map((row) => ({
      plotId: row.plot_id,
      zoneId: row.zone_id,
      ownerWallet: row.owner_wallet,
      ownerName: row.owner_name,
      structure: (row.structure as StructureType) ?? "house",
    }));
  } catch (error) {
    console.warn("[landPlots] load failed:", error);
    return [];
  }
}

export async function saveLandPlot(plot: StoredLandPlot): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO land_plots (plot_id, zone_id, owner_wallet, owner_name, structure)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (plot_id)
       DO UPDATE SET owner_wallet = EXCLUDED.owner_wallet, owner_name = EXCLUDED.owner_name,
                     structure = EXCLUDED.structure`,
      [plot.plotId, plot.zoneId, plot.ownerWallet, plot.ownerName, plot.structure],
    );
  } catch (error) {
    console.warn("[landPlots] save failed:", error);
  }
}
