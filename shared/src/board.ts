// District Deeds — a property board game played at /board.
//
// ─── THE SEAL (load-bearing; do not weaken) ──────────────────────────────────
// This file describes a CLOSED ABSTRACT ECONOMY. No square, card, deed, or
// outcome defined here may reference an item id, gold, gems, XP, a skill, a
// zone, or any other real-world game asset. Board cash is ⌬ ("credits"), an
// abstract unit with NO conversion rate to anything.
//
// The only real value that touches this game is the entry stake (in) and the
// prize (out), and both are handled exclusively in server/src/board/bank.ts.
// A table's stake currency is fixed at creation and never mixed: a gold table
// pays gold, a $BASE table pays $BASE. Mixing them would be a gold → $BASE
// conversion, which docs/company-coin.md forbids outright ("THE HARD
// INVARIANT"). The verification pass asserts this file imports nothing from
// items.js / economy.js / progression.js / zones.js — keep it that way.
//
// Owning a deed here grants NOTHING in the world. It is a position in a board
// game and nothing else.
// ─────────────────────────────────────────────────────────────────────────────
//
// This is also THE tunables table for the whole feature. Everything a designer
// would want to turn — prices, rents, timings, the rake, stake tiers, trade
// limits — lives in this one file so there is never a second place to look.

// ═══════════════════════════════════════════════════════════════════════════
// The board
// ═══════════════════════════════════════════════════════════════════════════

export const BOARD_SQUARE_COUNT = 40;

/** Property groups. `improvementCost` is per improvement on any deed in the
 *  group; the classic four-tier ladder (50/100/150/200). */
export interface BoardGroup {
  id: string;
  label: string;
  /** Hex colour for the deed's stripe in the UI. */
  color: string;
  improvementCost: number;
}

export const BOARD_GROUPS: Record<string, BoardGroup> = {
  ash: { id: "ash", label: "Ash", color: "#6b4a3a", improvementCost: 50 },
  tide: { id: "tide", label: "Tide", color: "#4a9fd4", improvementCost: 50 },
  ember: { id: "ember", label: "Ember", color: "#d4674a", improvementCost: 100 },
  hollow: { id: "hollow", label: "Hollow", color: "#c9862f", improvementCost: 100 },
  verdigris: { id: "verdigris", label: "Verdigris", color: "#3fa88a", improvementCost: 150 },
  sun: { id: "sun", label: "Sun", color: "#e0b93c", improvementCost: 150 },
  aurora: { id: "aurora", label: "Aurora", color: "#7a6bd4", improvementCost: 200 },
  obsidian: { id: "obsidian", label: "Obsidian", color: "#3b3b4d", improvementCost: 200 },
};

export type BoardSquareKind =
  | "uplink" // pass here → salary (the start square)
  | "deed" // a buildable district
  | "relay" // rent scales with how many of the four you hold
  | "utility" // rent is a multiple of the roll
  | "signal" // draw a Signal card
  | "ledger" // draw a Ledger card
  | "tax" // flat payment to the bank
  | "cooldownBay" // visiting / serving cooldown
  | "freeCache" // nothing happens
  | "sentToCooldown"; // go straight to cooldown

export interface BoardSquare {
  index: number;
  kind: BoardSquareKind;
  label: string;
  /** deed / relay / utility only. */
  price?: number;
  /** deed only: group id into BOARD_GROUPS. */
  group?: string;
  /** deed only: [base, 1, 2, 3, 4, estate] rent ladder. Base rent DOUBLES when
   *  the owner holds the whole group and it is unimproved. */
  rents?: readonly number[];
  /** tax only. */
  amount?: number;
}

/** The 40 squares. Positions mirror the classic cadence (card squares at
 *  2/7/17/22/33/36, relays at 5/15/25/35, utilities at 12/28, taxes at 4/38)
 *  because the 60–90 minute session target is calibrated on that rhythm and
 *  players already read it at a glance. Every NAME is invented — none of these
 *  is a real MetricBase location. */
