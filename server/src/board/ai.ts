// District Deeds — the rules-based opponent.
//
// PURE MODULE, like rules.ts. No I/O, no clock. The registry calls it when the
// turn belongs to an AI seat.
//
// Three constraints shape this:
//
//  1. It only ever sees `BoardAiView`, which is the state minus the deck order.
//     Deck order is the only hidden information in this game, so that single
//     omission is the whole "no peeking" guarantee — and `aiView()` is the one
//     place to check it.
//
//  2. It must be beatable. No dice access, no reaction-time edge, and `easy`
//     deliberately plays a worse move a fifth of the time.
//
//  3. It NEVER sits at a money table (BOARD_SEAT_LIMITS / boardAllowsAi, plus a
//     CHECK constraint on board_tables). That is why this file can afford to be
//     a heuristic rather than something that has to be provably unexploitable.
//
// Deliberate omission: the AI answers trade offers but never PROPOSES one. A
// naive proposer is an exploit surface — a human can farm favourable offers out
// of it all day, and on a gold table that is real value. Responding is enough
// to keep group-completion trades alive at the table.

import {
  BOARD_GROUPS,
  BOARD_MAX_IMPROVEMENTS,
  BOARD_MAX_OFFERS_PER_TURN,
  BOARD_MAX_TRADES,
  BOARD_RELAY_RENTS,
  BOARD_SQUARES,
  BOARD_UTILITY_MULTIPLIERS,
  SQUARE_LANDING_WEIGHTS,
  type BoardAction,
  type BoardAiDifficulty,
  type BoardDeedState,
  type BoardPhase,
  type BoardSeatState,
  type BoardState,
  type BoardTradeOffer,
} from "@metricbase/shared";

import { deedFaceValue, sideValue, validateTrade } from "./collusion.js";
import { autoRaiseStep, deedAt, ownsGroup } from "./rules.js";

/** Everything the AI is allowed to know: the full state MINUS the deck order.
 *  If you add a hidden field to BoardState, it must not appear here. */
export interface BoardAiView {
  seats: BoardSeatState[];
  deeds: BoardDeedState[];
  turn: number;
  phase: BoardPhase;
  turnCount: number;
  lastRoll: { d1: number; d2: number } | null;
  trades: BoardTradeOffer[];
  /** Trade history is public — everyone saw those trades happen — and the
   *  collusion checks need it, so it belongs in the view. */
  tradeFlow: Record<string, number>;
}

export function aiView(state: BoardState): BoardAiView {
  return {
    seats: state.seats,
    deeds: state.deeds,
    turn: state.turn,
    phase: state.phase,
    turnCount: state.turnCount,
    lastRoll: state.lastRoll,
    trades: state.trades,
    tradeFlow: state.tradeFlow,
  };
}

type Rng = () => number;

interface Profile {
  /** Deed value per credit of price below which it won't buy. */
  buyThreshold: number;
  /** Cash it tries to keep back, scaled up as the board fills. */
  reserveBase: number;
  /** Fraction of moves deliberately played worse. */
  jitter: number;
  /** Value ratio at which it accepts a trade. */
  tradeAccept: number;
  /** Whether it will offer trades at all. Assembling groups by trade is the
   *  single biggest skill gap in this game, so this is the main difficulty
   *  lever — bigger than any threshold. */
  proposesTrades: boolean;
  /** Multiple of the cash reserve it insists on keeping back before improving
   *  a group. Lower = builds sooner = wins more. */
  buildReserveMult: number;
  /** How far it will improve a deed. The rent ladder is shallow up to two and
   *  then jumps hard, so stopping at two is the classic beginner mistake and
   *  the clearest way to make `easy` weaker without making it erratic. */
  maxImprovements: number;
}

/**
 * `easy` is worse in the ways a new player is worse: it hoards cash, passes on
 * deeds it should take, and second-guesses itself. Note the direction — a LOWER
 * buy threshold is STRONGER play, because buying early is most of this game.
 * (Getting that backwards is what made the first version of `easy` beat
 * `normal` roughly half the time.)
 */
