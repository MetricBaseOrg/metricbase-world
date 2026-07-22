import { getPool } from "./pool.js";
import { currentSeason, seasonRewardPool } from "@metricbase/shared";

/**
 * $BASE treasury flows — the numbers behind docs/base-demand.md.
 *
 * The entry gate used to make every new player a forced buyer. Free-to-play
 * (v0.172.0) and Telegram login (v0.174.0) removed that, so the open question
 * is whether inflow still covers what the Season pool pays out. That was being
 * argued from intuition; this surfaces the actual figures on /stats so the
 * decision can be made from data.
 *
 * Everything here reads EXISTING durable records — `token_purchases` is a
 * per-transaction ledger of $BASE reaching the treasury, and `base.burned`
 * accumulates in economy_daily. Nothing new is tracked, so the history is real
 * rather than starting from today.
 */

export interface BaseFlowProduct {
  productId: string;
  purchases: number;
  base: number;
}

export interface BaseFlows {
  /** All-time $BASE into the treasury (gold desk, expansions, passes). */
  inflowTotal: number;
  inflow30d: number;
  /** Distinct wallets that have EVER sent $BASE. Concentration matters more
   *  than the total: a big number from one wallet is not demand. */
  distinctBuyers: number;
  byProduct: BaseFlowProduct[];
  /** Days since the most recent purchase; null when there has never been one. */
  daysSinceLastPurchase: number | null;
  /** All-time $BASE burned by in-game sinks. */
  burnedTotal: number;
  /** The current season's fixed pool — the outflow this must be weighed against. */
  seasonPool: number;
  /** $BASE already paid out across all seasons. */
  paidOut: number;
}

export async function getBaseFlows(): Promise<BaseFlows | null> {
  const db = getPool();
  if (!db) return null;

  const season = currentSeason();
  const empty: BaseFlows = {
    inflowTotal: 0,
    inflow30d: 0,
    distinctBuyers: 0,
    byProduct: [],
    daysSinceLastPurchase: null,
    burnedTotal: 0,
    seasonPool: seasonRewardPool(season.number),
    paidOut: 0,
  };

  try {
    const [totals, byProduct, burned, paid] = await Promise.all([
      db.query<{ total: string; recent: string; buyers: string; last_at: Date | null }>(
        `SELECT COALESCE(SUM(token_amount), 0) AS total,
                COALESCE(SUM(token_amount) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0) AS recent,
                COUNT(DISTINCT wallet) AS buyers,
                MAX(created_at) AS last_at
           FROM token_purchases`,
      ),
      db.query<{ product_id: string; n: string; base: string }>(
        `SELECT product_id, COUNT(*) AS n, COALESCE(SUM(token_amount), 0) AS base
           FROM token_purchases GROUP BY product_id ORDER BY base DESC`,
      ),
      db.query<{ v: string }>(
        `SELECT COALESCE(SUM(value), 0) AS v FROM economy_daily WHERE metric = 'base.burned'`,
      ),
      db.query<{ v: string }>(`SELECT COALESCE(SUM(amount), 0) AS v FROM season_payout`),
    ]);

    const row = totals.rows[0];
    const lastAt = row?.last_at ? new Date(row.last_at).getTime() : null;

    return {
      inflowTotal: Number(row?.total ?? 0),
      inflow30d: Number(row?.recent ?? 0),
      distinctBuyers: Number(row?.buyers ?? 0),
      byProduct: byProduct.rows.map((r) => ({
        productId: r.product_id,
        purchases: Number(r.n),
        base: Number(r.base),
      })),
      daysSinceLastPurchase:
        lastAt === null ? null : Math.floor((Date.now() - lastAt) / 86_400_000),
      burnedTotal: Number(burned.rows[0]?.v ?? 0),
      seasonPool: seasonRewardPool(season.number),
      paidOut: Number(paid.rows[0]?.v ?? 0),
    };
  } catch (error) {
    console.warn("[baseFlows] query failed:", error);
    return empty;
  }
}
