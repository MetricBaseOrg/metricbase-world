import {
  AD_MIN_CPM,
  validateCampaign,
  type AdCampaign,
  type BrandDashboardPayload,
} from "@metricbase/shared";
import bs58 from "bs58";
import { useEffect, useState } from "react";
import { getHttpServerUrl } from "../game/serverUrl";
import { discoverWallets, pickWalletConnector, type WalletConnector } from "../wallet/solanaProvider";
import { setSelectedWalletId } from "../wallet/discovery";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";

/**
 * Standalone Brand Portal (served at /brands): advertisers fund and run ad
 * campaigns with just a wallet — no game character, no player token gate.
 * Sign-in = wallet signature; budget = a $BASE deposit; creatives go through
 * the same review queue as in-game campaigns.
 */

interface BrandInfo {
  enabled: boolean;
  houseWallet: string | null;
  mint: string;
  decimals: number;
  rpcUrl: string;
  minDeposit: number;
  minCpm: number;
  sharePct: number;
  stats: {
    totalImpressions: number;
    activeCampaigns: number;
    brands: number;
    members: number;
    playerPaid: number;
  };
}

const api = (path: string) => `${getHttpServerUrl()}/api${path}`;

const STATUS_META: Record<string, { label: string; color: string }> = {
  approved: { label: "🟢 Live", color: "#3fae74" },
  pending: { label: "🕓 In review", color: "#e09b2d" },
  paused: { label: "⏸️ Paused", color: "#8a97a8" },
  rejected: { label: "🚫 Rejected", color: "#d85f97" },
};