export const BOARD_SQUARES: readonly BoardSquare[] = [
  { index: 0, kind: "uplink", label: "Uplink" },
  { index: 1, kind: "deed", label: "Ashfall Row", group: "ash", price: 60, rents: [2, 10, 30, 90, 160, 250] },
  { index: 2, kind: "ledger", label: "Ledger" },
  { index: 3, kind: "deed", label: "Cinder Lane", group: "ash", price: 60, rents: [4, 20, 60, 180, 320, 450] },
  { index: 4, kind: "tax", label: "Ingest Fee", amount: 200 },
  { index: 5, kind: "relay", label: "North Relay", price: 200 },
  { index: 6, kind: "deed", label: "Tidewatch", group: "tide", price: 100, rents: [6, 30, 90, 270, 400, 550] },
  { index: 7, kind: "signal", label: "Signal" },
  { index: 8, kind: "deed", label: "Saltglass", group: "tide", price: 100, rents: [6, 30, 90, 270, 400, 550] },
  { index: 9, kind: "deed", label: "Loom Quay", group: "tide", price: 120, rents: [8, 40, 100, 300, 450, 600] },
  { index: 10, kind: "cooldownBay", label: "Cooldown Bay" },
  { index: 11, kind: "deed", label: "Emberline", group: "ember", price: 140, rents: [10, 50, 150, 450, 625, 750] },
  { index: 12, kind: "utility", label: "Power Grid", price: 150 },
  { index: 13, kind: "deed", label: "Kiln Court", group: "ember", price: 140, rents: [10, 50, 150, 450, 625, 750] },
  { index: 14, kind: "deed", label: "Foundry Walk", group: "ember", price: 160, rents: [12, 60, 180, 500, 700, 900] },
  { index: 15, kind: "relay", label: "East Relay", price: 200 },
  { index: 16, kind: "deed", label: "Hollowgate", group: "hollow", price: 180, rents: [14, 70, 200, 550, 750, 950] },
  { index: 17, kind: "ledger", label: "Ledger" },
  { index: 18, kind: "deed", label: "Bramble Cross", group: "hollow", price: 180, rents: [14, 70, 200, 550, 750, 950] },
  { index: 19, kind: "deed", label: "Iron Vigil", group: "hollow", price: 200, rents: [16, 80, 220, 600, 800, 1000] },
  { index: 20, kind: "freeCache", label: "Free Cache" },
  { index: 21, kind: "deed", label: "Verdigris", group: "verdigris", price: 220, rents: [18, 90, 250, 700, 875, 1050] },
  { index: 22, kind: "signal", label: "Signal" },
  { index: 23, kind: "deed", label: "Highmark", group: "verdigris", price: 220, rents: [18, 90, 250, 700, 875, 1050] },
  { index: 24, kind: "deed", label: "Sable Terrace", group: "verdigris", price: 240, rents: [20, 100, 300, 750, 925, 1100] },
  { index: 25, kind: "relay", label: "South Relay", price: 200 },
  { index: 26, kind: "deed", label: "Sunspire", group: "sun", price: 260, rents: [22, 110, 330, 800, 975, 1150] },
  { index: 27, kind: "deed", label: "Amberfield", group: "sun", price: 260, rents: [22, 110, 330, 800, 975, 1150] },
  { index: 28, kind: "utility", label: "Data Well", price: 150 },
  { index: 29, kind: "deed", label: "Gild Hollow", group: "sun", price: 280, rents: [24, 120, 360, 850, 1025, 1200] },
  { index: 30, kind: "sentToCooldown", label: "Sent To Cooldown" },
  { index: 31, kind: "deed", label: "Northlight", group: "aurora", price: 300, rents: [26, 130, 390, 900, 1100, 1275] },
  { index: 32, kind: "deed", label: "Frostmere", group: "aurora", price: 300, rents: [26, 130, 390, 900, 1100, 1275] },
  { index: 33, kind: "ledger", label: "Ledger" },
  { index: 34, kind: "deed", label: "Aurora Reach", group: "aurora", price: 320, rents: [28, 150, 450, 1000, 1200, 1400] },
  { index: 35, kind: "relay", label: "West Relay", price: 200 },
  { index: 36, kind: "signal", label: "Signal" },
  { index: 37, kind: "deed", label: "Obsidian Keep", group: "obsidian", price: 350, rents: [35, 175, 500, 1100, 1300, 1500] },
  { index: 38, kind: "tax", label: "Audit Levy", amount: 100 },
  { index: 39, kind: "deed", label: "Zenith Row", group: "obsidian", price: 400, rents: [50, 200, 600, 1400, 1700, 2000] },
];

