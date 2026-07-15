// Player net worth: everything a player owns, valued in gold. Used by the
// richest leaderboard instead of gold-on-hand alone.
//
// Components (all at base/vendor valuations, not asking prices):
//   - gold on hand + pending (offline-sale) gold
//   - inventory items at vendor base value
//   - build assets owned (asset_inventory) and escrowed in open P2P listings
//   - owned Worlds: slot cost + everything placed in the build + unclaimed earnings
//   - owned land plots: plot cost + player-shop stock + unclaimed earnings
//   - stock portfolio: shares held in listed companies, at LIQUIDATION value
//     (what selling them now would return down the bonding curve). The gold that
//     backs those shares sits in each market's reserve, which is not attributed
//     to anyone, so this adds no phantom wealth and can't double-count.

import {
  getItemBaseValue,
  getPvpSeason,
  shareSellProceeds,
  zoneAssetPrice,
  zoneBuildCost,
  PLOT_PRICE,
  SEASON_EPOCH_MS,
  ZONE_SLOT_COST,
  type PlayerZoneBuild,
  type ShopListing,
} from "@metricbase/shared";
import type pg from "pg";
import { getPool } from "./pool.js";

/** Excludes deploy/health-probe accounts from any characters scan. */
export const PROBE_FILTER = "name !~ '^__' AND name NOT IN ('DeployCheck', 'WSProbe')";

/** Assets owned outside the character row, keyed by wallet or (walletless) name. */
export interface ExternalWealth {
  byWallet: Map<string, number>;
  byName: Map<string, number>;
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Gold value of a character's inventory JSON at vendor base prices. */
export function inventoryValue(inventory: unknown): number {
  let total = 0;
  for (const entry of asArray(inventory)) {
    const { itemId, quantity } = (entry ?? {}) as { itemId?: string; quantity?: number };
    if (typeof itemId === "string" && typeof quantity === "number" && quantity > 0) {
      total += getItemBaseValue(itemId) * quantity;
    }
  }
  return total;
}

/** Gold value of everything placed in a World build blob ({} on fresh zones). */
function buildValue(build: unknown): number {
  const b = (build ?? {}) as Partial<PlayerZoneBuild>;
  return zoneBuildCost({
    ...b,
    tiles: b.tiles ?? [],
    scenery: b.scenery ?? [],
    resources: b.resources ?? [],
  } as PlayerZoneBuild);
}

/** Gold value of a player shop's stocked items (goods, not asking prices). */
function shopStockValue(listings: unknown): number {
  let total = 0;
  for (const entry of asArray(listings)) {
    const { itemId, quantity } = (entry ?? {}) as Partial<ShopListing>;
    if (typeof itemId === "string" && typeof quantity === "number" && quantity > 0) {
      total += getItemBaseValue(itemId) * quantity;
    }
  }
  return total;
}

/**
 * Sum every player's non-character holdings (Worlds, plots, build assets,
 * listings, pending gold). Each source row is credited to exactly one key —
 * its wallet when present, otherwise its player name — so a character picks
 * up both maps without double counting.
 */
export async function fetchExternalWealth(pool: pg.Pool): Promise<ExternalWealth> {
  const byWallet = new Map<string, number>();
  const byName = new Map<string, number>();
  const credit = (wallet: string | null | undefined, name: string | null | undefined, value: number) => {
    if (value <= 0) return;
    if (wallet) byWallet.set(wallet, (byWallet.get(wallet) ?? 0) + value);
    else if (name) byName.set(name, (byName.get(name) ?? 0) + value);
  };

  const [pending, assets, listings, zones, plots, shares] = await Promise.all([
    pool.query("SELECT player_name, player_wallet, amount FROM pending_gold"),
    pool.query("SELECT player_name, player_wallet, asset_id, qty FROM asset_inventory"),
    pool.query("SELECT seller_name, seller_wallet, asset_id, qty FROM asset_listings"),
    pool.query("SELECT owner_name, owner_wallet, build, earnings FROM player_zones"),
    pool.query("SELECT owner_name, owner_wallet, listings, earnings FROM land_plots"),
    pool.query(
      `SELECT h.holder_name, h.holder_wallet, h.shares, m.circulating_shares, m.base_price, m.slope
       FROM share_holdings h JOIN share_markets m ON h.company_id = m.company_id
       WHERE h.shares > 0`,
    ),
  ]);

  for (const row of pending.rows) {
    credit(row.player_wallet, row.player_name, Number(row.amount) || 0);
  }
  for (const row of assets.rows) {
    credit(row.player_wallet, row.player_name, zoneAssetPrice(row.asset_id) * (Number(row.qty) || 0));
  }
  for (const row of listings.rows) {
    credit(row.seller_wallet, row.seller_name, zoneAssetPrice(row.asset_id) * (Number(row.qty) || 0));
  }
  for (const row of zones.rows) {
    credit(
      row.owner_wallet,
      row.owner_name,
      ZONE_SLOT_COST + buildValue(row.build) + (Number(row.earnings) || 0),
    );
  }
  for (const row of plots.rows) {
    credit(
      row.owner_wallet,
      row.owner_name,
      PLOT_PRICE + shopStockValue(row.listings) + (Number(row.earnings) || 0),
    );
  }
  for (const row of shares.rows) {
    const held = Number(row.shares) || 0;
    const supply = Number(row.circulating_shares) || 0;
    if (held <= 0 || supply <= 0) continue;
    const value = shareSellProceeds(supply, Math.min(held, supply), Number(row.base_price), Number(row.slope));
    credit(row.holder_wallet, row.holder_name, value);
  }

  return { byWallet, byName };
}

/** A character's total net worth given the shared external-wealth maps. */
export function resolveNetWorth(
  wealth: ExternalWealth,
  wallet: string | null | undefined,
  name: string,
  gold: number,
  inventory: unknown,
): number {
  return (
    gold +
    inventoryValue(inventory) +
    (wallet ? (wealth.byWallet.get(wallet) ?? 0) : 0) +
    (wealth.byName.get(name) ?? 0)
  );
}

// ===== Daily snapshots + /stats richest board ================================

const DAY_MS = 24 * 60 * 60 * 1000;

/** 1-based day counter since game launch (the season epoch = launch day). */
export function daysSinceLaunch(now: number): number {
  return Math.max(1, Math.floor((now - SEASON_EPOCH_MS) / DAY_MS) + 1);
}

interface NetWorthRow {
  /** Stable snapshot identity: wallet when bonded, else the display name. */
  key: string;
  name: string;
  netWorth: number;
}

/** Every real player's current net worth (probe accounts excluded). */
async function computeAllNetWorth(pool: pg.Pool): Promise<NetWorthRow[]> {
  const [chars, wealth] = await Promise.all([
    pool.query(`SELECT name, wallet_address, gold, inventory FROM characters WHERE ${PROBE_FILTER}`),
    fetchExternalWealth(pool),
  ]);
  return chars.rows.map((row) => ({
    key: row.wallet_address || row.name,
    name: row.name,
    netWorth: resolveNetWorth(wealth, row.wallet_address, row.name, Number(row.gold) || 0, row.inventory),
  }));
}

/**
 * Upsert today's (UTC) net-worth snapshot for every player. Idempotent — the
 * last capture of the day wins, so the stored row converges on end-of-day.
 */
export async function captureNetWorthSnapshot(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    const season = getPvpSeason(Date.now());
    const rows = await computeAllNetWorth(pool);
    for (const row of rows) {
      await pool.query(
        `INSERT INTO net_worth_daily (day, player_key, name, season, net_worth)
         VALUES ((now() AT TIME ZONE 'utc')::date, $1, $2, $3, $4)
         ON CONFLICT (day, player_key) DO UPDATE SET name = $2, season = $3, net_worth = $4`,
        [row.key, row.name, season, row.netWorth],
      );
    }
  } catch (error) {
    console.warn("[networth] snapshot failed:", error);
  }
}

