import type { MarketOrderView } from "./market.js";

export const MARKET_CHART_INTERVAL_MS = 60 * 60 * 1000;
export const MARKET_CHART_CANDLE_COUNT = 48;

export interface MarketTradePoint {
  time: number;
  price: number;
  goldVolume: number;
}

export interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketChartPayload {
  intervalMs: number;
  intervalLabel: string;
  candles: MarketCandle[];
  hasTrades: boolean;
  /** Best-effort mid price from open bids/asks when no trades exist yet. */
  indicativePrice: number | null;
  lastPrice: number | null;
  changePercent: number | null;
}

export function tradePricePerGold(tokenAmount: number, goldAmount: number): number {
  if (goldAmount <= 0) return 0;
  return Math.round((tokenAmount / goldAmount) * 1000) / 1000;
}

export function midMarketPrice(asks: MarketOrderView[], bids: MarketOrderView[]): number | null {
  const bestAsk = asks[0]?.tokenPerGold;
  const bestBid = bids[0]?.tokenPerGold;
  if (bestAsk !== undefined && bestBid !== undefined) {
    return Math.round(((bestAsk + bestBid) / 2) * 1000) / 1000;
  }
  return bestAsk ?? bestBid ?? null;
}

export function buildMarketCandles(
  trades: MarketTradePoint[],
  intervalMs: number,
  candleCount: number,
): MarketCandle[] {
  const now = Date.now();
  const rangeStart = now - candleCount * intervalMs;
  const buckets = new Map<number, MarketCandle>();

  for (let index = 0; index < candleCount; index += 1) {
    const time = rangeStart + index * intervalMs;
    buckets.set(time, { time, open: 0, high: 0, low: 0, close: 0, volume: 0 });
  }

  for (const trade of trades) {
    if (trade.time < rangeStart || trade.price <= 0) continue;
    const bucketIndex = Math.min(
      candleCount - 1,
      Math.floor((trade.time - rangeStart) / intervalMs),
    );
    const bucketTime = rangeStart + bucketIndex * intervalMs;
    const candle = buckets.get(bucketTime);
    if (!candle) continue;

    if (candle.volume === 0) {
      candle.open = trade.price;
      candle.high = trade.price;
      candle.low = trade.price;
      candle.close = trade.price;
    } else {
      candle.high = Math.max(candle.high, trade.price);
      candle.low = Math.min(candle.low, trade.price);
      candle.close = trade.price;
    }
    candle.volume += trade.goldVolume;
  }

  let lastTradedPrice: number | null = null;
  const candles: MarketCandle[] = [];
  for (let index = 0; index < candleCount; index += 1) {
    const time = rangeStart + index * intervalMs;
    const candle = buckets.get(time)!;
    if (candle.volume === 0 && lastTradedPrice !== null) {
      candle.open = lastTradedPrice;
      candle.high = lastTradedPrice;
      candle.low = lastTradedPrice;
      candle.close = lastTradedPrice;
    }
    if (candle.volume > 0) {
      lastTradedPrice = candle.close;
    }
    candles.push(candle);
  }

  return candles;
}

export function buildMarketChartPayload(input: {
  trades: MarketTradePoint[];
  asks: MarketOrderView[];
  bids: MarketOrderView[];
  intervalMs?: number;
  candleCount?: number;
  intervalLabel?: string;
}): MarketChartPayload {
  const intervalMs = input.intervalMs ?? MARKET_CHART_INTERVAL_MS;
  const candleCount = input.candleCount ?? MARKET_CHART_CANDLE_COUNT;
  const indicativePrice = midMarketPrice(input.asks, input.bids);
  const hasTrades = input.trades.length > 0;
  const candles = hasTrades ? buildMarketCandles(input.trades, intervalMs, candleCount) : [];

  const tradedCandles = candles.filter((candle) => candle.volume > 0);
  const lastPrice = hasTrades
    ? tradedCandles[tradedCandles.length - 1]?.close ?? null
    : indicativePrice;

  let changePercent: number | null = null;
  if (hasTrades && lastPrice !== null && candles.length >= 2) {
    const dayIndex = Math.max(0, candles.length - 25);
    const base = candles[dayIndex].open > 0 ? candles[dayIndex].open : candles[dayIndex].close;
    if (base > 0) {
      changePercent = Math.round(((lastPrice - base) / base) * 10000) / 100;
    }
  }

  return {
    intervalMs,
    intervalLabel: input.intervalLabel ?? "1H",
    candles,
    hasTrades,
    indicativePrice,
    lastPrice,
    changePercent,
  };
}

export function buildEmptyMarketChart(): MarketChartPayload {
  return {
    intervalMs: MARKET_CHART_INTERVAL_MS,
    intervalLabel: "1H",
    candles: [],
    hasTrades: false,
    indicativePrice: null,
    lastPrice: null,
    changePercent: null,
  };
}