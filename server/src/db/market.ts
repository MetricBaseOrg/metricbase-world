import {
  DEFAULT_CURRENCY_ID,
  MARKET_PAYMENT_TIMEOUT_MS,
  type MarketOrderStatus,
  type MarketSide,
  tokenPerGold,
  type MarketOrderView,
} from "@metricbase/shared";
import { getPool } from "./pool.js";

export interface MarketOrderRecord {
  id: string;
  side: MarketSide;
  status: MarketOrderStatus;
  wallet: string;
  playerName: string;
  goldAmount: number;
  tokenPrice: number;
  currency: string;
  escrowGold: number;
  counterpartyWallet: string | null;
  pendingExpiresAt: number | null;
  createdAt: number;
}

type MarketOrderRow = {
  id: string;
  side: MarketSide;
  status: MarketOrderStatus;
  wallet: string;
  player_name: string;
  gold_amount: number;
  token_price: number;
  currency: string | null;
  escrow_gold: number;
  counterparty_wallet: string | null;
  pending_expires_at: Date | null;
  created_at: Date;
};

const ORDER_COLUMNS =
  "id, side, status, wallet, player_name, gold_amount, token_price, currency, escrow_gold, counterparty_wallet, pending_expires_at, created_at";

export async function listOpenMarketOrders(): Promise<MarketOrderRecord[]> {
  const db = getPool();
  if (!db) return [];

  await expirePendingOrders();

  const result = await db.query<MarketOrderRow>(
    `SELECT id, side, status, wallet, player_name, gold_amount, token_price, currency, escrow_gold,
            counterparty_wallet, pending_expires_at, created_at
     FROM market_orders
     WHERE status IN ('open', 'pending')
     ORDER BY created_at ASC`,
  );

  return result.rows.map(mapRow);
}

export async function listMarketOrdersForWallet(wallet: string): Promise<MarketOrderRecord[]> {
  const db = getPool();
  if (!db) return [];

  await expirePendingOrders();

  const result = await db.query<MarketOrderRow>(
    `SELECT id, side, status, wallet, player_name, gold_amount, token_price, currency, escrow_gold,
            counterparty_wallet, pending_expires_at, created_at
     FROM market_orders
     WHERE wallet = $1 AND status IN ('open', 'pending')
     ORDER BY created_at DESC`,
    [wallet],
  );

  return result.rows.map(mapRow);
}

export async function getMarketOrder(orderId: string): Promise<MarketOrderRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<MarketOrderRow>(
    `SELECT id, side, status, wallet, player_name, gold_amount, token_price, currency, escrow_gold,
            counterparty_wallet, pending_expires_at, created_at
     FROM market_orders WHERE id = $1`,
    [orderId],
  );

  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

export async function createMarketOrder(input: {
  side: MarketSide;
  wallet: string;
  playerName: string;
  goldAmount: number;
  tokenPrice: number;
  currency: string;
  escrowGold: number;
}): Promise<MarketOrderRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<MarketOrderRow>(
    `INSERT INTO market_orders (side, wallet, player_name, gold_amount, token_price, currency, escrow_gold)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, side, status, wallet, player_name, gold_amount, token_price, currency, escrow_gold,
               counterparty_wallet, pending_expires_at, created_at`,
    [
      input.side,
      input.wallet,
      input.playerName,
      input.goldAmount,
      input.tokenPrice,
      input.currency,
      input.escrowGold,
    ],
  );

  return mapRow(result.rows[0]);
}

