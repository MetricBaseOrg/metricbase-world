import type { ShareTradeSide } from "@metricbase/shared";
import { getPool } from "./pool.js";

export interface StoredShareMarket {
  companyId: string;
  listedAt: number;
  circulatingShares: number;
  reserveGold: number;
  basePrice: number;
  slope: number;
}

export interface StoredShareHolding {
  companyId: string;
  holderName: string;
  holderWallet: string | null;
  shares: number;
  /** Total gold outlay for the current position (for unrealised P/L). */
  costBasis: number;
  /** Holder's preferred dividend % (their share-weighted vote); null = unset. */
  preferredPct: number | null;
}

export interface StoredShareDividend {
  companyId: string;
  week: string;
  total: number;
  perShare: number;
  at: number;
}

export interface StoredShareBaseListing {
  id: string;
  companyId: string;
  sellerName: string;
  sellerWallet: string;
  shares: number;
  priceBase: number;
  createdAt: number;
}

export interface StoredShareTrade {
  id: string;
  companyId: string;
  traderName: string;
  traderWallet: string | null;
  side: ShareTradeSide;
  shares: number;
  gold: number;
  price: number;
  at: number;
}

export async function loadShareMarkets(): Promise<StoredShareMarket[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      company_id: string;
      listed_at: string | number;
      circulating_shares: number;
      reserve_gold: string | number;
      base_price: number;
      slope: number;
    }>(
      "SELECT company_id, listed_at, circulating_shares, reserve_gold, base_price, slope FROM share_markets",
    );
    return res.rows.map((r) => ({
      companyId: r.company_id,
      listedAt: Number(r.listed_at),
      circulatingShares: Math.max(0, Math.floor(r.circulating_shares)),
      reserveGold: Math.max(0, Math.floor(Number(r.reserve_gold))),
      basePrice: r.base_price,
      slope: r.slope,
    }));
  } catch (error) {
    console.warn("[exchange] load markets failed:", error);
    return [];
  }
}

