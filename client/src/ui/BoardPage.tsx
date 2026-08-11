// District Deeds at /board — a standalone page like /dao and /brands.
//
// It never boots Phaser: this is a sit-down board game that should open fast on
// a phone, and the game client is 12MB of art it has no use for.
//
// Sign-in offers THREE routes, which /dashboard does not. A Telegram-only
// player has no wallet, and gold tables are aimed squarely at them — a
// wallet-only door would lock out the exact audience the free tables exist for.

import {
  BOARD_ENTRY_TERMS,
  BOARD_STAKE_TIERS,
  formatCasinoAmount as formatCurrencyAmount,
  getCurrency,
  type BoardAiDifficulty,
  type BoardStatePayload,
  type BoardTableSummary,
} from "@metricbase/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cashOutBank,
  createTable,
  depositToBank,
  getBoardBank,
  getBoardConfig,
  getLobby,
  fundGold,
  joinTable,
  leaveTable,
  setBoardToken,
  setReady,
  setSeed,
  startTable,
  subscribeToTable,
  invitePlayer,
  type BoardConfig,
  type BoardLobby,
  type BoardSubscription,
} from "../board/boardClient";
import { isTelegramMiniApp } from "../telegram/telegramApp";
import type { WalletConnector } from "../wallet/discovery";
import { isLikelyMobile, openInWalletBrowser, walletBrowserLinks, type MobileWalletLink } from "../wallet/mobileWallet";
import { shortenWallet } from "../wallet/solanaProvider";
import { sendSolPayment } from "../wallet/solPayment";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";
import {
  connectAndVerifyWallet,
  getValidWalletSession,
  listAvailableWallets,
  loginWithTelegram,
  resolveWalletConnector,
} from "../wallet/tokenGate";
import { BoardTable } from "./board/BoardTable";
import { FairnessPanel } from "./board/FairnessPanel";
import { TelegramLoginButton } from "./TelegramLoginButton";
import { usePageScroll } from "./usePageScroll";
import { WalletPicker } from "./WalletPicker";
import "./board.css";

const CURRENCY_LABEL: Record<string, string> = { gold: "Gold", base: "$BASE", sol: "SOL" };

function fmt(currencyId: string, uiAmount: number): string {
  if (currencyId === "gold") return `${Math.round(uiAmount).toLocaleString()} gold`;
  return `${formatCurrencyAmount(uiAmount, currencyId)} ${CURRENCY_LABEL[currencyId] ?? currencyId}`;
}

/** Bank balances come back in smallest units; gold is already whole. */
function toUi(currencyId: string, units: number): number {
  if (currencyId === "gold") return units;
  return units / 10 ** getCurrency(currencyId).decimals;
}

