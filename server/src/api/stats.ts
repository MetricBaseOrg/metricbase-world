import { Router } from "express";
import {
  BLACK_ZONE_BURN_AMOUNT,
  GAME_VERSION,
  ITEMS,
  ITEM_ICONS,
  SHOPS,
  getItemBaseValue,
  supplyDemandMultiplier,
} from "@metricbase/shared";
import { getPool } from "../db/pool.js";
import { ZoneRoom } from "../rooms/ZoneRoom.js";
import { getDailySeries, getMetricTotals } from "../economy/metrics.js";
import { getItemFlows } from "../economy/itemFlows.js";
import { getPlayerHeldBase } from "../solana/playerHeldBase.js";
import { adService, type AdPublicStats } from "../ads/adService.js";
import { countOpenJobs } from "../jobs/jobRegistry.js";

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
  players: { registered: number; online: number; circulatingGold: number; avgLevel: number; maxLevel: number };
  worlds: {
    total: number;
    published: number;
    /** Lifetime visitor entries across all Worlds. */
    visits: number;
    passesSold: number;
    passGold: number;
    taxGold: number;
    /** Worlds that bought at least one grid expansion. */
    expanded: number;
  };
  treasury: { total: number; bySource: { source: string; gold: number }[] };
  goldMarket: { trades: number; goldVolume: number };
  assetMarket: { listings: number; askValue: number; totalOwned: number };
  baseToken: { burned: number; heldByPlayers: number; holders: number };
  /** On-chain $BASE burn sinks, broken down by feature. */
  burnSinks: {
    blackPasses: number;
    blackPassBase: number;
    worldExpands: number;
    worldExpandBase: number;
    bagExpands: number;
    bagExpandBase: number;
  };
  /** Daily-quest engagement. */
  dailyQuests: { activeToday: number; claimed: number; gold: number; logins: number };
  /** Player-to-player jobs (hire & be hired). */
  jobs: { openNow: number; posted: number; completed: number; goldPaid: number; escrowGold: number };
  ads: AdPublicStats;
  topHolders: { name: string; gold: number }[];
  activity: Record<string, number>;
  daily: { day: string; metric: string; value: number }[];
  /** Live supply/demand item prices (vendor pays / shop charges). */
  itemPrices: ItemPriceStat[];
}

export interface ItemPriceStat {
  itemId: string;
  name: string;
  kind: string;
  emoji: string;
  /** Base vendor (sell-to-NPC) value; 0 when no vendor buys it. */
  base: number;
  /** Current vendor value after the supply/demand multiplier. */
  price: number;
  /** Base / current NPC shop price when the item is sold BY a shop. */
  buyBase: number;
  buyPrice: number;
  /** Supply/demand price multiplier (1 = neutral). */
  mult: number;
  /** Rolling 7-day flow volumes. */
  produced7d: number;
  consumed7d: number;
}

/** Every item with a price or any recorded flow, with its live price. */
function buildItemPrices(): ItemPriceStat[] {
  const flows = getItemFlows();
  const buyOffers = SHOPS.pip_general.buyOffers;
  const ids = new Set<string>([
    ...Object.keys(ITEMS).filter((id) => getItemBaseValue(id) > 0),
    ...buyOffers.map((o) => o.itemId),
    ...flows.keys(),
  ]);
  const out: ItemPriceStat[] = [];
  for (const itemId of ids) {
    const f = flows.get(itemId);
    const produced = f?.produced ?? 0;
    const consumed = f?.consumed ?? 0;
    const mult = supplyDemandMultiplier(produced, consumed);
    const base = getItemBaseValue(itemId);
    const offer = buyOffers.find((o) => o.itemId === itemId);
    out.push({
      itemId,
      name: ITEMS[itemId]?.name ?? itemId,
      kind: ITEMS[itemId]?.kind ?? "material",
      emoji: ITEM_ICONS[itemId] ?? "",
      base,
      price: base > 0 ? Math.max(1, Math.round(base * mult)) : 0,
      buyBase: offer?.price ?? 0,
      buyPrice: offer ? Math.max(1, Math.round(offer.price * mult)) : 0,
      mult: Math.round(mult * 100) / 100,
      produced7d: produced,
      consumed7d: consumed,
    });
  }
  return out.sort((a, b) => b.price - a.price || b.produced7d - a.produced7d || a.name.localeCompare(b.name));
}