export interface RichestEntry {
  name: string;
  netWorth: number;
  /** Change vs the latest prior-day snapshot this season; null = no baseline yet. */
  change: number | null;
}

export interface RichestBoard {
  /** Display season number (1-based). Baselines reset each season. */
  season: number;
  /** Display day number, 1-based since game launch. */
  day: number;
  entries: RichestEntry[];
}

const BOARD_TTL_MS = 60_000;
let boardCache: RichestBoard | null = null;
let boardCachedAt = 0;

/** Top players by live net worth with day-over-day change, cached a minute. */
export async function getRichestBoard(limit = 10): Promise<RichestBoard> {
  const now = Date.now();
  if (boardCache && now - boardCachedAt < BOARD_TTL_MS) return boardCache;
  const season = getPvpSeason(now);
  const empty: RichestBoard = { season: season + 1, day: daysSinceLaunch(now), entries: [] };
  const pool = getPool();
  if (!pool) return boardCache ?? empty;
  try {
    const rows = await computeAllNetWorth(pool);
    rows.sort((a, b) => b.netWorth - a.netWorth);
    const top = rows.slice(0, limit);
    // Baseline = each player's most recent snapshot BEFORE today, this season
    // only — a new season starts everyone from "no baseline" (the reset).
    const baseline = new Map<string, number>();
    try {
      const base = await pool.query(
        `SELECT DISTINCT ON (player_key) player_key, net_worth FROM net_worth_daily
         WHERE season = $1 AND day < (now() AT TIME ZONE 'utc')::date
         ORDER BY player_key, day DESC`,
        [season],
      );
      for (const r of base.rows) baseline.set(r.player_key as string, Number(r.net_worth));
    } catch {
      /* table may not exist yet — every entry just shows "new" */
    }
    boardCache = {
      season: season + 1,
      day: daysSinceLaunch(now),
      entries: top.map((row) => {
        const prev = baseline.get(row.key);
        return { name: row.name, netWorth: row.netWorth, change: prev === undefined ? null : row.netWorth - prev };
      }),
    };
    boardCachedAt = now;
    return boardCache;
  } catch (error) {
    console.warn("[networth] richest board failed:", error);
    return boardCache ?? empty;
  }
}
