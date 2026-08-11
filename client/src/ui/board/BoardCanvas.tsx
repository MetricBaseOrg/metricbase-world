// The board itself — plain SVG.
//
// No Phaser anywhere in the /board bundle: this page has to load fast on a
// phone and never boots the game. 40 squares in a ring, tokens on top.

import {
  BOARD_GROUPS,
  BOARD_SQUARES,
  BOARD_SQUARE_COUNT,
  type BoardState,
} from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";

const SIZE = 720;
const EDGE = 11; // squares along one edge, corners shared
const CORNER = 96;
const CELL = (SIZE - CORNER * 2) / (EDGE - 2);

const SEAT_COLORS = ["#e0b93c", "#4a9fd4", "#d4674a", "#3fa88a", "#7a6bd4", "#c9862f"];

/** Screen rectangle for a square index, walking anticlockwise from Uplink. */
function rectFor(index: number): { x: number; y: number; w: number; h: number; side: number } {
  const i = ((index % BOARD_SQUARE_COUNT) + BOARD_SQUARE_COUNT) % BOARD_SQUARE_COUNT;
  if (i === 0) return { x: SIZE - CORNER, y: SIZE - CORNER, w: CORNER, h: CORNER, side: 0 };
  if (i < 10) return { x: SIZE - CORNER - CELL * i, y: SIZE - CORNER, w: CELL, h: CORNER, side: 0 };
  if (i === 10) return { x: 0, y: SIZE - CORNER, w: CORNER, h: CORNER, side: 1 };
  if (i < 20) return { x: 0, y: SIZE - CORNER - CELL * (i - 10), w: CORNER, h: CELL, side: 1 };
  if (i === 20) return { x: 0, y: 0, w: CORNER, h: CORNER, side: 2 };
  if (i < 30) return { x: CORNER + CELL * (i - 21), y: 0, w: CELL, h: CORNER, side: 2 };
  if (i === 30) return { x: SIZE - CORNER, y: 0, w: CORNER, h: CORNER, side: 3 };
  return { x: SIZE - CORNER, y: CORNER + CELL * (i - 31), w: CORNER, h: CELL, side: 3 };
}

function groupColor(groupId: string | undefined): string | null {
  return groupId ? (BOARD_GROUPS[groupId]?.color ?? null) : null;
}

export function BoardCanvas({
  state,
  mySeat,
  drawnSquares,
  rolling,
  activeSeat,
  avatars,
  onSelectSquare,
}: {
  state: BoardState;
  mySeat: number | null;
  /** Where each token is DRAWN — lags the real square while it hops. */
  drawnSquares?: Record<number, number>;
  rolling?: boolean;
  activeSeat?: number;
  /** Seat index → which hand-drawn hero to use. */
  avatars?: Record<number, "boy" | "girl">;
  onSelectSquare?: (square: number) => void;
}) {
  const squareOf = (seat: { index: number; square: number }) =>
    drawnSquares?.[seat.index] ?? seat.square;

  // Group tokens by square so several players on one square don't overlap.
  const bySquare = new Map<number, number[]>();
  state.seats.forEach((seat) => {
    if (seat.status === "bankrupt" || seat.status === "forfeit") return;
    const sq = squareOf(seat);
    const list = bySquare.get(sq) ?? [];
    list.push(seat.index);
    bySquare.set(sq, list);
  });

  // The square the seat on the clock is standing on, so it can be lit up.
  const activeSquare =
    activeSeat !== undefined && state.seats[activeSeat] ? squareOf(state.seats[activeSeat]) : -1;

  return (
    <svg className="dd-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="District Deeds board">
      <rect x="0" y="0" width={SIZE} height={SIZE} rx="18" className="dd-board-bg" />

      {BOARD_SQUARES.map((sq) => {
        const r = rectFor(sq.index);
        const deed = state.deeds.find((d) => d.square === sq.index);
        const owner = deed?.owner ?? null;
        const color = groupColor(sq.group);
        const stripeH = 14;
        const isCorner = sq.index % 10 === 0;
        const isActive = sq.index === activeSquare;

        return (
          <g
            key={sq.index}
            className={`dd-sq${onSelectSquare ? " dd-sq-click" : ""}${isActive ? " dd-sq-active" : ""}`}
            onClick={onSelectSquare ? () => onSelectSquare(sq.index) : undefined}
          >
            <rect x={r.x} y={r.y} width={r.w} height={r.h} className="dd-sq-bg" />
            {color && !isCorner && (
              // The group stripe always sits on the edge facing the middle.
              <rect
                x={r.x}
                y={r.side === 0 ? r.y : r.side === 2 ? r.y + r.h - stripeH : r.y}
                width={r.side === 1 || r.side === 3 ? stripeH : r.w}
                height={r.side === 1 || r.side === 3 ? r.h : stripeH}
                transform={r.side === 1 ? `translate(${r.w - stripeH},0)` : undefined}
                fill={color}
              />
            )}
            {owner !== null && (
              <rect
                x={r.x + 2}
                y={r.y + 2}
                width={r.w - 4}
                height={r.h - 4}
                fill="none"
                stroke={SEAT_COLORS[owner % SEAT_COLORS.length]}
                strokeWidth="3"
                rx="4"
              />
            )}
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2 + 3}
              className={`dd-sq-label${isCorner ? " dd-sq-corner" : ""}`}
              textAnchor="middle"
            >
              {sq.label.length > 12 ? `${sq.label.slice(0, 11)}…` : sq.label}
            </text>
            {sq.price !== undefined && !isCorner && (
              <text x={r.x + r.w / 2} y={r.y + r.h - 8} className="dd-sq-price" textAnchor="middle">
                {deed?.mortgaged ? "mortgaged" : `${sq.price}⌬`}
              </text>
            )}
            {(deed?.improvements ?? 0) > 0 && (
              <text x={r.x + r.w / 2} y={r.y + 16} className="dd-sq-imp" textAnchor="middle">
                {deed!.improvements === 5 ? "★" : "▲".repeat(deed!.improvements)}
              </text>
            )}
          </g>
        );
      })}

      {[...bySquare.entries()].map(([square, seats]) =>
        seats.map((seatIndex, n) => {
          const r = rectFor(square);
          const cx = r.x + r.w / 2 + (n - (seats.length - 1) / 2) * 16;
          const cy = r.y + r.h / 2 + 20;
          return (
            <Token
              key={`token-${seatIndex}`}
              x={cx}
              y={cy}
              seatIndex={seatIndex}
              avatar={avatars?.[seatIndex] ?? "boy"}
              isMe={seatIndex === mySeat}
              isActive={seatIndex === activeSeat}
              square={square}
            />
          );
        }),
      )}

      <text x={SIZE / 2} y={SIZE / 2 - 14} className="dd-board-title" textAnchor="middle">
        District Deeds
      </text>
      <text x={SIZE / 2} y={SIZE / 2 + 14} className="dd-board-sub" textAnchor="middle">
        turn {state.turnCount}
      </text>
      {state.lastRoll && (
        <g className={rolling ? "dd-dice dd-dice-rolling" : "dd-dice"}>
          <Die x={SIZE / 2 - 44} y={SIZE / 2 + 26} value={state.lastRoll.d1} rolling={!!rolling} />
          <Die x={SIZE / 2 + 8} y={SIZE / 2 + 26} value={state.lastRoll.d2} rolling={!!rolling} />
        </g>
      )}
    </svg>
  );
}