export async function saveShareMarket(m: StoredShareMarket): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO share_markets (company_id, listed_at, circulating_shares, reserve_gold, base_price, slope)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (company_id) DO UPDATE SET
         circulating_shares = EXCLUDED.circulating_shares,
         reserve_gold = EXCLUDED.reserve_gold`,
      [m.companyId, m.listedAt, m.circulatingShares, m.reserveGold, m.basePrice, m.slope],
    );
  } catch (error) {
    console.warn("[exchange] save market failed:", error);
  }
}

export async function deleteShareMarket(companyId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM share_markets WHERE company_id = $1", [companyId]);
    await pool.query("DELETE FROM share_holdings WHERE company_id = $1", [companyId]);
    await pool.query("DELETE FROM share_trades WHERE company_id = $1", [companyId]);
  } catch (error) {
    console.warn("[exchange] delete market failed:", error);
  }
}

export async function loadShareHoldings(): Promise<StoredShareHolding[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      company_id: string;
      holder_name: string;
      holder_wallet: string | null;
      shares: number;
      cost_basis: string | number | null;
      preferred_payout_pct: number | null;
    }>("SELECT company_id, holder_name, holder_wallet, shares, cost_basis, preferred_payout_pct FROM share_holdings WHERE shares > 0");
    return res.rows.map((r) => ({
      companyId: r.company_id,
      holderName: r.holder_name,
      holderWallet: r.holder_wallet ?? null,
      shares: Math.max(0, Math.floor(r.shares)),
      costBasis: Math.max(0, Math.floor(Number(r.cost_basis ?? 0))),
      preferredPct: r.preferred_payout_pct == null ? null : Math.max(0, Math.floor(r.preferred_payout_pct)),
    }));
  } catch (error) {
    console.warn("[exchange] load holdings failed:", error);
    return [];
  }
}

/** Upsert (or delete when zeroed) a single holding. */
export async function saveShareHolding(h: StoredShareHolding): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    if (h.shares <= 0) {
      await pool.query("DELETE FROM share_holdings WHERE company_id = $1 AND holder_name = $2", [
        h.companyId,
        h.holderName,
      ]);
      return;
    }
    await pool.query(
      `INSERT INTO share_holdings (company_id, holder_name, holder_wallet, shares, cost_basis, preferred_payout_pct)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (company_id, holder_name) DO UPDATE SET
         shares = EXCLUDED.shares, cost_basis = EXCLUDED.cost_basis,
         preferred_payout_pct = EXCLUDED.preferred_payout_pct,
         holder_wallet = COALESCE(EXCLUDED.holder_wallet, share_holdings.holder_wallet)`,
      [h.companyId, h.holderName, h.holderWallet, h.shares, h.costBasis, h.preferredPct],
    );
  } catch (error) {
    console.warn("[exchange] save holding failed:", error);
  }
}

export async function insertShareTrade(t: StoredShareTrade): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO share_trades (id, company_id, trader_name, trader_wallet, side, shares, gold, price, at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.companyId, t.traderName, t.traderWallet, t.side, t.shares, t.gold, t.price, t.at],
    );
  } catch (error) {
    console.warn("[exchange] insert trade failed:", error);
  }
}

/** Load recent trades per company (for the in-memory feed / 24h stats). */
export async function loadRecentShareTrades(perCompany = 200): Promise<StoredShareTrade[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      id: string;
      company_id: string;
      trader_name: string;
      trader_wallet: string | null;
      side: string;
      shares: number;
      gold: number;
      price: number;
      at: string | number;
    }>(
      `SELECT id, company_id, trader_name, trader_wallet, side, shares, gold, price, at FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY at DESC) AS rn
         FROM share_trades
       ) t WHERE rn <= $1`,
      [perCompany],
    );
    return res.rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      traderName: r.trader_name,
      traderWallet: r.trader_wallet ?? null,
      side: r.side as ShareTradeSide,
      shares: Math.floor(r.shares),
      gold: Math.floor(r.gold),
      price: r.price,
      at: Number(r.at),
    }));
  } catch (error) {
    console.warn("[exchange] load recent trades failed:", error);
    return [];
  }
}

export async function insertShareDividend(d: StoredShareDividend): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO share_dividends (company_id, week, total, per_share, at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (company_id, week) DO NOTHING`,
      [d.companyId, d.week, d.total, d.perShare, d.at],
    );
  } catch (error) {
    console.warn("[exchange] insert dividend failed:", error);
  }
}

export async function loadShareBaseListings(): Promise<StoredShareBaseListing[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      id: string;
      company_id: string;
      seller_name: string;
      seller_wallet: string;
      shares: number;
      price_base: number;
      created_at: string | number;
    }>("SELECT id, company_id, seller_name, seller_wallet, shares, price_base, created_at FROM share_base_listings");
    return res.rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      sellerName: r.seller_name,
      sellerWallet: r.seller_wallet,
      shares: Math.max(0, Math.floor(r.shares)),
      priceBase: r.price_base,
      createdAt: Number(r.created_at),
    }));
  } catch (error) {
    console.warn("[exchange] load base listings failed:", error);
    return [];
  }
}

export async function saveShareBaseListing(l: StoredShareBaseListing): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO share_base_listings (id, company_id, seller_name, seller_wallet, shares, price_base, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [l.id, l.companyId, l.sellerName, l.sellerWallet, l.shares, l.priceBase, l.createdAt],
    );
  } catch (error) {
    console.warn("[exchange] save base listing failed:", error);
  }
}

export async function deleteShareBaseListing(id: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM share_base_listings WHERE id = $1", [id]);
  } catch (error) {
    console.warn("[exchange] delete base listing failed:", error);
  }
}

/** Recent dividend distributions per company (for history display). */
export async function loadRecentShareDividends(perCompany = 12): Promise<StoredShareDividend[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      company_id: string;
      week: string;
      total: number;
      per_share: number;
      at: string | number;
    }>(
      `SELECT company_id, week, total, per_share, at FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY at DESC) AS rn
         FROM share_dividends
       ) d WHERE rn <= $1`,
      [perCompany],
    );
    return res.rows.map((r) => ({
      companyId: r.company_id,
      week: r.week,
      total: Math.floor(r.total),
      perShare: r.per_share,
      at: Number(r.at),
    }));
  } catch (error) {
    console.warn("[exchange] load dividends failed:", error);
    return [];
  }
}
