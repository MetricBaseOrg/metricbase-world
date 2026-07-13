// Per-item supply & demand ledger. Every unit PRODUCED (gathered, crafted,
// mob/quest drops) and every DEMAND signal (craft inputs, food eaten, seeds
// planted, oil burned, gear broken, repair materials — and NPC SHOP PURCHASES,
// which reveal players wanting more than they have) is recorded as a daily
// metric (prod.<itemId> / cons.<itemId> in economy_daily via the metrics
// pipeline). A rolling 7-day window drives each item's price multiplier — see
// supplyDemandMultiplier in @metricbase/shared. Player-to-player transfers
// (jobs, gold market, loot bags) are NOT flows: the item merely changes hands.
// Exception: buying from a PLAYER SHOP is a demand signal like an NPC-shop
// buy, but credited only in proportion to the gold paid vs the item's base
// value (see handleShopBuyListing) so self-dealing can't pump prices for free.
// Selling TO an NPC is an oversupply signal handled by the short-term
// sell-pressure decay, not the flow ledger.

import { supplyDemandMultiplier } from "@metricbase/shared";
import { getPool } from "../db/pool.js";
import { bumpMetric } from "./metrics.js";

const WINDOW_DAYS = 7;
const REFRESH_MS = 10 * 60_000;

export interface ItemFlow {
  produced: number;
  consumed: number;
}

// itemId -> 7-day sums. Refreshed from the DB periodically; live events bump
// it immediately so prices react without waiting for the next refresh.
const flows = new Map<string, ItemFlow>();

function flowOf(itemId: string): ItemFlow {
  let f = flows.get(itemId);
  if (!f) flows.set(itemId, (f = { produced: 0, consumed: 0 }));
  return f;
}

export function recordProduced(itemId: string, quantity: number): void {
  if (!itemId || quantity <= 0) return;
  bumpMetric(`prod.${itemId}`, quantity);
  flowOf(itemId).produced += quantity;
}

export function recordConsumed(itemId: string, quantity: number): void {
  if (!itemId || quantity <= 0) return;
  bumpMetric(`cons.${itemId}`, quantity);
  flowOf(itemId).consumed += quantity;
}

/** Current price multiplier for an item from its 7-day produced/used volumes. */
export function itemPriceMultiplier(itemId: string): number {
  const f = flows.get(itemId);
  return supplyDemandMultiplier(f?.produced ?? 0, f?.consumed ?? 0);
}

/** Snapshot of the whole ledger (for /stats). */
export function getItemFlows(): Map<string, ItemFlow> {
  return flows;
}

async function refresh(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    const res = await pool.query<{ metric: string; v: string }>(
      `SELECT metric, SUM(value) v FROM economy_daily
       WHERE day >= (CURRENT_DATE - $1::int)
         AND (metric LIKE 'prod.%' OR metric LIKE 'cons.%')
       GROUP BY metric`,
      [WINDOW_DAYS - 1],
    );
    // Rebuild in place so the window actually rolls (old days age out). The
    // metrics pipeline flushes every 15s, so at most a few seconds of live
    // bumps are re-read from the DB on the next refresh — never lost.
    flows.clear();
    for (const row of res.rows) {
      const itemId = row.metric.slice(5);
      const f = flowOf(itemId);
      if (row.metric.startsWith("prod.")) f.produced += Number(row.v);
      else f.consumed += Number(row.v);
    }
  } catch (error) {
    console.warn("[itemFlows] refresh failed:", error);
  }
}

export async function initItemFlows(): Promise<void> {
  await refresh();
  setInterval(() => void refresh(), REFRESH_MS);
}