export async function buildStats(): Promise<EconomyStats> {
  const pool = getPool();
  const [registered, circulatingGold, avgLevel, maxLevel, worldsTotal, worldsPub, gmTrades, gmVol, alCount, alValue, aiOwned] =
    await Promise.all([
      scalar("SELECT COUNT(*) v FROM characters"),
      scalar("SELECT COALESCE(SUM(gold),0) v FROM characters"),
      scalar("SELECT COALESCE(ROUND(AVG(level)),0) v FROM characters"),
      scalar("SELECT COALESCE(MAX(level),0) v FROM characters"),
      scalar("SELECT COUNT(*) v FROM player_zones"),
      scalar("SELECT COUNT(*) v FROM player_zones WHERE published"),
      scalar("SELECT COUNT(*) v FROM market_trades"),
      scalar("SELECT COALESCE(SUM(gold_amount),0) v FROM market_trades"),
      scalar("SELECT COUNT(*) v FROM asset_listings"),
      scalar("SELECT COALESCE(SUM(price),0) v FROM asset_listings"),
      scalar("SELECT COALESCE(SUM(qty),0) v FROM asset_inventory"),
    ]);

  // Worlds engagement + on-chain burn sinks + daily-quest reach — all durable.
  const [wVisits, wPasses, wPassGold, wTaxGold, wExpanded, blackPasses, weCount, weBase, beCount, beBase, dailyActive] =
    await Promise.all([
      scalar("SELECT COALESCE(SUM(visits),0) v FROM player_zones"),
      scalar("SELECT COALESCE(SUM(passes_sold),0) v FROM player_zones"),
      scalar("SELECT COALESCE(SUM(pass_gold),0) v FROM player_zones"),
      scalar("SELECT COALESCE(SUM(tax_gold),0) v FROM player_zones"),
      scalar("SELECT COUNT(*) v FROM player_zones WHERE expand_level > 0"),
      scalar("SELECT COUNT(*) v FROM characters WHERE black_pass = true"),
      scalar("SELECT COUNT(*) v FROM token_purchases WHERE product_id = 'zone_expand'"),
      scalar("SELECT COALESCE(SUM(token_amount),0) v FROM token_purchases WHERE product_id = 'zone_expand'"),
      scalar("SELECT COUNT(*) v FROM token_purchases WHERE product_id = 'bag_expand'"),
      scalar("SELECT COALESCE(SUM(token_amount),0) v FROM token_purchases WHERE product_id = 'bag_expand'"),
      scalar("SELECT COUNT(*) v FROM daily_state WHERE day = to_char(now() AT TIME ZONE 'utc','YYYY-MM-DD')"),
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

  const playerHeld = await getPlayerHeldBase();
  const ads = await adService.getPublicStats();
  const activity = getMetricTotals();
  const daily = await getDailySeries(14);
  // Fold in the $BASE gold-market volume per day from market_trades.
  if (pool) {
    try {
      const m = await pool.query<{ day: Date; v: string }>(
        `SELECT created_at::date AS day, SUM(gold_amount) v FROM market_trades
         WHERE created_at >= (CURRENT_DATE - 13) GROUP BY 1 ORDER BY 1`,
      );
      for (const r of m.rows) {
        const day = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
        daily.push({ day, metric: "market.gold", value: Number(r.v) });
      }
    } catch {
      /* ignore */
    }
  }

  return {
    version: GAME_VERSION,
    updatedAt: Date.now(),
    players: { registered, online: ZoneRoom.onlinePlayerCount(), circulatingGold, avgLevel, maxLevel },
    worlds: {
      total: worldsTotal,
      published: worldsPub,
      visits: wVisits,
      passesSold: wPasses,
      passGold: wPassGold,
      taxGold: wTaxGold,
      expanded: wExpanded,
    },
    treasury: { total: bySource.reduce((a, b) => a + b.gold, 0), bySource },
    goldMarket: { trades: gmTrades, goldVolume: gmVol },
    assetMarket: { listings: alCount, askValue: alValue, totalOwned: aiOwned },
    baseToken: {
      burned: activity["base.burned"] ?? 0,
      heldByPlayers: playerHeld?.totalHeld ?? 0,
      holders: playerHeld?.holders ?? 0,
    },
    burnSinks: {
      blackPasses,
      blackPassBase: blackPasses * BLACK_ZONE_BURN_AMOUNT,
      worldExpands: weCount,
      worldExpandBase: weBase,
      bagExpands: beCount,
      bagExpandBase: beBase,
    },
    dailyQuests: {
      activeToday: dailyActive,
      claimed: activity["daily.claimed"] ?? 0,
      gold: activity["daily.gold"] ?? 0,
      logins: activity["daily.login"] ?? 0,
    },
    jobs: {
      openNow: countOpenJobs(),
      posted: activity["jobs.posted"] ?? 0,
      completed: activity["jobs.completed"] ?? 0,
      goldPaid: activity["jobs.goldPaid"] ?? 0,
      escrowGold: activity["jobs.escrowGold"] ?? 0,
    },
    ads,
    topHolders,
    activity,
    daily,
    itemPrices: buildItemPrices(),
  };
}

statsRouter.get("/stats", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=15");
  res.json(await buildStats());
});
