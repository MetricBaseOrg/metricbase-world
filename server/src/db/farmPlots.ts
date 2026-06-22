import { getPool } from "./pool.js";

export interface StoredFarmPlot {
  plotId: string;
  zoneId: string;
  cropId: string;
  seedId: string;
  planterName: string;
  plantedAt: number;
  readyAt: number;
}

export async function loadFarmPlots(): Promise<StoredFarmPlot[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      plot_id: string;
      zone_id: string;
      crop_id: string;
      seed_id: string;
      planter_name: string;
      planted_at: string | number;
      ready_at: string | number;
    }>(
      "SELECT plot_id, zone_id, crop_id, seed_id, planter_name, planted_at, ready_at FROM farm_plots",
    );
    return res.rows.map((row) => ({
      plotId: row.plot_id,
      zoneId: row.zone_id,
      cropId: row.crop_id,
      seedId: row.seed_id,
      planterName: row.planter_name,
      // BIGINT comes back as a string from node-postgres.
      plantedAt: Number(row.planted_at),
      readyAt: Number(row.ready_at),
    }));
  } catch (error) {
    console.warn("[farmPlots] load failed:", error);
    return [];
  }
}

export async function saveFarmPlot(plot: StoredFarmPlot): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO farm_plots (plot_id, zone_id, crop_id, seed_id, planter_name, planted_at, ready_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (plot_id)
       DO UPDATE SET zone_id = EXCLUDED.zone_id, crop_id = EXCLUDED.crop_id,
                     seed_id = EXCLUDED.seed_id, planter_name = EXCLUDED.planter_name,
                     planted_at = EXCLUDED.planted_at, ready_at = EXCLUDED.ready_at`,
      [
        plot.plotId,
        plot.zoneId,
        plot.cropId,
        plot.seedId,
        plot.planterName,
        plot.plantedAt,
        plot.readyAt,
      ],
    );
  } catch (error) {
    console.warn("[farmPlots] save failed:", error);
  }
}

export async function deleteFarmPlot(plotId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM farm_plots WHERE plot_id = $1", [plotId]);
  } catch (error) {
    console.warn("[farmPlots] delete failed:", error);
  }
}