export const BOARD_UPLINK_SQUARE = 0;
export const BOARD_COOLDOWN_SQUARE = 10;
export const BOARD_SENT_TO_COOLDOWN_SQUARE = 30;

/** Rent for a relay by how many of the four the owner holds (1-indexed). */
export const BOARD_RELAY_RENTS: readonly number[] = [25, 50, 100, 200];
/** Utility rent = this multiple of the dice total, by how many are owned. */
export const BOARD_UTILITY_MULTIPLIERS: readonly number[] = [4, 10];

/** Cash every seat starts with. */
export const BOARD_STARTING_CASH = 1500;
/** Paid on passing (or landing on) Uplink. */
export const BOARD_SALARY = 200;
/** Improvements per deed before it becomes an "estate" (the 5th). */
export const BOARD_MAX_IMPROVEMENTS = 5;
/** Rolling three doubles in a row sends you to Cooldown Bay. */
export const BOARD_DOUBLES_TO_COOLDOWN = 3;
/** Turns spent in Cooldown Bay before release is forced (paying the fee). */
export const BOARD_COOLDOWN_TURNS = 3;

/**
 * Hard cap on turns per seat, after which the table settles on net worth
 * (richest wins) instead of playing on to a bankruptcy.
 *
 * This is a BACKSTOP, not the intended ending — the normal ending is still
 * "last player standing". It exists because a property game is not guaranteed
 * to terminate: if no monopoly forms, rents stay below the salary and every
 * seat just gets richer forever. The simulation found exactly that — 363 of
 * 500 AI games ran past 90,000 turns with zero monopolies and six-figure cash
 * piles. Tournament play solves it the same way, with a clock.
 *
 * A table with real stakes in it cannot be allowed to run unbounded: the
 * 5-minute disconnect forfeit, the 10-minute restart grace and the deploy
 * cadence all assume a game that ends.
 *
 * 70 turns/seat ≈ 90 minutes at 4 seats, ≈ 45 at 2.
 */
export const BOARD_MAX_TURNS_PER_SEAT = 70;

/** Total turns before the net-worth settlement fires. */
export function boardTurnCap(seatCount: number): number {
  return BOARD_MAX_TURNS_PER_SEAT * Math.max(2, seatCount);
}
/** Cost to leave Cooldown Bay early. */
export const BOARD_COOLDOWN_FEE = 50;