const PROFILES: Record<BoardAiDifficulty, Profile> = {
  easy: {
    buyThreshold: 0.14,
    reserveBase: 520,
    jitter: 0.25,
    tradeAccept: 1.4,
    proposesTrades: false,
    buildReserveMult: 3,
    maxImprovements: 2,
  },
  normal: {
    buyThreshold: 0.05,
    reserveBase: 260,
    jitter: 0.0,
    tradeAccept: 1.05,
    proposesTrades: true,
    buildReserveMult: 1,
    maxImprovements: BOARD_MAX_IMPROVEMENTS,
  },
};

function groupSquares(groupId: string): number[] {
  return BOARD_SQUARES.filter((s) => s.group === groupId).map((s) => s.index);
}

function ownedOfKind(view: BoardAiView, seat: number, kind: "relay" | "utility"): number {
  return BOARD_SQUARES.filter(
    (s) => s.kind === kind && view.deeds.find((d) => d.square === s.index)?.owner === seat,
  ).length;
}

/** How much cash to keep in hand. Near zero at the start (buying early is the
 *  whole game), rising as the board fills and rents get dangerous. */
function cashReserve(view: BoardAiView, profile: Profile): number {
  const improved = view.deeds.reduce((n, d) => n + d.improvements, 0);
  const fill = Math.min(1, view.turnCount / 40) * 0.6 + Math.min(1, improved / 20) * 0.4;
  return Math.round(profile.reserveBase * fill);
}

/**
 * What a square is worth to this seat, in "expected credits per lap" terms:
 * how often anyone lands there × what they would pay × how much it moves this
 * seat toward (or denies an opponent) a monopoly.
 */
export function deedScore(view: BoardAiView, seat: number, square: number): number {
  const def = BOARD_SQUARES[square];
  if (!def || def.price === undefined) return 0;
  const weight = SQUARE_LANDING_WEIGHTS[square] ?? 0;

  let rent = 0;
  if (def.kind === "relay") {
    rent = BOARD_RELAY_RENTS[Math.min(BOARD_RELAY_RENTS.length - 1, ownedOfKind(view, seat, "relay"))] ?? 0;
  } else if (def.kind === "utility") {
    const mult = BOARD_UTILITY_MULTIPLIERS[Math.min(BOARD_UTILITY_MULTIPLIERS.length - 1, ownedOfKind(view, seat, "utility"))] ?? 4;
    // Utilities look strong on paper and underperform in play — the 7 is the
    // mean roll, the 0.5 is the discount for never being improvable.
    rent = mult * 7 * 0.5;
  } else if (def.rents && def.group) {
    const squares = groupSquares(def.group);
    const mine = squares.filter((sq) => view.deeds.find((d) => d.square === sq)?.owner === seat).length;
    const wouldOwnAll = mine + 1 >= squares.length;
    rent = def.rents[0] * (wouldOwnAll ? 2 : 1);
  }

  let bonus = 1;
  if (def.group) {
    const squares = groupSquares(def.group);
    const mine = squares.filter((sq) => view.deeds.find((d) => d.square === sq)?.owner === seat).length;
    if (mine + 1 >= squares.length) bonus = 2.5;
    else if (mine + 1 === squares.length - 1) bonus = 1.6;
    else bonus = 1.05;

    // Denying an opponent who is one deed short is worth almost as much as
    // completing a group ourselves.
    for (const other of view.seats) {
      if (other.index === seat || other.status !== "active") continue;
      const theirs = squares.filter((sq) => view.deeds.find((d) => d.square === sq)?.owner === other.index).length;
      if (theirs === squares.length - 1) bonus += 0.8;
    }
  }

  return weight * rent * bonus;
}

/** What this seat should be willing to pay for a square at auction. */
export function auctionValue(view: BoardAiView, seat: number, square: number, profile: Profile): number {
  const def = BOARD_SQUARES[square];
  if (!def || def.price === undefined) return 0;
  const ratio = deedScore(view, seat, square) / Math.max(1, def.price);
  const scale = Math.max(0.5, Math.min(1.5, ratio / 0.15));
  const cap = Math.floor(def.price * 1.5);
  return Math.min(cap, Math.floor(def.price * scale));
}

