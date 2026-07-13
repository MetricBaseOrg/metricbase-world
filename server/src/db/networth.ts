// Player net worth: everything a player owns, valued in gold. Used by the
// richest leaderboard instead of gold-on-hand alone.
//
// Components (all at base/vendor valuations, not asking prices):
//   - gold on hand + pending (offline-sale) gold
//   - inventory items at vendor base value
//   - build assets owned (asset_inventory) and escrowed in open P2P listings
//   - owned Worlds: slot cost + everything placed in the build + unclaimed earnings
//   - owned land plots: plot cost + player-shop stock + unclaimed earnings

import {
  getItemBaseValue,
  zoneAssetPrice,
  zoneBuildCost,
  PLOT_PRICE,
  ZONE_SLOT_COST,
  type PlayerZoneBuild,
  type ShopListing,
} from "@metricbase/shared";
import type pg from "pg";

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

  const [pending, assets, listings, zones, plots] = await Promise.all([
    pool.query("SELECT player_name, player_wallet, amount FROM pending_gold"),
    pool.query("SELECT player_name, player_wallet, asset_id, qty FROM asset_inventory"),
    pool.query("SELECT seller_name, seller_wallet, asset_id, qty FROM asset_listings"),
    pool.query("SELECT owner_name, owner_wallet, build, earnings FROM player_zones"),
    pool.query("SELECT owner_name, owner_wallet, listings, earnings FROM land_plots"),
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

  return { byWallet, byName };
}
