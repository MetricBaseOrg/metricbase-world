// The live table view: board, seats, and whatever the phase is asking you for.

import {
  BOARD_GROUPS,
  BOARD_MAX_IMPROVEMENTS,
  BOARD_SQUARES,
  boardMortgageValue,
  boardUnmortgageCost,
  type BoardAction,
  type BoardState,
  type BoardStatePayload,
} from "@metricbase/shared";
import { useEffect, useMemo, useState } from "react";

import { sendAction } from "../../board/boardClient";
import { useBoardFx } from "../../board/useBoardFx";
import { BoardCanvas, SEAT_COLORS } from "./BoardCanvas";
import { TradeDialog } from "./TradeDialog";

function useCountdown(deadline: number | null): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

function actorOf(state: BoardState): number {
  if (state.phase.kind === "auction") return state.phase.auction.currentBidder;
  if (state.phase.kind === "awaitDebt") return state.phase.debtor;
  return state.turn;
}

/** A shrinking ring around the turn countdown — a number alone doesn't read as
 *  urgent until it's nearly gone. */
function TurnRing({ seconds, total }: { seconds: number; total: number }) {
  const frac = Math.max(0, Math.min(1, seconds / total));
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg className="dd-ring" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r={r} className="dd-ring-track" />
      <circle
        cx="12"
        cy="12"
        r={r}
        className={`dd-ring-fill${frac < 0.25 ? " dd-ring-low" : ""}`}
        strokeDasharray={`${c * frac} ${c}`}
        transform="rotate(-90 12 12)"
      />
      <text x="12" y="15.5" textAnchor="middle" className="dd-ring-text">
        {seconds}
      </text>
    </svg>
  );
}

