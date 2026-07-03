import { Router } from "express";
import { GAME_VERSION } from "@metricbase/shared";
import { getPool } from "../db/pool.js";
import { ZoneRoom } from "../rooms/ZoneRoom.js";
import { getDailySeries, getMetricTotals } from "../economy/metrics.js";

export const statsRouter = Router();

async function scalar(sql: string, def = 0): Promise<number> {
  const pool = getPool();
  if (!pool) return def;
  try {
    const res = await pool.query<{ v: string | number | null }>(sql);
    return Number(res.rows[0]?.v ?? def);
  } catch {
    return def;
  }
}

interface EconomyStats {
  version: string;
  updatedAt: number;
  players: { registered: number; online: number; circulatingGold: number };
  worlds: { total: number; published: number };
  treasury: { total: number; bySource: { source: string; gold: number }[] };
  goldMarket: { trades: number; goldVolume: number };
  assetMarket: { listings: number; askValue: number; totalOwned: number };
  topHolders: { name: string; gold: number }[];
  activity: Record<string, number>;
  daily: { day: string; metric: string; value: number }[];
}

async function buildStats(): Promise<EconomyStats> {
  const pool = getPool();
  const [registered, circulatingGold, worldsTotal, worldsPub, gmTrades, gmVol, alCount, alValue, aiOwned] =
    await Promise.all([
      scalar("SELECT COUNT(*) v FROM characters"),
      scalar("SELECT COALESCE(SUM(gold),0) v FROM characters"),
      scalar("SELECT COUNT(*) v FROM player_zones"),
      scalar("SELECT COUNT(*) v FROM player_zones WHERE published"),
      scalar("SELECT COUNT(*) v FROM market_trades"),
      scalar("SELECT COALESCE(SUM(gold_amount),0) v FROM market_trades"),
      scalar("SELECT COUNT(*) v FROM asset_listings"),
      scalar("SELECT COALESCE(SUM(price),0) v FROM asset_listings"),
      scalar("SELECT COALESCE(SUM(qty),0) v FROM asset_inventory"),
    ]);

  let bySource: { source: string; gold: number }[] = [];
  let topHolders: { name: string; gold: number }[] = [];
  if (pool) {
    try {
      const t = await pool.query<{ source: string; gold: string }>(
        "SELECT source, gold FROM treasury_gold ORDER BY gold DESC",
      );
      bySource = t.rows.map((r) => ({ source: r.source, gold: Number(r.gold) }));
    } catch {
      /* table may not exist yet */
    }
    try {
      const h = await pool.query<{ name: string; gold: number }>(
        "SELECT name, gold FROM characters ORDER BY gold DESC LIMIT 10",
      );
      topHolders = h.rows.map((r) => ({ name: r.name, gold: Number(r.gold) }));
    } catch {
      /* ignore */
    }
  }

  const daily = await getDailySeries(14);

  return {
    version: GAME_VERSION,
    updatedAt: Date.now(),
    players: { registered, online: ZoneRoom.onlinePlayerCount(), circulatingGold },
    worlds: { total: worldsTotal, published: worldsPub },
    treasury: { total: bySource.reduce((a, b) => a + b.gold, 0), bySource },
    goldMarket: { trades: gmTrades, goldVolume: gmVol },
    assetMarket: { listings: alCount, askValue: alValue, totalOwned: aiOwned },
    topHolders,
    activity: getMetricTotals(),
    daily,
  };
}

statsRouter.get("/stats", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=15");
  res.json(await buildStats());
});