export function BrandPortal() {
  const [info, setInfo] = useState<BrandInfo | null>(null);
  const [gameStats, setGameStats] = useState<{ online: number; registered: number } | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dash, setDash] = useState<BrandDashboardPayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Multiple wallet extensions installed: let the advertiser choose one.
  const [walletChoices, setWalletChoices] = useState<WalletConnector[] | null>(null);
  const [depositAmt, setDepositAmt] = useState("");
  // Campaign form.
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [clickUrl, setClickUrl] = useState("");
  const [cpm, setCpm] = useState("5");

  // The game shell locks page scrolling (html/body/#root are height:100% +
  // overflow:hidden for the canvas). The portal is an ordinary web page, so
  // undo that here — otherwise mobile visitors can't scroll at all.
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

  useEffect(() => {
    void fetch(api("/brand/info")).then(async (r) => setInfo(await r.json())).catch(() => setNotice("Couldn't reach the ad service."));
    void fetch(api("/stats"))
      .then(async (r) => {
        const s = await r.json();
        setGameStats({ online: s.players?.online ?? 0, registered: s.players?.registered ?? 0 });
      })
      .catch(() => undefined);
  }, []);

  const authedFetch = async (path: string, body?: unknown) => {
    const res = await fetch(api(path), {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
    return json;
  };

  /** Connect a wallet and sign the challenge — no token holdings required. */
  const signIn = async (chosen?: WalletConnector) => {
    setPending(true);
    setNotice(null);
    try {
      const connector = chosen ?? pickWalletConnector();
      if (!connector) {
        // More than one wallet extension (or none): show the picker / a
        // truthful error instead of claiming no wallet exists.
        const available = discoverWallets();
        if (available.length === 0) {
          throw new Error("No Solana wallet found — install Phantom or Solflare.");
        }
        setWalletChoices(available);
        return;
      }
      setSelectedWalletId(connector.id);
      setWalletChoices(null);
      const address = await connector.connect();
      const challenge = (await (await fetch(api(`/auth/challenge?wallet=${encodeURIComponent(address)}`))).json()) as {
        message: string;
      };
      const signature = await connector.signMessage(new TextEncoder().encode(challenge.message));
      const auth = await (
        await fetch(api("/brand/auth"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: address,
            message: challenge.message,
            signature: bs58.encode(signature),
          }),
        })
      ).json();
      if (!auth.accessToken) throw new Error(auth.error ?? "Sign-in failed.");
      setWallet(address);
      setToken(auth.accessToken);
      const d = await fetch(api("/brand/dashboard"), { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      setDash(await d.json());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  };

  const refresh = async () => {
    if (!token) return;
    try {
      setDash(await authedFetch("/brand/dashboard"));
    } catch {
      /* keep last */
    }
  };

  const deposit = async () => {
    if (!wallet || !info?.houseWallet) return;
    const amount = Math.floor(Number(depositAmt) || 0);
    if (amount < info.minDeposit) return setNotice(`Minimum deposit is ${info.minDeposit.toLocaleString()} $BASE.`);
    setPending(true);
    setNotice(`Sending ${amount.toLocaleString()} $BASE — confirm in your wallet…`);
    try {
      const signature = await sendMetricbaseTokenPayment({
        payerWallet: wallet,
        recipientWallet: info.houseWallet,
        mint: info.mint,
        uiAmount: amount,
        decimals: info.decimals,
        rpcUrl: info.rpcUrl,
      });
      setNotice("Verifying your deposit on-chain…");
      const r = await authedFetch("/brand/deposit", { signature });
      setDash(r.dashboard);
      setDepositAmt("");
      setNotice(`Deposited! Ad balance: ${Number(r.balance).toLocaleString()} $BASE.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Deposit failed.");
    } finally {
      setPending(false);
    }
  };

  const launch = async () => {
    const invalid = validateCampaign(name, imageUrl, headline, clickUrl, Number(cpm));
    if (invalid) return setNotice(invalid);
    setPending(true);
    setNotice(null);
    try {
      const r = await authedFetch("/brand/campaign", { name, imageUrl, headline, clickUrl, cpm: Number(cpm) });
      setDash(r.dashboard);
      setName("");
      setHeadline("");
      setImageUrl("");
      setClickUrl("");
      setNotice("Campaign submitted! It goes live once approved (usually fast).");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't create the campaign.");
    } finally {
      setPending(false);
    }
  };

  const togglePause = async (c: AdCampaign) => {
    setPending(true);
    try {
      const r = await authedFetch("/brand/campaign/pause", { id: c.id, paused: c.status === "approved" });
      setDash(r.dashboard);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't update the campaign.");
    } finally {
      setPending(false);
    }
  };

  const card: React.CSSProperties = {
    background: "#fffdf6",
    border: "2px solid #e6d3aa",
    borderRadius: 18,
    boxShadow: "0 4px 0 #e4cf9f",
    padding: "16px 18px",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1000px 520px at 50% -10%, #fff7e6, #fdf3df)",
        color: "#4a3b2a",
        fontFamily: '"Nunito","Fredoka",system-ui,sans-serif',
        padding: "0 16px 60px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Hero */}
        <header style={{ textAlign: "center", padding: "44px 0 10px" }}>
          <div style={{ fontSize: "2.6rem" }}>📣</div>
          <h1 style={{ margin: "6px 0 0", fontSize: "clamp(1.5rem,4.5vw,2.2rem)", fontWeight: 800 }}>
            Put your brand inside a living game world
          </h1>
          <p style={{ color: "#9c8a6d", maxWidth: 560, margin: "10px auto 0", lineHeight: 1.6 }}>
            MetricBase World players see your billboard while they play. You bid a CPM in $BASE,
            pay only for real view-minutes, and <b>{info?.sharePct ?? 50}% of your spend goes straight to the players watching</b> —
            ads people actually welcome.
          </p>
          {/* Live proof chips */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
            {[
              gameStats ? `🟢 ${gameStats.online} playing right now` : null,
              gameStats ? `👥 ${gameStats.registered.toLocaleString()} adventurers` : null,
              info ? `👁️ ${info.stats.totalImpressions.toLocaleString()} impressions served` : null,
              info ? `🏢 ${info.stats.brands} brands on board` : null,
            ]
              .filter(Boolean)
              .map((t) => (
                <span key={t as string} style={{ background: "#fff", border: "1.5px solid #e6d3aa", borderRadius: 999, padding: "4px 12px", fontSize: "0.8rem", fontWeight: 700 }}>
                  {t}
                </span>
              ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <a href="/stats" style={{ color: "#5a97e0", fontSize: "0.8rem", fontWeight: 700 }}>
              See the fully transparent live dashboard →
            </a>
          </div>
        </header>

        {/* How it works */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", margin: "22px 0" }}>
          {[
            ["1️⃣", "Connect a wallet", "No game account, no sign-up forms. Your wallet is your login."],
            ["2️⃣", `Deposit $BASE (min ${info?.minDeposit?.toLocaleString() ?? "100"})`, "Your ad budget. Unspent balance simply stays in your account."],
            ["3️⃣", "Launch your campaign", "Upload art + headline, set a CPM bid. Highest bids win the billboards."],
          ].map(([e, t, d]) => (
            <div key={t as string} style={card}>
              <div style={{ fontSize: "1.4rem" }}>{e}</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{t}</div>
              <div style={{ color: "#9c8a6d", fontSize: "0.82rem", marginTop: 4, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>

        {notice && (
          <div style={{ ...card, borderColor: "#e0a92e", marginBottom: 12, fontSize: "0.88rem" }}>{notice}</div>
        )}

        {/* Sign in */}
        {!token && (
          <div style={{ ...card, textAlign: "center", padding: "26px 18px" }}>
            <button
              type="button"
              disabled={pending || !info?.enabled}
              onClick={() => void signIn()}
              style={{
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 800,
                fontSize: "1rem",
                color: "#4a3313",
                background: "#f5c542",
                border: "3px solid #4a3b2a",
                borderRadius: 14,
                padding: "12px 26px",
                boxShadow: "0 4px 0 #e4cf9f",
              }}
            >
              👛 Connect wallet to get started
            </button>
            {walletChoices && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, fontSize: "0.85rem", marginBottom: 8 }}>
                  Several wallets found — pick one:
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  {walletChoices.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      disabled={pending}
                      onClick={() => void signIn(w)}
                      style={{
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        color: "#4a3b2a",
                        background: "#fffdf6",
                        border: "2px solid #4a3b2a",
                        borderRadius: 12,
                        padding: "9px 16px",
                        boxShadow: "0 3px 0 #e4cf9f",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      {w.icon && <img src={w.icon} alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />}
                      {w.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ color: "#9c8a6d", fontSize: "0.76rem", marginTop: 10 }}>
              You'll sign a message to prove wallet ownership — free, no transaction.
              {!info?.enabled && " (Deposits are temporarily disabled.)"}
            </div>
          </div>
        )}

        {/* Dashboard */}
        {token && dash && (
          <>
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: "0.72rem", color: "#9c8a6d", fontWeight: 800, textTransform: "uppercase" }}>Ad balance</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#b8860b" }}>
                  {dash.balance.toLocaleString()} $BASE
                </div>
                <div style={{ color: "#9c8a6d", fontSize: "0.72rem" }}>
                  {wallet?.slice(0, 4)}…{wallet?.slice(-4)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={depositAmt}
                  inputMode="numeric"
                  placeholder={`Amount (min ${info?.minDeposit ?? 100})`}
                  onChange={(e) => setDepositAmt(e.target.value.replace(/[^0-9]/g, ""))}
                  style={{ border: "2px solid #e6d3aa", borderRadius: 10, padding: "8px 10px", fontFamily: "inherit", fontSize: "1rem", width: 170 }}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void deposit()}
                  style={{ cursor: "pointer", fontFamily: "inherit", fontWeight: 800, background: "#f5c542", border: "2px solid #4a3b2a", borderRadius: 10, padding: "8px 14px" }}
                >
                  Deposit
                </button>
              </div>
            </div>

            {/* Create campaign + live preview */}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", marginTop: 12 }}>
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>🚀 New campaign</div>
                {[
                  ["Campaign name", name, setName, "My Spring Drop"],
                  ["Image URL (https)", imageUrl, setImageUrl, "https://…/banner.png"],
                  ["Headline", headline, setHeadline, "Tagline players will see"],
                  ["Click URL (https)", clickUrl, setClickUrl, "https://yourbrand.xyz"],
                ].map(([label, value, setter, ph]) => (
                  <div key={label as string} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#9c8a6d", marginBottom: 2 }}>{label as string}</div>
                    <input
                      value={value as string}
                      placeholder={ph as string}
                      onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box", border: "2px solid #e6d3aa", borderRadius: 10, padding: "8px 10px", fontFamily: "inherit", fontSize: "1rem" }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#9c8a6d", marginBottom: 2 }}>
                    CPM bid — $BASE per 1,000 view-minutes (min {info?.minCpm ?? AD_MIN_CPM})
                  </div>
                  <input
                    value={cpm}
                    inputMode="numeric"
                    onChange={(e) => setCpm(e.target.value.replace(/[^0-9.]/g, ""))}
                    style={{ width: 120, border: "2px solid #e6d3aa", borderRadius: 10, padding: "8px 10px", fontFamily: "inherit", fontSize: "1rem" }}
                  />
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void launch()}
                  style={{ width: "100%", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: "0.95rem", background: "#3fae74", color: "#fff", border: "2px solid #2a6e4c", borderRadius: 12, padding: "10px" }}
                >
                  Submit for review
                </button>
              </div>

              {/* In-world billboard preview */}
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>👁️ In-world preview</div>
                <div style={{ background: "linear-gradient(180deg,#7ec9f5,#a8e6a1)", borderRadius: 12, padding: "26px 18px", textAlign: "center" }}>
                  <div
                    style={{
                      display: "inline-block",
                      background: "#3b2c1e",
                      border: "3px solid #241a10",
                      borderRadius: 8,
                      padding: 6,
                      maxWidth: 260,
                    }}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="" style={{ display: "block", width: "100%", borderRadius: 4, minHeight: 60, background: "#222" }} />
                    ) : (
                      <div style={{ width: 240, height: 90, display: "grid", placeItems: "center", color: "#a58a68", fontSize: "0.78rem" }}>
                        your art here
                      </div>
                    )}
                    <div style={{ color: "#ffd24a", fontWeight: 800, fontSize: "0.8rem", padding: "5px 4px 2px" }}>
                      {headline || "Your headline"}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: "0.72rem", color: "#2a5230", fontWeight: 700 }}>
                    ↑ how it appears on billboards in the Hub
                  </div>
                </div>
                <div style={{ color: "#9c8a6d", fontSize: "0.74rem", marginTop: 8, lineHeight: 1.5 }}>
                  One impression = one player viewing your board for a minute. You're charged CPM/1000 per
                  impression, and {info?.sharePct ?? 50}% is paid to that player.
                </div>
              </div>
            </div>

            {/* Campaign list */}
            <div style={{ ...card, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ fontWeight: 800, flex: 1 }}>📋 Your campaigns</div>
                <button type="button" onClick={() => void refresh()} style={{ cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.74rem", background: "#fff", border: "2px solid #e6d3aa", borderRadius: 999, padding: "4px 12px" }}>
                  ↻ Refresh
                </button>
              </div>
              {dash.campaigns.length === 0 && (
                <div style={{ color: "#9c8a6d", fontSize: "0.84rem", marginTop: 8 }}>No campaigns yet — launch your first above!</div>
              )}
              {dash.campaigns.map((c) => {
                const meta = STATUS_META[c.status] ?? { label: c.status, color: "#9c8a6d" };
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1.5px dashed #e6d3aa", padding: "10px 0", flexWrap: "wrap" }}>
                    <img src={c.imageUrl} alt="" style={{ width: 56, height: 34, objectFit: "cover", borderRadius: 6, border: "1.5px solid #e6d3aa" }} />
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>{c.name}</div>
                      <div style={{ color: "#9c8a6d", fontSize: "0.72rem" }}>
                        <span style={{ color: meta.color, fontWeight: 800 }}>{meta.label}</span> · CPM {c.cpm} · 👁️ {c.impressions.toLocaleString()} · spent {c.spent.toLocaleString()} $BASE
                        {c.reviewNote ? ` · note: ${c.reviewNote}` : ""}
                      </div>
                    </div>
                    {(c.status === "approved" || c.status === "paused") && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void togglePause(c)}
                        style={{ cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.74rem", background: "#fff", border: "2px solid #e6d3aa", borderRadius: 999, padding: "4px 12px" }}
                      >
                        {c.status === "approved" ? "⏸️ Pause" : "▶️ Resume"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <footer style={{ textAlign: "center", color: "#9c8a6d", fontSize: "0.74rem", marginTop: 34, lineHeight: 1.7 }}>
          Campaigns are human-reviewed before going live. Spend and payouts are publicly auditable on the{" "}
          <a href="/stats" style={{ color: "#5a97e0" }}>economy dashboard</a>.<br />
          Want to see your board in the wild? <a href="/play" style={{ color: "#5a97e0" }}>Jump into MetricBase World</a> 🌍
        </footer>
      </div>
    </div>
  );
}