export function BoardPage() {
  // The game shell pins html/body/#root to height:100% + overflow:hidden for
  // the canvas. Without this the page simply cannot be scrolled on a phone.
  usePageScroll();

  const [wallet, setWallet] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [config, setConfig] = useState<BoardConfig | null>(null);
  const [lobby, setLobby] = useState<BoardLobby | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [tableId, setTableId] = useState<string | null>(null);
  const [payload, setPayload] = useState<BoardStatePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fairnessOpen, setFairnessOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<WalletConnector[]>([]);
  const [mobileLinks, setMobileLinks] = useState<MobileWalletLink[] | null>(null);
  const subscription = useRef<BoardSubscription | null>(null);

  // create-table form
  const [newCurrency, setNewCurrency] = useState("gold");
  const [newStake, setNewStake] = useState(BOARD_STAKE_TIERS.gold[0]);
  const [newSeats, setNewSeats] = useState(2);
  const [newAi, setNewAi] = useState(1);
  const [newDifficulty, setNewDifficulty] = useState<BoardAiDifficulty>("normal");

  const refreshLobby = useCallback(async () => {
    const [l, b] = await Promise.all([getLobby(), getBoardBank()]);
    if (l.ok && l.data) setLobby(l.data);
    if (b.ok && b.data) setBalances(b.data.balances);
  }, []);

  const afterSignIn = useCallback(
    async (token: string, address: string) => {
      setBoardToken(token);
      setWallet(address);
      setSignedIn(true);
      const c = await getBoardConfig();
      if (c.ok && c.data) setConfig(c.data);
      await refreshLobby();
    },
    [refreshLobby],
  );

  useEffect(() => {
    void (async () => {
      try {
        const session = await getValidWalletSession();
        if (session) return void afterSignIn(session.accessToken, session.wallet);
      } catch {
        /* fall through to the sign-in card */
      }
      // Inside the Mini App we already have everything needed to authenticate,
      // so don't make the player press a button to prove it.
      if (isTelegramMiniApp()) {
        try {
          const tg = await loginWithTelegram();
          return void afterSignIn(tg.accessToken, tg.wallet);
        } catch {
          /* show the sign-in card */
        }
      }
    })();
  }, [afterSignIn]);

  // Follow the selected table.
  useEffect(() => {
    subscription.current?.stop();
    subscription.current = null;
    setPayload(null);
    if (!tableId) return;
    subscription.current = subscribeToTable(tableId, setPayload, setError);
    return () => {
      subscription.current?.stop();
      subscription.current = null;
    };
  }, [tableId]);

  // Keep the lobby fresh while we're looking at it.
  useEffect(() => {
    if (!signedIn || tableId) return;
    const t = setInterval(() => void refreshLobby(), 6000);
    return () => clearInterval(t);
  }, [signedIn, tableId, refreshLobby]);

  const connectSelected = async (connector: WalletConnector) => {
    setBusy(true);
    setError(null);
    try {
      const verified = await connectAndVerifyWallet(connector);
      await afterSignIn(verified.accessToken, verified.wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet verification failed.");
    } finally {
      setBusy(false);
      setWalletPickerOpen(false);
    }
  };

  const handleConnectWallet = () => {
    setError(null);
    setMobileLinks(null);
    const preferred = resolveWalletConnector();
    if (preferred) return void connectSelected(preferred);
    const wallets = listAvailableWallets();
    if (wallets.length === 0) {
      // A plain mobile browser has no injected provider at all; offer to reopen
      // inside a wallet's own browser rather than dead-ending.
      if (isLikelyMobile()) return setMobileLinks(walletBrowserLinks());
      setError("No Solana wallet detected. Install one, then refresh.");
      return;
    }
    setDetectedWallets(wallets);
    setWalletPickerOpen(true);
  };

  const doCreate = async () => {
    setBusy(true);
    setError(null);
    const res = await createTable({
      currencyId: newCurrency,
      stake: newStake,
      seatCount: newSeats,
      aiCount: newCurrency === "gold" ? newAi : 0,
      aiDifficulty: newDifficulty,
      name: "",
    });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? "Couldn't open that table.");
    setTableId(res.data.tableId);
    await refreshLobby();
  };

  const doJoin = async (id: string) => {
    setBusy(true);
    const res = await joinTable(id);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Couldn't join.");
    setTableId(id);
  };

  const doDeposit = async (currencyId: string, uiAmount: number) => {
    if (!wallet || !config?.houseWallet) return setError("Stake tables are closed right now.");
    setBusy(true);
    setError(null);
    setNotice("Approve the transfer in your wallet…");
    try {
      const rpcUrl = config.rpcUrl;
      const signature =
        currencyId === "sol"
          ? await sendSolPayment({
              payerWallet: wallet,
              recipientWallet: config.houseWallet,
              uiAmount,
              rpcUrl,
            })
          : await sendMetricbaseTokenPayment({
              payerWallet: wallet,
              recipientWallet: config.houseWallet,
              mint: config.mint ?? "",
              uiAmount,
              decimals: getCurrency(currencyId).decimals,
              rpcUrl,
            });

      setNotice("Confirming on-chain…");
      // The server treats "not indexed yet" as retryable (202) precisely so a
      // real payment is never dropped — so keep asking rather than giving up.
      for (let attempt = 0; attempt < 8; attempt++) {
        const res = await depositToBank(currencyId, signature, uiAmount);
        if (res.ok && res.data) {
          setBalances(res.data.balances);
          setNotice(`Added ${fmt(currencyId, uiAmount)} to your table bank.`);
          return;
        }
        if (res.status !== 202) {
          setError(res.error ?? "Couldn't confirm that transfer.");
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      setError("That transfer is taking a while to settle. It's safe — try the deposit again in a minute.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The transfer didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  const doFundGold = async (amount: number) => {
    setBusy(true);
    setError(null);
    const res = await fundGold(amount);
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? "Couldn't move that gold.");
    setBalances(res.data.balances);
    setNotice(`Moved ${res.data.moved.toLocaleString()} gold into your table bank.`);
  };

  const doCashOut = async (currencyId: string, uiAmount: number) => {
    setBusy(true);
    setError(null);
    const res = await cashOutBank(currencyId, uiAmount);
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? "Couldn't cash that out.");
    setBalances(res.data.balances);
    setNotice(
      currencyId === "gold"
        ? "Sent back to your character — it'll be there next time you're in the world."
        : "Sent to your wallet.",
    );
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (!signedIn) {
    return (
      <div className="dd-page">
        <Header />
        <div className="dd-card dd-signin">
          <h2>Sign in to play</h2>
          <p className="dd-muted">
            Gold tables are open to everyone. Stake tables need a Solana wallet.
          </p>
          {error && <p className="dd-warn">{error}</p>}
          <button className="dd-btn dd-btn-primary" disabled={busy} onClick={handleConnectWallet}>
            Connect a Solana wallet
          </button>
          <div className="dd-or">or</div>
          <TelegramLoginButton
            onSuccess={(s) => void afterSignIn(s.accessToken, s.wallet)}
            onError={(m) => setError(m)}
          />
          {mobileLinks && (
            <div className="dd-row">
              {mobileLinks.map((link) => (
                <button key={link.name} className="dd-btn" onClick={() => openInWalletBrowser(link)}>
                  Open in {link.name}
                </button>
              ))}
            </div>
          )}
          <a className="dd-back" href="/play">
            ← Back to the world
          </a>
        </div>
        {walletPickerOpen && (
          <WalletPicker
            wallets={detectedWallets}
            onSelect={(w) => void connectSelected(w)}
            onClose={() => setWalletPickerOpen(false)}
          />
        )}
      </div>
    );
  }

  if (tableId && payload) {
    const seat = payload.seats.find((s) => s.index === payload.mySeat);
    const isHost = payload.table.hostName === (seat?.name ?? "");
    return (
      <div className="dd-page">
        <Header onBack={() => setTableId(null)} />
        {error && <p className="dd-warn dd-banner">{error}</p>}
        {payload.table.status === "lobby" ? (
          <div className="dd-card">
            <h2>Waiting to start</h2>
            <p className="dd-muted">
              {fmt(payload.table.currencyId, toUi(payload.table.currencyId, payload.table.stake))} per seat ·{" "}
              {payload.table.filled}/{payload.table.seatCount} seats
            </p>
            <ul className="dd-seatlist">
              {payload.seats.map((s) => (
                <li key={s.index}>
                  {s.name} {s.kind === "ai" ? "· practice" : ""} {s.ready ? "· ready" : "· not ready"}
                </li>
              ))}
            </ul>
            <label className="dd-field">
              <span>Your dice seed (mixed into every roll)</span>
              <input
                className="dd-input"
                placeholder="anything you like"
                onBlur={(e) => void setSeed(payload.table.id, e.target.value)}
              />
            </label>
            <div className="dd-row">
              <button className="dd-btn" onClick={() => void setReady(payload.table.id, !seat?.ready)}>
                {seat?.ready ? "Not ready" : "I'm ready"}
              </button>
              <InviteBox tableId={payload.table.id} onError={setError} />
              {isHost && (
                <button
                  className="dd-btn dd-btn-primary"
                  onClick={async () => {
                    const res = await startTable(payload.table.id);
                    if (!res.ok) setError(res.error ?? "Couldn't start.");
                  }}
                >
                  Start the table
                </button>
              )}
              <button
                className="dd-btn dd-btn-ghost"
                onClick={async () => {
                  await leaveTable(payload.table.id);
                  setTableId(null);
                  await refreshLobby();
                }}
              >
                Leave (stake refunded)
              </button>
            </div>
            <button className="dd-btn dd-btn-ghost" onClick={() => setTermsOpen(true)}>
              What am I agreeing to?
            </button>
          </div>
        ) : (
          <BoardTable payload={payload} onError={setError} onOpenFairness={() => setFairnessOpen(true)} />
        )}
        {fairnessOpen && <FairnessPanel tableId={payload.table.id} onClose={() => setFairnessOpen(false)} />}
        {termsOpen && <TermsModal terms={config?.terms ?? [...BOARD_ENTRY_TERMS]} onClose={() => setTermsOpen(false)} />}
      </div>
    );
  }

  const currencies = config?.currencies ?? ["gold"];

  return (
    <div className="dd-page">
      <Header />
      {error && <p className="dd-warn dd-banner">{error}</p>}
      {notice && <p className="dd-banner dd-banner-info">{notice}</p>}

      <div className="dd-card">
        <h2>Your table bank</h2>
        <p className="dd-muted">
          Money you bring to the table lives here. It's yours — cash it out whenever you're not sitting at a table.
        </p>
        {currencies.map((c) => (
          <div key={c} className="dd-bankrow">
            <span>{CURRENCY_LABEL[c] ?? c}</span>
            <strong>{fmt(c, toUi(c, balances[c] ?? 0))}</strong>
            {c === "gold" ? (
              <GoldControls busy={busy} onFund={doFundGold} onCashOut={doCashOut} />
            ) : (
              <BankControls currencyId={c} busy={busy} onDeposit={doDeposit} onCashOut={doCashOut} />
            )}
            {(balances[c] ?? 0) > 0 && (
              <button
                className="dd-btn dd-btn-sm"
                disabled={busy}
                onClick={() => void doCashOut(c, toUi(c, balances[c] ?? 0))}
              >
                Cash out all
              </button>
            )}
          </div>
        ))}
        {wallet && <p className="dd-muted">Signed in as {shortenWallet(wallet)}</p>}
      </div>

      <div className="dd-card">
        <h2>Open a table</h2>
        <div className="dd-row dd-wrap">
          <label className="dd-field">
            <span>Stake in</span>
            <select
              className="dd-input"
              value={newCurrency}
              onChange={(e) => {
                setNewCurrency(e.target.value);
                setNewStake(BOARD_STAKE_TIERS[e.target.value as "gold"]?.[0] ?? 1000);
                const limits = config?.seatLimits?.[e.target.value];
                if (limits) setNewSeats(limits.min);
                if (e.target.value !== "gold") setNewAi(0);
              }}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABEL[c] ?? c}
                </option>
              ))}
            </select>
          </label>
          <label className="dd-field">
            <span>Stake</span>
            <select className="dd-input" value={newStake} onChange={(e) => setNewStake(Number(e.target.value))}>
              {(BOARD_STAKE_TIERS[newCurrency as "gold"] ?? []).map((s) => (
                <option key={s} value={s}>
                  {fmt(newCurrency, s)}
                </option>
              ))}
            </select>
          </label>
          <label className="dd-field">
            <span>Seats</span>
            <input
              type="number"
              className="dd-input"
              min={config?.seatLimits?.[newCurrency]?.min ?? 2}
              max={config?.seatLimits?.[newCurrency]?.max ?? 6}
              value={newSeats}
              onChange={(e) => setNewSeats(Number(e.target.value))}
            />
          </label>
          {newCurrency === "gold" && (
            <>
              <label className="dd-field">
                <span>Practice opponents</span>
                <input
                  type="number"
                  className="dd-input"
                  min={0}
                  max={Math.max(0, newSeats - 1)}
                  value={newAi}
                  onChange={(e) => setNewAi(Number(e.target.value))}
                />
              </label>
              <label className="dd-field">
                <span>Difficulty</span>
                <select
                  className="dd-input"
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value as BoardAiDifficulty)}
                >
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                </select>
              </label>
            </>
          )}
          <button className="dd-btn dd-btn-primary" disabled={busy} onClick={() => void doCreate()}>
            Open it
          </button>
        </div>
        {newCurrency !== "gold" && (
          <p className="dd-muted">
            Stake tables are all-human — practice opponents only sit at gold tables.
          </p>
        )}
        <button className="dd-btn dd-btn-ghost" onClick={() => setTermsOpen(true)}>
          What am I agreeing to?
        </button>
      </div>

      {(lobby?.invites.length ?? 0) > 0 && (
        <div className="dd-card">
          <h2>You've been invited</h2>
          {lobby!.invites.map((inv) => (
            <div key={inv.tableId} className="dd-row">
              <span>{inv.fromName} invited you</span>
              <button className="dd-btn dd-btn-primary" onClick={() => void doJoin(inv.tableId)}>
                Take a seat
              </button>
            </div>
          ))}
        </div>
      )}

      {(lobby?.mine.length ?? 0) > 0 && (
        <div className="dd-card">
          <h2>Your tables</h2>
          {lobby!.mine.map((t) => (
            <TableRow key={t.id} table={t} label="Rejoin" onPick={() => setTableId(t.id)} />
          ))}
        </div>
      )}

      <div className="dd-card">
        <h2>Open tables</h2>
        {(lobby?.open.length ?? 0) === 0 && <p className="dd-muted">Nothing open. Start one above.</p>}
        {lobby?.open.map((t) => (
          <TableRow key={t.id} table={t} label="Join" onPick={() => void doJoin(t.id)} />
        ))}
      </div>

      {termsOpen && <TermsModal terms={config?.terms ?? [...BOARD_ENTRY_TERMS]} onClose={() => setTermsOpen(false)} />}
    </div>
  );
}

