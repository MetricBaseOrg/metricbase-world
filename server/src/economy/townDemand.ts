// NPC town demand engine: ambient consumption + the rotating order boards.
// Process-global (one board per town across all zone rooms), tunables in
// @metricbase/shared townDemand.ts.
//
// FAUCET DISCIPLINE: order payouts mint gold, so every payout is triple-capped
// (per order size, per town per day, per player per day) and metered under
// gold.faucet.townOrders. Daily counters are in-memory and reset at UTC
// midnight; a server restart resets them early, which players cannot trigger.

import {
  TOWNS,
  TOWN_AMBIENT_PROD_FRACTION,
  TOWN_MAX_OPEN_ORDERS,
  TOWN_ORDER_DAILY_GOLD_CAP,
  TOWN_ORDER_DURATION_MS,
  TOWN_ORDER_INTERVAL_MS,
  TOWN_ORDER_PREMIUM_MAX,
  TOWN_ORDER_PREMIUM_MIN,
  TOWN_ORDER_QTY_MAX,
  TOWN_ORDER_QTY_MIN,
  TOWN_ORDER_TARGET_VALUE_MAX,
  TOWN_ORDER_TARGET_VALUE_MIN,
  PLAYER_ORDER_DAILY_GOLD_CAP,
  getItemBaseValue,
  type TownOrder,
} from "@metricbase/shared";
import crypto from "node:crypto";
import { bumpMetric } from "./metrics.js";
import { getItemFlows, recordConsumed } from "./itemFlows.js";
import { effectiveSellPrice } from "../market/sellPressure.js";

const orders = new Map<string, TownOrder>();

// UTC-day-keyed payout counters.
let counterDay = today();
const townPaidToday = new Map<string, number>();
const playerPaidToday = new Map<string, number>();
let lastAmbientDay = "";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollCountersIfNewDay(): void {
  const day = today();
  if (day === counterDay) return;
  counterDay = day;
  townPaidToday.clear();
  playerPaidToday.clear();
}

/** Prune expired orders (metering how many died unfilled — honest signal). */
function pruneExpired(now = Date.now()): void {
  for (const [id, order] of orders) {
    if (order.expiresAt <= now) {
      if (order.remaining > 0) bumpMetric("town.order.expired", 1);
      orders.delete(id);
    }
  }
}

/** Post one new order for a town, item picked from its basket. */
function postOrder(town: (typeof TOWNS)[number], now = Date.now()): TownOrder | null {
  const itemIds = Object.keys(town.basket);
  if (itemIds.length === 0) return null;
  const itemId = itemIds[Math.floor(Math.random() * itemIds.length)];
  const value = Math.max(1, getItemBaseValue(itemId));
  const targetValue =
    TOWN_ORDER_TARGET_VALUE_MIN +
    Math.random() * (TOWN_ORDER_TARGET_VALUE_MAX - TOWN_ORDER_TARGET_VALUE_MIN);
  const qty = Math.max(TOWN_ORDER_QTY_MIN, Math.min(TOWN_ORDER_QTY_MAX, Math.round(targetValue / value)));
  const premium =
    Math.round(
      (TOWN_ORDER_PREMIUM_MIN + Math.random() * (TOWN_ORDER_PREMIUM_MAX - TOWN_ORDER_PREMIUM_MIN)) * 100,
    ) / 100;
  const order: TownOrder = {
    id: crypto.randomUUID(),
    zoneId: town.zoneId,
    townLabel: town.label,
    itemId,
    remaining: qty,
    requested: qty,
    premium,
    expiresAt: now + TOWN_ORDER_DURATION_MS,
    createdAt: now,
  };
  orders.set(order.id, order);
  bumpMetric("town.order.posted", 1);
  return order;
}

/** Top a town's board back up to its open-order count. */
function replenishOrders(now = Date.now()): TownOrder[] {
  pruneExpired(now);
  const posted: TownOrder[] = [];
  for (const town of TOWNS) {
    const open = [...orders.values()].filter((o) => o.zoneId === town.zoneId && o.remaining > 0);
    for (let i = open.length; i < TOWN_MAX_OPEN_ORDERS; i++) {
      const order = postOrder(town, now);
      if (order) posted.push(order);
    }
  }
  return posted;
}

/**
 * Daily ambient consumption: each town "eats" from its basket, throttled to a
 * fraction of REAL 7-day player production so untraded goods gain no phantom
 * demand. Day-keyed idempotent; call from an hourly tick.
 */
export function runAmbientConsumption(): void {
  const day = today();
  if (day === lastAmbientDay) return;
  lastAmbientDay = day;
  const flows = getItemFlows();
  for (const town of TOWNS) {
    for (const [itemId, ceiling] of Object.entries(town.basket)) {
      const produced7d = flows.get(itemId)?.produced ?? 0;
      const qty = Math.min(ceiling, Math.floor(produced7d * TOWN_AMBIENT_PROD_FRACTION));
      if (qty <= 0) continue;
      recordConsumed(itemId, qty);
      bumpMetric(`town.consumed.${itemId}`, qty);
    }
  }
}

