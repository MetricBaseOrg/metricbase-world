import type { MarketChartPayload } from "./marketChart.js";
import { buildEmptyMarketChart, normalizeMarketChart } from "./marketChart.js";
import { DEFAULT_CURRENCY_ID } from "./currencies.js";
import { METRICBASE_TOKEN_MINT } from "./tokenGate.js";
import { TOKEN_DECIMALS } from "./tokenShop.js";

export type { MarketCandle, MarketChartPayload, MarketTradePoint } from "./marketChart.js";
export {
  buildEmptyMarketChart,
  buildMarketCandles,
  buildMarketChartPayload,
  MARKET_CHART_CANDLE_COUNT,
  MARKET_CHART_INTERVAL_MS,
  midMarketPrice,
  normalizeMarketChart,
  tradePricePerGold,
} from "./marketChart.js";

export type MarketSide = "bid" | "ask";
export type MarketOrderStatus = "open" | "pending" | "filled" | "cancelled";

export const MIN_MARKET_GOLD = 10;
export const MAX_MARKET_GOLD = 5_000;
export const MIN_MARKET_TOKEN_PRICE = 1;
export const MARKET_PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;

export interface MarketOrderView {
  id: string;
  side: MarketSide;
  status: MarketOrderStatus;
  playerName: string;
  wallet: string;
  goldAmount: number;
  tokenPrice: number;
  tokenPerGold: number;
  /** Payment currency id (see PAYMENT_CURRENCIES); defaults to "base". */
  currency: string;
  createdAt: number;
  /** When pending: wallet that must receive token payment. */
  payToWallet?: string;
  /** When pending: wallet that must send token payment. */
  payFromWallet?: string;
}

export interface MarketStatePayload {
  enabled: boolean;
  mint: string;
  rpcUrl: string;
  decimals: number;
  asks: MarketOrderView[];
  bids: MarketOrderView[];
  myOrders: MarketOrderView[];
  chart: MarketChartPayload;
  /** Currency the chart's prices are denominated in (the trades it aggregates). */
  chartCurrency: string;
  minGold: number;
  maxGold: number;
}

export interface MarketResultPayload {
  ok: boolean;
  error?: string;
  gold?: number;
  /** Gold burned as the market fee on this trade. */
  fee?: number;
  market?: MarketStatePayload;
  /** Buyer must pay this wallet to complete a trade. */
  payment?: {
    orderId: string;
    payToWallet: string;
    tokenAmount: number;
    goldAmount: number;
    role: "buyer";
  };
}

export function tokenPerGold(goldAmount: number, tokenPrice: number): number {
  if (goldAmount <= 0) return 0;
  return Math.round((tokenPrice / goldAmount) * 1000) / 1000;
}

export function buildEmptyMarketState(
  rpcUrl: string,
  enabled: boolean,
): MarketStatePayload {
  return {
    enabled,
    mint: METRICBASE_TOKEN_MINT,
    rpcUrl,
    decimals: TOKEN_DECIMALS,
    asks: [],
    bids: [],
    myOrders: [],
    chart: buildEmptyMarketChart(),
    chartCurrency: DEFAULT_CURRENCY_ID,
    minGold: MIN_MARKET_GOLD,
    maxGold: MAX_MARKET_GOLD,
  };
}

export function normalizeMarketState(
  market: Partial<MarketStatePayload>,
): MarketStatePayload {
  const enabled = market.enabled ?? false;
  const base = buildEmptyMarketState(
    market.rpcUrl ?? "https://api.mainnet-beta.solana.com",
    enabled,
  );
  return {
    ...base,
    ...market,
    asks: market.asks ?? [],
    bids: market.bids ?? [],
    myOrders: market.myOrders ?? [],
    chart: normalizeMarketChart(market.chart),
    chartCurrency: market.chartCurrency ?? base.chartCurrency,
    mint: market.mint ?? base.mint,
    rpcUrl: market.rpcUrl ?? base.rpcUrl,
    decimals: market.decimals ?? base.decimals,
    minGold: market.minGold ?? base.minGold,
    maxGold: market.maxGold ?? base.maxGold,
  };
}