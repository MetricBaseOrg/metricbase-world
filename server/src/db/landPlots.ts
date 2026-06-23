import { normalizeDecor, type ShopListing, type StructureType } from "@metricbase/shared";
import { getPool } from "./pool.js";

export interface StoredLandPlot {
  plotId: string;
  zoneId: string;
  ownerWallet: string | null;
  ownerName: string;
  structure: StructureType;
  /** Chosen roof-paint palette id, or null for the default colour. */
  roof: string | null;
  /** Owner-set building name, or null for the default label. */
  sign: string | null;
  /** Corner decoration prop ids (fixed-length; null = empty corner). */
  decor: (string | null)[];
  listings: ShopListing[];
  earnings: number;
  /** Building light state. */
  lightOn: boolean;
  energy: number;
  energyAt: number | null;
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
      roof: string | null;
      sign: string | null;
      decor: unknown;
      listings: unknown;
      earnings: number | null;
      light_on: boolean | null;
      energy: number | null;
      energy_at: string | number | null;
    }>(
      "SELECT plot_id, zone_id, owner_wallet, owner_name, structure, roof, sign, decor, listings, earnings, light_on, energy, energy_at FROM land_plots",
    );
    return res.rows.map((row) => ({
      plotId: row.plot_id,
      zoneId: row.zone_id,
      ownerWallet: row.owner_wallet,
      ownerName: row.owner_name,
      structure: (row.structure as StructureType) ?? "house",
      roof: row.roof,
      sign: row.sign,
      decor: normalizeDecor(row.decor),
      listings: normalizeListings(row.listings),
      earnings: row.earnings ?? 0,
      lightOn: Boolean(row.light_on),
      energy: row.energy ?? 100,
      energyAt: row.energy_at === null ? null : Number(row.energy_at),
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
      `INSERT INTO land_plots (plot_id, zone_id, owner_wallet, owner_name, structure, roof, sign, decor, listings, earnings, light_on, energy, energy_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (plot_id)
       DO UPDATE SET owner_wallet = EXCLUDED.owner_wallet, owner_name = EXCLUDED.owner_name,
                     structure = EXCLUDED.structure, roof = EXCLUDED.roof, sign = EXCLUDED.sign,
                     decor = EXCLUDED.decor, listings = EXCLUDED.listings, earnings = EXCLUDED.earnings,
                     light_on = EXCLUDED.light_on, energy = EXCLUDED.energy, energy_at = EXCLUDED.energy_at`,
      [
        plot.plotId,
        plot.zoneId,
        plot.ownerWallet,
        plot.ownerName,
        plot.structure,
        plot.roof,
        plot.sign,
        JSON.stringify(plot.decor ?? []),
        JSON.stringify(plot.listings ?? []),
        plot.earnings ?? 0,
        plot.lightOn,
        plot.energy,
        plot.energyAt,
      ],
    );
  } catch (error) {
    console.warn("[landPlots] save failed:", error);
  }
}
