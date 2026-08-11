// District Deeds — the rules engine.
//
// PURE MODULE. No Colyseus, no pg, no fs, no Date.now(). Everything that could
// vary between two runs comes in through `BoardRandom`, which the caller binds
// to the table's committed seed chain (server/src/board/fairRoll.ts). That is
// what makes a table replayable from its seed, and it is also what lets
// scratchpad/board-sim.mjs run 500 games in a second with no server at all.
//
// The caller owns the state object. `applyAction` mutates it in place and
// returns { ok }; every branch validates fully BEFORE it touches anything, so
// a rejected action never leaves a half-applied state. The registry persists
// only on ok.

import {
  BOARD_COOLDOWN_FEE,
  BOARD_MAX_OFFERS_PER_TURN,
  BOARD_COOLDOWN_SQUARE,
  BOARD_COOLDOWN_TURNS,
  BOARD_DOUBLES_TO_COOLDOWN,
  BOARD_GROUPS,
  BOARD_LEDGER_CARDS,
  BOARD_MAX_IMPROVEMENTS,
  BOARD_RELAY_RENTS,
  BOARD_SALARY,
  BOARD_SIGNAL_CARDS,
  BOARD_SQUARES,
  BOARD_SQUARE_COUNT,
  BOARD_STARTING_CASH,
  BOARD_UTILITY_MULTIPLIERS,
  boardImprovementRefund,
  boardMortgageValue,
  boardTurnCap,
  boardUnmortgageCost,
  type BoardAction,
  type BoardActionResult,
  type BoardAiDifficulty,
  type BoardCard,
  type BoardDeedState,
  type BoardSeatState,
  type BoardState,
  type BoardTradeOffer,
} from "@metricbase/shared";

import { flowKey, validateTrade } from "./collusion.js";

/** Randomness, bound by the caller to the table's committed seed chain. The
 *  caller reads `nonce` back afterwards and persists it in the same
 *  transaction as the resulting state — that is what stops a roll being
 *  silently re-taken. */
export interface BoardRandom {
  dice(): [number, number];
  index(size: number): number;
  readonly nonce: number;
}

export interface BoardSeatInit {
  name: string;
  kind: "human" | "ai";
  aiDifficulty?: BoardAiDifficulty;
}

const LOG_CAP = 60;

// ── construction ────────────────────────────────────────────────────────────

