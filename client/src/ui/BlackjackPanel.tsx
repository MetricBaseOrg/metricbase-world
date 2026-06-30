import {
  CASINO_CURRENCIES,
  CASINO_ACTIVE_CURRENCY_IDS,
  getCasinoTable,
  formatCasinoAmount,
  handValue,
  type Card,
  type CasinoStatePayload,
} from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { depositToCasino } from "../wallet/casinoDeposit";

const SUIT_SYMBOL: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_RED = new Set(["H", "D"]);

function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) return <span className="chibi-bj-card chibi-bj-card--back" aria-hidden="true" />;
  return (
    <span className={`chibi-bj-card${SUIT_RED.has(card.suit) ? " chibi-bj-card--red" : ""}`}>
      <span className="chibi-bj-card__rank">{card.rank}</span>
      <span className="chibi-bj-card__suit">{SUIT_SYMBOL[card.suit]}</span>
    </span>
  );
}

export function BlackjackPanel() {
  const open = useGameStore((s) => s.blackjackOpen);
  const setOpen = useGameStore((s) => s.setBlackjackOpen);
  const walletAddress = useGameStore((s) => s.walletAddress);

  const activeCurrencies = CASINO_CURRENCIES.filter((c) => CASINO_ACTIVE_CURRENCY_IDS.includes(c.id as never));
  const [state, setState] = useState<CasinoStatePayload | null>(null);
  const [currencyId, setCurrencyId] = useState(activeCurrencies[0]?.id ?? "base");
  const [bet, setBet] = useState(0);
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState({ hands: 0, wins: 0, streak: 0, best: 0, net: 0 });
  const pendingHand = useRef(false);

  const table = getCasinoTable(currencyId);

  useEffect(() => {
    const offState = networkManager.onCasinoState((s) => setState(s));
    const offResult = networkManager.onCasinoResult((r) => {
      setBusy(null);
      if (r.state) setState(r.state);
      if (!r.ok) {
        setError(r.error ?? "Something went wrong.");
        playSfx("shop_fail");
        return;
      }
      setError(null);
      const hand = r.state?.hand;
      const outcome = hand?.outcome;
      // Count a finished hand once, only when it followed a deal/action we sent
      // (not a passive state refresh).
      if (pendingHand.current && hand?.phase === "done" && outcome) {
        pendingHand.current = false;
        setStats((s) => {
          const won = outcome === "win" || outcome === "blackjack";
          const streak = won ? s.streak + 1 : outcome === "lose" ? 0 : s.streak;
          return {
            hands: s.hands + 1,
            wins: s.wins + (won ? 1 : 0),
            streak,
            best: Math.max(s.best, streak),
            net: s.net + (hand.net ?? 0),
          };
        });
      }
      if (outcome === "win" || outcome === "blackjack") playSfx("level_up");
      else if (outcome === "lose") playSfx("shop_fail");
      else playSfx("ui_click");
      if (r.signature) setNotice(`Paid out — tx ${r.signature.slice(0, 8)}…`);
    });
    return () => {
      offState();
      offResult();
    };
  }, []);

  useEffect(() => {
    if (open) networkManager.requestCasinoState();
  }, [open]);

  useEffect(() => {
    if (table) setBet(table.minBet);
  }, [currencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !table) return null;

  const cfg = table;
  const balance = state?.balances?.[currencyId as keyof typeof state.balances] ?? 0;
  const hand = state?.hand ?? null;
  const handActive = hand && hand.phase !== "done";
  const houseWallet = state?.houseWallet ?? null;

  const deposit = async () => {
    const amount = Number(depositAmt);
    if (!walletAddress) return setError("Connect your wallet first.");
    if (!houseWallet) return setError("Deposits are disabled right now.");
    if (!Number.isFinite(amount) || amount < cfg.minDeposit) {
      return setError(`Minimum deposit is ${cfg.minDeposit} ${getLabel(currencyId)}.`);
    }
    setBusy("deposit");
    setError(null);
    setNotice("Confirm the deposit in your wallet…");
    try {
      const signature = await depositToCasino({
        currencyId,
        uiAmount: amount,
        payerWallet: walletAddress,
        houseWallet,
        rpcUrl: state?.rpcUrl ?? null,
        mint: state?.mints?.[currencyId] ?? null,
      });
      setNotice("Verifying deposit on-chain…");
      networkManager.sendCasinoDeposit(currencyId, signature);
      setDepositAmt("");
    } catch (e) {
      setBusy(null);
      setNotice(null);
      setError(e instanceof Error ? e.message : "Deposit failed.");
    }
  };

  const withdraw = () => {
    const amount = Number(withdrawAmt);
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter an amount to withdraw.");
    if (amount > balance) return setError("You can't withdraw more than your balance.");
    setBusy("withdraw");
    setError(null);
    setNotice("Sending payout…");
    networkManager.sendCasinoWithdraw(currencyId, amount);
    setWithdrawAmt("");
  };

  const deal = () => {
    if (bet < cfg.minBet || bet > cfg.maxBet) return setError(`Bet ${cfg.minBet}–${cfg.maxBet}.`);
    if (bet > balance) return setError("Not enough balance — deposit to play.");
    setBusy("deal");
    setError(null);
    setNotice(null);
    pendingHand.current = true;
    networkManager.sendBlackjackDeal(currencyId, bet);
  };

  const act = (action: "hit" | "stand" | "double") => {
    setBusy(action);
    setError(null);
    pendingHand.current = true;
    networkManager.sendBlackjackAction(action);
  };

  const claimDaily = () => {
    setBusy("daily");
    setError(null);
    networkManager.sendCasinoDailyClaim();
    playSfx("item_use");
  };

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="Blackjack">
      <div className="chibi-panel chibi-panel--floating chibi-bj">
        <div className="chibi-close-row">
          <div className="chibi-title chibi-title--sm chibi-sparkle-title">♠ Lodge Blackjack</div>
          <button
            type="button"
            className="chibi-btn chibi-btn--ghost"
            onClick={() => {
              playSfx("ui_close");
              setOpen(false);
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Currency tabs */}
        <div className="chibi-bj-tabs">
          {activeCurrencies.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chibi-btn ${currencyId === c.id ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
              style={{ padding: "4px 10px", fontSize: "0.74rem" }}
              disabled={!!handActive}
              onClick={() => setCurrencyId(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Daily login bonus — the come-back-every-day hook. */}
        {state?.dailyAvailable && (
          <button
            type="button"
            className="chibi-bj-daily"
            disabled={busy !== null}
            onClick={() => claimDaily()}
          >
            🎁 Claim daily bonus{state.dailyStreak > 0 ? ` · day ${state.dailyStreak + 1} streak!` : ""}
          </button>
        )}

        {/* Cashier */}
        <div className="chibi-bj-cashier">
          <div className="chibi-bj-balance">
            Balance: <strong>{formatCasinoAmount(balance, currencyId)} {getLabel(currencyId)}</strong>
          </div>
          <div className="chibi-bj-cashier__row">
            <input
              className="chibi-input"
              inputMode="decimal"
              placeholder={`Deposit (min ${cfg.minDeposit})`}
              value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
            />
            <button
              type="button"
              className="chibi-btn chibi-btn--mint"
              disabled={busy !== null || !walletAddress}
              onClick={() => void deposit()}
            >
              {busy === "deposit" ? "…" : "Deposit"}
            </button>
          </div>
          <div className="chibi-bj-cashier__row">
            <input
              className="chibi-input"
              inputMode="decimal"
              placeholder="Withdraw"
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
            />
            <button
              type="button"
              className="chibi-btn chibi-btn--gold"
              disabled={busy !== null || !state?.withdrawEnabled}
              onClick={() => withdraw()}
              title={state?.withdrawEnabled ? "Cash out to your wallet" : "Withdrawals not available yet"}
            >
              {busy === "withdraw" ? "…" : "Withdraw"}
            </button>
          </div>
          {!walletAddress && <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>Connect a wallet to deposit.</div>}
          {!state?.withdrawEnabled && (
            <div className="chibi-text-muted" style={{ fontSize: "0.68rem" }}>Cash-out opens once the house wallet is live.</div>
          )}
        </div>

        {/* Table */}
        <div className="chibi-bj-table">
          {hand ? (
            <>
              <div className="chibi-bj-seat">
                <div className="chibi-bj-seat__label">
                  Dealer {hand.dealerHidden ? "" : `— ${handValue(hand.dealerCards)}`}
                </div>
                <div className="chibi-bj-cards">
                  {hand.dealerCards.map((c, i) => (
                    <CardView key={i} card={c} />
                  ))}
                  {hand.dealerHidden && <CardView hidden />}
                </div>
              </div>
              <div className="chibi-bj-seat">
                <div className="chibi-bj-seat__label">You — {handValue(hand.playerCards)}</div>
                <div className="chibi-bj-cards">
                  {hand.playerCards.map((c, i) => (
                    <CardView key={i} card={c} />
                  ))}
                </div>
              </div>
              {hand.phase === "done" && hand.outcome && (
                <div className={`chibi-bj-outcome chibi-bj-outcome--${hand.outcome}`}>
                  {outcomeLabel(hand.outcome)}
                  {typeof hand.net === "number" && (
                    <span> {hand.net >= 0 ? "+" : ""}{formatCasinoAmount(hand.net, currencyId)} {getLabel(currencyId)}</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "10px 4px", color: "rgba(255,255,255,0.9)", fontSize: "0.82rem", fontWeight: 600 }}>
              Place your bet and deal a hand.<br />Dealer stands on 17 · Blackjack pays 3:2.
            </div>
          )}
        </div>

        {/* Session stats — keeps a run going. */}
        {stats.hands > 0 && (
          <div className="chibi-bj-stats">
            <span>🃏 {stats.hands}</span>
            <span>✅ {stats.wins}</span>
            <span>🔥 {stats.streak}{stats.best > 1 ? ` (best ${stats.best})` : ""}</span>
            <span style={{ color: stats.net >= 0 ? "var(--chibi-mint-deep)" : "#d6453b" }}>
              {stats.net >= 0 ? "+" : ""}{formatCasinoAmount(stats.net, currencyId)}
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="chibi-bj-controls">
          {handActive ? (
            <>
              <button type="button" className="chibi-btn chibi-btn--primary" disabled={busy !== null} onClick={() => act("hit")}>Hit</button>
              <button type="button" className="chibi-btn chibi-btn--secondary" disabled={busy !== null} onClick={() => act("stand")}>Stand</button>
              <button type="button" className="chibi-btn chibi-btn--gold" disabled={busy !== null || !hand?.canDouble} onClick={() => act("double")}>Double</button>
            </>
          ) : (
            <>
              <div className="chibi-bj-bet">
                <button type="button" className="chibi-btn chibi-btn--ghost" onClick={() => setBet((b) => Math.max(cfg.minBet, Number((b - cfg.betStep).toFixed(8))))}>−</button>
                <span className="chibi-bj-bet__val">{formatCasinoAmount(bet, currencyId)}</span>
                <button type="button" className="chibi-btn chibi-btn--ghost" onClick={() => setBet((b) => Math.min(cfg.maxBet, Number((b + cfg.betStep).toFixed(8))))}>+</button>
              </div>
              <button type="button" className="chibi-btn chibi-btn--primary" disabled={busy !== null} onClick={() => deal()}>
                {busy === "deal" ? "Dealing…" : hand?.phase === "done" ? "Deal Again" : "Deal"}
              </button>
            </>
          )}
        </div>

        {notice && <div className="chibi-text-muted" style={{ marginTop: 8, fontSize: "0.74rem" }}>{notice}</div>}
        {error && (
          <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, fontSize: "0.78rem" }}>{error}</div>
        )}
      </div>
    </div>
  );
}

function getLabel(currencyId: string): string {
  return CASINO_CURRENCIES.find((c) => c.id === currencyId)?.label ?? currencyId.toUpperCase();
}

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "blackjack":
      return "Blackjack!";
    case "win":
      return "You win!";
    case "push":
      return "Push — bet returned";
    default:
      return "Dealer wins";
  }
}
