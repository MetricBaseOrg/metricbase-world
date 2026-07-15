// Players Company Stock Exchange — Phase 1: a gold-settled bonding-curve market
// for shares in Merchant Companies (see company.ts / docs/exchange.md).
//
// Shares are an AUTHORITATIVE in-game ledger (like gold / the company treasury),
// NOT a real on-chain token. Buying mints shares and moves the price up a linear
// bonding curve; selling burns shares and moves it down. Gold paid in is locked
// in a per-company RESERVE that backs sells, so the market is solvent by
// construction. A trade fee funds the company treasury and burns a slice.
//
// ECONOMIC INVARIANT: nothing is minted. Gold buys lock into the reserve; sells
// pay out of the reserve; the fee is a transfer (to treasury) + a burn (sink).
// Reserve solvency is a maths invariant (ceil buys / floor sells round in the
// reserve's favour).

import type { CompanyType } from "./company.js";

// ---------------------------------------------------------------------------
// Tunables — THE exchange balancing table (owner-tuned).
// ---------------------------------------------------------------------------

/** Share price at zero circulating supply (gold). */
export const SHARE_BASE_PRICE = 10;
/** Linear bonding-curve slope: gold the price rises per share issued. */
export const SHARE_SLOPE = 0.05;

/** Trade fee on the gross gold value of a buy/sell. */
export const SHARE_TRADE_FEE_RATE = 0.03;
/** Fraction of the trade fee routed to the company treasury (rest is burned). */
export const SHARE_FEE_TREASURY_SPLIT = 0.667;

/** Gold cost for a company owner to list on the exchange (a sink). */
export const SHARE_LISTING_COST = 1000;

export const SHARE_MIN_TRADE = 1;
export const SHARE_MAX_TRADE = 100_000;

/** Per-player, per-company trade cooldown (anti-spam / anti-wash). */
export const SHARE_TRADE_COOLDOWN_MS = 3_000;

// --- Dividends + governance (Phase 2b) ---

/** Max share-dividend payout as a % of a week's net profit. */
export const SHARE_DIVIDEND_MAX_PCT = 50;
/** Payout % a share votes at when its holder hasn't set a preference. */
export const SHARE_DIVIDEND_DEFAULT_PCT = 30;
/** Ownership fraction that grants hard control (CEO) of a company. */
export const SHARE_CONTROL_THRESHOLD = 0.5;
/** How often share dividends are distributed. */
export const SHARE_DIVIDEND_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** UTC week bucket for a timestamp (the idempotency key for weekly payouts). */
export function shareWeekKey(at: number): string {
  return String(Math.floor(at / SHARE_DIVIDEND_INTERVAL_MS));
}

/**
 * The company's effective share-dividend % = the share-weighted average of every
 * shareholder's preferred %, where a holder who hasn't voted contributes their
 * shares at the default %. Every share therefore votes; a majority holder's
 * preference dominates (this is the "share-weighted vote" and the takeover lever
 * in one). Result is clamped to [0, SHARE_DIVIDEND_MAX_PCT].
 */
export function effectiveDividendPct(
  holders: Array<{ shares: number; preferredPct: number | null }>,
): number {
  let weighted = 0;
  let total = 0;
  for (const h of holders) {
    if (h.shares <= 0) continue;
    const pref = h.preferredPct == null ? SHARE_DIVIDEND_DEFAULT_PCT : h.preferredPct;
    weighted += h.shares * clampPct(pref);
    total += h.shares;
  }
  if (total <= 0) return SHARE_DIVIDEND_DEFAULT_PCT;
  return Math.round(weighted / total);
}

export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(SHARE_DIVIDEND_MAX_PCT, Math.round(pct)));
}

// ---------------------------------------------------------------------------
// Bonding-curve maths (pure). Computed in float, rounded at the boundary so the
// reserve is always solvent.
// ---------------------------------------------------------------------------

/** Marginal share price at circulating supply S. */
export function sharePrice(supply: number, p0 = SHARE_BASE_PRICE, k = SHARE_SLOPE): number {
  return p0 + k * Math.max(0, supply);
}

/** Gold needed to buy n shares starting from supply S (paid INTO the reserve). */
export function shareBuyCost(supply: number, n: number, p0 = SHARE_BASE_PRICE, k = SHARE_SLOPE): number {
  if (n <= 0) return 0;
  const s = Math.max(0, supply);
  return Math.ceil(p0 * n + k * (s * n + (n * n) / 2));
}

/** Gold returned for selling n shares from supply S (paid OUT of the reserve). */
export function shareSellProceeds(supply: number, n: number, p0 = SHARE_BASE_PRICE, k = SHARE_SLOPE): number {
  if (n <= 0) return 0;
  const s = Math.max(0, supply);
  const take = Math.min(n, s);
  return Math.floor(p0 * take + k * (s * take - (take * take) / 2));
}

/** The gold reserve that fully backs a supply of S shares. */
export function shareReserveFor(supply: number, p0 = SHARE_BASE_PRICE, k = SHARE_SLOPE): number {
  const s = Math.max(0, supply);
  return Math.floor(p0 * s + (k * s * s) / 2);
}

/** Notional market cap: marginal price × circulating supply. */
export function shareMarketCap(supply: number, p0 = SHARE_BASE_PRICE, k = SHARE_SLOPE): number {
  return Math.round(sharePrice(supply, p0, k) * Math.max(0, supply));
}