/** Best deed to improve right now, or null. Respects the even-build rule. */
function bestBuild(view: BoardAiView, seat: number, ceiling: number): { square: number; cost: number } | null {
  let best: { square: number; cost: number; roi: number } | null = null;

  for (const groupId of Object.keys(BOARD_GROUPS)) {
    const squares = groupSquares(groupId);
    if (squares.length === 0) continue;
    if (!squares.every((sq) => view.deeds.find((d) => d.square === sq)?.owner === seat)) continue;
    if (squares.some((sq) => view.deeds.find((d) => d.square === sq)?.mortgaged)) continue;

    const cost = BOARD_GROUPS[groupId].improvementCost;
    const lowest = Math.min(...squares.map((sq) => view.deeds.find((d) => d.square === sq)?.improvements ?? 0));
    if (lowest >= Math.min(ceiling, BOARD_MAX_IMPROVEMENTS)) continue;
    const target = squares.find((sq) => (view.deeds.find((d) => d.square === sq)?.improvements ?? 0) === lowest);
    if (target === undefined) continue;

    const def = BOARD_SQUARES[target];
    if (!def.rents) continue;
    const current = lowest === 0 ? def.rents[0] * 2 : def.rents[lowest];
    const next = def.rents[lowest + 1] ?? current;
    const weight = SQUARE_LANDING_WEIGHTS[target] ?? 0;
    const roi = ((next - current) * weight) / Math.max(1, cost);

    // The classic "three houses" heuristic: the jump to the third improvement
    // is where rent stops being polite, so weight it up.
    const staged = lowest < 3 ? roi * 1.25 : roi;
    if (!best || staged > best.roi) best = { square: target, cost, roi: staged };
  }

  return best ? { square: best.square, cost: best.cost } : null;
}

/** Should it try to leave Cooldown Bay early? Early on the board is full of
 *  unowned deeds and sitting still is expensive; late on, moving is what costs
 *  you. */
function wantsOutOfCooldown(view: BoardAiView): boolean {
  const unowned = view.deeds.filter((d) => d.owner === null).length;
  const improved = view.deeds.reduce((n, d) => n + d.improvements, 0);
  return unowned > view.deeds.length * 0.3 && improved < 8;
}

/**
 * The AI's move for the current phase. Returns null when it has nothing to do
 * (it isn't this seat's decision). The registry loops on this — building
 * returns a `build` action and the next call decides again — so it must always
 * terminate at `endTurn`.
 */
