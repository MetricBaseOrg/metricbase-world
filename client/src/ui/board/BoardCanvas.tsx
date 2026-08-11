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
  onSelectSquare,
}: {
  state: BoardState;
  mySeat: number | null;
  onSelectSquare?: (square: number) => void;
}) {
  // Group tokens by square so several players on one square don't overlap.
  const bySquare = new Map<number, number[]>();
  state.seats.forEach((seat) => {
    if (seat.status === "bankrupt" || seat.status === "forfeit") return;
    const list = bySquare.get(seat.square) ?? [];
    list.push(seat.index);
    bySquare.set(seat.square, list);
  });

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

        return (
          <g
            key={sq.index}
            className={`dd-sq${onSelectSquare ? " dd-sq-click" : ""}`}
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
            <circle
              key={`${square}-${seatIndex}`}
              cx={cx}
              cy={cy}
              r={9}
              fill={SEAT_COLORS[seatIndex % SEAT_COLORS.length]}
              stroke={seatIndex === mySeat ? "#fff" : "rgba(0,0,0,.45)"}
              strokeWidth={seatIndex === mySeat ? 3 : 1.5}
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
        <text x={SIZE / 2} y={SIZE / 2 + 46} className="dd-board-roll" textAnchor="middle">
          🎲 {state.lastRoll.d1} + {state.lastRoll.d2}
        </text>
      )}
    </svg>
  );
}

export { SEAT_COLORS };
