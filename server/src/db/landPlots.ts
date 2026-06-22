import type { ShopListing, StructureType } from "@metricbase/shared";
import { getPool } from "./pool.js";

export interface StoredLandPlot {
  plotId: string;
  zoneId: string;
  ownerWallet: string | null;
  ownerName: string;
  structure: StructureType;
  listings: ShopListing[];
  earnings: number;
}

function normalizeListings(value: unknown): ShopListing[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((l): l is ShopListing => !!l && typeof l === "object" && "itemId" in l)
    .map((l) => ({ itemId: String(l.itemId), quantity: Number(l.quantity) || 0, price: Number(l.price) || 0 }))
    .filter((l) => l.quantity > 0 && l.price > 0);
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
      listings: unknown;
      earnings: number | null;
    }>(
      "SELECT plot_id, zone_id, owner_wallet, owner_name, structure, listings, earnings FROM land_plots",
    );
    return res.rows.map((row) => ({
      plotId: row.plot_id,
      zoneId: row.zone_id,
      ownerWallet: row.owner_wallet,
      ownerName: row.owner_name,
      structure: (row.structure as StructureType) ?? "house",
      listings: normalizeListings(row.listings),
      earnings: row.earnings ?? 0,
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
      `INSERT INTO land_plots (plot_id, zone_id, owner_wallet, owner_name, structure, listings, earnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (plot_id)
       DO UPDATE SET owner_wallet = EXCLUDED.owner_wallet, owner_name = EXCLUDED.owner_name,
                     structure = EXCLUDED.structure, listings = EXCLUDED.listings,
                     earnings = EXCLUDED.earnings`,
      [
        plot.plotId,
        plot.zoneId,
        plot.ownerWallet,
        plot.ownerName,
        plot.structure,
        JSON.stringify(plot.listings ?? []),
        plot.earnings ?? 0,
      ],
    );
  } catch (error) {
    console.warn("[landPlots] save failed:", error);
  }
}