function shuffled(ids: string[], rand: BoardRandom): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand.index(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newGame(seatInits: BoardSeatInit[], rand: BoardRandom): BoardState {
  const seats: BoardSeatState[] = seatInits.map((s, index) => ({
    index,
    name: s.name,
    kind: s.kind,
    aiDifficulty: s.aiDifficulty,
    cash: BOARD_STARTING_CASH,
    square: 0,
    inCooldown: false,
    cooldownTurns: 0,
    pardons: 0,
    status: "active",
    consecutiveDoubles: 0,
    autoPlayStrikes: 0,
    tradesUsed: 0,
    offersThisTurn: 0,
  }));

  const deeds: BoardDeedState[] = BOARD_SQUARES.filter((sq) => sq.price !== undefined).map((sq) => ({
    square: sq.index,
    owner: null,
    improvements: 0,
    mortgaged: false,
  }));

  return {
    seats,
    deeds,
    turn: 0,
    phase: { kind: "awaitRoll" },
    turnCount: 0,
    lastRoll: null,
    signalPile: shuffled(BOARD_SIGNAL_CARDS.map((c) => c.id), rand),
    ledgerPile: shuffled(BOARD_LEDGER_CARDS.map((c) => c.id), rand),
    trades: [],
    tradeFlow: {},
    log: [`The table is open. Everyone starts with ${BOARD_STARTING_CASH} ⌬.`],
  };
}

// ── small helpers ───────────────────────────────────────────────────────────

function log(state: BoardState, line: string) {
  state.log.push(line);
  if (state.log.length > LOG_CAP) state.log.splice(0, state.log.length - LOG_CAP);
}

export function deedAt(state: BoardState, square: number): BoardDeedState | undefined {
  return state.deeds.find((d) => d.square === square);
}

export function activeSeats(state: BoardState): BoardSeatState[] {
  return state.seats.filter((s) => s.status === "active");
}

function groupSquares(groupId: string): number[] {
  return BOARD_SQUARES.filter((s) => s.group === groupId).map((s) => s.index);
}

/** Does `seat` own every deed in this group (mortgaged or not)? */
export function ownsGroup(state: BoardState, seat: number, groupId: string): boolean {
  const squares = groupSquares(groupId);
  return squares.length > 0 && squares.every((sq) => deedAt(state, sq)?.owner === seat);
}

function countOwnedOfKind(state: BoardState, seat: number, kind: "relay" | "utility"): number {
  return BOARD_SQUARES.filter((s) => s.kind === kind && deedAt(state, s.index)?.owner === seat).length;
}

/** Rent owed for landing on `square`, given the roll that got you there. */
export function rentFor(state: BoardState, square: number, diceTotal: number): number {
  const def = BOARD_SQUARES[square];
  const deed = deedAt(state, square);
  if (!def || !deed || deed.owner === null || deed.mortgaged) return 0;

  if (def.kind === "relay") {
    const owned = countOwnedOfKind(state, deed.owner, "relay");
    return BOARD_RELAY_RENTS[Math.max(0, owned - 1)] ?? 0;
  }
  if (def.kind === "utility") {
    const owned = countOwnedOfKind(state, deed.owner, "utility");
    const mult = BOARD_UTILITY_MULTIPLIERS[Math.max(0, owned - 1)] ?? BOARD_UTILITY_MULTIPLIERS[0];
    return mult * diceTotal;
  }
  if (def.kind === "deed" && def.rents && def.group) {
    if (deed.improvements > 0) return def.rents[deed.improvements] ?? def.rents[0];
    // An unimproved deed rents double once its owner holds the whole group.
    return ownsGroup(state, deed.owner, def.group) ? def.rents[0] * 2 : def.rents[0];
  }
  return 0;
}

/** Everything a seat could raise by selling improvements and mortgaging. */
export function liquidationValue(state: BoardState, seat: number): number {
  let total = 0;
  for (const deed of state.deeds) {
    if (deed.owner !== seat) continue;
    const def = BOARD_SQUARES[deed.square];
    if (!def || def.price === undefined) continue;
    if (def.group) total += deed.improvements * boardImprovementRefund(def.group);
    if (!deed.mortgaged) total += boardMortgageValue(def.price);
  }
  return total;
}

/** Cash plus everything they could raise RIGHT NOW — the bankruptcy test.
 *  Deliberately pessimistic: it values assets at what the bank would actually
 *  pay for them under duress. */
export function netWorth(state: BoardState, seat: number): number {
  return state.seats[seat].cash + liquidationValue(state, seat);
}

/**
 * Standings value, used by the turn-cap settlement and shown in the UI.
 *
 * This is NOT `netWorth`. Liquidation values a deed at half its price, so
 * ranking on it would mean every purchase instantly halves your score and the
 * winning strategy is to sit on your starting cash and buy nothing. (The
 * simulation caught exactly that: a deliberately passive `easy` opponent was
 * beating `normal` 44% of the time.) Valuing deeds at face and improvements at
 * cost makes buying neutral, which leaves rent income — actually playing well
 * — as the thing that decides a table on the clock.
 */
export function settlementWorth(state: BoardState, seat: number): number {
  let total = state.seats[seat].cash;
  for (const deed of state.deeds) {
    if (deed.owner !== seat) continue;
    const def = BOARD_SQUARES[deed.square];
    if (!def || def.price === undefined) continue;
    total += deed.mortgaged ? def.price - boardMortgageValue(def.price) : def.price;
    if (def.group) total += deed.improvements * (BOARD_GROUPS[def.group]?.improvementCost ?? 0);
  }
  return total;
}

// ── money ───────────────────────────────────────────────────────────────────

/** Pay if they can; otherwise put the table into awaitDebt and return false. */
function charge(
  state: BoardState,
  seatIndex: number,
  amount: number,
  creditor: number | null,
  distributeTo?: number[],
): boolean {
  if (amount <= 0) return true;
  const seat = state.seats[seatIndex];
  if (seat.cash >= amount) {
    seat.cash -= amount;
    payOut(state, amount, creditor, distributeTo);
    return true;
  }
  state.phase = { kind: "awaitDebt", debtor: seatIndex, amount, creditor, distributeTo };
  return false;
}

function payOut(state: BoardState, amount: number, creditor: number | null, distributeTo?: number[]) {
  if (distributeTo && distributeTo.length > 0) {
    const each = Math.floor(amount / distributeTo.length);
    for (const idx of distributeTo) state.seats[idx].cash += each;
    return;
  }
  if (creditor !== null) state.seats[creditor].cash += amount;
  // creditor null = the bank; the credits simply leave play.
}

/**
 * Called after anything that could have raised cash while in debt, and again
 * at the top of every action as a safety net.
 *
 * The phase MUST be moved off awaitDebt before afterResolution runs —
 * afterResolution returns early on awaitDebt, so leaving it set here strands
 * the table in a phase where no action is legal and the auto-play loop spins
 * forever. (It did exactly that: 92,000 turns and no winner.)
 */
export function settleDebtIfPossible(state: BoardState): void {
  if (state.phase.kind !== "awaitDebt") return;
  const { debtor, amount, creditor, distributeTo } = state.phase;
  const seat = state.seats[debtor];
  if (seat.cash < amount) return;
  seat.cash -= amount;
  payOut(state, amount, creditor, distributeTo);
  log(state, `${seat.name} settled ${amount} ⌬.`);
  state.phase = { kind: "awaitEndTurn" };
  afterResolution(state, false);
}

const trySettleDebt = settleDebtIfPossible;

// ── movement + landing ──────────────────────────────────────────────────────

function advance(state: BoardState, seatIndex: number, steps: number): void {
  const seat = state.seats[seatIndex];
  const raw = seat.square + steps;
  if (steps > 0 && raw >= BOARD_SQUARE_COUNT) {
    seat.cash += BOARD_SALARY;
    log(state, `${seat.name} passed Uplink and collected ${BOARD_SALARY} ⌬.`);
  }
  seat.square = ((raw % BOARD_SQUARE_COUNT) + BOARD_SQUARE_COUNT) % BOARD_SQUARE_COUNT;
}

function jumpTo(state: BoardState, seatIndex: number, target: number, collectSalary: boolean): void {
  const seat = state.seats[seatIndex];
  if (collectSalary && target < seat.square) {
    seat.cash += BOARD_SALARY;
    log(state, `${seat.name} passed Uplink and collected ${BOARD_SALARY} ⌬.`);
  }
  seat.square = target;
}

function sendToCooldown(state: BoardState, seatIndex: number): void {
  const seat = state.seats[seatIndex];
  seat.square = BOARD_COOLDOWN_SQUARE;
  seat.inCooldown = true;
  seat.cooldownTurns = 0;
  seat.consecutiveDoubles = 0;
  log(state, `${seat.name} was sent to Cooldown Bay.`);
}

function nextOfKind(from: number, kind: "relay" | "utility"): number {
  for (let step = 1; step <= BOARD_SQUARE_COUNT; step++) {
    const idx = (from + step) % BOARD_SQUARE_COUNT;
    if (BOARD_SQUARES[idx].kind === kind) return idx;
  }
  return from;
}

function drawCard(state: BoardState, pile: "signal" | "ledger"): BoardCard | null {
  const ids = pile === "signal" ? state.signalPile : state.ledgerPile;
  const defs = pile === "signal" ? BOARD_SIGNAL_CARDS : BOARD_LEDGER_CARDS;
  if (ids.length === 0) return null;
  const id = ids.shift()!;
  const card = defs.find((c) => c.id === id) ?? null;
  // A pardon is held by the player and returns to the bottom when spent;
  // everything else goes straight back so the deck never runs dry.
  if (card && card.effect.kind !== "cooldownPardon") ids.push(id);
  return card;
}

function returnPardon(state: BoardState): void {
  // Put it back wherever it came from — either deck is fine, the card is the
  // same effect. Prefer signal so the piles stay near their original sizes.
  const inSignal = BOARD_SIGNAL_CARDS.find((c) => c.effect.kind === "cooldownPardon");
  if (inSignal && !state.signalPile.includes(inSignal.id)) {
    state.signalPile.push(inSignal.id);
    return;
  }
  const inLedger = BOARD_LEDGER_CARDS.find((c) => c.effect.kind === "cooldownPardon");
  if (inLedger && !state.ledgerPile.includes(inLedger.id)) state.ledgerPile.push(inLedger.id);
}

function applyCard(state: BoardState, seatIndex: number, card: BoardCard, diceTotal: number): void {
  const seat = state.seats[seatIndex];
  log(state, `${seat.name}: ${card.text}`);
  const e = card.effect;

  switch (e.kind) {
    case "cash":
      if (e.amount >= 0) seat.cash += e.amount;
      else charge(state, seatIndex, -e.amount, null);
      return;

    case "collectFromEach": {
      for (const other of activeSeats(state)) {
        if (other.index === seatIndex) continue;
        const take = Math.min(other.cash, e.amount);
        other.cash -= take;
        seat.cash += take;
      }
      return;
    }

    case "payEach": {
      const others = activeSeats(state).filter((s) => s.index !== seatIndex).map((s) => s.index);
      if (others.length === 0) return;
      charge(state, seatIndex, e.amount * others.length, null, others);
      return;
    }

    case "moveTo":
      jumpTo(state, seatIndex, e.square, e.collectSalary);
      resolveLanding(state, seatIndex, diceTotal);
      return;

    case "moveBy":
      advance(state, seatIndex, e.steps);
      resolveLanding(state, seatIndex, diceTotal);
      return;

    case "nearestRelay": {
      const target = nextOfKind(seat.square, "relay");
      jumpTo(state, seatIndex, target, true);
      const deed = deedAt(state, target);
      if (!deed || deed.owner === null) {
        state.phase = { kind: "awaitBuy", square: target };
        return;
      }
      if (deed.owner === seatIndex || deed.mortgaged) return;
      const rent = rentFor(state, target, diceTotal) * 2;
      log(state, `${seat.name} owes ${rent} ⌬ (double) to ${state.seats[deed.owner].name}.`);
      charge(state, seatIndex, rent, deed.owner);
      return;
    }

    case "nearestUtility": {
      const target = nextOfKind(seat.square, "utility");
      jumpTo(state, seatIndex, target, true);
      const deed = deedAt(state, target);
      if (!deed || deed.owner === null) {
        state.phase = { kind: "awaitBuy", square: target };
        return;
      }
      if (deed.owner === seatIndex || deed.mortgaged) return;
      const rent = 10 * diceTotal;
      log(state, `${seat.name} owes ${rent} ⌬ to ${state.seats[deed.owner].name}.`);
      charge(state, seatIndex, rent, deed.owner);
      return;
    }

    case "goToCooldown":
      sendToCooldown(state, seatIndex);
      return;

    case "repairs": {
      let owed = 0;
      for (const deed of state.deeds) {
        if (deed.owner !== seatIndex) continue;
        if (deed.improvements === BOARD_MAX_IMPROVEMENTS) owed += e.perEstate;
        else owed += deed.improvements * e.perImprovement;
      }
      if (owed > 0) charge(state, seatIndex, owed, null);
      return;
    }

    case "cooldownPardon":
      seat.pardons += 1;
      return;
  }
}

function resolveLanding(state: BoardState, seatIndex: number, diceTotal: number): void {
  const seat = state.seats[seatIndex];
  const def = BOARD_SQUARES[seat.square];
  if (!def) return;

  switch (def.kind) {
    case "deed":
    case "relay":
    case "utility": {
      const deed = deedAt(state, seat.square);
      if (!deed) return;
      if (deed.owner === null) {
        state.phase = { kind: "awaitBuy", square: seat.square };
        return;
      }
      if (deed.owner === seatIndex || deed.mortgaged) return;
      const rent = rentFor(state, seat.square, diceTotal);
      if (rent <= 0) return;
      log(state, `${seat.name} owes ${rent} ⌬ to ${state.seats[deed.owner].name} for ${def.label}.`);
      charge(state, seatIndex, rent, deed.owner);
      return;
    }

    case "tax":
      log(state, `${seat.name} paid ${def.amount ?? 0} ⌬ — ${def.label}.`);
      charge(state, seatIndex, def.amount ?? 0, null);
      return;

    case "signal": {
      const card = drawCard(state, "signal");
      if (card) applyCard(state, seatIndex, card, diceTotal);
      return;
    }

    case "ledger": {
      const card = drawCard(state, "ledger");
      if (card) applyCard(state, seatIndex, card, diceTotal);
      return;
    }

    case "sentToCooldown":
      sendToCooldown(state, seatIndex);
      return;

    case "uplink":
    case "freeCache":
    case "cooldownBay":
      return;
  }
}

/** Decide what the table waits for once a landing (or a debt) has resolved. */
function afterResolution(state: BoardState, rolledDoubles: boolean): void {
  if (state.phase.kind === "awaitBuy" || state.phase.kind === "auction") return;
  if (state.phase.kind === "awaitDebt" || state.phase.kind === "done") return;
  const seat = state.seats[state.turn];
  if (rolledDoubles && !seat.inCooldown && seat.status === "active") {
    state.phase = { kind: "awaitRoll" };
    return;
  }
  state.phase = { kind: "awaitEndTurn" };
}

// ── bankruptcy + winning ────────────────────────────────────────────────────

function releaseDeeds(state: BoardState, seatIndex: number, creditor: number | null): void {
  for (const deed of state.deeds) {
    if (deed.owner !== seatIndex) continue;
    if (creditor !== null) {
      deed.owner = creditor;
      // Improvements do not transfer — they are sold back to the bank first.
      deed.improvements = 0;
    } else {
      deed.owner = null;
      deed.improvements = 0;
      deed.mortgaged = false;
    }
  }
}

/** Returns true when removing this seat ended the table. */
function endSeat(state: BoardState, seatIndex: number, creditor: number | null, why: "bankrupt" | "forfeit"): boolean {
  const seat = state.seats[seatIndex];
  if (seat.status !== "active") return state.phase.kind === "done";

  // Improvements are sold back before anything moves, so a creditor inherits
  // deeds and cash, never buildings.
  for (const deed of state.deeds) {
    if (deed.owner !== seatIndex || deed.improvements === 0) continue;
    const def = BOARD_SQUARES[deed.square];
    if (def?.group) seat.cash += deed.improvements * boardImprovementRefund(def.group);
    deed.improvements = 0;
  }

  if (creditor !== null && state.seats[creditor].status === "active") {
    state.seats[creditor].cash += seat.cash;
    state.seats[creditor].pardons += seat.pardons;
  } else {
    for (let i = 0; i < seat.pardons; i++) returnPardon(state);
  }
  seat.cash = 0;
  seat.pardons = 0;
  releaseDeeds(state, seatIndex, creditor !== null && state.seats[creditor].status === "active" ? creditor : null);
  seat.status = why;
  // Any pending offers involving this seat are dead.
  state.trades = state.trades.filter((t) => t.from !== seatIndex && t.to !== seatIndex);

  log(state, why === "bankrupt" ? `${seat.name} is out — bankrupt.` : `${seat.name} forfeited their seat.`);
  return checkWin(state);
}

function checkWin(state: BoardState): boolean {
  const remaining = activeSeats(state);
  if (remaining.length > 1) return false;
  if (remaining.length === 1) {
    remaining[0].status = "won";
    state.phase = { kind: "done", winner: remaining[0].index };
    log(state, `${remaining[0].name} takes the table.`);
  } else {
    state.phase = { kind: "done", winner: null };
    log(state, "Nobody is left at the table.");
  }
  return true;
}

/** The registry calls this when a disconnect grace or auto-play strike limit
 *  expires. Assets go to the bank, never to an opponent — a forfeit must not
 *  reward whoever happened to be owed money at the time. */
export function forfeitSeat(state: BoardState, seatIndex: number): void {
  const finished = endSeat(state, seatIndex, null, "forfeit");
  if (!finished && state.turn === seatIndex) endTurn(state);
}

// ── turn flow ───────────────────────────────────────────────────────────────

function nextActiveSeat(state: BoardState, from: number): number {
  for (let step = 1; step <= state.seats.length; step++) {
    const idx = (from + step) % state.seats.length;
    if (state.seats[idx].status === "active") return idx;
  }
  return from;
}

function endTurn(state: BoardState): void {
  if (state.phase.kind === "done") return;
  state.seats[state.turn].consecutiveDoubles = 0;
  for (const seat of state.seats) seat.offersThisTurn = 0;
  state.turn = nextActiveSeat(state, state.turn);
  state.turnCount += 1;
  state.phase = { kind: "awaitRoll" };
  // Offers do not survive the turn that proposed them.
  state.trades = [];
  if (state.turnCount >= boardTurnCap(state.seats.length)) settleOnNetWorth(state);
}

/**
 * The turn-cap backstop: richest net worth takes the table. Ties break toward
 * the lower seat index, which is arbitrary but deterministic — and a tie on
 * exact net worth across a whole game is vanishingly unlikely anyway.
 */
function settleOnNetWorth(state: BoardState): void {
  const contenders = activeSeats(state);
  if (contenders.length === 0) {
    state.phase = { kind: "done", winner: null };
    return;
  }
  let best = contenders[0];
  let bestWorth = settlementWorth(state, best.index);
  for (const seat of contenders.slice(1)) {
    const worth = settlementWorth(state, seat.index);
    if (worth > bestWorth) {
      best = seat;
      bestWorth = worth;
    }
  }
  for (const seat of contenders) if (seat.index !== best.index) seat.status = "bankrupt";
  best.status = "won";
  state.phase = { kind: "done", winner: best.index };
  log(state, `Time. ${best.name} takes the table on net worth (${bestWorth} ⌬).`);
}

// ── auctions ────────────────────────────────────────────────────────────────

function startAuction(state: BoardState, square: number): void {
  const contenders = activeSeats(state).map((s) => s.index);
  if (contenders.length === 0) {
    afterResolution(state, false);
    return;
  }
  state.phase = {
    kind: "auction",
    auction: { square, highBid: 0, highBidder: null, currentBidder: contenders[0], passed: [] },
  };
  log(state, `${BOARD_SQUARES[square].label} goes to auction.`);
}

function auctionContenders(state: BoardState, passed: number[]): number[] {
  return activeSeats(state).map((s) => s.index).filter((i) => !passed.includes(i));
}

function stepAuction(state: BoardState): void {
  if (state.phase.kind !== "auction") return;
  const a = state.phase.auction;
  const remaining = auctionContenders(state, a.passed);

  if (remaining.length <= 1) {
    // Settle. One contender with the high bid wins; nobody bidding = no sale.
    if (a.highBidder !== null && a.highBid > 0) {
      const winner = state.seats[a.highBidder];
      const deed = deedAt(state, a.square);
      if (deed) {
        winner.cash -= a.highBid;
        deed.owner = a.highBidder;
      }
      log(state, `${winner.name} took ${BOARD_SQUARES[a.square].label} at auction for ${a.highBid} ⌬.`);
    } else {
      log(state, `${BOARD_SQUARES[a.square].label} went unsold.`);
    }
    state.phase = { kind: "awaitEndTurn" };
    afterResolution(state, false);
    return;
  }

  // Next contender in seat order after the current one.
  const start = remaining.indexOf(a.currentBidder);
  const next = remaining[(Math.max(0, start) + 1) % remaining.length];
  a.currentBidder = next;
}

// ── trades ──────────────────────────────────────────────────────────────────

function tradeStructurallyLegal(state: BoardState, offer: BoardTradeOffer): string | null {
  const from = state.seats[offer.from];
  const to = state.seats[offer.to];
  if (offer.giveCash < 0 || offer.takeCash < 0) return "Cash amounts can't be negative.";
  if (!Number.isInteger(offer.giveCash) || !Number.isInteger(offer.takeCash)) return "Cash has to be a whole number.";
  if (from.cash < offer.giveCash) return "You don't have that much cash.";
  if (to.cash < offer.takeCash) return `${to.name} doesn't have that much cash.`;

  for (const sq of offer.giveDeeds) {
    const deed = deedAt(state, sq);
    if (!deed || deed.owner !== offer.from) return "You don't own one of those deeds.";
    if (deed.improvements > 0) return "Sell the improvements on a deed before trading it.";
  }
  for (const sq of offer.takeDeeds) {
    const deed = deedAt(state, sq);
    if (!deed || deed.owner !== offer.to) return `${to.name} doesn't own one of those deeds.`;
    if (deed.improvements > 0) return "That deed has improvements on it and can't be traded yet.";
  }
  if (new Set(offer.giveDeeds).size !== offer.giveDeeds.length) return "Duplicate deed in the offer.";
  if (new Set(offer.takeDeeds).size !== offer.takeDeeds.length) return "Duplicate deed in the offer.";
  return null;
}

function applyTrade(state: BoardState, offer: BoardTradeOffer, netToResponder: number): void {
  const from = state.seats[offer.from];
  const to = state.seats[offer.to];

  from.cash -= offer.giveCash;
  to.cash += offer.giveCash;
  to.cash -= offer.takeCash;
  from.cash += offer.takeCash;

  for (const sq of offer.giveDeeds) {
    const deed = deedAt(state, sq);
    if (deed) deed.owner = offer.to;
  }
  for (const sq of offer.takeDeeds) {
    const deed = deedAt(state, sq);
    if (deed) deed.owner = offer.from;
  }

  from.tradesUsed += 1;
  to.tradesUsed += 1;
  if (netToResponder > 0) {
    const key = flowKey(offer.from, offer.to);
    state.tradeFlow[key] = (state.tradeFlow[key] ?? 0) + netToResponder;
  }
  log(state, `${from.name} and ${to.name} agreed a trade.`);
}

// ── the action entry point ──────────────────────────────────────────────────

const OK: BoardActionResult = { ok: true };
const fail = (error: string): BoardActionResult => ({ ok: false, error });

/** True when this seat is allowed to act right now for this action type. */
function mayAct(state: BoardState, seatIndex: number, action: BoardAction): boolean {
  const phase = state.phase;
  if (action.type === "respondTrade") return true; // guarded by the offer's target
  if (action.type === "bid" || action.type === "pass") {
    return phase.kind === "auction" && phase.auction.currentBidder === seatIndex;
  }
  // Asset management is allowed on your own turn, or while you are the one in
  // debt — that is exactly when you need to raise cash.
  if (
    action.type === "mortgage" ||
    action.type === "unmortgage" ||
    action.type === "build" ||
    action.type === "sellImprovement" ||
    action.type === "proposeTrade" ||
    action.type === "declareBankrupt"
  ) {
    if (phase.kind === "awaitDebt") return phase.debtor === seatIndex;
    return state.turn === seatIndex;
  }
  return state.turn === seatIndex;
}

export function applyAction(
  state: BoardState,
  seatIndex: number,
  action: BoardAction,
  rand: BoardRandom,
): BoardActionResult {
  // Safety net: a debt that can be paid must never be able to hold the table
  // in a phase where nothing is legal.
  settleDebtIfPossible(state);
  if (state.phase.kind === "done") return fail("This table has finished.");
  const seat = state.seats[seatIndex];
  if (!seat) return fail("That seat isn't at this table.");
  if (seat.status !== "active" && action.type !== "respondTrade") return fail("You're out of this game.");
  if (!mayAct(state, seatIndex, action)) return fail("It isn't your move.");

  switch (action.type) {
    // ── roll ──
    case "roll": {
      if (state.phase.kind !== "awaitRoll") return fail("You can't roll right now.");
      const [d1, d2] = rand.dice();
      const total = d1 + d2;
      const doubles = d1 === d2;
      state.lastRoll = { d1, d2 };
      log(state, `${seat.name} rolled ${d1} and ${d2}.`);

      if (seat.inCooldown) {
        if (doubles) {
          seat.inCooldown = false;
          seat.cooldownTurns = 0;
          log(state, `${seat.name} rolled doubles and left Cooldown Bay.`);
          advance(state, seatIndex, total);
          resolveLanding(state, seatIndex, total);
          // No extra roll for doubles out of cooldown.
          afterResolution(state, false);
          return OK;
        }
        seat.cooldownTurns += 1;
        if (seat.cooldownTurns >= BOARD_COOLDOWN_TURNS) {
          seat.inCooldown = false;
          seat.cooldownTurns = 0;
          log(state, `${seat.name} paid the ${BOARD_COOLDOWN_FEE} ⌬ release fee.`);
          const paid = charge(state, seatIndex, BOARD_COOLDOWN_FEE, null);
          if (!paid) return OK; // awaitDebt; the move happens once it settles
          advance(state, seatIndex, total);
          resolveLanding(state, seatIndex, total);
          afterResolution(state, false);
          return OK;
        }
        state.phase = { kind: "awaitEndTurn" };
        return OK;
      }

      if (doubles) {
        seat.consecutiveDoubles += 1;
        if (seat.consecutiveDoubles >= BOARD_DOUBLES_TO_COOLDOWN) {
          log(state, `${seat.name} rolled a third double.`);
          sendToCooldown(state, seatIndex);
          state.phase = { kind: "awaitEndTurn" };
          return OK;
        }
      }

      advance(state, seatIndex, total);
      resolveLanding(state, seatIndex, total);
      afterResolution(state, doubles);
      return OK;
    }

    // ── buy / decline ──
    case "buy": {
      if (state.phase.kind !== "awaitBuy") return fail("There's nothing to buy.");
      const square = state.phase.square;
      const def = BOARD_SQUARES[square];
      const deed = deedAt(state, square);
      if (!def || !deed || def.price === undefined) return fail("That square isn't for sale.");
      if (deed.owner !== null) return fail("That deed is already owned.");
      if (seat.cash < def.price) return fail("You can't afford that.");
      seat.cash -= def.price;
      deed.owner = seatIndex;
      log(state, `${seat.name} bought ${def.label} for ${def.price} ⌬.`);
      state.phase = { kind: "awaitEndTurn" };
      afterResolution(state, false);
      return OK;
    }

    case "decline": {
      if (state.phase.kind !== "awaitBuy") return fail("There's nothing to decline.");
      startAuction(state, state.phase.square);
      return OK;
    }

    // ── auction ──
    case "bid": {
      if (state.phase.kind !== "auction") return fail("No auction is running.");
      const a = state.phase.auction;
      if (!Number.isInteger(action.amount) || action.amount <= a.highBid) {
        return fail(`You have to go above ${a.highBid} ⌬.`);
      }
      if (action.amount > seat.cash) return fail("You don't have that much cash.");
      a.highBid = action.amount;
      a.highBidder = seatIndex;
      log(state, `${seat.name} offered ${action.amount} ⌬.`);
      stepAuction(state);
      return OK;
    }

    case "pass": {
      if (state.phase.kind !== "auction") return fail("No auction is running.");
      const a = state.phase.auction;
      if (!a.passed.includes(seatIndex)) a.passed.push(seatIndex);
      stepAuction(state);
      return OK;
    }

    // ── property management ──
    case "build": {
      const deed = deedAt(state, action.square);
      const def = BOARD_SQUARES[action.square];
      if (!deed || !def || def.kind !== "deed" || !def.group) return fail("You can't build there.");
      if (deed.owner !== seatIndex) return fail("You don't own that deed.");
      if (!ownsGroup(state, seatIndex, def.group)) return fail("You need the whole group first.");
      if (deed.improvements >= BOARD_MAX_IMPROVEMENTS) return fail("That's fully improved.");
      const squares = groupSquares(def.group);
      if (squares.some((sq) => deedAt(state, sq)?.mortgaged)) {
        return fail("Lift the mortgages in that group first.");
      }
      const lowest = Math.min(...squares.map((sq) => deedAt(state, sq)?.improvements ?? 0));
      if (deed.improvements > lowest) return fail("Improve the group evenly.");
      const cost = BOARD_GROUPS[def.group].improvementCost;
      if (seat.cash < cost) return fail("You can't afford that.");
      seat.cash -= cost;
      deed.improvements += 1;
      log(state, `${seat.name} improved ${def.label}.`);
      return OK;
    }

    case "sellImprovement": {
      const deed = deedAt(state, action.square);
      const def = BOARD_SQUARES[action.square];
      if (!deed || !def || !def.group) return fail("Nothing to sell there.");
      if (deed.owner !== seatIndex) return fail("You don't own that deed.");
      if (deed.improvements <= 0) return fail("There's nothing built there.");
      const squares = groupSquares(def.group);
      const highest = Math.max(...squares.map((sq) => deedAt(state, sq)?.improvements ?? 0));
      if (deed.improvements < highest) return fail("Sell down evenly across the group.");
      deed.improvements -= 1;
      seat.cash += boardImprovementRefund(def.group);
      log(state, `${seat.name} sold an improvement on ${def.label}.`);
      trySettleDebt(state);
      return OK;
    }

    case "mortgage": {
      const deed = deedAt(state, action.square);
      const def = BOARD_SQUARES[action.square];
      if (!deed || !def || def.price === undefined) return fail("You can't mortgage that.");
      if (deed.owner !== seatIndex) return fail("You don't own that deed.");
      if (deed.mortgaged) return fail("That's already mortgaged.");
      if (def.group && groupSquares(def.group).some((sq) => (deedAt(state, sq)?.improvements ?? 0) > 0)) {
        return fail("Sell the improvements in that group first.");
      }
      deed.mortgaged = true;
      seat.cash += boardMortgageValue(def.price);
      log(state, `${seat.name} mortgaged ${def.label}.`);
      trySettleDebt(state);
      return OK;
    }

    case "unmortgage": {
      const deed = deedAt(state, action.square);
      const def = BOARD_SQUARES[action.square];
      if (!deed || !def || def.price === undefined) return fail("You can't lift that.");
      if (deed.owner !== seatIndex) return fail("You don't own that deed.");
      if (!deed.mortgaged) return fail("That isn't mortgaged.");
      const cost = boardUnmortgageCost(def.price);
      if (seat.cash < cost) return fail("You can't afford to lift that.");
      seat.cash -= cost;
      deed.mortgaged = false;
      log(state, `${seat.name} lifted the mortgage on ${def.label}.`);
      return OK;
    }

    // ── cooldown ──
    case "payCooldownFee": {
      if (!seat.inCooldown) return fail("You're not in Cooldown Bay.");
      if (state.phase.kind !== "awaitRoll") return fail("You can't do that right now.");
      if (seat.cash < BOARD_COOLDOWN_FEE) return fail("You can't afford the release fee.");
      seat.cash -= BOARD_COOLDOWN_FEE;
      seat.inCooldown = false;
      seat.cooldownTurns = 0;
      log(state, `${seat.name} paid ${BOARD_COOLDOWN_FEE} ⌬ to leave Cooldown Bay.`);
      return OK;
    }

    case "usePardon": {
      if (!seat.inCooldown) return fail("You're not in Cooldown Bay.");
      if (seat.pardons <= 0) return fail("You don't have a pardon.");
      seat.pardons -= 1;
      seat.inCooldown = false;
      seat.cooldownTurns = 0;
      returnPardon(state);
      log(state, `${seat.name} used a pardon and left Cooldown Bay.`);
      return OK;
    }

    // ── trading ──
    case "proposeTrade": {
      const offer: BoardTradeOffer = {
        id: `t${state.turnCount}-${seatIndex}-${state.trades.length}`,
        from: seatIndex,
        to: action.to,
        giveDeeds: [...action.giveDeeds],
        giveCash: action.giveCash,
        takeDeeds: [...action.takeDeeds],
        takeCash: action.takeCash,
      };
      const structural = tradeStructurallyLegal(state, offer);
      if (structural) return fail(structural);
      const check = validateTrade(state, offer);
      if (!check.ok) return fail(check.error ?? "That trade isn't allowed.");
      if (state.trades.some((t) => t.from === seatIndex && t.to === action.to)) {
        return fail("You already have an offer open with them.");
      }
      if (seat.offersThisTurn >= BOARD_MAX_OFFERS_PER_TURN) {
        return fail(`You can make ${BOARD_MAX_OFFERS_PER_TURN} offers per turn.`);
      }
      seat.offersThisTurn += 1;
      state.trades.push(offer);
      log(state, `${seat.name} offered ${state.seats[action.to].name} a trade.`);
      return OK;
    }

    case "respondTrade": {
      const idx = state.trades.findIndex((t) => t.id === action.tradeId);
      if (idx < 0) return fail("That offer is gone.");
      const offer = state.trades[idx];
      if (offer.to !== seatIndex) return fail("That offer isn't yours to answer.");
      state.trades.splice(idx, 1);
      if (!action.accept) {
        log(state, `${seat.name} declined the trade.`);
        return OK;
      }
      // Re-validate: the board may have moved since the offer was made.
      const structural = tradeStructurallyLegal(state, offer);
      if (structural) return fail(structural);
      const check = validateTrade(state, offer);
      if (!check.ok) return fail(check.error ?? "That trade isn't allowed any more.");
      applyTrade(state, offer, check.netToResponder ?? 0);
      trySettleDebt(state);
      return OK;
    }

    // ── ending ──
    case "declareBankrupt": {
      const creditor = state.phase.kind === "awaitDebt" ? state.phase.creditor : null;
      const finished = endSeat(state, seatIndex, creditor, "bankrupt");
      if (!finished) {
        if (state.turn === seatIndex) endTurn(state);
        else state.phase = { kind: "awaitEndTurn" };
      }
      return OK;
    }

    case "endTurn": {
      if (state.phase.kind !== "awaitEndTurn") return fail("You can't end your turn yet.");
      endTurn(state);
      return OK;
    }
  }
}

// ── auto-play ───────────────────────────────────────────────────────────────

/**
 * What the turn timer plays on a seat's behalf. Deterministic and published in
 * the UI so a timeout is never a surprise.
 *
 * The one rule worth stating: it never BUYS. Spending someone's credits without
 * instruction is the difference between "the clock moved the game on" and "the
 * clock made a decision for me", and only the second one generates a complaint.
 * Declining sends the deed to auction, which keeps the board liquid anyway.
 */
export function autoAction(state: BoardState, seatIndex: number): BoardAction | null {
  const phase = state.phase;
  const seat = state.seats[seatIndex];
  if (!seat || seat.status !== "active") return null;

  switch (phase.kind) {
    case "awaitRoll":
      return { type: "roll" };
    case "awaitBuy":
      return { type: "decline" };
    case "auction":
      return phase.auction.currentBidder === seatIndex ? { type: "pass" } : null;
    case "awaitEndTurn":
      return { type: "endTurn" };
    case "awaitDebt": {
      if (phase.debtor !== seatIndex) return null;
      return autoRaiseStep(state, seatIndex, phase.amount);
    }
    default:
      return null;
  }
}

/**
 * One step of the published debt ladder:
 *   1. sell improvements, cheapest group first, highest-built deed first
 *   2. mortgage unimproved deeds, cheapest first
 *   3. bankrupt
 * Called repeatedly by the sweep until the debt settles or the seat is out.
 */
export function autoRaiseStep(state: BoardState, seatIndex: number, need: number): BoardAction {
  const seat = state.seats[seatIndex];
  // Never return an action that is illegal in awaitDebt — that is how the
  // auto-play loop spins. If the debt is already covered, settling is the
  // caller's job (settleDebtIfPossible); mortgaging one more deed is harmless.
  const owned = state.deeds.filter((d) => d.owner === seatIndex);
  void need;

  const improved = owned
    .filter((d) => d.improvements > 0)
    .sort((a, b) => {
      const ga = BOARD_SQUARES[a.square].group ?? "";
      const gb = BOARD_SQUARES[b.square].group ?? "";
      const ca = BOARD_GROUPS[ga]?.improvementCost ?? 0;
      const cb = BOARD_GROUPS[gb]?.improvementCost ?? 0;
      if (ca !== cb) return ca - cb;
      return b.improvements - a.improvements;
    });
  if (improved.length > 0) {
    // Respect the even-sell rule: pick the highest-built deed in that group.
    const group = BOARD_SQUARES[improved[0].square].group!;
    const squares = groupSquares(group);
    const highest = Math.max(...squares.map((sq) => deedAt(state, sq)?.improvements ?? 0));
    const target = squares.find((sq) => (deedAt(state, sq)?.improvements ?? 0) === highest)!;
    return { type: "sellImprovement", square: target };
  }

  const mortgageable = owned
    .filter((d) => !d.mortgaged && d.improvements === 0)
    .filter((d) => {
      const g = BOARD_SQUARES[d.square].group;
      return !g || groupSquares(g).every((sq) => (deedAt(state, sq)?.improvements ?? 0) === 0);
    })
    .sort((a, b) => (BOARD_SQUARES[a.square].price ?? 0) - (BOARD_SQUARES[b.square].price ?? 0));
  if (mortgageable.length > 0) return { type: "mortgage", square: mortgageable[0].square };

  return { type: "declareBankrupt" };
}
