import { type AdminBanListPayload, type AdminBanRecord } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

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
