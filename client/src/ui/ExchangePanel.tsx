import {
  SHARE_LISTING_COST,
  SHARE_MAX_TRADE,
  SHARE_MIN_TRADE,
  SHARE_DIVIDEND_MAX_PCT,
  SHARE_TRADE_FEE_RATE,
  quoteBuy,
  quoteSell,
  shareSellProceeds,
  type CompanyMarketDetail,
  type ExchangeStatePayload,
  type ShareMarketSummary,
} from "@metricbase/shared";
import { useEffect, useMemo, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { setUiTypingActive } from "../game/inputControl";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

function colorCss(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}

function pctBadge(change: number | null) {
  if (change === null) return <span className="chibi-text-muted" style={{ fontSize: "0.68rem" }}>—</span>;
  const up = change >= 0;
  return (
    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: up ? "#2f9e5e" : "#c0392b" }}>
      {up ? "▲" : "▼"} {(Math.abs(change) * 100).toFixed(1)}%
    </span>
  );
}

/**
 * Stock Exchange (Phase 1): a gold-settled bonding-curve market for shares in
 * Merchant Companies. Browse the market board, open a company to buy/sell shares
 * against the curve, and track your holdings. Opened from the ⚙️ menu.
 */
export function ExchangePanel() {
  const open = useGameStore((s) => s.exchangeOpen);
  const setOpen = useGameStore((s) => s.setExchangeOpen);
  const gold = useGameStore((s) => s.playerGold);
  const [state, setState] = useState<ExchangeStatePayload | null>(null);
  const [detail, setDetail] = useState<CompanyMarketDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const offState = networkManager.onExchangeState((s) => setState(s));
    const offResult = networkManager.onExchangeResult((r) => {
      setPending(false);
      if (r.ok) {
        setError(null);
        setNotice(r.message ?? "Done!");
        playSfx("ui_open");
      } else {
        setError(r.error ?? "Trade failed.");
      }
    });
    const offDetail = networkManager.onMarketDetail((d) => {
      setDetail(d);
      setSelected(d.summary.companyId);
    });
    const offChanged = networkManager.onExchangeChanged(() => {
      if (useGameStore.getState().exchangeOpen) {
        networkManager.requestExchange();
        const sel = useGameStore.getState().exchangeOpen ? selectedRef.current : null;
        if (sel) networkManager.requestMarketDetail(sel);
      }
    });
    return () => {
      offState();
      offResult();
      offDetail();
      offChanged();
    };
  }, []);

  // Keep a ref to the selected company for the (stable) exchangeChanged handler.
  const selectedRef = useMemo(() => ({ current: null as string | null }), []);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected, selectedRef]);

  useEffect(() => {
    if (open) {
      setNotice(null);
      setError(null);
      networkManager.requestExchange();
      if (selected) networkManager.requestMarketDetail(selected);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const close = () => {
    playSfx("ui_close");
    setOpen(false);
  };

  const openMarket = (companyId: string) => {
    playSfx("ui_click");
    setSelected(companyId);
    setError(null);
    setNotice(null);
    networkManager.requestMarketDetail(companyId);
  };

  const listMine = () => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendExchangeList();
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 560, width: "94vw", maxHeight: "86vh", overflowY: "auto" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">📈 Stock Exchange</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      {notice && (
        <div className="chibi-card" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>
          {error}
        </div>
      )}

      {!state && (
        <div className="chibi-text-muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
          Loading the exchange…
        </div>
      )}

      {state?.listableCompanyId && (
        <div className="chibi-card" style={{ marginTop: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: "0.76rem" }}>
            List your company on the exchange so players can trade its shares.
          </div>
          <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "7px 12px", fontSize: "0.74rem" }} disabled={pending || gold < SHARE_LISTING_COST} onClick={listMine}>
            List · 🪙 {SHARE_LISTING_COST.toLocaleString()}
          </button>
        </div>
      )}

      {selected && detail ? (
        <MarketDetailView
          detail={detail}
          gold={gold}
          pending={pending}
          setPending={setPending}
          onBack={() => {
            setSelected(null);
            setDetail(null);
          }}
        />
      ) : (
        state && (
          <MarketBoard state={state} onOpen={openMarket} />
        )
      )}
    </div>
  );
}

