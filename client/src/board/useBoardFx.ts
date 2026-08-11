// Turns the long-poll's state snapshots into things you can see and hear.
//
// The transport delivers whole boards, not events — a poll says "here is the
// table now", never "Brill paid you 240". So the feel of the game has to be
// recovered by diffing consecutive snapshots: cash that moved, tokens that
// moved, dice that changed, seats that went out. That diff is this hook.
//
// It deliberately does NOT fire on the first snapshot. Joining a table already
// in progress would otherwise replay every cash difference at once as a wall of
// toasts and a pile of coin sounds.

import { BOARD_SQUARES, type BoardState, type BoardStatePayload } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";

import { playSfx } from "../audio/soundEffects";

export interface BoardToast {
  id: number;
  text: string;
  tone: "good" | "bad" | "info";
}

export interface CashDelta {
  id: number;
  seat: number;
  amount: number;
}

export interface BoardFx {
  toasts: BoardToast[];
  cashDeltas: CashDelta[];
  /** True while the dice are tumbling; the board shows a scramble, not a value. */
  rolling: boolean;
  /** Square each token should be DRAWN on — lags the real position while hopping. */
  drawnSquares: Record<number, number>;
  /** Set when the table has just finished, for the celebration overlay. */
  finished: { winner: number | null } | null;
  dismissFinished: () => void;
}

const TOAST_MS = 4200;
const HOP_MS = 140;
const ROLL_MS = 620;

/** Forward distance from a to b around the ring — tokens never move backwards
 *  visually except on an explicit "go back three squares". */
function forwardSteps(from: number, to: number): number {
  return (to - from + BOARD_SQUARES.length) % BOARD_SQUARES.length;
}

export function useBoardFx(payload: BoardStatePayload | null, mySeat: number | null): BoardFx {
  const [toasts, setToasts] = useState<BoardToast[]>([]);
  const [cashDeltas, setCashDeltas] = useState<CashDelta[]>([]);
  const [rolling, setRolling] = useState(false);
  const [drawnSquares, setDrawnSquares] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState<{ winner: number | null } | null>(null);

  const prev = useRef<BoardState | null>(null);
  const prevLogLen = useRef(0);
  const nextId = useRef(1);
  const hopTimers = useRef<number[]>([]);
  const wasMyTurn = useRef(false);
  // Lets the diff effect read the latest drawn positions without listing them
  // as a dependency, which would re-run the whole diff on every hop.
  const drawnSquaresRef = useRef(drawnSquares);
  drawnSquaresRef.current = drawnSquares;

  useEffect(
    () => () => {
      for (const t of hopTimers.current) window.clearTimeout(t);
      hopTimers.current = [];
    },
    [],
  );

  useEffect(() => {
    const state = payload?.state;
    if (!state) return;

    const before = prev.current;
    prev.current = state;

    // First snapshot: adopt positions silently. No replay of history.
    if (!before) {
      const initial: Record<number, number> = {};
      for (const seat of state.seats) initial[seat.index] = seat.square;
      setDrawnSquares(initial);
      prevLogLen.current = state.log.length;
      return;
    }

    const push = (text: string, tone: BoardToast["tone"]) => {
      const id = nextId.current++;
      setToasts((cur) => [...cur.slice(-4), { id, text, tone }]);
      window.setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), TOAST_MS);
    };

    // ── cash ────────────────────────────────────────────────────────────────
    for (const seat of state.seats) {
      const had = before.seats[seat.index]?.cash ?? seat.cash;
      const delta = seat.cash - had;
      if (delta === 0) continue;
      const id = nextId.current++;
      setCashDeltas((cur) => [...cur.slice(-6), { id, seat: seat.index, amount: delta }]);
      window.setTimeout(() => setCashDeltas((cur) => cur.filter((d) => d.id !== id)), 1600);

      if (seat.index === mySeat) {
        if (delta > 0) playSfx(delta >= 400 ? "coin_pile" : "coin");
        else playSfx("rent_paid");
      }
    }

    // ── dice ────────────────────────────────────────────────────────────────
    const rolledNow =
      state.lastRoll &&
      (!before.lastRoll ||
        before.lastRoll.d1 !== state.lastRoll.d1 ||
        before.lastRoll.d2 !== state.lastRoll.d2 ||
        // Same numbers twice in a row is still a new roll if anyone moved.
        state.seats.some((s, i) => s.square !== before.seats[i]?.square));
    if (rolledNow) {
      setRolling(true);
      playSfx("dice_roll");
      window.setTimeout(() => {
        setRolling(false);
        playSfx("dice_land");
      }, ROLL_MS);
    }

    // ── tokens: hop square by square rather than teleporting ────────────────
    for (const seat of state.seats) {
      const from = drawnSquaresRef.current[seat.index] ?? seat.square;
      const to = seat.square;
      if (from === to) continue;
      const steps = forwardSteps(from, to);
      // A long jump backwards (a card sending you back) reads better as a
      // single move than as 37 hops the wrong way round the board.
      if (steps > 12) {
        const t = window.setTimeout(() => {
          setDrawnSquares((cur) => ({ ...cur, [seat.index]: to }));
        }, ROLL_MS);
        hopTimers.current.push(t);
        continue;
      }
      for (let i = 1; i <= steps; i++) {
        const square = (from + i) % BOARD_SQUARES.length;
        const t = window.setTimeout(() => {
          setDrawnSquares((cur) => ({ ...cur, [seat.index]: square }));
          if (seat.index === mySeat) playSfx("token_hop");
        }, ROLL_MS + i * HOP_MS);
        hopTimers.current.push(t);
      }
    }

    // ── the log, as toasts ──────────────────────────────────────────────────
    const fresh = state.log.slice(prevLogLen.current);
    prevLogLen.current = state.log.length;
    for (const line of fresh.slice(-3)) {
      const bad = /owes|paid|bankrupt|forfeit|Cooldown Bay|went unsold/i.test(line);
      const good = /bought|collected|took the table|settled|improved|agreed/i.test(line);
      push(line, bad ? "bad" : good ? "good" : "info");
    }

    // ── seats going out ─────────────────────────────────────────────────────
    for (const seat of state.seats) {
      const was = before.seats[seat.index]?.status;
      if (was === "active" && (seat.status === "bankrupt" || seat.status === "forfeit")) {
        if (seat.index === mySeat) playSfx("table_out");
      }
      if (was !== "active" || seat.status !== "active") continue;
    }

    // ── bought a deed ───────────────────────────────────────────────────────
    for (const deed of state.deeds) {
      const wasOwner = before.deeds.find((d) => d.square === deed.square)?.owner ?? null;
      if (wasOwner === null && deed.owner !== null && deed.owner === mySeat) playSfx("deed_bought");
    }

    // ── your turn ───────────────────────────────────────────────────────────
    const actor =
      state.phase.kind === "auction"
        ? state.phase.auction.currentBidder
        : state.phase.kind === "awaitDebt"
          ? state.phase.debtor
          : state.turn;
    const isMyTurn = mySeat !== null && actor === mySeat && state.phase.kind !== "done";
    if (isMyTurn && !wasMyTurn.current) playSfx("turn_alert");
    wasMyTurn.current = isMyTurn;

    // ── the ending ──────────────────────────────────────────────────────────
    if (before.phase.kind !== "done" && state.phase.kind === "done") {
      setFinished({ winner: state.phase.winner });
      playSfx(state.phase.winner === mySeat ? "table_win" : "table_out");
    }
  }, [payload, mySeat]);

  return {
    toasts,
    cashDeltas,
    rolling,
    drawnSquares,
    finished,
    dismissFinished: () => setFinished(null),
  };
}