export function BoardTable({
  payload,
  onError,
  onOpenFairness,
}: {
  payload: BoardStatePayload;
  onError: (message: string) => void;
  onOpenFairness: () => void;
}) {
  const state = payload.state;
  const mySeat = payload.mySeat;
  const [busy, setBusy] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState(0);
  const secondsLeft = useCountdown(payload.turnDeadline);
  const fx = useBoardFx(payload, payload.mySeat);

  const inGrace = payload.resumeGraceUntil !== null;
  const graceLeft = useCountdown(payload.resumeGraceUntil);

  const me = state && mySeat !== null ? state.seats[mySeat] : null;
  const actor = state ? actorOf(state) : -1;
  const myTurn = me !== null && actor === mySeat;

  const myDeeds = useMemo(
    () => (state && mySeat !== null ? state.deeds.filter((d) => d.owner === mySeat) : []),
    [state, mySeat],
  );

  if (!state) return <div className="dd-card">Waiting for the table to start…</div>;

  const act = async (action: BoardAction) => {
    setBusy(true);
    const res = await sendAction(payload.table.id, action);
    setBusy(false);
    if (!res.ok) onError(res.error ?? "That move didn't go through.");
  };

  const offersForMe = state.trades.filter((t) => t.to === mySeat);
  // Bound once: TypeScript loses the phase narrowing inside nested JSX callbacks.
  const auction = state.phase.kind === "auction" ? state.phase.auction : null;

  return (
    <div className="dd-table">
      {inGrace && (
        <div className="dd-banner dd-banner-info">
          The server restarted — your table was saved. Everyone has {Math.ceil(graceLeft / 60)} min to come back,
          and nobody can forfeit until then.
        </div>
      )}
      {payload.table.status === "paused" && (
        <div className="dd-banner dd-banner-warn">This table is paused by an operator.</div>
      )}
      {payload.table.status === "review" && (
        <div className="dd-banner dd-banner-warn">
          This table finished and is being reviewed before the prize is paid. Your stake is safe.
        </div>
      )}

      <div className="dd-table-grid">
        <div className="dd-board-wrap">
          <BoardCanvas
            state={state}
            mySeat={mySeat}
            drawnSquares={fx.drawnSquares}
            rolling={fx.rolling}
            activeSeat={actor}
          />
          <div className="dd-toasts" aria-live="polite">
            {fx.toasts.map((t) => (
              <div key={t.id} className={`dd-toast dd-toast-${t.tone}`}>
                {t.text}
              </div>
            ))}
          </div>
        </div>

        <div className="dd-side">
          <div className="dd-card">
            <h3>Players</h3>
            {state.seats.map((seat) => {
              const info = payload.seats.find((s) => s.index === seat.index);
              return (
                <div key={seat.index} className={`dd-seat${seat.index === actor ? " dd-seat-turn" : ""}`}>
                  <span className="dd-dot" style={{ background: SEAT_COLORS[seat.index % SEAT_COLORS.length] }} />
                  <span className="dd-seat-name">
                    {seat.name}
                    {seat.index === mySeat ? " (you)" : ""}
                    {info?.kind === "ai" ? " · practice" : ""}
                  </span>
                  <span className="dd-seat-cash">
                    {seat.cash.toLocaleString()} ⌬
                    {fx.cashDeltas
                      .filter((d) => d.seat === seat.index)
                      .map((d) => (
                        <span key={d.id} className={`dd-delta ${d.amount > 0 ? "dd-delta-up" : "dd-delta-down"}`}>
                          {d.amount > 0 ? "+" : "−"}
                          {Math.abs(d.amount).toLocaleString()}
                        </span>
                      ))}
                  </span>
                  <span className="dd-seat-tags">
                    {seat.status === "bankrupt" && <em>out</em>}
                    {seat.status === "forfeit" && <em>forfeited</em>}
                    {seat.status === "won" && <em>winner</em>}
                    {seat.inCooldown && <em>cooldown</em>}
                    {info && info.kind === "human" && !info.connected && <em className="dd-warn">away</em>}
                    {info?.idle && <em className="dd-warn">idle</em>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="dd-card dd-actions">
            <h3 className="dd-turnhead">
              {state.phase.kind === "done" ? (
                "Table finished"
              ) : myTurn ? (
                <>
                  <TurnRing seconds={secondsLeft} total={45} />
                  Your move
                </>
              ) : (
                <>
                  <span className="dd-thinking" />
                  {state.seats[actor]?.name ?? "…"} is thinking
                </>
              )}
            </h3>

            {state.phase.kind === "done" && (
              <p>
                {state.phase.winner === null
                  ? "Nobody took the table."
                  : `${state.seats[state.phase.winner].name} took the table.`}
              </p>
            )}

            {myTurn && state.phase.kind === "awaitRoll" && (
              <>
                <button className="dd-btn dd-btn-primary" disabled={busy} onClick={() => void act({ type: "roll" })}>
                  🎲 Roll
                </button>
                {me?.inCooldown && (
                  <>
                    {me.pardons > 0 && (
                      <button className="dd-btn" disabled={busy} onClick={() => void act({ type: "usePardon" })}>
                        Use a pardon
                      </button>
                    )}
                    <button className="dd-btn" disabled={busy} onClick={() => void act({ type: "payCooldownFee" })}>
                      Pay 50 ⌬ to leave
                    </button>
                  </>
                )}
              </>
            )}

            {myTurn && state.phase.kind === "awaitBuy" && (
              <>
                <p>
                  {BOARD_SQUARES[state.phase.square].label} — {BOARD_SQUARES[state.phase.square].price} ⌬
                </p>
                <button
                  className="dd-btn dd-btn-primary"
                  disabled={busy || (me?.cash ?? 0) < (BOARD_SQUARES[state.phase.square].price ?? 0)}
                  onClick={() => void act({ type: "buy" })}
                >
                  Buy it
                </button>
                <button className="dd-btn" disabled={busy} onClick={() => void act({ type: "decline" })}>
                  Pass → auction
                </button>
              </>
            )}

            {auction && (
              <>
                <p>
                  Auction: {BOARD_SQUARES[auction.square].label} · high bid {auction.highBid} ⌬
                </p>
                {actor === mySeat && (
                  <div className="dd-row">
                    <input
                      type="number"
                      className="dd-input"
                      min={auction.highBid + 1}
                      max={me?.cash ?? 0}
                      value={bidAmount || auction.highBid + 10}
                      onChange={(e) => setBidAmount(Number(e.target.value))}
                    />
                    <button
                      className="dd-btn dd-btn-primary"
                      disabled={busy}
                      onClick={() => void act({ type: "bid", amount: bidAmount || auction.highBid + 10 })}
                    >
                      Bid
                    </button>
                    <button className="dd-btn" disabled={busy} onClick={() => void act({ type: "pass" })}>
                      Pass
                    </button>
                  </div>
                )}
              </>
            )}

            {state.phase.kind === "awaitDebt" && state.phase.debtor === mySeat && (
              <>
                <p className="dd-warn">
                  You owe {state.phase.amount} ⌬ and have {me?.cash ?? 0}. Sell or mortgage to cover it.
                </p>
                <button className="dd-btn dd-btn-danger" disabled={busy} onClick={() => void act({ type: "declareBankrupt" })}>
                  Declare bankrupt
                </button>
              </>
            )}

            {myTurn && state.phase.kind === "awaitEndTurn" && (
              <button className="dd-btn dd-btn-primary" disabled={busy} onClick={() => void act({ type: "endTurn" })}>
                End turn
              </button>
            )}

            {mySeat !== null && state.phase.kind !== "done" && (
              <button className="dd-btn" disabled={busy} onClick={() => setTradeOpen(true)}>
                Offer a trade
              </button>
            )}
            <button className="dd-btn dd-btn-ghost" onClick={onOpenFairness}>
              Check the dice
            </button>
          </div>

          {offersForMe.length > 0 && (
            <div className="dd-card">
              <h3>Offers for you</h3>
              {offersForMe.map((offer) => (
                <div key={offer.id} className="dd-offer">
                  <p>
                    {state.seats[offer.from].name} gives{" "}
                    {offer.giveDeeds.map((s) => BOARD_SQUARES[s].label).join(", ") || "—"}
                    {offer.giveCash > 0 ? ` + ${offer.giveCash} ⌬` : ""} for{" "}
                    {offer.takeDeeds.map((s) => BOARD_SQUARES[s].label).join(", ") || "—"}
                    {offer.takeCash > 0 ? ` + ${offer.takeCash} ⌬` : ""}
                  </p>
                  <div className="dd-row">
                    <button
                      className="dd-btn dd-btn-primary"
                      disabled={busy}
                      onClick={() => void act({ type: "respondTrade", tradeId: offer.id, accept: true })}
                    >
                      Accept
                    </button>
                    <button
                      className="dd-btn"
                      disabled={busy}
                      onClick={() => void act({ type: "respondTrade", tradeId: offer.id, accept: false })}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {myDeeds.length > 0 && (
            <div className="dd-card">
              <h3>Your deeds</h3>
              {myDeeds.map((deed) => {
                const def = BOARD_SQUARES[deed.square];
                const cost = def.group ? BOARD_GROUPS[def.group].improvementCost : 0;
                return (
                  <div key={deed.square} className="dd-deed">
                    <span>{def.label}</span>
                    <span className="dd-deed-tags">
                      {deed.mortgaged && <em>mortgaged</em>}
                      {deed.improvements > 0 && <em>{deed.improvements}×▲</em>}
                    </span>
                    <span className="dd-row">
                      {def.kind === "deed" && !deed.mortgaged && deed.improvements < BOARD_MAX_IMPROVEMENTS && (
                        <button
                          className="dd-btn dd-btn-sm"
                          disabled={busy || (me?.cash ?? 0) < cost}
                          onClick={() => void act({ type: "build", square: deed.square })}
                        >
                          Improve {cost}⌬
                        </button>
                      )}
                      {deed.improvements > 0 && (
                        <button
                          className="dd-btn dd-btn-sm"
                          disabled={busy}
                          onClick={() => void act({ type: "sellImprovement", square: deed.square })}
                        >
                          Sell ▲
                        </button>
                      )}
                      {!deed.mortgaged && deed.improvements === 0 && (
                        <button
                          className="dd-btn dd-btn-sm"
                          disabled={busy}
                          onClick={() => void act({ type: "mortgage", square: deed.square })}
                        >
                          Mortgage +{boardMortgageValue(def.price ?? 0)}⌬
                        </button>
                      )}
                      {deed.mortgaged && (
                        <button
                          className="dd-btn dd-btn-sm"
                          disabled={busy || (me?.cash ?? 0) < boardUnmortgageCost(def.price ?? 0)}
                          onClick={() => void act({ type: "unmortgage", square: deed.square })}
                        >
                          Lift −{boardUnmortgageCost(def.price ?? 0)}⌬
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="dd-card dd-log">
            <h3>What happened</h3>
            {[...state.log].reverse().slice(0, 14).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      </div>

      {fx.finished && (
        <div className="dd-win" onClick={fx.dismissFinished}>
          <div className={`dd-win-card${fx.finished.winner === mySeat ? " dd-win-mine" : ""}`}>
            <div className="dd-win-emoji">{fx.finished.winner === mySeat ? "🏆" : "🎲"}</div>
            <h2>
              {fx.finished.winner === null
                ? "Nobody took the table"
                : fx.finished.winner === mySeat
                  ? "You took the table"
                  : `${state.seats[fx.finished.winner].name} took the table`}
            </h2>
            {payload.prizeUnits > 0 && fx.finished.winner === mySeat && (
              <p>The prize is in your table bank.</p>
            )}
            <button className="dd-btn dd-btn-primary" onClick={fx.dismissFinished}>
              See the final board
            </button>
            <button className="dd-btn" onClick={onOpenFairness}>
              Check the dice
            </button>
          </div>
        </div>
      )}

      {tradeOpen && mySeat !== null && (
        <TradeDialog
          state={state}
          mySeat={mySeat}
          onClose={() => setTradeOpen(false)}
          onSubmit={async (action) => {
            await act(action);
            setTradeOpen(false);
          }}
        />
      )}
    </div>
  );
}