function MarketBoard({ state, onOpen }: { state: ExchangeStatePayload; onOpen: (id: string) => void }) {
  return (
    <>
      {state.myHoldings.length > 0 && (
        <>
          <div className="chibi-label" style={{ margin: "12px 0 4px", display: "flex", justifyContent: "space-between" }}>
            <span>Your holdings</span>
            <span style={{ color: "#b8860b" }}>
              portfolio ~{state.myHoldings.reduce((a, h) => a + h.value, 0).toLocaleString()}g
            </span>
          </div>
          {state.myHoldings.map((h) => (
            <button
              key={h.companyId}
              type="button"
              className="chibi-card chibi-chat-name-btn"
              style={{ padding: "8px 12px", marginTop: 4, display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={() => onOpen(h.companyId)}
            >
              <div style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: colorCss(h.color), fontSize: 14 }}>{h.emblem}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>{h.ticker} · {h.name}</div>
                <div className="chibi-text-muted" style={{ fontSize: "0.68rem" }}>
                  {h.shares.toLocaleString()} shares · ~{h.value.toLocaleString()}g ·{" "}
                  <span style={{ color: h.pnl >= 0 ? "#2f9e5e" : "#c0392b" }}>
                    {h.pnl >= 0 ? "+" : ""}{h.pnl.toLocaleString()}g
                  </span>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#b8860b" }}>{h.price.toFixed(2)}g</div>
            </button>
          ))}
        </>
      )}

      <div className="chibi-label" style={{ margin: "12px 0 4px" }}>Market</div>
      {state.markets.length === 0 && (
        <div className="chibi-text-muted" style={{ fontSize: "0.78rem" }}>
          No companies are listed yet. A company owner can list from here.
        </div>
      )}
      {state.markets.map((m: ShareMarketSummary) => (
        <button
          key={m.companyId}
          type="button"
          className="chibi-card chibi-chat-name-btn"
          style={{ padding: "8px 12px", marginTop: 4, display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "pointer" }}
          onClick={() => onOpen(m.companyId)}
        >
          <div style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: colorCss(m.color), fontSize: 16 }}>{m.emblem}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: "0.82rem" }}>{m.ticker} <span className="chibi-text-muted" style={{ fontWeight: 400 }}>· {m.name}</span></div>
            <div className="chibi-text-muted" style={{ fontSize: "0.68rem" }}>
              cap {m.marketCap.toLocaleString()}g · {m.circulatingShares.toLocaleString()} shares · vol {m.volume24h.toLocaleString()}g
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: "0.84rem", color: "#b8860b" }}>{m.price.toFixed(2)}g</div>
            {pctBadge(m.change24h)}
          </div>
        </button>
      ))}
    </>
  );
}

