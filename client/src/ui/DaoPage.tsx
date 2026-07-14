import {
  DAO_DEFAULT_DURATION_DAYS,
  DAO_DESCRIPTION_MAX,
  DAO_MAX_DURATION_DAYS,
  DAO_MAX_OPTIONS,
  DAO_MIN_CREATE_BALANCE,
  DAO_MIN_DURATION_DAYS,
  DAO_MIN_OPTIONS,
  DAO_MIN_VOTE_BALANCE,
  DAO_OPTION_MAX,
  DAO_TITLE_MAX,
  isDaoPollOpen,
  type DaoActionResponse,
  type DaoPoll,
  type DaoPollsResponse,
} from "@metricbase/shared";
import { useEffect, useState } from "react";
import { getHttpServerUrl } from "../game/serverUrl";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type { WalletConnector } from "../wallet/discovery";
import { shortenWallet } from "../wallet/solanaProvider";
import {
  connectAndVerifyWallet,
  getValidWalletSession,
  listAvailableWallets,
  resolveWalletConnector,
} from "../wallet/tokenGate";
import { WalletPicker } from "./WalletPicker";
import "./dashboard.css";

/**
 * MetricBase DAO at /dao — a standalone wallet-only page (like /brands).
 * $BASE holders create token-weighted polls (≥ 10M to create, ≥ 1M to vote);
 * a vote's weight is the wallet's live balance when it's cast, then frozen.
 */

const kfmt = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, "")}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  return Math.round(n).toLocaleString();
};

