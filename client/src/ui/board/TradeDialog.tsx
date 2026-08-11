// Build a trade offer.
//
// The value bands are shown live rather than only enforced on submit — a rule
// you only meet as an error message reads as the game being awkward; a rule you
// can see while you build reads as the game having a shape.

import {
  BOARD_SQUARES,
  BOARD_TRADE_BAND,
  type BoardAction,
  type BoardState,
} from "@metricbase/shared";
import { useMemo, useState } from "react";

/** Mirrors server/src/board/collusion.ts deedFaceValue — kept in step by hand,
 *  which is fine because it is only a preview: the server decides. */
function faceValue(state: BoardState, square: number): number {
  const def = BOARD_SQUARES[square];
  if (!def || def.price === undefined) return 0;
  const deed = state.deeds.find((d) => d.square === square);
  if (!deed) return 0;
  const debt = deed.mortgaged ? Math.floor(def.price / 2) : 0;
  return def.price - debt;
}

export function TradeDialog({
  state,
  mySeat,
  onClose,
  onSubmit,
}: {
  state: BoardState;
  mySeat: number;
  onClose: () => void;
  onSubmit: (action: BoardAction) => Promise<void>;
}) {
  const others = state.seats.filter((s) => s.index !== mySeat && s.status === "active");
  const [to, setTo] = useState(others[0]?.index ?? -1);
  const [giveDeeds, setGiveDeeds] = useState<number[]>([]);
  const [takeDeeds, setTakeDeeds] = useState<number[]>([]);
  const [giveCash, setGiveCash] = useState(0);
  const [takeCash, setTakeCash] = useState(0);

  const mine = state.deeds.filter((d) => d.owner === mySeat && d.improvements === 0);
  const theirs = state.deeds.filter((d) => d.owner === to && d.improvements === 0);

  const giveValue = useMemo(
    () => giveDeeds.reduce((s, sq) => s + faceValue(state, sq), 0) + giveCash,
    [giveDeeds, giveCash, state],
  );
  const takeValue = useMemo(
    () => takeDeeds.reduce((s, sq) => s + faceValue(state, sq), 0) + takeCash,
    [takeDeeds, takeCash, state],
  );

  const ratio = takeValue > 0 ? giveValue / takeValue : 0;
  const inBand = ratio >= BOARD_TRADE_BAND.min && ratio <= BOARD_TRADE_BAND.max;
  const hasDeed = giveDeeds.length > 0 || takeDeeds.length > 0;
  const valid = to >= 0 && hasDeed && giveValue > 0 && takeValue > 0 && inBand;

  const toggle = (list: number[], set: (v: number[]) => void, square: number) =>
    set(list.includes(square) ? list.filter((s) => s !== square) : [...list, square]);

  return (
    <div className="dd-modal" role="dialog" aria-label="Offer a trade">
      <div className="dd-modal-body">
        <h2>Offer a trade</h2>

        <label className="dd-field">
          <span>With</span>
          <select className="dd-input" value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {others.map((s) => (
              <option key={s.index} value={s.index}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="dd-trade-cols">
          <div>
            <h4>You give</h4>
            <div className="dd-chiplist">
              {mine.map((d) => (
                <button
                  key={d.square}
                  className={`dd-chip${giveDeeds.includes(d.square) ? " dd-chip-on" : ""}`}
                  onClick={() => toggle(giveDeeds, setGiveDeeds, d.square)}
                >
                  {BOARD_SQUARES[d.square].label}
                </button>
              ))}
            </div>
            <label className="dd-field">
              <span>Cash</span>
              <input
                type="number"
                className="dd-input"
                min={0}
                max={state.seats[mySeat].cash}
                value={giveCash}
                onChange={(e) => setGiveCash(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <p className="dd-muted">worth {giveValue} ⌬</p>
          </div>

          <div>
            <h4>You get</h4>
            <div className="dd-chiplist">
              {theirs.map((d) => (
                <button
                  key={d.square}
                  className={`dd-chip${takeDeeds.includes(d.square) ? " dd-chip-on" : ""}`}
                  onClick={() => toggle(takeDeeds, setTakeDeeds, d.square)}
                >
                  {BOARD_SQUARES[d.square].label}
                </button>
              ))}
            </div>
            <label className="dd-field">
              <span>Cash</span>
              <input
                type="number"
                className="dd-input"
                min={0}
                max={to >= 0 ? state.seats[to].cash : 0}
                value={takeCash}
                onChange={(e) => setTakeCash(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <p className="dd-muted">worth {takeValue} ⌬</p>
          </div>
        </div>

        <p className={inBand || takeValue === 0 ? "dd-muted" : "dd-warn"}>
          Each side has to be worth between {BOARD_TRADE_BAND.min}× and {BOARD_TRADE_BAND.max}× the other, and at
          least one deed has to move. That's what stops a table being handed to a partner.
          {takeValue > 0 && ` Currently ${ratio.toFixed(2)}×.`}
        </p>

        <div className="dd-row">
          <button
            className="dd-btn dd-btn-primary"
            disabled={!valid}
            onClick={() =>
              void onSubmit({ type: "proposeTrade", to, giveDeeds, giveCash, takeDeeds, takeCash })
            }
          >
            Send offer
          </button>
          <button className="dd-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