export function chooseAction(
  view: BoardAiView,
  seatIndex: number,
  difficulty: BoardAiDifficulty,
  rng: Rng = Math.random,
): BoardAction | null {
  const profile = PROFILES[difficulty] ?? PROFILES.normal;
  const seat = view.seats[seatIndex];
  if (!seat || seat.status !== "active") return null;
  const phase = view.phase;
  const reserve = cashReserve(view, profile);

  switch (phase.kind) {
    case "awaitRoll": {
      if (seat.inCooldown && wantsOutOfCooldown(view)) {
        if (seat.pardons > 0) return { type: "usePardon" };
        if (seat.cash > reserve + 50) return { type: "payCooldownFee" };
      }
      return { type: "roll" };
    }

    case "awaitBuy": {
      const def = BOARD_SQUARES[phase.square];
      if (!def || def.price === undefined) return { type: "decline" };
      const affordable = seat.cash - def.price >= reserve;
      const ratio = deedScore(view, seatIndex, phase.square) / Math.max(1, def.price);
      let want = affordable && ratio >= profile.buyThreshold;
      // Second-guessing: flip the decision, but never into a purchase it
      // cannot actually pay for.
      if (profile.jitter > 0 && rng() < profile.jitter) want = !want && seat.cash >= def.price;
      return want ? { type: "buy" } : { type: "decline" };
    }

    case "auction": {
      const a = phase.auction;
      if (a.currentBidder !== seatIndex) return null;
      let ceiling = Math.min(auctionValue(view, seatIndex, a.square, profile), seat.cash - Math.floor(reserve / 2));
      if (profile.jitter > 0 && rng() < profile.jitter) ceiling = Math.floor(ceiling * 0.6);
      const next = a.highBid + Math.max(5, Math.floor(a.highBid * 0.1));
      if (next > ceiling || next > seat.cash) return { type: "pass" };
      return { type: "bid", amount: next };
    }

    case "awaitDebt": {
      if (phase.debtor !== seatIndex) return null;
      return autoRaiseStep(view as unknown as BoardState, seatIndex, phase.amount);
    }

    case "awaitEndTurn": {
      // Offer a trade before building. Without this the AI never assembles a
      // group, rents never rise above the salary, and the game literally never
      // ends — the simulation ran 363 of 500 games past 90,000 turns with zero
      // monopolies on the board before this existed.
      // The `offersThisTurn` check is what stops this looping: a DECLINED offer
      // is removed from `trades` and never touches `tradesUsed`, so gating on
      // either of those alone lets the AI re-propose forever.
      if (seat.offersThisTurn < BOARD_MAX_OFFERS_PER_TURN && !view.trades.some((t) => t.from === seatIndex)) {
        const offer = proposeGroupTrade(view, seatIndex, profile, rng);
        if (offer) return offer;
      }
      const build = bestBuild(view, seatIndex, profile.maxImprovements);
      if (build && seat.cash - build.cost >= reserve * profile.buildReserveMult) {
        if (!(profile.jitter > 0 && rng() < profile.jitter)) return { type: "build", square: build.square };
      }
      return { type: "endTurn" };
    }

    default:
      return null;
  }
}

/**
 * Offer the one deed that would complete a group, paying over the odds for it.
 *
 * Kept deliberately narrow: it only ever asks for a deed that completes a group
 * it already almost owns, only ever offers a deed that is NOT part of a group
 * it is close to completing, and every offer still goes through the same
 * `validateTrade` band and flow cap a human's would. That bounds what a human
 * can farm out of it, which matters because AI seats sit at gold tables where
 * the prize is real (if modest) value.
 */
function proposeGroupTrade(
  view: BoardAiView,
  seatIndex: number,
  profile: Profile,
  rng: Rng,
): BoardAction | null {
  const seat = view.seats[seatIndex];
  if (!profile.proposesTrades) return null;
  if (seat.tradesUsed >= BOARD_MAX_TRADES) return null;
  if (profile.jitter > 0 && rng() < profile.jitter) return null;

  const state = view as unknown as BoardState;
  const ownerOf = (sq: number) => view.deeds.find((d) => d.square === sq)?.owner ?? null;
  const deedOf = (sq: number) => view.deeds.find((d) => d.square === sq);

  // 1. Which single deed would complete a group for us?
  const wants: { square: number; from: number }[] = [];
  for (const groupId of Object.keys(BOARD_GROUPS)) {
    const squares = groupSquares(groupId);
    const mine = squares.filter((sq) => ownerOf(sq) === seatIndex);
    if (mine.length !== squares.length - 1) continue;
    const missing = squares.find((sq) => ownerOf(sq) !== seatIndex);
    if (missing === undefined) continue;
    const owner = ownerOf(missing);
    const deed = deedOf(missing);
    if (owner === null || owner === seatIndex || !deed) continue;
    if (deed.improvements > 0 || deed.mortgaged) continue;
    if (view.seats[owner]?.status !== "active") continue;
    if (view.seats[owner]?.tradesUsed >= BOARD_MAX_TRADES) continue;
    wants.push({ square: missing, from: owner });
  }
  if (wants.length === 0) return null;

  // Chase the most valuable completion first.
  wants.sort((a, b) => deedScore(view, seatIndex, b.square) - deedScore(view, seatIndex, a.square));
  const want = wants[0];

  // 2. What can we spare? Anything we own that isn't itself near-completing a
  //    group for us, has nothing built on it, and isn't mortgaged.
  const nearlyOurs = new Set<number>();
  for (const groupId of Object.keys(BOARD_GROUPS)) {
    const squares = groupSquares(groupId);
    const mine = squares.filter((sq) => ownerOf(sq) === seatIndex).length;
    if (mine >= squares.length - 1) for (const sq of squares) nearlyOurs.add(sq);
  }
  const spares = view.deeds
    .filter((d) => d.owner === seatIndex && !d.mortgaged && d.improvements === 0 && !nearlyOurs.has(d.square))
    .map((d) => d.square)
    .sort((a, b) => deedFaceValue(state, a) - deedFaceValue(state, b));
  if (spares.length === 0) return null;

  const takeValue = deedFaceValue(state, want.square);
  if (takeValue <= 0) return null;

  // 3. Build the smallest offer that clears the band, paying ~15% over so it
  //    is worth the other side's while.
  const target = Math.ceil(takeValue * 1.15);
  for (const spare of spares) {
    const spareValue = deedFaceValue(state, spare);
    const topUp = Math.max(0, target - spareValue);
    if (topUp > seat.cash - 200) continue; // keep something in hand
    const offer: BoardTradeOffer = {
      id: "probe",
      from: seatIndex,
      to: want.from,
      giveDeeds: [spare],
      giveCash: topUp,
      takeDeeds: [want.square],
      takeCash: 0,
    };
    if (!validateTrade(state, offer).ok) continue;
    return {
      type: "proposeTrade",
      to: want.from,
      giveDeeds: [spare],
      giveCash: topUp,
      takeDeeds: [want.square],
      takeCash: 0,
    };
  }
  // Cash alone can't buy a deed (a trade must move one), so if no spare works,
  // there is no offer to make this turn.
  return null;
}