function Header({ onBack }: { onBack?: () => void }) {
  return (
    <header className="dd-header">
      <h1>🎲 District Deeds</h1>
      {onBack ? (
        <button className="dd-btn dd-btn-ghost" onClick={onBack}>
          ← All tables
        </button>
      ) : (
        <a className="dd-back" href="/play">
          ← Back to the world
        </a>
      )}
    </header>
  );
}

function TableRow({
  table,
  label,
  onPick,
}: {
  table: BoardTableSummary;
  label: string;
  onPick: () => void;
}) {
  return (
    <div className="dd-row dd-tablerow">
      <span>
        {fmt(table.currencyId, toUi(table.currencyId, table.stake))} · {table.filled}/{table.seatCount} seats
        {table.aiCount > 0 ? ` · ${table.aiCount} practice` : ""} · {table.status}
      </span>
      <button className="dd-btn" onClick={onPick}>
        {label}
      </button>
    </div>
  );
}

function GoldControls({
  busy,
  onFund,
  onCashOut,
}: {
  busy: boolean;
  onFund: (amount: number) => Promise<void>;
  onCashOut: (c: string, amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(10000);
  return (
    <span className="dd-row">
      <input
        type="number"
        className="dd-input dd-input-sm"
        min={1}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      <button className="dd-btn dd-btn-sm" disabled={busy || amount <= 0} onClick={() => void onFund(amount)}>
        Add from your character
      </button>
      <button className="dd-btn dd-btn-sm" disabled={busy || amount <= 0} onClick={() => void onCashOut("gold", amount)}>
        Send back
      </button>
    </span>
  );
}

function BankControls({
  currencyId,
  busy,
  onDeposit,
  onCashOut,
}: {
  currencyId: string;
  busy: boolean;
  onDeposit: (c: string, amount: number) => Promise<void>;
  onCashOut: (c: string, amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(BOARD_STAKE_TIERS[currencyId as "base"]?.[0] ?? 0);
  return (
    <span className="dd-row">
      <input
        type="number"
        className="dd-input dd-input-sm"
        value={amount}
        step="any"
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      <button className="dd-btn dd-btn-sm" disabled={busy || amount <= 0} onClick={() => void onDeposit(currencyId, amount)}>
        Add
      </button>
      <button className="dd-btn dd-btn-sm" disabled={busy || amount <= 0} onClick={() => void onCashOut(currencyId, amount)}>
        Take out
      </button>
    </span>
  );
}

function InviteBox({ tableId, onError }: { tableId: string; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  return (
    <span className="dd-row">
      <input
        className="dd-input dd-input-sm"
        placeholder="invite by name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        className="dd-btn dd-btn-sm"
        onClick={async () => {
          const res = await invitePlayer(tableId, name);
          if (!res.ok) onError(res.error ?? "Couldn't send that invite.");
          else setName("");
        }}
      >
        Invite
      </button>
    </span>
  );
}

function TermsModal({ terms, onClose }: { terms: string[]; onClose: () => void }) {
  return (
    <div className="dd-modal" role="dialog" aria-label="Entry terms">
      <div className="dd-modal-body">
        <h2>Before you sit down</h2>
        <ul className="dd-terms">
          {terms.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <button className="dd-btn dd-btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