export async function setMarketOrderPending(
  orderId: string,
  counterpartyWallet: string,
): Promise<MarketOrderRecord | null> {
  const db = getPool();
  if (!db) return null;

  const expiresAt = new Date(Date.now() + MARKET_PAYMENT_TIMEOUT_MS);
  const result = await db.query<MarketOrderRow>(
    `UPDATE market_orders
     SET status = 'pending',
         counterparty_wallet = $2,
         escrow_gold = gold_amount,
         pending_expires_at = $3,
         updated_at = NOW()
     WHERE id = $1 AND status = 'open'
     RETURNING id, side, status, wallet, player_name, gold_amount, token_price, currency, escrow_gold,
               counterparty_wallet, pending_expires_at, created_at`,
    [orderId, counterpartyWallet, expiresAt],
  );

  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

export async function fillMarketOrder(orderId: string): Promise<MarketOrderRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<MarketOrderRow>(
    `UPDATE market_orders
     SET status = 'filled', escrow_gold = 0, updated_at = NOW()
     WHERE id = $1 AND status IN ('open', 'pending')
     RETURNING id, side, status, wallet, player_name, gold_amount, token_price, currency, escrow_gold,
               counterparty_wallet, pending_expires_at, created_at`,
    [orderId],
  );

  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

export async function cancelMarketOrder(orderId: string, wallet: string): Promise<MarketOrderRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<MarketOrderRow & { refunded_escrow_gold: number }>(
    `WITH target AS (
       SELECT id, side, status, wallet, player_name, gold_amount, token_price, currency, escrow_gold,
              counterparty_wallet, pending_expires_at, created_at
       FROM market_orders
       WHERE id = $1 AND wallet = $2 AND status IN ('open', 'pending')
     )
     UPDATE market_orders AS o
     SET status = 'cancelled', escrow_gold = 0, updated_at = NOW()
     FROM target AS t
     WHERE o.id = t.id
     RETURNING o.id, o.side, o.status, o.wallet, o.player_name, o.gold_amount, o.token_price, o.currency,
               t.escrow_gold AS escrow_gold,
               o.counterparty_wallet, o.pending_expires_at, o.created_at`,
    [orderId, wallet],
  );

  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

export async function recordMarketTrade(input: {
  orderId: string;
  buyerWallet: string;
  sellerWallet: string;
  goldAmount: number;
  tokenAmount: number;
  currency: string;
  txSignature: string;
}): Promise<boolean> {
  const db = getPool();
  if (!db) return false;

  try {
    await db.query(
      `INSERT INTO market_trades (order_id, buyer_wallet, seller_wallet, gold_amount, token_amount, currency, tx_signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.orderId,
        input.buyerWallet,
        input.sellerWallet,
        input.goldAmount,
        input.tokenAmount,
        input.currency,
        input.txSignature,
      ],
    );
    return true;
  } catch {
    return false;
  }
}

export interface MarketTradeRecord {
  goldAmount: number;
  tokenAmount: number;
  createdAt: number;
}

export interface MarketTradeDetail {
  goldAmount: number;
  tokenAmount: number;
  currency: string;
  createdAt: number;
}

/** The most recent trades across all currencies, newest first (for the ticker). */
export async function listLatestMarketTrades(limit = 10): Promise<MarketTradeDetail[]> {
  const db = getPool();
  if (!db) return [];

  const result = await db.query<{
    gold_amount: number;
    token_amount: number;
    currency: string;
    created_at: Date;
  }>(
    `SELECT gold_amount, token_amount, currency, created_at
     FROM market_trades
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    goldAmount: row.gold_amount,
    tokenAmount: row.token_amount,
    currency: row.currency,
    createdAt: row.created_at.getTime(),
  }));
}

export async function listRecentMarketTrades(
  sinceMs: number,
  currency = "base",
): Promise<MarketTradeRecord[]> {
  const db = getPool();
  if (!db) return [];

  const result = await db.query<{
    gold_amount: number;
    token_amount: number;
    created_at: Date;
  }>(
    `SELECT gold_amount, token_amount, created_at
     FROM market_trades
     WHERE created_at >= $1 AND currency = $2
     ORDER BY created_at ASC`,
    [new Date(sinceMs), currency],
  );

  return result.rows.map((row) => ({
    goldAmount: row.gold_amount,
    tokenAmount: row.token_amount,
    createdAt: row.created_at.getTime(),
  }));
}

export async function isTradeSignatureUsed(signature: string): Promise<boolean> {
  const db = getPool();
  if (!db) return false;

  const result = await db.query<{ tx_signature: string }>(
    `SELECT tx_signature FROM market_trades WHERE tx_signature = $1`,
    [signature],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function expirePendingOrders(): Promise<void> {
  const db = getPool();
  if (!db) return;

  const expired = await db.query<{
    side: MarketSide;
    gold_amount: number;
    counterparty_wallet: string | null;
    wallet: string;
  }>(
    `SELECT side, gold_amount, counterparty_wallet, wallet
     FROM market_orders
     WHERE status = 'pending' AND pending_expires_at < NOW()`,
  );

  for (const row of expired.rows) {
    if (row.side === "bid" && row.counterparty_wallet) {
      await db.query(`UPDATE characters SET gold = gold + $1 WHERE wallet_address = $2`, [
        row.gold_amount,
        row.counterparty_wallet,
      ]);
    }
  }

  await db.query(
    `UPDATE market_orders
     SET status = 'cancelled', escrow_gold = 0, counterparty_wallet = NULL, pending_expires_at = NULL, updated_at = NOW()
     WHERE status = 'pending' AND pending_expires_at < NOW()`,
  );
}

export function toMarketOrderView(order: MarketOrderRecord): MarketOrderView {
  const view: MarketOrderView = {
    id: order.id,
    side: order.side,
    status: order.status,
    playerName: order.playerName,
    wallet: order.wallet,
    goldAmount: order.goldAmount,
    tokenPrice: order.tokenPrice,
    tokenPerGold: tokenPerGold(order.goldAmount, order.tokenPrice),
    currency: order.currency,
    createdAt: order.createdAt,
  };

  if (order.status === "pending") {
    if (order.side === "ask") {
      view.payToWallet = order.wallet;
      view.payFromWallet = order.counterpartyWallet ?? undefined;
    } else {
      view.payToWallet = order.counterpartyWallet ?? undefined;
      view.payFromWallet = order.wallet;
    }
  }

  return view;
}

function mapRow(row: MarketOrderRow): MarketOrderRecord {
  return {
    id: row.id,
    side: row.side,
    status: row.status,
    wallet: row.wallet,
    playerName: row.player_name,
    goldAmount: row.gold_amount,
    tokenPrice: row.token_price,
    currency: row.currency ?? DEFAULT_CURRENCY_ID,
    escrowGold: row.escrow_gold,
    counterpartyWallet: row.counterparty_wallet,
    pendingExpiresAt: row.pending_expires_at ? row.pending_expires_at.getTime() : null,
    createdAt: row.created_at.getTime(),
  };
}