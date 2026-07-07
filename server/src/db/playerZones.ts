import {
  emptyPlayerZoneBuild,
  normalizePlayerZoneTier,
  type PlayerZoneBuild,
  type PlayerZoneRecord,
} from "@metricbase/shared";
import { getPool } from "./pool.js";

/** Coerce an arbitrary JSON blob into a well-formed build (defensive load). */
function normalizeBuild(value: unknown): PlayerZoneBuild {
  const base = emptyPlayerZoneBuild();
  if (!value || typeof value !== "object") return base;
  const v = value as Partial<PlayerZoneBuild>;
  return {
    spawnTile:
      v.spawnTile && typeof v.spawnTile.x === "number" && typeof v.spawnTile.y === "number"
        ? { x: v.spawnTile.x, y: v.spawnTile.y }
        : base.spawnTile,
    scenery: Array.isArray(v.scenery) ? v.scenery : [],
    landPlots: Array.isArray(v.landPlots) ? v.landPlots : [],
    farmPlots: Array.isArray(v.farmPlots) ? v.farmPlots : [],
    resources: Array.isArray(v.resources) ? v.resources : [],
    tiles: Array.isArray(v.tiles) ? v.tiles : [],
  };
}

export async function loadPlayerZones(): Promise<PlayerZoneRecord[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      zone_id: string;
      owner_wallet: string | null;
      owner_name: string;
      display_name: string;
      pass_price: number | null;
      published: boolean | null;
      earnings: number | null;
      visits: number | null;
      gather_tax: number | null;
      passes_sold: number | null;
      pass_gold: string | number | null;
      tax_gold: string | number | null;
      lifetime_earnings: string | number | null;
      created_at: Date | string | null;
      expand_level: number | null;
      danger_tier: string | null;
      build: unknown;
    }>(
      "SELECT zone_id, owner_wallet, owner_name, display_name, pass_price, published, earnings, visits, gather_tax, passes_sold, pass_gold, tax_gold, lifetime_earnings, created_at, expand_level, danger_tier, build FROM player_zones",
    );
    return res.rows.map((row) => ({
      zoneId: row.zone_id,
      ownerWallet: row.owner_wallet,
      ownerName: row.owner_name,
      displayName: row.display_name,
      passPrice: row.pass_price ?? 0,
      published: Boolean(row.published),
      earnings: row.earnings ?? 0,
      visits: row.visits ?? 0,
      gatherTax: row.gather_tax ?? 0,
      passesSold: row.passes_sold ?? 0,
      passGold: Number(row.pass_gold ?? 0),
      taxGold: Number(row.tax_gold ?? 0),
      // Older rows predate the counter; fall back to pass+tax so it's never less.
      lifetimeEarnings: Math.max(Number(row.lifetime_earnings ?? 0), Number(row.pass_gold ?? 0) + Number(row.tax_gold ?? 0)),
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      expandLevel: row.expand_level ?? 0,
      dangerTier: normalizePlayerZoneTier(row.danger_tier),
      build: normalizeBuild(row.build),
    }));
  } catch (error) {
    console.warn("[playerZones] load failed:", error);
    return [];
  }
}

export async function savePlayerZone(zone: PlayerZoneRecord): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO player_zones (zone_id, owner_wallet, owner_name, display_name, pass_price, published, earnings, visits, gather_tax, passes_sold, pass_gold, tax_gold, lifetime_earnings, expand_level, danger_tier, build)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (zone_id)
       DO UPDATE SET owner_wallet = EXCLUDED.owner_wallet, owner_name = EXCLUDED.owner_name,
                     display_name = EXCLUDED.display_name, pass_price = EXCLUDED.pass_price,
                     published = EXCLUDED.published, earnings = EXCLUDED.earnings,
                     visits = EXCLUDED.visits, gather_tax = EXCLUDED.gather_tax,
                     passes_sold = EXCLUDED.passes_sold, pass_gold = EXCLUDED.pass_gold,
                     tax_gold = EXCLUDED.tax_gold, lifetime_earnings = EXCLUDED.lifetime_earnings,
                     expand_level = EXCLUDED.expand_level, danger_tier = EXCLUDED.danger_tier,
                     build = EXCLUDED.build`,
      [
        zone.zoneId,
        zone.ownerWallet,
        zone.ownerName,
        zone.displayName,
        zone.passPrice,
        zone.published,
        zone.earnings,
        zone.visits,
        zone.gatherTax,
        zone.passesSold,
        zone.passGold,
        zone.taxGold,
        zone.lifetimeEarnings,
        zone.expandLevel,
        normalizePlayerZoneTier(zone.dangerTier),
        JSON.stringify(zone.build ?? emptyPlayerZoneBuild()),
      ],
    );
  } catch (error) {
    console.warn("[playerZones] save failed:", error);
  }
}

export interface StoredZonePass {
  zoneId: string;
  holderName: string;
  expiresAt: number;
}

export async function loadZonePasses(): Promise<StoredZonePass[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ zone_id: string; holder_name: string; expires_at: string | number }>(
      "SELECT zone_id, holder_name, expires_at FROM zone_passes",
    );
    return res.rows.map((row) => ({
      zoneId: row.zone_id,
      holderName: row.holder_name,
      expiresAt: Number(row.expires_at),
    }));
  } catch (error) {
    console.warn("[playerZones] load passes failed:", error);
    return [];
  }
}

export async function saveZonePass(pass: StoredZonePass): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO zone_passes (zone_id, holder_name, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (zone_id, holder_name)
       DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [pass.zoneId, pass.holderName, pass.expiresAt],
    );
  } catch (error) {
    console.warn("[playerZones] save pass failed:", error);
  }
}