/**
 * A player's token: their actual MetricBase hero standing on the square, on a
 * seat-coloured disc so you can still tell four heroes apart at a glance.
 *
 * The art is loaded straight from /assets/characters as an SVG <image>. It
 * deliberately does NOT go through the game's avatar renderer, which pulls in
 * Phaser — 1.5MB this page has no other use for.
 */
function Token({
  x,
  y,
  seatIndex,
  avatar,
  isMe,
  isActive,
  square,
}: {
  x: number;
  y: number;
  seatIndex: number;
  avatar: "boy" | "girl";
  isMe: boolean;
  isActive: boolean;
  square: number;
}) {
  // Walk while the token is moving between squares, idle once it settles. The
  // square changing IS the movement signal, so the frame cycles off it.
  const [frame, setFrame] = useState(0);
  const [walking, setWalking] = useState(false);
  const lastSquare = useRef(square);

  useEffect(() => {
    if (lastSquare.current === square) return;
    lastSquare.current = square;
    setWalking(true);
    setFrame((f) => (f + 1) % 4);
    const t = window.setTimeout(() => setWalking(false), 320);
    return () => window.clearTimeout(t);
  }, [square]);

  const href = walking
    ? `/assets/characters/${avatar}-front-walk-${frame}.webp`
    : `/assets/characters/${avatar}-front-idle-0.webp`;
  const size = 34;

  return (
    <g className={`dd-token${isActive ? " dd-token-active" : ""}`} transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="4" rx="11" ry="4" className="dd-token-shadow" />
      <circle
        cx="0"
        cy="0"
        r="12"
        fill={SEAT_COLORS[seatIndex % SEAT_COLORS.length]}
        stroke={isMe ? "#fff" : "rgba(0,0,0,.5)"}
        strokeWidth={isMe ? 2.5 : 1.5}
        opacity="0.9"
      />
      <image
        href={href}
        x={-size / 2}
        y={-size + 8}
        width={size}
        height={size}
        className={walking ? "dd-token-art dd-token-walking" : "dd-token-art"}
        preserveAspectRatio="xMidYMax meet"
      />
    </g>
  );
}

/** One die. While `rolling` it shows a scramble rather than the real face, so
 *  the result lands as a reveal instead of appearing before the animation. */
function Die({ x, y, value, rolling }: { x: number; y: number; value: number; rolling: boolean }) {
  // Self-ticking: the scramble has to re-render on its own, because nothing
  // else changes between the roll landing on the server and the reveal here.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!rolling) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 70);
    return () => window.clearInterval(t);
  }, [rolling]);
  const shown = rolling ? 1 + ((value + tick * 3 + x) % 6) : value;
  const pips: Record<number, [number, number][]> = {
    1: [[18, 18]],
    2: [[9, 9], [27, 27]],
    3: [[9, 9], [18, 18], [27, 27]],
    4: [[9, 9], [27, 9], [9, 27], [27, 27]],
    5: [[9, 9], [27, 9], [18, 18], [9, 27], [27, 27]],
    6: [[9, 9], [27, 9], [9, 18], [27, 18], [9, 27], [27, 27]],
  };
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width="36" height="36" rx="7" className="dd-die" />
      {(pips[shown] ?? []).map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r="3.4" className="dd-pip" />
      ))}
    </g>
  );
}

export { SEAT_COLORS };