/**
 * Every pending offer aimed at an AI seat, with its answer. The registry (and
 * the simulation) apply these after each action so an AI-to-AI offer doesn't
 * simply expire at the end of the turn that made it.
 */
export function aiTradeResponses(
  view: BoardAiView,
): { seat: number; tradeId: string; accept: boolean }[] {
  const out: { seat: number; tradeId: string; accept: boolean }[] = [];
  for (const offer of view.trades) {
    const target = view.seats[offer.to];
    if (!target || target.kind !== "ai" || target.status !== "active") continue;
    out.push({
      seat: offer.to,
      tradeId: offer.id,
      accept: evaluateTrade(view, offer.to, offer, target.aiDifficulty ?? "normal"),
    });
  }
  return out;
}

/**
 * Answer a trade offer. Values both sides at face (the same yardstick the
 * collusion band uses) plus the strategic score of the deeds involved, so the
 * AI won't hand over the last deed of someone else's monopoly for its cash
 * value alone.
 */
export function evaluateTrade(
  view: BoardAiView,
  seatIndex: number,
  offer: BoardTradeOffer,
  difficulty: BoardAiDifficulty,
): boolean {
  const profile = PROFILES[difficulty] ?? PROFILES.normal;
  if (offer.to !== seatIndex) return false;
  const state = view as unknown as BoardState;

  // What lands in our hands vs what leaves it.
  const incoming = sideValue(state, offer.giveDeeds, offer.giveCash);
  const outgoing = sideValue(state, offer.takeDeeds, offer.takeCash);

  const strategicIn = offer.giveDeeds.reduce((s, sq) => s + deedScore(view, seatIndex, sq), 0);
  const strategicOut = offer.takeDeeds.reduce((s, sq) => s + deedScore(view, offer.from, sq), 0);

  // Scale the strategic term into the same rough magnitude as face value.
  const gain = incoming + strategicIn * 6;
  const give = outgoing + strategicOut * 6;
  if (give <= 0) return true;
  return gain / give >= profile.tradeAccept;
}

/** Small helper for the registry: does this seat already hold a full group? */
export function hasMonopoly(state: BoardState, seat: number): boolean {
  return Object.keys(BOARD_GROUPS).some((g) => ownsGroup(state, seat, g));
}

/** Re-exported so the registry can settle an AI's debt without importing rules
 *  twice. */
export { deedAt };
