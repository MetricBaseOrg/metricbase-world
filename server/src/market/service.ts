import {
  buildEmptyMarketState,
  buildMarketChartPayload,
  MARKET_CHART_CANDLE_COUNT,
  MARKET_CHART_INTERVAL_MS,
  MAX_MARKET_GOLD,
  METRICBASE_TOKEN_MINT,
  MIN_MARKET_GOLD,
  MIN_MARKET_TOKEN_PRICE,
  TOKEN_DECIMALS,
  tradePricePerGold,
  type MarketResultPayload,
  type MarketSide,
  type MarketStatePayload,
} from "@metricbase/shared";
import { isTokenGateEnabled } from "../auth/tokenGate.js";
import {
  cancelMarketOrder,
  createMarketOrder,
  fillMarketOrder,
  getMarketOrder,
  isTradeSignatureUsed,
  listMarketOrdersForWallet,
  listOpenMarketOrders,
  listRecentMarketTrades,
  recordMarketTrade,
  setMarketOrderPending,
  toMarketOrderView,
} from "../db/market.js";
import { getPool } from "../db/pool.js";
import { verifyPeerTokenTransfer } from "../solana/verifyPeerTokenTransfer.js";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

export function isMarketEnabled(): boolean {
  return isTokenGateEnabled() && Boolean(getPool());
}

export async function buildMarketState(wallet: string | null): Promise<MarketStatePayload> {
  const enabled = isMarketEnabled();
  const base = buildEmptyMarketState(getRpcUrl(), enabled);
  if (!enabled) return base;

  const orders = await listOpenMarketOrders();
  const asks = orders
    .filter((order) => order.side === "ask" && order.status === "open")
    .map(toMarketOrderView)
    .sort((left, right) => left.tokenPerGold - right.tokenPerGold);
  const bids = orders
    .filter((order) => order.side === "bid" && order.status === "open")
    .map(toMarketOrderView)
    .sort((left, right) => right.tokenPerGold - left.tokenPerGold);

  const myOrders = wallet ? (await listMarketOrdersForWallet(wallet)).map(toMarketOrderView) : [];

  const sinceMs = Date.now() - MARKET_CHART_CANDLE_COUNT * MARKET_CHART_INTERVAL_MS;
  const trades = (await listRecentMarketTrades(sinceMs)).map((trade) => ({
    time: trade.createdAt,
    price: tradePricePerGold(trade.tokenAmount, trade.goldAmount),
    goldVolume: trade.goldAmount,
  }));
  const chart = buildMarketChartPayload({ trades, asks, bids });

  return { ...base, asks, bids, myOrders, chart };
}

export async function placeMarketOrder(input: {
  wallet: string;
  playerName: string;
  playerGold: number;
  side: MarketSide;
  goldAmount: number;
  tokenPrice: number;
}): Promise<{ result: MarketResultPayload; playerGold: number }> {
  if (!isMarketEnabled()) {
    return { result: { ok: false, error: "Gold market is unavailable." }, playerGold: input.playerGold };
  }

  const goldAmount = Math.floor(input.goldAmount);
  const tokenPrice = Number(input.tokenPrice);

  if (goldAmount < MIN_MARKET_GOLD || goldAmount > MAX_MARKET_GOLD) {
    return {
      result: { ok: false, error: `Order size must be ${MIN_MARKET_GOLD}-${MAX_MARKET_GOLD} gold.` },
      playerGold: input.playerGold,
    };
  }

  if (!Number.isFinite(tokenPrice) || tokenPrice < MIN_MARKET_TOKEN_PRICE) {
    return {
      result: { ok: false, error: `Token price must be at least ${MIN_MARKET_TOKEN_PRICE}.` },
      playerGold: input.playerGold,
    };
  }

  let playerGold = input.playerGold;
  let escrowGold = 0;

  if (input.side === "ask") {
    if (playerGold < goldAmount) {
      return { result: { ok: false, error: "Not enough gold to list this offer." }, playerGold };
    }
    playerGold -= goldAmount;
    escrowGold = goldAmount;
  }

  const created = await createMarketOrder({
    side: input.side,
    wallet: input.wallet,
    playerName: input.playerName,
    goldAmount,
    tokenPrice,
    escrowGold,
  });

  if (!created) {
    return { result: { ok: false, error: "Could not create market order." }, playerGold: input.playerGold };
  }

  const market = await buildMarketState(input.wallet);
  return {
    result: { ok: true, gold: playerGold, market },
    playerGold,
  };
}

export async function cancelPlayerMarketOrder(input: {
  wallet: string;
  orderId: string;
  playerGold: number;
}): Promise<{ result: MarketResultPayload; playerGold: number }> {
  const order = await getMarketOrder(input.orderId);
  if (!order || order.wallet !== input.wallet) {
    return { result: { ok: false, error: "Order not found." }, playerGold: input.playerGold };
  }

  const cancelled = await cancelMarketOrder(input.orderId, input.wallet);
  if (!cancelled) {
    return { result: { ok: false, error: "Could not cancel order." }, playerGold: input.playerGold };
  }

  const playerGold = input.playerGold + cancelled.escrowGold;
  const market = await buildMarketState(input.wallet);
  return { result: { ok: true, gold: playerGold, market }, playerGold };
}

