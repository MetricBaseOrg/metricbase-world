import { type AdminBanListPayload, type AdminBanRecord } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { requestSeasonPayout, type SeasonPayoutReport } from "../character/seasonApi";

/** Admin moderation panel: ban a player by name (optionally deleting their
 *  character), and review/lift existing bans. Every action is re-verified
 *  server-side — this UI is only reachable for admin wallets. */
export function AdminPanel() {
  const open = useGameStore((s) => s.adminOpen);
  const setOpen = useGameStore((s) => s.setAdminOpen);
  const setIsAdmin = useGameStore((s) => s.setIsAdmin);
  const [bans, setBans] = useState<AdminBanRecord[]>([]);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [deleteChar, setDeleteChar] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Season payout
  const [seasonInput, setSeasonInput] = useState("");
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutNotice, setPayoutNotice] = useState<string | null>(null);
  const [report, setReport] = useState<SeasonPayoutReport | null>(null);

  const runPayout = async (execute: boolean) => {
    const token = networkManager.getAccessToken();
    if (!token) {
      setPayoutNotice("⚠️ No wallet session — connect an admin wallet first.");
      return;
    }
    const n = seasonInput.trim() ? Number(seasonInput.trim()) : undefined;
    if (execute) {
      const total = report?.totalToPay ?? 0;
      if (!window.confirm(`Pay out ${total.toLocaleString()} $BASE to ${report?.eligible ?? 0} players for Season ${report?.seasonNumber ?? n}? This moves real funds.`)) {
        return;
      }
    }
    setPayoutBusy(true);
    setPayoutNotice(null);
    playSfx("ui_click");
    try {
      const res = await requestSeasonPayout(token, n, execute);
      if (res.report) setReport(res.report);
      if (!res.ok || res.report?.error) {
        setPayoutNotice(`⚠️ ${res.error ?? res.report?.error ?? "Payout failed."}`);
      } else if (execute) {
        const paid = res.report?.lines.filter((l) => l.status === "paid").length ?? 0;
        setPayoutNotice(`✅ Paid ${paid} players.`);
      } else {
        setPayoutNotice("Preview ready — review below, then Execute.");
      }
    } catch (e) {
      setPayoutNotice(`⚠️ ${e instanceof Error ? e.message : "Payout failed."}`);
    } finally {
      setPayoutBusy(false);
    }
  };

  useEffect(() => {
    const offList = networkManager.onAdminBanList((p: AdminBanListPayload) => {
      setIsAdmin(p.isAdmin);
      setBans(p.bans ?? []);
      if (!p.isAdmin) setOpen(false);
    });
    const offResult = networkManager.onAdminActionResult((p) => {
      setBusy(false);
      setNotice(p.ok ? `✅ ${p.message ?? "Done."}` : `⚠️ ${p.error ?? "Action failed."}`);
      if (p.ok) {
        setName("");
        setReason("");
        setDeleteChar(false);
      }
    });
    return () => {
      offList();
      offResult();
    };
  }, [setIsAdmin, setOpen]);

  useEffect(() => {
    if (open) {
      setNotice(null);
      networkManager.requestAdminBanList();
    }
  }, [open]);

  if (!open) return null;
  const close = () => {
    playSfx("ui_close");
    setOpen(false);
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 440, width: "92vw", maxHeight: "82vh", overflowY: "auto" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🛡️ Admin — Moderation</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="chibi-card" style={{ marginTop: 8, padding: "10px 12px" }}>
        <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>Ban a player</div>
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 2 }}>
          Bans their wallet (survives renames), kicks them if online, and blocks all future sign-ins.
        </div>
        <input
          className="chibi-input"
          style={{ width: "100%", marginTop: 8 }}
          placeholder="Player name"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="chibi-input"
          style={{ width: "100%", marginTop: 6 }}
          placeholder="Reason (e.g. botting)"
          value={reason}
          maxLength={120}
          onChange={(e) => setReason(e.target.value)}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: "0.76rem" }}>
          <input type="checkbox" checked={deleteChar} onChange={(e) => setDeleteChar(e.target.checked)} />
          Also delete their character (irreversible)
        </label>
        <button
          type="button"
          className="chibi-btn chibi-btn--danger"
          style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
          disabled={busy || !name.trim()}
          onClick={() => {
            setBusy(true);
            setNotice(null);
            playSfx("ui_click");
            networkManager.sendAdminBan(name.trim(), reason.trim(), deleteChar);
          }}
        >
          {busy ? "⏳ Working…" : "🔨 Ban player"}
        </button>
      </div>

      {notice && (
        <div className="chibi-card" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>
          {notice}
        </div>
      )}

      {/* Season-end payout */}
      <div className="chibi-card" style={{ marginTop: 12, padding: "10px 12px", borderColor: "#4FB8A8" }}>
        <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>🏆 Season payout</div>
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 2 }}>
          Split the season's fixed $BASE pool by points. Preview is a safe dry-run; Execute moves real funds. Only ended seasons; idempotent (never double-pays).
        </div>
        <input
          className="chibi-input"
          style={{ width: "100%", marginTop: 8 }}
          placeholder="Season number (blank = last ended)"
          value={seasonInput}
          inputMode="numeric"
          onChange={(e) => setSeasonInput(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            style={{ flex: 1, padding: "8px 10px" }}
            disabled={payoutBusy}
            onClick={() => void runPayout(false)}
          >
            {payoutBusy ? "⏳…" : "🔍 Preview"}
          </button>
          <button
            type="button"
            className="chibi-btn chibi-btn--gold"
            style={{ flex: 1, padding: "8px 10px" }}
            disabled={payoutBusy || !report || !report.solvent || !report.withdrawEnabled || (report.eligible - report.alreadyPaid) <= 0}
            onClick={() => void runPayout(true)}
          >
            💸 Execute
          </button>
        </div>
        {payoutNotice && (
          <div style={{ marginTop: 8, fontSize: "0.76rem" }}>{payoutNotice}</div>
        )}
        {report && !report.error && (
          <div style={{ marginTop: 8, fontSize: "0.72rem" }}>
            <div className="chibi-text-muted">
              Season {report.seasonNumber} · pool {report.pool.toLocaleString()} $BASE · {report.eligible} eligible · pay {report.totalToPay.toLocaleString()} $BASE
            </div>
            <div className="chibi-text-muted" style={{ marginTop: 2 }}>
              House balance: {report.houseBalance == null ? "—" : report.houseBalance.toLocaleString()} ·{" "}
              <span style={{ color: report.solvent ? "#3fae74" : "#e0567a", fontWeight: 700 }}>
                {report.solvent ? "solvent ✓" : "INSUFFICIENT"}
              </span>
              {!report.withdrawEnabled && " · withdrawals disabled"}
              {report.alreadyPaid > 0 && ` · already paid ${report.alreadyPaid}`}
            </div>
            <div style={{ maxHeight: 160, overflowY: "auto", marginTop: 6 }}>
              {report.lines.map((l) => (
                <div key={l.name} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <span>
                    {l.status === "paid" ? "✅ " : l.status === "failed" ? "⚠️ " : l.status === "skipped" ? "· " : ""}
                    {l.name} <span className="chibi-text-muted">({l.points.toLocaleString()}p)</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>{l.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ fontWeight: 700, fontSize: "0.82rem", marginTop: 12 }}>
        Banned accounts {bans.length > 0 && <span className="chibi-text-muted">({bans.length})</span>}
      </div>
      {bans.length === 0 && (
        <div className="chibi-text-muted" style={{ fontSize: "0.78rem", marginTop: 6 }}>
          No bans on record. 🌱
        </div>
      )}
      {bans.map((b) => (
        <div key={b.wallet} className="chibi-card" style={{ marginTop: 6, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{b.name ?? "(no name)"}</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 2, overflowWrap: "anywhere" }}>
                {b.wallet}
              </div>
              <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 2 }}>
                {b.reason || "No reason recorded"} · {new Date(b.bannedAt).toLocaleDateString()}
              </div>
            </div>
            <button
              type="button"
              className="chibi-btn chibi-btn--ghost"
              style={{ padding: "6px 10px", fontSize: "0.72rem" }}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setNotice(null);
                playSfx("ui_click");
                networkManager.sendAdminUnban(b.wallet);
              }}
            >
              Unban
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
