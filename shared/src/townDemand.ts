// NPC town demand — towns "eat" goods so demand exists even at low player
// counts, and post rotating time-limited bulk ORDERS at a premium over the
// effective vendor price. This file is THE tunables table for the system.
//
// Economic rules (enforced server-side in server/src/economy/townDemand.ts):
// - Ambient consumption records into the SAME supply/demand ledger as player
//   demand, but is throttled by real player production (no phantom demand for
//   goods nobody trades).
// - Order payouts are a GOLD FAUCET — every payout is capped per town per day
//   AND per player per day, and metered under gold.faucet.townOrders.
// - Orders take ITEMS, never gold, so alts cannot wash demand into the ledger.

/** One town's identity + what it consumes. Quantities are PER DAY ceilings. */
export interface TownDef {
  zoneId: string;
  label: string;
  /** Daily ambient consumption ceiling per item (throttled by 7d production). */
  basket: Record<string, number>;
}

/** Towns = the base zones with a Pip/notice board. Player Worlds excluded. */
export const TOWNS: TownDef[] = [
  {
    zoneId: "zone_hub",
    label: "The Hub",
    basket: {
      item_bread: 30,
      item_cooked_fish: 20,
      item_plank: 24,
      item_copper_bar: 12,
      item_health_potion: 8,
    },
  },
  {
    zoneId: "zone_wilderness",
    label: "Wilderness Camp",
    basket: {
      item_bread: 20,
      item_carrot_soup: 12,
      item_plank: 16,
      item_hardwood_plank: 10,
      item_health_potion: 12,
    },
  },
  {
    zoneId: "zone_grotto",
    label: "Grotto Outpost",
    basket: {
      item_cooked_fish: 24,
      item_grilled_salmon: 10,
      item_lamp_oil: 16,
      item_iron_bar: 10,
      item_carrot_bread: 10,
    },
  },
];

/** Ambient consumption per day = min(basket qty, this fraction of 7d production). */
export const TOWN_AMBIENT_PROD_FRACTION = 0.15;

/** How often a town considers posting a new order. */
export const TOWN_ORDER_INTERVAL_MS = 3 * 60 * 60 * 1000;
/** Active orders per town at any time. */
export const TOWN_MAX_OPEN_ORDERS = 2;
/** How long an order stays on the board before expiring. */
export const TOWN_ORDER_DURATION_MS = 6 * 60 * 60 * 1000;
/** Premium over the effective vendor price, rolled per order. */
export const TOWN_ORDER_PREMIUM_MIN = 1.1;
export const TOWN_ORDER_PREMIUM_MAX = 1.4;
/** Target order size in BASE-value gold (qty derives from the item's value). */
export const TOWN_ORDER_TARGET_VALUE_MIN = 250;
export const TOWN_ORDER_TARGET_VALUE_MAX = 700;
/** Hard bounds on rolled order quantity. */
export const TOWN_ORDER_QTY_MIN = 5;
export const TOWN_ORDER_QTY_MAX = 80;

/** FAUCET CAPS — gold paid out by town orders, per UTC day. */
export const TOWN_ORDER_DAILY_GOLD_CAP = 6000; // per town
export const PLAYER_ORDER_DAILY_GOLD_CAP = 1500; // per player, all towns

/** One order on a town's board (wire shape). */
export interface TownOrder {
  id: string;
  zoneId: string;
  townLabel: string;
  itemId: string;
  /** Units still wanted (partial fills decrement this). */
  remaining: number;
  /** Units originally requested. */
  requested: number;
  /** Premium multiplier applied to the effective sell price at fill time. */
  premium: number;
  expiresAt: number;
  createdAt: number;
}

/** GET-style payload for the board UI. */
export interface TownOrdersPayload {
  orders: TownOrder[];
  /** Gold the requesting player can still earn from orders today. */
  playerDailyRemaining: number;
}

export interface TownOrderFillResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  /** Units actually delivered (may be less than asked: caps/stock/remaining). */
  delivered?: number;
  goldPaid?: number;
}