/** Split a gross gold amount into a trade fee (treasury + burn). */
export function shareTradeFee(gross: number): { fee: number; treasury: number; burn: number } {
  const fee = Math.round(gross * SHARE_TRADE_FEE_RATE);
  const treasury = Math.floor(fee * SHARE_FEE_TREASURY_SPLIT);
  return { fee, treasury, burn: fee - treasury };
}

/** A stock ticker derived from a company name: up to 4 uppercase alphanumerics. */
export function tickerFor(name: string): string {
  const cleaned = (name ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length >= 4) return cleaned.slice(0, 4);
  // Pad short names by taking word initials, else the cleaned string.
  const initials = (name ?? "")
    .toUpperCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Z0-9]/g, "")[0] ?? "")
    .join("");
  return (initials.length >= 2 ? initials : cleaned || "SHR").slice(0, 4).padEnd(2, "X");
}

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export type ShareTradeSide = "buy" | "sell";

export interface ShareTradeView {
  id: string;
  companyId: string;
  traderName: string;
  side: ShareTradeSide;
  shares: number;
  gold: number;
  /** Price per share at execution (gold). */
  price: number;
  at: number;
}

export interface ShareMarketSummary {
  companyId: string;
  name: string;
  ticker: string;
  emblem: string;
  color: number;
  companyType: CompanyType;
  /** Marginal price per share (gold). */
  price: number;
  circulatingShares: number;
  reserve: number;
  marketCap: number;
  /** Bonding-curve params (so clients can quote trades exactly). */
  basePrice: number;
  slope: number;
  /** Price change vs ~24h ago, as a fraction (e.g. 0.05 = +5%). null if no history. */
  change24h: number | null;
  volume24h: number;
  listedAt: number;
}

export interface ShareHoldingView {
  companyId: string;
  name: string;
  ticker: string;
  emblem: string;
  color: number;
  shares: number;
  /** Current marginal price per share. */
  price: number;
  /** Marketable value if sold now (liquidation down the curve). */
  value: number;
  /** Total gold outlay for this position. */
  costBasis: number;
  /** Unrealised profit/loss = value − costBasis. */
  pnl: number;
}

export interface ShareholderView {
  name: string;
  shares: number;
  /** Fraction of circulating supply. */
  pct: number;
}

/** A company's income summary (weekly cadence) for financial reporting. */
export interface CompanyFinancialsView {
  /** Revenue booked so far in the current week, by source. */
  weekRevenue: number;
  /** Operating expenses (salaries + member dividends) so far this week. */
  weekExpenses: number;
  /** weekRevenue − weekExpenses (can be negative). */
  weekNetProfit: number;
  /** Lifetime totals for the balance-sheet view. */
  lifetimeRevenue: number;
  lifetimeExpenses: number;
  /** Company assets: treasury gold + warehouse value. */
  treasury: number;
  warehouseValue: number;
}

export interface DividendRecordView {
  week: string;
  total: number;
  perShare: number;
  at: number;
}

export interface CompanyMarketDetail {
  summary: ShareMarketSummary;
  /** The viewer's holding in this company. */
  myShares: number;
  /** The viewer's gold outlay for the current position (for P/L). */
  myCostBasis: number;
  topHolders: ShareholderView[];
  recentTrades: ShareTradeView[];
  // --- governance + dividends ---
  /** Largest shareholder (the CEO), or null if no shares are held. */
  ceo: string | null;
  /** The CEO's ownership fraction (0–1). */
  ceoPct: number;
  /** True when the CEO holds a controlling (>threshold) stake. */
  controlled: boolean;
  /** Effective share-weighted dividend % applied at the weekly payout. */
  dividendPct: number;
  /** The viewer's own preferred % (their vote), or null if unset. */
  myDividendVote: number | null;
  /** Company income summary. */
  financials: CompanyFinancialsView;
  /** Recent share-dividend distributions (newest first). */
  dividendHistory: DividendRecordView[];
}

export interface ExchangeStatePayload {
  /** All listed companies, for the market board. */
  markets: ShareMarketSummary[];
  /** The viewer's share holdings. */
  myHoldings: ShareHoldingView[];
  /** Whether the viewer owns a company that is NOT yet listed (can list it). */
  listableCompanyId: string | null;
}

export interface ExchangeResultPayload {
  ok: boolean;
  error?: string;
  message?: string;
  /** Updated player gold after a trade/listing charge. */
  gold?: number;
}

/** A live quote for a prospective trade, shown before the player confirms. */
export interface ShareQuote {
  side: ShareTradeSide;
  shares: number;
  /** Gross gold moved through the reserve. */
  gross: number;
  fee: number;
  /** What the buyer pays / the seller receives, after fees. */
  net: number;
  /** Marginal price after the trade. */
  priceAfter: number;
}

/** Quote a prospective buy (total gold the buyer pays, fees included). */
export function quoteBuy(supply: number, n: number, p0 = SHARE_BASE_PRICE, k = SHARE_SLOPE): ShareQuote {
  const gross = shareBuyCost(supply, n, p0, k);
  const { fee } = shareTradeFee(gross);
  return { side: "buy", shares: n, gross, fee, net: gross + fee, priceAfter: sharePrice(supply + n, p0, k) };
}

/** Quote a prospective sell (net gold the seller receives, fees deducted). */
export function quoteSell(supply: number, n: number, p0 = SHARE_BASE_PRICE, k = SHARE_SLOPE): ShareQuote {
  const gross = shareSellProceeds(supply, n, p0, k);
  const { fee } = shareTradeFee(gross);
  return {
    side: "sell",
    shares: n,
    gross,
    fee,
    net: Math.max(0, gross - fee),
    priceAfter: sharePrice(Math.max(0, supply - n), p0, k),
  };
}