/** Called on boot: seed boards, then keep them rotating. */
export function initTownDemand(onNewOrders?: (orders: TownOrder[]) => void): void {
  replenishOrders();
  runAmbientConsumption();
  setInterval(() => {
    rollCountersIfNewDay();
    runAmbientConsumption();
    const posted = replenishOrders();
    if (posted.length > 0 && onNewOrders) onNewOrders(posted);
  }, Math.min(TOWN_ORDER_INTERVAL_MS, 60 * 60 * 1000));
}

/** Live orders for the board UI (all towns, so players can plan travel). */
export function getTownOrders(now = Date.now()): TownOrder[] {
  pruneExpired(now);
  return [...orders.values()]
    .filter((o) => o.remaining > 0)
    .sort((a, b) => a.expiresAt - b.expiresAt);
}

/** Gold a player can still earn from town orders today. */
export function playerOrderGoldRemaining(pid: string): number {
  rollCountersIfNewDay();
  return Math.max(0, PLAYER_ORDER_DAILY_GOLD_CAP - (playerPaidToday.get(pid) ?? 0));
}

export interface TownFillOutcome {
  ok: boolean;
  error?: string;
  /** Units the caller should remove from the player's bag. */
  delivered: number;
  /** Gold to grant (already capped; caller mints via its faucet metric). */
  goldPaid: number;
  order?: TownOrder;
}

/**
 * Fill an order with up to `available` units. Applies the premium to the
 * CURRENT effective (supply/demand + saturation) sell price, then trims the
 * delivery so neither the town's nor the player's daily gold cap is exceeded.
 * The caller verifies zone presence + bag stock, removes items, and mints.
 */
export function fillTownOrder(orderId: string, pid: string, available: number): TownFillOutcome {
  rollCountersIfNewDay();
  const order = orders.get(orderId);
  const now = Date.now();
  if (!order || order.expiresAt <= now || order.remaining <= 0) {
    return { ok: false, error: "That order is gone — the board rotates.", delivered: 0, goldPaid: 0 };
  }
  if (available <= 0) {
    return { ok: false, error: "You don't have any of that item.", delivered: 0, goldPaid: 0 };
  }
  const unitPrice = Math.max(1, Math.round(effectiveSellPrice(order.itemId, getItemBaseValue(order.itemId)) * order.premium));
  const townRemaining = Math.max(0, TOWN_ORDER_DAILY_GOLD_CAP - (townPaidToday.get(order.zoneId) ?? 0));
  const playerRemaining = Math.max(0, PLAYER_ORDER_DAILY_GOLD_CAP - (playerPaidToday.get(pid) ?? 0));
  const goldCeiling = Math.min(townRemaining, playerRemaining);
  if (goldCeiling < unitPrice) {
    const which = playerRemaining < townRemaining ? "You've hit your" : "This town hit its";
    return { ok: false, error: `${which} daily town-order earnings cap — come back tomorrow.`, delivered: 0, goldPaid: 0 };
  }
  const maxByGold = Math.floor(goldCeiling / unitPrice);
  const delivered = Math.min(available, order.remaining, maxByGold);
  if (delivered <= 0) {
    return { ok: false, error: "Daily order cap reached.", delivered: 0, goldPaid: 0 };
  }
  const goldPaid = delivered * unitPrice;
  order.remaining -= delivered;
  townPaidToday.set(order.zoneId, (townPaidToday.get(order.zoneId) ?? 0) + goldPaid);
  playerPaidToday.set(pid, (playerPaidToday.get(pid) ?? 0) + goldPaid);
  // The town consumed the goods — real demand into the ledger.
  recordConsumed(order.itemId, delivered);
  bumpMetric(`town.consumed.${order.itemId}`, delivered);
  bumpMetric("town.order.filled", order.remaining === 0 ? 1 : 0);
  bumpMetric("gold.faucet.townOrders", goldPaid);
  if (order.remaining <= 0) orders.delete(order.id);
  return { ok: true, delivered, goldPaid, order };
}

/** Test hook (dev/E2E only): force-post an order with fixed parameters. */
export function forcePostOrder(zoneId: string, itemId: string, qty: number, premium: number): TownOrder | null {
  const town = TOWNS.find((t) => t.zoneId === zoneId);
  if (!town) return null;
  const order: TownOrder = {
    id: crypto.randomUUID(),
    zoneId,
    townLabel: town.label,
    itemId,
    remaining: qty,
    requested: qty,
    premium,
    expiresAt: Date.now() + TOWN_ORDER_DURATION_MS,
    createdAt: Date.now(),
  };
  orders.set(order.id, order);
  return order;
}
