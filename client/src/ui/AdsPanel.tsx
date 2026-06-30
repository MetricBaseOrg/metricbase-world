import {
  AD_MIN_CLAIM,
  AD_MIN_CPM,
  AD_MIN_DEPOSIT,
  AD_PLAYER_SHARE,
  type AdCampaign,
  type AdProgramPayload,
  type BrandDashboardPayload,
} from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { depositToCasino } from "../wallet/casinoDeposit";

type Tab = "earn" | "advertise" | "review";

export function AdsPanel() {
  const open = useGameStore((s) => s.adsOpen);
  const setOpen = useGameStore((s) => s.setAdsOpen);
  const walletAddress = useGameStore((s) => s.walletAddress);

  const [tab, setTab] = useState<Tab>("earn");
  const [program, setProgram] = useState<AdProgramPayload | null>(null);
  const [dash, setDash] = useState<BrandDashboardPayload | null>(null);
  const [pending, setPending] = useState<AdCampaign[]>([]);
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
      offResult();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    networkManager.requestAdProgram();
    networkManager.requestAdBrandDashboard();
    networkManager.requestAdAdminList();
  }, [open]);

  if (!open) return null;

  const deposit = async () => {
    const amount = Number(depositAmt);
    if (!walletAddress) return setError("Connect your wallet first.");
    if (!dash?.houseWallet) return setError("Ad deposits are disabled right now.");
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
    ...(isAdmin ? ([{ id: "review", label: "🛡️ Review" }] as { id: Tab; label: string }[]) : []),
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
              Join the Ad Program and earn <strong>{Math.round(AD_PLAYER_SHARE * 100)}%</strong> of the ad revenue from
              impressions you generate just by playing. Earnings pay out in $BASE.
            </p>
            {!program?.member ? (
              <button type="button" className="chibi-btn chibi-btn--primary" disabled={busy || !walletAddress} onClick={() => { setBusy(true); networkManager.sendAdJoin(); }}>
                {walletAddress ? "Join the Ad Program" : "Connect a wallet to join"}
              </button>
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