export async function fillAskOrder(input: {
  buyerWallet: string;
  buyerName: string;
  buyerGold: number;
  orderId: string;
  signature: string;
}): Promise<{ result: MarketResultPayload; buyerGold: number }> {
  const order = await getMarketOrder(input.orderId);
  if (!order || order.side !== "ask" || order.status !== "open") {
    return { result: { ok: false, error: "Offer not available." }, buyerGold: input.buyerGold };
  }

  if (order.wallet === input.buyerWallet) {
    return { result: { ok: false, error: "You cannot buy your own offer." }, buyerGold: input.buyerGold };
  }

  if (await isTradeSignatureUsed(input.signature)) {
    return { result: { ok: false, error: "This transaction was already used." }, buyerGold: input.buyerGold };
  }

  const verification = await verifyPeerTokenTransfer(input.signature, {
    fromWallet: input.buyerWallet,
    toWallet: order.wallet,
    mint: process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT,
    minUiAmount: order.tokenPrice,
  });

  if (!verification.ok) {
    return { result: { ok: false, error: verification.error ?? "Payment verification failed." }, buyerGold: input.buyerGold };
  }

  const filled = await fillMarketOrder(order.id);
  if (!filled) {
    return { result: { ok: false, error: "Offer was already filled." }, buyerGold: input.buyerGold };
  }

  const recorded = await recordMarketTrade({
    orderId: order.id,
    buyerWallet: input.buyerWallet,
    sellerWallet: order.wallet,
    goldAmount: order.goldAmount,
    tokenAmount: order.tokenPrice,
    txSignature: input.signature,
  });

  if (!recorded) {
    return { result: { ok: false, error: "Trade already recorded." }, buyerGold: input.buyerGold };
  }

  const buyerGold = input.buyerGold + order.goldAmount;
  const market = await buildMarketState(input.buyerWallet);
  return {
    result: { ok: true, gold: buyerGold, market },
    buyerGold,
  };
}

export async function acceptBidOrder(input: {
  sellerWallet: string;
  sellerName: string;
  sellerGold: number;
  orderId: string;
}): Promise<{ result: MarketResultPayload; sellerGold: number }> {
  const order = await getMarketOrder(input.orderId);
  if (!order || order.side !== "bid" || order.status !== "open") {
    return { result: { ok: false, error: "Bid not available." }, sellerGold: input.sellerGold };
  }

  if (order.wallet === input.sellerWallet) {
    return { result: { ok: false, error: "You cannot fill your own bid." }, sellerGold: input.sellerGold };
  }

  if (input.sellerGold < order.goldAmount) {
    return { result: { ok: false, error: "Not enough gold to sell into this bid." }, sellerGold: input.sellerGold };
  }

  const pending = await setMarketOrderPending(order.id, input.sellerWallet);
  if (!pending) {
    return { result: { ok: false, error: "Bid was already taken." }, sellerGold: input.sellerGold };
  }

  const sellerGold = input.sellerGold - order.goldAmount;
  const market = await buildMarketState(input.sellerWallet);

  return {
    result: {
      ok: true,
      gold: sellerGold,
      market,
      payment: {
        orderId: order.id,
        payToWallet: input.sellerWallet,
        tokenAmount: order.tokenPrice,
        goldAmount: order.goldAmount,
        role: "buyer",
      },
    },
    sellerGold,
  };
}

export async function completeBidPayment(input: {
  buyerWallet: string;
  buyerGold: number;
  orderId: string;
  signature: string;
}): Promise<{ result: MarketResultPayload; buyerGold: number; sellerWallet?: string; sellerGold?: number; goldToCreditSeller?: number }> {
  const order = await getMarketOrder(input.orderId);
  if (!order || order.side !== "bid" || order.status !== "pending") {
    return { result: { ok: false, error: "Pending bid not found." }, buyerGold: input.buyerGold };
  }

  if (order.wallet !== input.buyerWallet) {
    return { result: { ok: false, error: "Only the bidder can complete this payment." }, buyerGold: input.buyerGold };
  }

  const sellerWallet = order.counterpartyWallet;
  if (!sellerWallet) {
    return { result: { ok: false, error: "Seller wallet missing for this bid." }, buyerGold: input.buyerGold };
  }

  if (await isTradeSignatureUsed(input.signature)) {
    return { result: { ok: false, error: "This transaction was already used." }, buyerGold: input.buyerGold };
  }

  const verification = await verifyPeerTokenTransfer(input.signature, {
    fromWallet: input.buyerWallet,
    toWallet: sellerWallet,
    mint: process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT,
    minUiAmount: order.tokenPrice,
  });

  if (!verification.ok) {
    return { result: { ok: false, error: verification.error ?? "Payment verification failed." }, buyerGold: input.buyerGold };
  }

  const filled = await fillMarketOrder(order.id);
  if (!filled) {
    return { result: { ok: false, error: "Bid already completed." }, buyerGold: input.buyerGold };
  }

  await recordMarketTrade({
    orderId: order.id,
    buyerWallet: input.buyerWallet,
    sellerWallet,
    goldAmount: order.goldAmount,
    tokenAmount: order.tokenPrice,
    txSignature: input.signature,
  });

  const buyerGold = input.buyerGold + order.goldAmount;
  const market = await buildMarketState(input.buyerWallet);

  return {
    result: { ok: true, gold: buyerGold, market },
    buyerGold,
    sellerWallet,
    goldToCreditSeller: 0,
  };
}

export function getMarketDecimals(): number {
  return Number(process.env.TOKEN_DECIMALS ?? TOKEN_DECIMALS);
}