function MarketDetailView({
  detail,
  gold,
  pending,
  setPending,
  onBack,
}: {
  detail: CompanyMarketDetail;
  gold: number;
  pending: boolean;
  setPending: (v: boolean) => void;
  onBack: () => void;
}) {
  const m = detail.summary;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("1");
  const n = Math.max(0, Math.floor(Number(amount) || 0));

  const quote = useMemo(() => {
    if (n < SHARE_MIN_TRADE) return null;
    return side === "buy"
      ? quoteBuy(m.circulatingShares, n, m.basePrice, m.slope)
      : quoteSell(m.circulatingShares, n, m.basePrice, m.slope);
  }, [side, n, m.circulatingShares, m.basePrice, m.slope]);

  const trade = () => {
    if (n < SHARE_MIN_TRADE || n > SHARE_MAX_TRADE) return;
    playSfx("ui_click");
    setPending(true);
    if (side === "buy") networkManager.sendExchangeBuy(m.companyId, n);
    else networkManager.sendExchangeSell(m.companyId, n);
  };

  const canTrade =
    !pending &&
    n >= SHARE_MIN_TRADE &&
    n <= SHARE_MAX_TRADE &&
    quote !== null &&
    (side === "buy" ? quote.net <= gold : n <= detail.myShares);

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="chibi-btn chibi-btn--ghost" style={{ padding: "4px 10px", fontSize: "0.7rem" }} onClick={onBack}>
        ← Market
      </button>

      <div className="chibi-card" style={{ padding: "12px", marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, display: "grid", placeItems: "center", background: colorCss(m.color), fontSize: 22 }}>{m.emblem}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{m.ticker} · {m.name}</div>
          <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
            cap {m.marketCap.toLocaleString()}g · {m.circulatingShares.toLocaleString()} shares · reserve {m.reserve.toLocaleString()}g
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#b8860b" }}>{m.price.toFixed(2)}g</div>
          {pctBadge(m.change24h)}
        </div>
      </div>

      <div className="chibi-card" style={{ padding: "12px", marginTop: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className={`chibi-btn ${side === "buy" ? "chibi-btn--mint" : "chibi-btn--ghost"}`} style={{ flex: 1, padding: "7px" }} onClick={() => setSide("buy")}>
            Buy
          </button>
          <button type="button" className={`chibi-btn ${side === "sell" ? "chibi-btn--mint" : "chibi-btn--ghost"}`} style={{ flex: 1, padding: "7px" }} onClick={() => setSide("sell")}>
            Sell
          </button>
        </div>
        <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 8 }}>
          You hold <b>{detail.myShares.toLocaleString()}</b> shares · You have <b>{gold.toLocaleString()}g</b>
        </div>
        {detail.myShares > 0 && (() => {
          const posValue = shareSellProceeds(m.circulatingShares, Math.min(detail.myShares, m.circulatingShares), m.basePrice, m.slope);
          const pnl = posValue - detail.myCostBasis;
          return (
            <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 2 }}>
              worth ~{posValue.toLocaleString()}g · cost {detail.myCostBasis.toLocaleString()}g ·{" "}
              <span style={{ color: pnl >= 0 ? "#2f9e5e" : "#c0392b", fontWeight: 700 }}>
                {pnl >= 0 ? "+" : ""}{pnl.toLocaleString()}g P/L
              </span>
            </div>
          );
        })()}
        <input
          className="chibi-input"
          style={{ width: "100%", marginTop: 6 }}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          onFocus={() => setUiTypingActive(true)}
          onBlur={() => setUiTypingActive(false)}
          placeholder="Shares"
        />
        {quote && (
          <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 6, lineHeight: 1.6 }}>
            {side === "buy" ? (
              <>Cost <b style={{ color: "#b8860b" }}>{quote.net.toLocaleString()}g</b> ({quote.gross.toLocaleString()} + {quote.fee.toLocaleString()} fee) · price after {quote.priceAfter.toFixed(2)}g</>
            ) : (
              <>Receive <b style={{ color: "#2f9e5e" }}>{quote.net.toLocaleString()}g</b> ({quote.gross.toLocaleString()} − {quote.fee.toLocaleString()} fee) · price after {quote.priceAfter.toFixed(2)}g</>
            )}
            <div>Fee is {(SHARE_TRADE_FEE_RATE * 100).toFixed(0)}% — a slice funds the company treasury, the rest is burned.</div>
          </div>
        )}
        <button type="button" className={`chibi-btn ${side === "buy" ? "chibi-btn--gold" : "chibi-btn--secondary"}`} style={{ width: "100%", marginTop: 8, padding: "9px" }} disabled={!canTrade} onClick={trade}>
          {side === "buy" ? "Buy" : "Sell"} {n > 0 ? n.toLocaleString() : ""} shares
        </button>
      </div>

      <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
        <div className="chibi-label">Governance</div>
        <div style={{ fontSize: "0.74rem", marginTop: 4, lineHeight: 1.7 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>👑 CEO (largest holder)</span>
            <b>{detail.ceo ? `${detail.ceo} (${(detail.ceoPct * 100).toFixed(1)}%)` : "—"}</b>
          </div>
          {detail.controlled && (
            <div style={{ color: "#b8860b", fontSize: "0.68rem" }}>
              Holds a controlling stake — their vote decides dividend policy.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Dividend payout (share-weighted vote)</span>
            <b>{detail.dividendPct}% of weekly profit</b>
          </div>
        </div>
        {detail.myShares > 0 && (
          <DividendVote companyId={m.companyId} current={detail.myDividendVote} effective={detail.dividendPct} pending={pending} setPending={setPending} />
        )}
      </div>

      <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
        <div className="chibi-label">Financials (this week)</div>
        <div style={{ fontSize: "0.74rem", marginTop: 4, lineHeight: 1.7 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Revenue</span><b>{detail.financials.weekRevenue.toLocaleString()}g</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Expenses (wages + payroll)</span><b>{detail.financials.weekExpenses.toLocaleString()}g</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Net profit</span>
            <span style={{ color: detail.financials.weekNetProfit >= 0 ? "#2f9e5e" : "#c0392b" }}>{detail.financials.weekNetProfit.toLocaleString()}g</span>
          </div>
          <div style={{ borderTop: "1px solid var(--chibi-outline-light)", margin: "5px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Treasury</span><b>{detail.financials.treasury.toLocaleString()}g</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Warehouse value</span><b>{detail.financials.warehouseValue.toLocaleString()}g</b></div>
          <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 2 }}>
            Lifetime revenue {detail.financials.lifetimeRevenue.toLocaleString()}g · expenses {detail.financials.lifetimeExpenses.toLocaleString()}g
          </div>
        </div>
      </div>

      {detail.dividendHistory.length > 0 && (
        <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
          <div className="chibi-label">Dividend history</div>
          <div style={{ fontSize: "0.72rem", marginTop: 4, lineHeight: 1.7 }}>
            {detail.dividendHistory.map((d) => (
              <div key={d.week} style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="chibi-text-muted">{new Date(d.at).toLocaleDateString()}</span>
                <b>{d.total.toLocaleString()}g ({d.perShare.toFixed(2)}g/share)</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.topHolders.length > 0 && (
        <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
          <div className="chibi-label">Largest shareholders</div>
          <div style={{ fontSize: "0.72rem", marginTop: 4, lineHeight: 1.7 }}>
            {detail.topHolders.map((h) => (
              <div key={h.name} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{h.name}</span>
                <b>{h.shares.toLocaleString()} ({(h.pct * 100).toFixed(1)}%)</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.recentTrades.length > 0 && (
        <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
          <div className="chibi-label">Recent trades</div>
          <div style={{ fontSize: "0.7rem", marginTop: 4, lineHeight: 1.7 }}>
            {detail.recentTrades.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: t.side === "buy" ? "#2f9e5e" : "#c0392b" }}>
                  {t.side === "buy" ? "▲ bought" : "▼ sold"} {t.shares.toLocaleString()}
                </span>
                <span className="chibi-text-muted">{t.traderName} · {t.price.toFixed(2)}g</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DividendVote({
  companyId,
  current,
  effective,
  pending,
  setPending,
}: {
  companyId: string;
  current: number | null;
  effective: number;
  pending: boolean;
  setPending: (v: boolean) => void;
}) {
  const [val, setVal] = useState(current ?? effective);
  useEffect(() => setVal(current ?? effective), [current, effective]);
  return (
    <div style={{ marginTop: 8, borderTop: "1px solid var(--chibi-outline-light)", paddingTop: 8 }}>
      <div style={{ fontSize: "0.72rem" }}>
        Your dividend vote (weighted by your shares): <b>{val}%</b>
        {current == null && <span className="chibi-text-muted"> · not yet voted</span>}
      </div>
      <input type="range" min={0} max={SHARE_DIVIDEND_MAX_PCT} value={val} style={{ width: "100%", marginTop: 4 }} onChange={(e) => setVal(Number(e.target.value))} />
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="chibi-btn chibi-btn--mint" style={{ flex: 1, padding: "6px", fontSize: "0.7rem" }} disabled={pending} onClick={() => { playSfx("ui_click"); setPending(true); networkManager.sendExchangeVote(companyId, val); }}>
          Cast vote
        </button>
        {current != null && (
          <button type="button" className="chibi-btn chibi-btn--ghost" style={{ padding: "6px 10px", fontSize: "0.7rem" }} disabled={pending} onClick={() => { playSfx("ui_click"); setPending(true); networkManager.sendExchangeVote(companyId, null); }}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
