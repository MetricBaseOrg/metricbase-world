import {
  AD_MIN_CLAIM,
  AD_MIN_CPM,
  AD_MIN_DEPOSIT,
  AD_PLAYER_SHARE,
  AD_REQUIRED_INVITES,
  type AdCampaign,
  type AdProgramPayload,
  type BrandDashboardPayload,
  type AdAdminDashboardPayload,
} from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { depositToCasino } from "../wallet/casinoDeposit";

type Tab = "earn" | "advertise" | "review" | "dashboard";

export function AdsPanel() {
  const open = useGameStore((s) => s.adsOpen);
  const setOpen = useGameStore((s) => s.setAdsOpen);
  const walletAddress = useGameStore((s) => s.walletAddress);

  const [tab, setTab] = useState<Tab>("earn");
  const [program, setProgram] = useState<AdProgramPayload | null>(null);
  const [dash, setDash] = useState<BrandDashboardPayload | null>(null);
  const [pending, setPending] = useState<AdCampaign[]>([]);
  const [admin, setAdmin] = useState<AdAdminDashboardPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Campaign form + deposit amount.
  const [depositAmt, setDepositAmt] = useState("");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [clickUrl, setClickUrl] = useState("");
  const [cpm, setCpm] = useState("");

  const isAdmin = !!walletAddress && dash?.houseWallet === walletAddress;

  useEffect(() => {
    const offProgram = networkManager.onAdProgram(setProgram);
    const offDash = networkManager.onAdBrandDashboard(setDash);
    const offAdmin = networkManager.onAdAdminList((p) => setPending(p.campaigns));
    const offDashboard = networkManager.onAdAdminDashboard(setAdmin);
    const offResult = networkManager.onAdActionResult((r) => {
      setBusy(false);
      if (!r.ok) {
        playSfx("shop_fail");
        setError(r.error ?? "Something went wrong.");
        return;
      }
      setError(null);
      if (r.signature) setNotice(`Paid out — tx ${r.signature.slice(0, 8)}…`);
      else setNotice("Done.");
      window.setTimeout(() => setNotice(null), 3000);
    });
    return () => {
      offProgram();
      offDash();
      offAdmin();
      offDashboard();
      offResult();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    networkManager.requestAdProgram();
    networkManager.requestAdBrandDashboard();
    networkManager.requestAdAdminList();
    networkManager.requestAdAdminDashboard();
  }, [open]);

  if (!open) return null;

  const deposit = async () => {
    const amount = Number(depositAmt);
    if (!walletAddress) return setError("Connect your wallet first.");
    if (!dash?.houseWallet) {
      networkManager.requestAdBrandDashboard();
      return setError("Loading the ad treasury — tap Deposit again in a moment.");
    }
    if (!Number.isFinite(amount) || amount < AD_MIN_DEPOSIT) return setError(`Minimum deposit is ${AD_MIN_DEPOSIT} $BASE.`);
    setBusy(true);
    setError(null);
    setNotice("Confirm the deposit in your wallet…");
    try {
      const signature = await depositToCasino({
        currencyId: "base",
        uiAmount: amount,
        payerWallet: walletAddress,
        houseWallet: dash.houseWallet,
        rpcUrl: dash.rpcUrl,
        mint: dash.mint,
      });
      setNotice("Verifying deposit…");
      networkManager.sendAdDeposit(signature);
      setDepositAmt("");
    } catch (e) {
      setBusy(false);
      setNotice(null);
      setError(e instanceof Error ? e.message : "Deposit failed.");
    }
  };

  const createCampaign = () => {
    setBusy(true);
    setError(null);
    networkManager.sendAdCreateCampaign({
      name,
      imageUrl,
      headline,
      clickUrl,
      cpm: Number(cpm) || 0,
    });
    setName("");
    setImageUrl("");
    setHeadline("");
    setClickUrl("");
    setCpm("");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "earn", label: "💸 Earn" },
    { id: "advertise", label: "📣 Advertise" },
    ...(isAdmin
      ? ([
          { id: "review", label: "🛡️ Review" },
          { id: "dashboard", label: "📊 Dashboard" },
        ] as { id: Tab; label: string }[])
      : []),
  ];

  const statusColor = (s: string) =>
    s === "approved" ? "var(--chibi-mint-deep)" : s === "rejected" ? "#d6453b" : "var(--chibi-gold-deep)";

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="Ad marketplace">
      <div className="chibi-panel chibi-panel--floating chibi-ads">
        <div className="chibi-close-row">
          <div className="chibi-ads__tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chibi-btn ${tab === t.id ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
                style={{ padding: "4px 9px", fontSize: "0.74rem" }}
                onClick={() => {
                  setTab(t.id);
                  setError(null);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" className="chibi-btn chibi-btn--ghost" onClick={() => { playSfx("ui_close"); setOpen(false); }} aria-label="Close">
            ×
          </button>
        </div>

        {tab === "earn" && (
          <div className="chibi-ads__body">
            <p className="chibi-text-muted" style={{ fontSize: "0.82rem" }}>
              Earn <strong>{Math.round(AD_PLAYER_SHARE * 100)}%</strong> of the ad revenue from impressions you generate
              just by playing. Earnings pay out in $BASE. To qualify you must invite <strong>{AD_REQUIRED_INVITES} friends</strong>, then apply.
            </p>
            {!program?.member ? (
              <>
                <div className="chibi-ads__balance">
                  Invited friends: <strong>{program?.invitedCount ?? 0} / {AD_REQUIRED_INVITES}</strong>
                </div>
                <button
                  type="button"
                  className="chibi-btn chibi-btn--primary"
                  disabled={busy || !walletAddress || (program?.invitedCount ?? 0) < AD_REQUIRED_INVITES}
                  onClick={() => { setBusy(true); networkManager.sendAdJoin(); }}
                >
                  {!walletAddress
                    ? "Connect a wallet to apply"
                    : (program?.invitedCount ?? 0) < AD_REQUIRED_INVITES
                      ? `Invite ${AD_REQUIRED_INVITES - (program?.invitedCount ?? 0)} more friend(s) to apply`
                      : "Apply to the Ad Program"}
                </button>
              </>
            ) : (
              <>
                <div className="chibi-ads__stats">
                  <Stat label="Claimable" value={`${program.earnings.toLocaleString()} $BASE`} />
                  <Stat label="Lifetime" value={`${program.lifetime.toLocaleString()} $BASE`} />
                  <Stat label="Impressions" value={program.impressions.toLocaleString()} />
                </div>
                <button
                  type="button"
                  className="chibi-btn chibi-btn--gold"
                  disabled={busy || !program.withdrawEnabled || program.earnings < AD_MIN_CLAIM}
                  onClick={() => { setBusy(true); networkManager.sendAdClaim(); }}
                  title={program.withdrawEnabled ? "" : "Payouts not available yet"}
                >
                  Claim {program.earnings.toLocaleString()} $BASE
                </button>
                <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
                  Minimum claim {AD_MIN_CLAIM} $BASE.{!program.withdrawEnabled ? " Cash-out opens once the house wallet is live." : ""}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "advertise" && (
          <div className="chibi-ads__body">
            <div className="chibi-ads__balance">
              Ad balance: <strong>{(dash?.balance ?? 0).toLocaleString()} $BASE</strong>
            </div>
            <div className="chibi-ads__row">
              <input className="chibi-input" inputMode="decimal" placeholder={`Deposit $BASE (min ${AD_MIN_DEPOSIT})`} value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} />
              <button type="button" className="chibi-btn chibi-btn--mint" disabled={busy || !walletAddress} onClick={() => void deposit()}>Deposit</button>
            </div>

            <div className="chibi-ads__sub">New campaign</div>
            <input className="chibi-input" placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="chibi-input" placeholder="Image URL (https://…)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <input className="chibi-input" placeholder="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            <input className="chibi-input" placeholder="Click URL (https://…)" value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} />
            <input className="chibi-input" inputMode="decimal" placeholder={`CPM bid — $BASE per 1,000 view-minutes (min ${AD_MIN_CPM})`} value={cpm} onChange={(e) => setCpm(e.target.value)} />
            <button type="button" className="chibi-btn chibi-btn--primary" disabled={busy} onClick={() => createCampaign()}>Submit for review</button>

            {dash && dash.campaigns.length > 0 && (
              <>
                <div className="chibi-ads__sub">Your campaigns</div>
                {dash.campaigns.map((c) => (
                  <div key={c.id} className="chibi-ads__campaign">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.82rem" }}>{c.name}</div>
                      <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
                        CPM {c.cpm} · {c.impressions.toLocaleString()} views · {c.spent.toLocaleString()} $BASE spent
                      </div>
                      {c.reviewNote && <div style={{ fontSize: "0.68rem", color: "#d6453b" }}>{c.reviewNote}</div>}
                    </div>
                    <span className="chibi-stat-pill" style={{ color: statusColor(c.status), textTransform: "capitalize" }}>{c.status}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "review" && isAdmin && (
          <div className="chibi-ads__body">
            {pending.length === 0 ? (
              <div className="chibi-text-muted" style={{ textAlign: "center", padding: 12 }}>No campaigns awaiting review.</div>
            ) : (
              pending.map((c) => (
                <div key={c.id} className="chibi-ads__review">
                  {c.imageUrl && <img className="chibi-ads__reviewimg" src={c.imageUrl} alt="" referrerPolicy="no-referrer" />}
                  <div style={{ fontWeight: 800 }}>{c.name}</div>
                  <div className="chibi-text-muted" style={{ fontSize: "0.74rem" }}>{c.headline}</div>
                  <div className="chibi-text-muted" style={{ fontSize: "0.68rem", wordBreak: "break-all" }}>{c.clickUrl}</div>
                  <div className="chibi-text-muted" style={{ fontSize: "0.68rem" }}>CPM {c.cpm} $BASE · {c.brandWallet.slice(0, 8)}…</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button type="button" className="chibi-btn chibi-btn--mint" style={{ flex: 1 }} disabled={busy} onClick={() => { setBusy(true); networkManager.sendAdReview(c.id, "approved"); }}>Approve</button>
                    <button type="button" className="chibi-btn chibi-btn--secondary" style={{ flex: 1 }} disabled={busy} onClick={() => { setBusy(true); networkManager.sendAdReview(c.id, "rejected", "Rejected by moderator"); }}>Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "dashboard" && isAdmin && (
          <div className="chibi-ads__body">
            {!admin ? (
              <div className="chibi-text-muted" style={{ textAlign: "center", padding: 12 }}>Loading…</div>
            ) : (
              <>
                <div className="chibi-ads__stats">
                  <Stat label="Revenue" value={`${admin.totalRevenue.toLocaleString()} $BASE`} />
                  <Stat label="Players paid" value={`${admin.playerPaid.toLocaleString()} $BASE`} />
                  <Stat label="Platform" value={`${admin.platformCut.toLocaleString()} $BASE`} />
                </div>
                <div className="chibi-ads__stats">
                  <Stat label="Impressions" value={admin.totalImpressions.toLocaleString()} />
                  <Stat label="Active" value={admin.activeCampaigns} />
                  <Stat label="Pending" value={admin.pendingCount} />
                </div>

                <div className="chibi-ads__sub">Slots (by impression volume)</div>
                <div className="chibi-ads__table">
                  {admin.slots.map((s) => (
                    <div key={s.slotId} className="chibi-ads__trow">
                      <span style={{ flex: 1, fontWeight: 700 }}>{s.label}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: s.campaignId ? "var(--chibi-ink)" : "var(--chibi-ink-soft)" }}>
                        {s.campaignName}
                      </span>
                      <span style={{ width: 64, textAlign: "right" }}>{s.cpm ? `${s.cpm} cpm` : "—"}</span>
                      <span style={{ width: 56, textAlign: "right" }}>{s.impressions.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="chibi-ads__sub">Bid rank</div>
                <div className="chibi-ads__table">
                  <div className="chibi-ads__trow chibi-ads__trow--head">
                    <span style={{ width: 22 }}>#</span>
                    <span style={{ flex: 1 }}>Campaign</span>
                    <span style={{ width: 56, textAlign: "right" }}>CPM</span>
                    <span style={{ width: 52, textAlign: "right" }}>Views</span>
                    <span style={{ width: 70, textAlign: "right" }}>Slot</span>
                  </div>
                  {admin.rank.length === 0 ? (
                    <div className="chibi-text-muted" style={{ padding: 8 }}>No approved campaigns yet.</div>
                  ) : (
                    admin.rank.map((r) => (
                      <div key={r.campaignId} className="chibi-ads__trow">
                        <span style={{ width: 22, fontWeight: 800 }}>{r.rank}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                          <span className="chibi-text-muted" style={{ fontSize: "0.66rem" }}>
                            {r.brandWallet.slice(0, 6)}… · bal {r.balance.toLocaleString()}
                          </span>
                        </span>
                        <span style={{ width: 56, textAlign: "right" }}>{r.cpm}</span>
                        <span style={{ width: 52, textAlign: "right" }}>{r.impressions.toLocaleString()}</span>
                        <span style={{ width: 70, textAlign: "right", color: r.slotLabel ? "var(--chibi-mint-deep)" : "var(--chibi-ink-soft)", fontSize: "0.66rem" }}>
                          {r.slotLabel ?? "—"}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <button type="button" className="chibi-btn chibi-btn--ghost" style={{ alignSelf: "center", padding: "4px 12px", fontSize: "0.72rem" }} onClick={() => networkManager.requestAdAdminDashboard()}>
                  ↻ Refresh
                </button>
              </>
            )}
          </div>
        )}

        {notice && <div className="chibi-text-muted" style={{ marginTop: 8, fontSize: "0.74rem" }}>{notice}</div>}
        {error && <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, fontSize: "0.78rem" }}>{error}</div>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="chibi-ads__stat">
      <span className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>{label}</span>
      <span style={{ fontWeight: 800 }}>{value}</span>
    </div>
  );
}