function timeLeft(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${Math.max(1, minutes)}m left`;
}

export function DaoPage() {
  const [polls, setPolls] = useState<DaoPoll[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<WalletConnector[]>([]);
  const [busyPoll, setBusyPoll] = useState<string | null>(null);
  // Create-poll form
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [duration, setDuration] = useState(DAO_DEFAULT_DURATION_DAYS);

  // This is an ordinary scrolling web page (the game shell locks scrolling).
  useEffect(() => {
    const root = document.getElementById("root");
    const targets = [document.documentElement, document.body, root].filter(Boolean) as HTMLElement[];
    const prev = targets.map((el) => ({ el, height: el.style.height, overflow: el.style.overflow }));
    for (const el of targets) {
      el.style.height = "auto";
      el.style.overflow = "visible";
    }
    document.body.style.overflowY = "auto";
    return () => {
      for (const p of prev) {
        p.el.style.height = p.height;
        p.el.style.overflow = p.overflow;
      }
    };
  }, []);

  const loadPolls = async (token: string | null) => {
    const response = await fetchWithTimeout(`${getHttpServerUrl()}/api/dao/polls`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error("Failed to load DAO polls.");
    const body = (await response.json()) as DaoPollsResponse;
    setPolls(body.polls);
    setBalance(typeof body.balance === "number" ? body.balance : null);
  };

  useEffect(() => {
    void (async () => {
      let token: string | null = null;
      try {
        const session = await getValidWalletSession();
        if (session) {
          setWallet(session.wallet);
          setAccessToken(session.accessToken);
          token = session.accessToken;
        }
      } catch {
        /* stay signed out */
      }
      try {
        await loadPolls(token);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load DAO polls.");
      }
    })();
  }, []);

  const connectSelectedWallet = async (connector: WalletConnector) => {
    setConnecting(true);
    setError(null);
    try {
      const verified = await connectAndVerifyWallet(connector);
      setWallet(verified.wallet);
      setAccessToken(verified.accessToken);
      await loadPolls(verified.accessToken);
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : "Wallet verification failed.");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectWallet = () => {
    setError(null);
    const preferred = resolveWalletConnector();
    if (preferred) return void connectSelectedWallet(preferred);
    const wallets = listAvailableWallets();
    if (wallets.length === 0) {
      setError("No Solana wallet detected. Install a Solana wallet, then refresh this page.");
      return;
    }
    setDetectedWallets(wallets);
    setWalletPickerOpen(true);
  };

  const post = async (path: string, body: unknown): Promise<DaoActionResponse> => {
    const response = await fetchWithTimeout(`${getHttpServerUrl()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return (await response.json().catch(() => ({ ok: false, error: "Request failed." }))) as DaoActionResponse;
  };

  const handleVote = async (poll: DaoPoll, optionIndex: number) => {
    if (!accessToken) return handleConnectWallet();
    setBusyPoll(poll.id);
    setNotice(null);
    setError(null);
    const result = await post(`/api/dao/polls/${poll.id}/vote`, { optionIndex });
    setBusyPoll(null);
    if (!result.ok || !result.poll) {
      setError(result.error ?? "Vote failed.");
      return;
    }
    setPolls((prev) => (prev ?? []).map((p) => (p.id === result.poll!.id ? result.poll! : p)));
    setNotice(`✅ Vote recorded with ${kfmt(result.poll.myWeight ?? 0)} $BASE weight.`);
  };

  const handleCreate = async () => {
    if (!accessToken) return handleConnectWallet();
    setCreating(true);
    setNotice(null);
    setError(null);
    const result = await post("/api/dao/polls", {
      title,
      description,
      options: options.filter((o) => o.trim()),
      durationDays: duration,
    });
    setCreating(false);
    if (!result.ok || !result.poll) {
      setError(result.error ?? "Failed to create the poll.");
      return;
    }
    setPolls((prev) => [result.poll!, ...(prev ?? [])]);
    setFormOpen(false);
    setTitle("");
    setDescription("");
    setOptions(["", ""]);
    setDuration(DAO_DEFAULT_DURATION_DAYS);
    setNotice("✅ Poll created — voting is open.");
  };

  const canCreate = balance !== null && balance >= DAO_MIN_CREATE_BALANCE;
  const canVote = balance !== null && balance >= DAO_MIN_VOTE_BALANCE;

  const renderPoll = (poll: DaoPoll) => {
    const open = isDaoPollOpen(poll, Date.now());
    const total = poll.totals.reduce((a, b) => a + b, 0);
    const leading = Math.max(...poll.totals, 0);
    return (
      <section key={poll.id} className="chibi-panel mb-dash-card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{poll.title}</h2>
          <span
            className="chibi-stat-pill"
            style={{ fontSize: "0.72rem", ...(open ? {} : { opacity: 0.6 }) }}
            title={new Date(poll.endsAt).toLocaleString()}
          >
            {open ? `🟢 ${timeLeft(poll.endsAt)}` : "⚪ ended"}
          </span>
        </div>
        {poll.description && (
          <p style={{ fontSize: "0.85rem", margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{poll.description}</p>
        )}
        <div style={{ marginTop: 10 }}>
          {poll.options.map((option, index) => {
            const weight = poll.totals[index] ?? 0;
            const pct = total > 0 ? Math.round((weight / total) * 100) : 0;
            const isMine = poll.myVote === index;
            const isLeading = total > 0 && weight === leading;
            return (
              <div key={option} style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.82rem", alignItems: "center" }}>
                  <span style={{ fontWeight: isLeading ? 800 : 600 }}>
                    {option} {isMine && <span title="Your vote">🗳️</span>}
                  </span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "var(--chibi-ink-soft, #9c8a6d)", fontSize: "0.74rem" }}>
                      {kfmt(weight)} $BASE · {pct}%
                    </span>
                    {open && poll.myVote === undefined && (
                      <button
                        type="button"
                        className="chibi-btn chibi-btn--primary"
                        style={{ padding: "3px 10px", fontSize: "0.72rem" }}
                        disabled={busyPoll === poll.id || (wallet !== null && !canVote)}
                        onClick={() => void handleVote(poll, index)}
                      >
                        {busyPoll === poll.id ? "…" : "Vote"}
                      </button>
                    )}
                  </span>
                </div>
                <div style={{ marginTop: 3, height: 10, borderRadius: 999, background: "#f0e4c8", border: "1.5px solid #e6d3aa", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: isMine ? "#3fae74" : isLeading ? "#e0a92e" : "#c9b088",
                      transition: "width .3s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--chibi-ink-soft, #9c8a6d)" }}>
          {poll.voters.toLocaleString()} wallet{poll.voters === 1 ? "" : "s"} · {kfmt(total)} $BASE total weight ·
          by {shortenWallet(poll.creatorWallet)}
        </div>
      </section>
    );
  };

  return (
    <div className="mb-dash" style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 48px" }}>
        <header style={{ textAlign: "center", marginBottom: 16 }}>
          <a href="/" style={{ textDecoration: "none" }}>
            <img src="/metricbase-world.png" alt="MetricBase World" style={{ height: 48 }} />
          </a>
          <h1 className="chibi-title" style={{ margin: "8px 0 4px" }}>🏛️ MetricBase DAO</h1>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--chibi-ink-soft, #9c8a6d)" }}>
            Govern the world with your $BASE. Hold {kfmt(DAO_MIN_CREATE_BALANCE)} to create a poll,{" "}
            {kfmt(DAO_MIN_VOTE_BALANCE)} to vote — one wallet, one vote, weighted by your holdings.
          </p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {wallet ? (
              <>
                <span className="chibi-stat-pill" style={{ fontSize: "0.76rem" }}>👛 {shortenWallet(wallet)}</span>
                {balance !== null && (
                  <span className="chibi-stat-pill" style={{ fontSize: "0.76rem" }} title={`${Math.floor(balance).toLocaleString()} $BASE`}>
                    💎 {kfmt(balance)} $BASE
                  </span>
                )}
              </>
            ) : (
              <button type="button" className="chibi-btn chibi-btn--gold" disabled={connecting} onClick={handleConnectWallet}>
                {connecting ? "⏳ Connecting…" : "👛 Connect Wallet"}
              </button>
            )}
            {wallet && (
              <button
                type="button"
                className="chibi-btn chibi-btn--gold"
                disabled={!canCreate}
                title={canCreate ? "" : `Requires ${kfmt(DAO_MIN_CREATE_BALANCE)} $BASE`}
                onClick={() => setFormOpen((v) => !v)}
              >
                📜 Create Poll
              </button>
            )}
          </div>
        </header>

        {(error || notice) && (
          <div className="chibi-panel mb-dash-card" style={{ padding: "10px 14px", fontSize: "0.82rem" }}>
            {error ? `⚠️ ${error}` : notice}
          </div>
        )}

        {formOpen && (
          <section className="chibi-panel mb-dash-card" style={{ marginTop: 14 }}>
            <h2 style={{ marginTop: 0 }}>📜 New poll</h2>
            <input
              className="chibi-input"
              style={{ width: "100%" }}
              placeholder={`Poll title (max ${DAO_TITLE_MAX})`}
              value={title}
              maxLength={DAO_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="chibi-input"
              style={{ width: "100%", marginTop: 8, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
              placeholder="What should holders decide? (optional details)"
              value={description}
              maxLength={DAO_DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
            />
            {options.map((option, index) => (
              <div key={index} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  className="chibi-input"
                  style={{ flex: 1 }}
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  maxLength={DAO_OPTION_MAX}
                  onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))}
                />
                {options.length > DAO_MIN_OPTIONS && (
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--ghost"
                    onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              {options.length < DAO_MAX_OPTIONS && (
                <button type="button" className="chibi-btn chibi-btn--ghost" onClick={() => setOptions((prev) => [...prev, ""])}>
                  ＋ Add option
                </button>
              )}
              <label style={{ fontSize: "0.8rem", display: "flex", gap: 6, alignItems: "center" }}>
                Runs for
                <input
                  className="chibi-input"
                  type="number"
                  min={DAO_MIN_DURATION_DAYS}
                  max={DAO_MAX_DURATION_DAYS}
                  value={duration}
                  style={{ width: 64 }}
                  onChange={(e) => setDuration(Math.round(Number(e.target.value)))}
                />
                day{duration === 1 ? "" : "s"}
              </label>
              <button
                type="button"
                className="chibi-btn chibi-btn--primary"
                disabled={creating || !title.trim() || options.filter((o) => o.trim()).length < DAO_MIN_OPTIONS}
                onClick={() => void handleCreate()}
              >
                {creating ? "⏳ Creating…" : "🗳️ Open the vote"}
              </button>
            </div>
          </section>
        )}

        {polls === null && !error && (
          <div style={{ textAlign: "center", padding: 24, fontSize: "0.85rem" }}>Loading polls…</div>
        )}
        {polls !== null && polls.length === 0 && (
          <section className="chibi-panel mb-dash-card" style={{ marginTop: 14, textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem" }}>
              No polls yet. Hold {kfmt(DAO_MIN_CREATE_BALANCE)} $BASE? Be the first to put something to a vote. 🌱
            </p>
          </section>
        )}
        {polls?.map(renderPoll)}

        <footer style={{ textAlign: "center", fontSize: "0.72rem", marginTop: 24, color: "var(--chibi-ink-soft, #9c8a6d)", lineHeight: 1.6 }}>
          Votes are off-chain and gasless: sign in with your wallet and your live $BASE balance becomes your vote
          weight, frozen the moment you vote. One vote per wallet per poll — votes are final.
          <br />
          <a href="/">Home</a> · <a href="/dashboard">Dashboard</a> · <a href="/stats">Stats</a> ·{" "}
          <a href="/docs">Wiki</a>
        </footer>
      </div>

      {walletPickerOpen && (
        <WalletPicker
          wallets={detectedWallets}
          onSelect={(connector) => {
            setWalletPickerOpen(false);
            void connectSelectedWallet(connector);
          }}
          onClose={() => setWalletPickerOpen(false)}
        />
      )}
    </div>
  );
}
