import {
  SHARE_LISTING_COST,
  SHARE_MAX_TRADE,
  SHARE_MIN_TRADE,
  SHARE_DIVIDEND_MAX_PCT,
  SHARE_ORDER_MIN_PRICE,
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
import { networkManager, type PipGoldInfoPayload } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";

const PENDING_BASE_KEY = "mb.pendingSharePurchase";

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
  const walletAddress = useGameStore((s) => s.walletAddress);
  const [state, setState] = useState<ExchangeStatePayload | null>(null);
  const [detail, setDetail] = useState<CompanyMarketDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pipInfo, setPipInfo] = useState<PipGoldInfoPayload | null>(null);

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
      // Clear a stashed $BASE payment once it's settled (or failed non-retryably).
      if (r.signature && (r.ok || !r.retryable)) {
        try {
          localStorage.removeItem(PENDING_BASE_KEY);
        } catch {
          /* ignore */
        }
      }
    });
    const offPip = networkManager.onPipGoldInfo((info) => setPipInfo(info));
    networkManager.requestPipGoldInfo?.();
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
    // Recover a $BASE payment that was sent but not yet confirmed (e.g. a reload
    // mid-purchase) so a real payment is never stranded.
    try {
      const raw = localStorage.getItem(PENDING_BASE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { id: string; signature: string };
        if (p?.id && p?.signature) networkManager.sendExchangeBuyBase(p.id, p.signature);
      }
    } catch {
      /* ignore */
    }
    return () => {
      offState();
      offResult();
      offDetail();
      offChanged();
      offPip();
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
          walletAddress={walletAddress}
          pipInfo={pipInfo}
          pending={pending}
          setPending={setPending}
          setNotice={setNotice}
          setError={setError}
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
  walletAddress,
  pipInfo,
  pending,
  setPending,
  setNotice,
  setError,
  onBack,
}: {
  detail: CompanyMarketDetail;
  gold: number;
  walletAddress: string | null;
  pipInfo: PipGoldInfoPayload | null;
  pending: boolean;
  setPending: (v: boolean) => void;
  setNotice: (s: string | null) => void;
  setError: (s: string | null) => void;
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

      <OrderBook detail={detail} gold={gold} pending={pending} setPending={setPending} />

      <BaseMarket
        detail={detail}
        walletAddress={walletAddress}
        pipInfo={pipInfo}
        pending={pending}
        setPending={setPending}
        setNotice={setNotice}
        setError={setError}
      />

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

function OrderBook({
  detail,
  gold,
  pending,
  setPending,
}: {
  detail: CompanyMarketDetail;
  gold: number;
  pending: boolean;
  setPending: (v: boolean) => void;
}) {
  const companyId = detail.summary.companyId;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const n = Math.floor(Number(shares) || 0);
  const p = Math.floor(Number(price) || 0);
  const sellable = detail.myShares - detail.myCommitted;
  const cost = n * p;
  const canPlace =
    !pending &&
    n >= 1 &&
    p >= SHARE_ORDER_MIN_PRICE &&
    (side === "buy" ? cost <= gold : n <= sellable);

  const place = () => {
    if (!canPlace) return;
    playSfx("ui_click");
    setPending(true);
    networkManager.sendExchangeOrder(companyId, side, n, p);
    setShares("");
    setPrice("");
  };
  const cancel = (id: string) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendExchangeCancelOrder(id);
  };

  const level = (l: { price: number; shares: number }, color: string) => (
    <div key={`${l.price}`} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
      <span style={{ color, fontWeight: 700 }}>{l.price.toLocaleString()}g</span>
      <span className="chibi-text-muted">{l.shares.toLocaleString()}</span>
    </div>
  );

  return (
    <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
      <div className="chibi-label">📖 Order book (limit orders)</div>
      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <div className="chibi-text-muted" style={{ fontSize: "0.66rem" }}>Bids (buy)</div>
          {detail.bids.length === 0 ? <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>—</div> : detail.bids.map((l) => level(l, "#2f9e5e"))}
        </div>
        <div style={{ flex: 1 }}>
          <div className="chibi-text-muted" style={{ fontSize: "0.66rem" }}>Asks (sell)</div>
          {detail.asks.length === 0 ? <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>—</div> : detail.asks.map((l) => level(l, "#c0392b"))}
        </div>
      </div>

      <div style={{ marginTop: 8, borderTop: "1px solid var(--chibi-outline-light)", paddingTop: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className={`chibi-btn ${side === "buy" ? "chibi-btn--mint" : "chibi-btn--ghost"}`} style={{ flex: 1, padding: "5px", fontSize: "0.72rem" }} onClick={() => setSide("buy")}>
            Buy limit
          </button>
          <button type="button" className={`chibi-btn ${side === "sell" ? "chibi-btn--mint" : "chibi-btn--ghost"}`} style={{ flex: 1, padding: "5px", fontSize: "0.72rem" }} onClick={() => setSide("sell")}>
            Sell limit
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input className="chibi-input" style={{ flex: 1 }} inputMode="numeric" placeholder="Shares" value={shares}
            onChange={(e) => setShares(e.target.value.replace(/[^0-9]/g, ""))}
            onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
          <input className="chibi-input" style={{ flex: 1 }} inputMode="numeric" placeholder="Limit g/share" value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
            onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
          <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "6px 10px" }} disabled={!canPlace} onClick={place}>
            Place
          </button>
        </div>
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 4 }}>
          {side === "buy"
            ? `Escrows ${cost.toLocaleString()}g until filled (you have ${gold.toLocaleString()}g).`
            : `Reserves ${n || 0} shares (${sellable.toLocaleString()} sellable).`}
        </div>
      </div>

      {detail.myOrders.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="chibi-text-muted" style={{ fontSize: "0.66rem" }}>Your open orders</div>
          {detail.myOrders.map((o) => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, fontSize: "0.72rem" }}>
              <span style={{ flex: 1, color: o.side === "buy" ? "#2f9e5e" : "#c0392b" }}>
                {o.side === "buy" ? "BUY" : "SELL"} {o.sharesRemaining.toLocaleString()} @ {o.limitPrice.toLocaleString()}g
              </span>
              <button type="button" className="chibi-btn chibi-btn--ghost" style={{ padding: "4px 8px", fontSize: "0.66rem" }} disabled={pending} onClick={() => cancel(o.id)}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BaseMarket({
  detail,
  walletAddress,
  pipInfo,
  pending,
  setPending,
  setNotice,
  setError,
}: {
  detail: CompanyMarketDetail;
  walletAddress: string | null;
  pipInfo: PipGoldInfoPayload | null;
  pending: boolean;
  setPending: (v: boolean) => void;
  setNotice: (s: string | null) => void;
  setError: (s: string | null) => void;
}) {
  const companyId = detail.summary.companyId;
  const sellable = detail.myShares - detail.myCommitted;
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");

  const list = () => {
    const n = Math.floor(Number(shares) || 0);
    const p = Number(price) || 0;
    if (n < 1 || n > sellable || p <= 0) return;
    playSfx("ui_click");
    setPending(true);
    networkManager.sendExchangeListBase(companyId, n, p);
    setShares("");
    setPrice("");
  };

  const cancel = (id: string) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendExchangeCancelBase(id);
  };

  const buy = async (listing: CompanyMarketDetail["baseListings"][number]) => {
    if (!walletAddress) return setError("Connect your wallet to pay with $BASE.");
    if (!pipInfo?.mint) return setError("Wallet services are unavailable right now.");
    playSfx("ui_click");
    setPending(true);
    setError(null);
    setNotice("Sending $BASE to the seller…");
    try {
      const signature = await sendMetricbaseTokenPayment({
        payerWallet: walletAddress,
        recipientWallet: listing.sellerWallet,
        mint: pipInfo.mint,
        uiAmount: listing.priceBase,
        decimals: pipInfo.decimals,
        rpcUrl: pipInfo.rpcUrl,
      });
      // Persist BEFORE asking the server so a reload can't strand a real payment.
      try {
        localStorage.setItem(PENDING_BASE_KEY, JSON.stringify({ id: listing.id, signature }));
      } catch {
        /* ignore */
      }
      setNotice("Confirming your payment on-chain…");
      networkManager.sendExchangeBuyBase(listing.id, signature);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Payment was cancelled.");
    }
  };

  return (
    <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
      <div className="chibi-label">💵 $BASE market (real crypto)</div>
      {detail.baseListings.length === 0 && (
        <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
          No $BASE listings. List a block below to sell shares for real $BASE.
        </div>
      )}
      {detail.baseListings.map((l) => {
        const mine = l.sellerName === useGameStore.getState().playerName;
        return (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: "0.74rem" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{l.shares.toLocaleString()}</b> shares · <b style={{ color: "#9a4ad9" }}>{l.priceBase} $BASE</b>
              <div className="chibi-text-muted" style={{ fontSize: "0.66rem" }}>
                {mine ? "your listing" : `by ${l.sellerName}`} · {(l.priceBase / l.shares).toFixed(4)} $BASE/share
              </div>
            </div>
            {mine ? (
              <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "5px 9px", fontSize: "0.68rem" }} disabled={pending} onClick={() => cancel(l.id)}>
                Cancel
              </button>
            ) : (
              <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "5px 9px", fontSize: "0.68rem" }} disabled={pending || !walletAddress} onClick={() => void buy(l)}>
                Buy · {l.priceBase} $BASE
              </button>
            )}
          </div>
        );
      })}

      {sellable > 0 && (
        <div style={{ marginTop: 8, borderTop: "1px solid var(--chibi-outline-light)", paddingTop: 8 }}>
          <div style={{ fontSize: "0.7rem", marginBottom: 4 }}>
            List shares for $BASE ({sellable.toLocaleString()} sellable
            {detail.myCommitted > 0 ? `, ${detail.myCommitted.toLocaleString()} already listed` : ""})
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="chibi-input" style={{ flex: 1 }} inputMode="numeric" placeholder="Shares" value={shares}
              onChange={(e) => setShares(e.target.value.replace(/[^0-9]/g, ""))}
              onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
            <input className="chibi-input" style={{ flex: 1 }} inputMode="decimal" placeholder="$BASE total" value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
            <button type="button" className="chibi-btn chibi-btn--mint" style={{ padding: "6px 10px" }} disabled={pending || !walletAddress} onClick={list}>
              List
            </button>
          </div>
          {!walletAddress && (
            <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 3 }}>
              Connect a wallet to receive $BASE.
            </div>
          )}
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