/** Mortgaging returns half the deed's face price. */
export function boardMortgageValue(price: number): number {
  return Math.floor(price / 2);
}
/** Lifting a mortgage costs the mortgage plus 10%, rounded up. */
export function boardUnmortgageCost(price: number): number {
  return Math.ceil(boardMortgageValue(price) * 1.1);
}
/** Selling an improvement back to the bank returns half what it cost. */
export function boardImprovementRefund(groupId: string): number {
  return Math.floor((BOARD_GROUPS[groupId]?.improvementCost ?? 0) / 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// Cards
// ═══════════════════════════════════════════════════════════════════════════

/** CLOSED union — every card effect a card may have. Adding a member here is
 *  the only way to add a new kind of card effect, and anything referencing the
 *  world outside the board is by construction unrepresentable. The seal audit
 *  checks that no card payload carries a key outside this union. */
export type BoardCardEffect =
  /** Gain (positive) or pay the bank (negative). */
  | { kind: "cash"; amount: number }
  /** Every other active seat pays you this much. */
  | { kind: "collectFromEach"; amount: number }
  /** You pay every other active seat this much. */
  | { kind: "payEach"; amount: number }
  /** Jump to a square; collect salary if you pass Uplink on the way. */
  | { kind: "moveTo"; square: number; collectSalary: boolean }
  /** Shuffle backwards (or forwards) without passing-Uplink salary. */
  | { kind: "moveBy"; steps: number }
  /** Advance to the next Relay; pay double rent if it is owned. */
  | { kind: "nearestRelay" }
  /** Advance to the next utility; pay 10× the roll if it is owned. */
  | { kind: "nearestUtility" }
  /** Straight to Cooldown Bay, no salary. */
  | { kind: "goToCooldown" }
  /** Pay per improvement and per estate across everything you own. */
  | { kind: "repairs"; perImprovement: number; perEstate: number }
  /** Keep this card; spend it to leave Cooldown Bay free. */
  | { kind: "cooldownPardon" };

export interface BoardCard {
  id: string;
  text: string;
  effect: BoardCardEffect;
}

export const BOARD_SIGNAL_CARDS: readonly BoardCard[] = [
  { id: "sig_uplink", text: "Cache hit — advance to Uplink and collect your salary.", effect: { kind: "moveTo", square: 0, collectSalary: true } },
  { id: "sig_latency", text: "Latency spike — pay 75 ⌬ in maintenance.", effect: { kind: "cash", amount: -75 } },
  { id: "sig_review", text: "Peer review passed — collect 100 ⌬.", effect: { kind: "cash", amount: 100 } },
  { id: "sig_rollback", text: "Rollback — go back three squares.", effect: { kind: "moveBy", steps: -3 } },
  { id: "sig_downtime", text: "Scheduled downtime — report to Cooldown Bay.", effect: { kind: "goToCooldown" } },
  { id: "sig_reindex", text: "Index rebuild — pay 40 ⌬ per improvement and 115 ⌬ per estate.", effect: { kind: "repairs", perImprovement: 40, perEstate: 115 } },
  { id: "sig_surge", text: "Traffic surge — advance to the nearest Relay and pay double rent.", effect: { kind: "nearestRelay" } },
  { id: "sig_draw", text: "Power draw — advance to the nearest utility and pay ten times your roll.", effect: { kind: "nearestUtility" } },
  { id: "sig_audit", text: "Audit clean — keep this card to leave Cooldown Bay free.", effect: { kind: "cooldownPardon" } },
  { id: "sig_zenith", text: "Priority route — advance to Zenith Row.", effect: { kind: "moveTo", square: 39, collectSalary: true } },
  { id: "sig_hollow", text: "Contract awarded — advance to Hollowgate.", effect: { kind: "moveTo", square: 16, collectSalary: true } },
  { id: "sig_dividend", text: "Bandwidth dividend — collect 50 ⌬.", effect: { kind: "cash", amount: 50 } },
  { id: "sig_levy", text: "Emergency levy — pay every other player 50 ⌬.", effect: { kind: "payEach", amount: 50 } },
  { id: "sig_eastrelay", text: "Freight rerouted — advance to East Relay.", effect: { kind: "moveTo", square: 15, collectSalary: true } },
  { id: "sig_overrun", text: "Budget overrun — pay 150 ⌬.", effect: { kind: "cash", amount: -150 } },
  { id: "sig_tide", text: "Survey complete — advance to Tidewatch.", effect: { kind: "moveTo", square: 6, collectSalary: true } },
];

export const BOARD_LEDGER_CARDS: readonly BoardCard[] = [
  { id: "led_grant", text: "Grant approved — collect 200 ⌬.", effect: { kind: "cash", amount: 200 } },
  { id: "led_storage", text: "Storage bill — pay 50 ⌬.", effect: { kind: "cash", amount: -50 } },
  { id: "led_fund", text: "Community fund payout — every other player pays you 25 ⌬.", effect: { kind: "collectFromEach", amount: 25 } },
  { id: "led_rebate", text: "Refactor rebate — collect 150 ⌬.", effect: { kind: "cash", amount: 150 } },
  { id: "led_pardon", text: "Filing accepted — keep this card to leave Cooldown Bay free.", effect: { kind: "cooldownPardon" } },
  { id: "led_uplink", text: "Quarter closed — advance to Uplink and collect your salary.", effect: { kind: "moveTo", square: 0, collectSalary: true } },
  { id: "led_inspect", text: "Inspection failed — report to Cooldown Bay.", effect: { kind: "goToCooldown" } },
  { id: "led_upkeep", text: "Scheduled upkeep — pay 40 ⌬ per improvement and 115 ⌬ per estate.", effect: { kind: "repairs", perImprovement: 40, perEstate: 115 } },
  { id: "led_refund", text: "Overpayment refunded — collect 100 ⌬.", effect: { kind: "cash", amount: 100 } },
  { id: "led_consult", text: "Consulting fee — pay 100 ⌬.", effect: { kind: "cash", amount: -100 } },
  { id: "led_royalty", text: "Royalty cleared — collect 75 ⌬.", effect: { kind: "cash", amount: 75 } },
  { id: "led_settle", text: "Settlement reached — collect 25 ⌬ from every other player.", effect: { kind: "collectFromEach", amount: 25 } },
  { id: "led_penalty", text: "Late filing — pay 75 ⌬.", effect: { kind: "cash", amount: -75 } },
  { id: "led_bond", text: "Bond matured — collect 250 ⌬.", effect: { kind: "cash", amount: 250 } },
  { id: "led_recall", text: "Recall notice — go back three squares.", effect: { kind: "moveBy", steps: -3 } },
  { id: "led_stipend", text: "Research stipend — collect 60 ⌬.", effect: { kind: "cash", amount: 60 } },
];

// ═══════════════════════════════════════════════════════════════════════════
// Steady-state landing weights (AI input only — never gameplay)
// ═══════════════════════════════════════════════════════════════════════════

/** Long-run share of landings per square, as percentages summing to ~100.
 *
 *  Derived from the classic board's absorbing-chain walk (cooldown modelled as
 *  three turns, card decks resolved). Hardcoded rather than computed at runtime
 *  because it never changes while BOARD_SQUARES is fixed, and the AI consults
 *  it on every decision. `scratchpad/board-sim.mjs` re-derives these empirically
 *  over 500 games and asserts each entry is within tolerance — if you edit the
 *  board layout, that assert is what will tell you these are stale. */
export const SQUARE_LANDING_WEIGHTS: readonly number[] = [
  3.10, 2.14, 1.89, 2.18, 2.33, 2.93, 2.31, 0.87, 2.35, 2.33,
  3.95, 2.77, 2.61, 2.35, 2.47, 2.92, 2.82, 2.60, 2.94, 3.09,
  2.88, 2.82, 1.04, 2.73, 3.18, 3.06, 2.70, 2.67, 2.81, 2.58,
  0.00, 2.67, 2.62, 2.39, 2.50, 2.44, 0.87, 2.18, 2.17, 2.62,
];

// ═══════════════════════════════════════════════════════════════════════════
// Timings
// ═══════════════════════════════════════════════════════════════════════════

/** Main decision (roll, buy, build…). */
export const BOARD_TURN_SECONDS = 45;
/** Sub-decision: an auction bid, a trade response, resolving a debt. */
export const BOARD_SUBTURN_SECONDS = 25;
/** Consecutive auto-plays before a seat is shown as idle to everyone. */
export const BOARD_AUTOPLAY_STRIKES_IDLE = 3;
/** Consecutive auto-plays before the seat forfeits. */
export const BOARD_AUTOPLAY_STRIKES_FORFEIT = 5;

/** A seat is "connected" while it has polled within this window. */
export const BOARD_POLL_TIMEOUT_MS = 60_000;
/** How long a long-poll request parks before returning empty. */
export const BOARD_POLL_HOLD_MS = 25_000;
/** After the server OBSERVES a player go quiet, how long until the seat
 *  forfeits. Only ever started by a live process watching a live player — a
 *  restart can never start this clock (see server/src/board/registry.ts). */
export const BOARD_DISCONNECT_GRACE_MS = 300_000; // 5 min
/** After a server restart, every seat at every resumed table gets this long to
 *  come back before any forfeit clock may start. Deliberately longer than the
 *  disconnect grace: the players did nothing wrong. */
export const BOARD_RESTART_GRACE_MS = 600_000; // 10 min

// ═══════════════════════════════════════════════════════════════════════════
// Stakes, rake, and limits
// ═══════════════════════════════════════════════════════════════════════════

/** A table's stake currency. Fixed at creation, NEVER mixed — see the seal. */
export type BoardCurrencyId = "gold" | "base" | "sol";

/** Percent of the pot kept by the house. Mirrors the season vault's 5% fee, and
 *  mirrors its rounding discipline: the rake rounds UP so the prize can never
 *  exceed what was staked. */
export const BOARD_RAKE_PCT = 5;

/**
 * Split a pot into the house's rake and the winner's prize.
 *
 * `pot` MUST be in the currency's smallest integer units (lamports for SOL,
 * raw token units for $BASE, whole gold). Passing UI units throws rather than
 * rounding: `boardRakeSplit(0.04)` would otherwise return a rake of 1 and a
 * prize of 0 — a whole 0.04 SOL pot silently eaten by ceil(). Money math never
 * touches floats here for exactly this reason.
 */
export function boardRakeSplit(pot: number): { rake: number; prize: number } {
  if (!Number.isFinite(pot) || pot <= 0) return { rake: 0, prize: 0 };
  if (!Number.isInteger(pot)) {
    throw new Error(`boardRakeSplit needs smallest-unit integers, got ${pot}`);
  }
  const rake = Math.ceil((pot * BOARD_RAKE_PCT) / 100);
  return { rake, prize: Math.max(0, pot - rake) };
}

/** Selectable stakes per currency, in that currency's UI units. */
export const BOARD_STAKE_TIERS: Record<BoardCurrencyId, readonly number[]> = {
  gold: [1_000, 10_000, 100_000, 1_000_000],
  base: [1_000, 5_000, 25_000],
  sol: [0.02, 0.05, 0.1],
};

/** Seat limits per currency.
 *
 *  Money tables are capped at 2 seats at launch, and that is a MITIGATION, not
 *  a UI choice. Winner-takes-all with three or more seats is exploitable by two
 *  players soft-playing each other (declining deeds the partner wants, bidding
 *  nothing, always taking the value-band edge) and splitting the pot offline.
 *  The trade bands and flow caps below reduce that to a slow, logged edge; they
 *  do not remove it. At two seats the attack does not exist at all. Raise this
 *  only alongside a decision about how flagged tables get reviewed. */
export const BOARD_SEAT_LIMITS: Record<BoardCurrencyId, { min: number; max: number }> = {
  gold: { min: 2, max: 6 },
  base: { min: 2, max: 2 },
  sol: { min: 2, max: 2 },
};

/** AI opponents are gold-only, forever. A house-controlled opponent taking a
 *  player's $BASE makes the house the counterparty, which is a different
 *  product with different obligations. Enforced in the lobby, again in
 *  startTable(), and again by a CHECK constraint on board_tables. */
export function boardAllowsAi(currencyId: BoardCurrencyId): boolean {
  return currencyId === "gold";
}

/** Hard ceiling on a gold pot. `pending_gold.amount` is INTEGER (schema.sql),
 *  so an offline winner's prize must stay well clear of 2^31. */
export const BOARD_GOLD_POT_CAP = 100_000_000;

/** Every trade must give each side between 0.5× and 2× the other's value. This
 *  is what stops a colluder simply gifting their board to a partner. */
export const BOARD_TRADE_BAND = { min: 0.5, max: 2.0 } as const;
/** The band alone is defeatable by iteration (three 0.5× trades ≈ 8× transfer),
 *  so cumulative net value moved between any ordered pair of seats is capped at
 *  this percent of starting cash. */
export const BOARD_TRADE_FLOW_CAP_PCT = 25;
/** Trades a seat may complete in one table. */
export const BOARD_MAX_TRADES = 6;
/** Risk score above which a finished money table holds at `review` instead of
 *  paying out. See server/src/board/collusion.ts. */
export const BOARD_REVIEW_THRESHOLD = 60;

// ═══════════════════════════════════════════════════════════════════════════
// Game state
// ═══════════════════════════════════════════════════════════════════════════

export type BoardAiDifficulty = "easy" | "normal";
export const BOARD_AI_DIFFICULTIES: readonly BoardAiDifficulty[] = ["easy", "normal"];

export type BoardSeatStatus = "active" | "bankrupt" | "forfeit" | "won";

export interface BoardSeatState {
  index: number;
  name: string;
  kind: "human" | "ai";
  aiDifficulty?: BoardAiDifficulty;
  /** Board credits (⌬). Abstract; convertible to nothing. */
  cash: number;
  square: number;
  inCooldown: boolean;
  /** Turns already served in Cooldown Bay. */
  cooldownTurns: number;
  /** Unspent "leave free" cards held. */
  pardons: number;
  status: BoardSeatStatus;
  /** Doubles rolled so far this turn (3 → Cooldown Bay). */
  consecutiveDoubles: number;
  /** Consecutive auto-plays; reset by any real action. */
  autoPlayStrikes: number;
  tradesUsed: number;
  /** Offers made this turn, reset at endTurn. Caps trade spam, and stops an AI
   *  re-proposing forever after a decline (which is an infinite loop, not a
   *  cosmetic problem — a declined offer never increments tradesUsed). */
  offersThisTurn: number;
}

/** Offers one seat may make in a single turn. */
export const BOARD_MAX_OFFERS_PER_TURN = 2;

export interface BoardDeedState {
  square: number;
  /** Seat index, or null when the bank holds it. */
  owner: number | null;
  improvements: number;
  mortgaged: boolean;
}

export interface BoardAuctionState {
  square: number;
  highBid: number;
  highBidder: number | null;
  /** Seat whose turn it is to bid or pass. */
  currentBidder: number;
  /** Seats that have passed and are out of this auction. */
  passed: number[];
}

export interface BoardTradeOffer {
  id: string;
  from: number;
  to: number;
  giveDeeds: number[];
  giveCash: number;
  takeDeeds: number[];
  takeCash: number;
}

/** What the table is waiting for. Exactly one is live at a time. */
export type BoardPhase =
  | { kind: "awaitRoll" }
  | { kind: "awaitBuy"; square: number }
  | { kind: "auction"; auction: BoardAuctionState }
  /** `creditor` is the seat owed, or null for the bank. `distributeTo` is set
   *  only by the "pay every other player" cards, where the debt settles by
   *  splitting evenly rather than paying one party. */
  | { kind: "awaitDebt"; debtor: number; amount: number; creditor: number | null; distributeTo?: number[] }
  | { kind: "awaitEndTurn" }
  | { kind: "done"; winner: number | null };

export interface BoardRollRecord {
  nonce: number;
  d1: number;
  d2: number;
  seat: number;
}

export interface BoardState {
  seats: BoardSeatState[];
  deeds: BoardDeedState[];
  /** Seat index whose turn it is. */
  turn: number;
  phase: BoardPhase;
  /** Increments every completed turn; the length yardstick. */
  turnCount: number;
  /** The most recent roll, for display. */
  lastRoll: { d1: number; d2: number } | null;
  /** Shuffled draw piles (card ids) plus discards. */
  signalPile: string[];
  ledgerPile: string[];
  /** Pending trade offers awaiting a response. */
  trades: BoardTradeOffer[];
  /** Cumulative net value moved from seat i to seat j, for the flow cap. */
  tradeFlow: Record<string, number>;
  /** Human-readable turn log, newest last, capped. */
  log: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════════════════════════════════════

export type BoardAction =
  | { type: "roll" }
  | { type: "buy" }
  | { type: "decline" }
  | { type: "bid"; amount: number }
  | { type: "pass" }
  | { type: "proposeTrade"; to: number; giveDeeds: number[]; giveCash: number; takeDeeds: number[]; takeCash: number }
  | { type: "respondTrade"; tradeId: string; accept: boolean }
  | { type: "mortgage"; square: number }
  | { type: "unmortgage"; square: number }
  | { type: "build"; square: number }
  | { type: "sellImprovement"; square: number }
  | { type: "payCooldownFee" }
  | { type: "usePardon" }
  | { type: "declareBankrupt" }
  | { type: "endTurn" };

export interface BoardActionResult {
  ok: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Wire payloads
// ═══════════════════════════════════════════════════════════════════════════

export type BoardTableStatus =
  | "lobby"
  | "running"
  | "paused"
  | "settling"
  | "review"
  | "done"
  | "void";

/** A table as the lobby list renders it. */
export interface BoardTableSummary {
  id: string;
  name: string;
  currencyId: BoardCurrencyId;
  /** Per-seat stake, in the currency's UI units. */
  stake: number;
  seatCount: number;
  aiCount: number;
  filled: number;
  status: BoardTableStatus;
  hostName: string;
  createdAt: number;
}

/** The full table view for a seated player. */
export interface BoardStatePayload {
  table: BoardTableSummary;
  /** Monotonic; the long-poll cursor. */
  version: number;
  /** Rotates on every server boot; a change means "we restarted, resync". */
  serverBootId: string;
  /** This viewer's seat, or null when spectating the lobby. */
  mySeat: number | null;
  state: BoardState | null;
  /** Wall-clock ms when the current decision times out. */
  turnDeadline: number | null;
  /** While set, no forfeit clock may run (post-restart amnesty). */
  resumeGraceUntil: number | null;
  seats: {
    index: number;
    name: string;
    kind: "human" | "ai";
    ready: boolean;
    connected: boolean;
    idle: boolean;
    stakePaid: boolean;
  }[];
  /** Published at table creation; the seed itself only after the table ends. */
  serverSeedHash: string;
  serverSeed: string | null;
  combinedClientSeed: string | null;
  potUnits: number;
  prizeUnits: number;
  rakeUnits: number;
}

/** Rendered at join, before any stake is taken. The right to void a flagged
 *  table only means something if it was stated up front. */
export const BOARD_ENTRY_TERMS = [
  "Your stake is held until the table finishes, then the whole pot less a 5% house fee goes to the winner.",
  "Deeds, credits (⌬) and anything else on the board exist only inside this game. They grant nothing in MetricBase World and convert to nothing.",
  "A table pays out in the same currency it was entered in. Currencies are never mixed.",
  `If nobody has been bankrupted after ${BOARD_MAX_TURNS_PER_SEAT} turns each, the table settles there and the richest player wins.`,
  "If you disconnect, you have 5 minutes to return before your seat forfeits and its assets go to the bank. Your stake stays in the pot.",
  "If the server restarts, your table is saved and everyone gets 10 minutes to return. Nobody forfeits for a restart.",
  "Every roll is committed in advance and verifiable after the table ends — check the Fairness tab.",
  "Tables flagged for coordinated play are held for review before payout and may be voided with all stakes refunded.",
] as const;
