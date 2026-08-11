// District Deeds — trade validation and coordinated-play risk scoring.
//
// The problem this exists for: winner-takes-all with real stakes means two
// players who agree offline can hand one of them the game. The purest form is
// a gift — "here, take my whole board" — and that is what the value band below
// makes structurally impossible.
//
// What this CANNOT do is stop soft play: declining deeds a partner wants,
// bidding nothing in auctions, always taking the band-edge trade. That attack
// survives everything here. It is mitigated by capping money tables at two
// seats (BOARD_SEAT_LIMITS), by logging every trade, and by holding a
// high-risk table for review instead of paying it out. Those are procedural
// controls, and they are the honest answer — see docs/board-game.md.
//
// PURE MODULE: no I/O, no DB, no Colyseus. Deliberately importable by the
// rules engine and by an offline simulation alike.

import {
  BOARD_GROUPS,
  BOARD_MAX_TRADES,
  BOARD_SQUARES,
  BOARD_STARTING_CASH,
  BOARD_TRADE_BAND,
  BOARD_TRADE_FLOW_CAP_PCT,
  boardMortgageValue,
  type BoardState,
  type BoardTradeOffer,
} from "@metricbase/shared";

/** Key into BoardState.tradeFlow for value moving from → to. */
export function flowKey(from: number, to: number): string {
  return `${from}>${to}`;
}

/** What a deed is worth for trade-fairness purposes: its face price, plus what
 *  was sunk into improvements, less the debt if it is mortgaged. Deliberately
 *  NOT a market valuation — a market valuation is exactly the thing two
 *  colluders would agree to misstate. */
export function deedFaceValue(state: BoardState, square: number): number {
  const def = BOARD_SQUARES[square];
  if (!def || def.price === undefined) return 0;
  const deed = state.deeds.find((d) => d.square === square);
  if (!deed) return 0;
  const improvementCost = def.group ? (BOARD_GROUPS[def.group]?.improvementCost ?? 0) : 0;
  const sunk = deed.improvements * improvementCost;
  const debt = deed.mortgaged ? boardMortgageValue(def.price) : 0;
  return def.price + sunk - debt;
}

/** Total value on one side of an offer. */
export function sideValue(state: BoardState, deeds: number[], cash: number): number {
  return deeds.reduce((sum, sq) => sum + deedFaceValue(state, sq), 0) + Math.max(0, cash);
}

export interface TradeCheck {
  ok: boolean;
  error?: string;
  /** Net value moved from the proposer to the responder (may be negative). */
  netToResponder?: number;
}

/**
 * The full fairness check for a proposed trade. Structural legality (do you own
 * these deeds, can you afford this cash) is the rules engine's job; this is
 * only about whether the trade is a disguised gift.
 */
export function validateTrade(state: BoardState, offer: BoardTradeOffer): TradeCheck {
  const from = state.seats[offer.from];
  const to = state.seats[offer.to];
  if (!from || !to) return { ok: false, error: "That seat isn't at this table." };
  if (offer.from === offer.to) return { ok: false, error: "You can't trade with yourself." };
  if (from.status !== "active" || to.status !== "active") {
    return { ok: false, error: "Both players have to still be in the game." };
  }
  if (from.tradesUsed >= BOARD_MAX_TRADES) {
    return { ok: false, error: `You've used all ${BOARD_MAX_TRADES} of your trades for this table.` };
  }
  if (to.tradesUsed >= BOARD_MAX_TRADES) {
    return { ok: false, error: `${to.name} has used all their trades for this table.` };
  }

  // At least one deed must move. Cash-for-cash and cash-for-nothing are the two
  // shapes a pure transfer takes, and neither is a trade.
  if (offer.giveDeeds.length === 0 && offer.takeDeeds.length === 0) {
    return { ok: false, error: "A trade has to include at least one deed." };
  }

  const giveValue = sideValue(state, offer.giveDeeds, offer.giveCash);
  const takeValue = sideValue(state, offer.takeDeeds, offer.takeCash);
  if (giveValue <= 0 || takeValue <= 0) {
    return { ok: false, error: "Both sides of a trade have to be worth something." };
  }

  // Each side must be within [0.5×, 2×] of the other.
  const ratio = giveValue / takeValue;
  if (ratio < BOARD_TRADE_BAND.min || ratio > BOARD_TRADE_BAND.max) {
    return {
      ok: false,
      error: `That's too lopsided — each side has to be worth between ${BOARD_TRADE_BAND.min}× and ${BOARD_TRADE_BAND.max}× the other.`,
    };
  }

  // The band alone is defeatable by iteration: three trades at 0.5× move ~8×
  // the value of one. Cap the cumulative net flow between an ordered pair.
  const netToResponder = giveValue - takeValue;
  if (netToResponder > 0) {
    const cap = Math.floor((BOARD_STARTING_CASH * BOARD_TRADE_FLOW_CAP_PCT) / 100);
    const already = state.tradeFlow?.[flowKey(offer.from, offer.to)] ?? 0;
    if (already + netToResponder > cap) {
      return {
        ok: false,
        error: `You've already moved about as much value to ${to.name} as one table allows.`,
      };
    }
  }

  return { ok: true, netToResponder };
}

// ── Risk scoring ────────────────────────────────────────────────────────────

export interface TradeLogEntry {
  from: number;
  to: number;
  giveValue: number;
  takeValue: number;
}

export interface RiskInput {
  seatCount: number;
  trades: TradeLogEntry[];
  /** Seats that ended bankrupt, and on which turn. */
  bankruptcies: { seat: number; turn: number }[];
  /** Auctions won at a nominal price while another seat could have bid. */
  unopposedAuctions: number;
  /** Seat-linkage near-misses recorded at join (shared network, shared funder). */
  linkageFlags: number;
  totalTurns: number;
}

/**
 * A 0–100 score. Above BOARD_REVIEW_THRESHOLD a money table holds at `review`
 * rather than paying out. Deliberately blunt — this is a triage signal for a
 * human, not a verdict.
 */
export function tableRiskScore(input: RiskInput): number {
  let score = 0;

  // Trades that sit hard against the band edge are the signature of someone
  // moving as much value as the rules permit, repeatedly.
  for (const t of input.trades) {
    if (t.takeValue <= 0) continue;
    const ratio = t.giveValue / t.takeValue;
    const edge = Math.max(
      0,
      Math.max(BOARD_TRADE_BAND.min / ratio, ratio / BOARD_TRADE_BAND.max),
    );
    if (edge >= 0.95) score += 12;
    else if (edge >= 0.8) score += 6;
  }

  // Value concentrated in one direction between one pair.
  const pairNet = new Map<string, number>();
  for (const t of input.trades) {
    const k = flowKey(t.from, t.to);
    pairNet.set(k, (pairNet.get(k) ?? 0) + (t.giveValue - t.takeValue));
  }
  const cap = Math.floor((BOARD_STARTING_CASH * BOARD_TRADE_FLOW_CAP_PCT) / 100);
  for (const net of pairNet.values()) {
    if (net > cap * 0.75) score += 20;
    else if (net > cap * 0.5) score += 10;
  }

  // A game that ends far too quickly for its seat count suggests someone did
  // not really play. Calibrated off the simulation's median turn count.
  const expectedMin = 12 * input.seatCount;
  if (input.totalTurns > 0 && input.totalTurns < expectedMin) score += 15;

  // Nobody contesting auctions in a multi-seat game.
  if (input.seatCount > 2) score += Math.min(20, input.unopposedAuctions * 4);

  // Join-time linkage warnings that were let through.
  score += input.linkageFlags * 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}
