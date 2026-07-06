import { type PlayerProfilePayload } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { PortraitCanvas } from "./PortraitCanvas";

/**
 * Player profile card — opens when any name tag is clicked (chat, mail,
 * @mention chips, who list). Shows public info only, plus quick actions:
 * tag them in chat or start a letter to them.
 */
export function PlayerProfilePanel() {
  const name = useGameStore((s) => s.profileFor);
  const [profile, setProfile] = useState<PlayerProfilePayload | null>(null);

  useEffect(() => {
    if (!name) {
      setProfile(null);
      return;
    }
    setProfile(null);
    const off = networkManager.onPlayerProfile((payload) => setProfile(payload));
    networkManager.requestPlayerProfile(name);
    return () => {
      off();
    };
  }, [name]);

  if (!name) return null;

  const close = () => {
    playSfx("ui_close");
    useGameStore.getState().setProfileFor(null);
  };

  const skillRows: Array<[string, number | undefined]> = profile?.ok
    ? [
        ["🪓 Woodcutting", profile.skills?.woodcutting],
        ["⛏️ Mining", profile.skills?.mining],
        ["🎣 Fishing", profile.skills?.fishing],
        ["🌾 Farming", profile.skills?.farming],
      ]
    : [];

  return (
    <div className="chibi-overlay" onPointerDown={close}>
      <div
        className="chibi-panel chibi-panel--modal"
        style={{ width: "min(360px, 94vw)", padding: 18 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>👤 Player Profile</span>
          <button type="button" className="chibi-btn chibi-btn--ghost" style={{ padding: "2px 10px" }} onClick={close}>
            ×
          </button>
        </div>

        {!profile && <div className="chibi-text-muted" style={{ padding: "18px 0", textAlign: "center" }}>Looking them up…</div>}

        {profile && !profile.ok && (
          <div className="chibi-text-muted" style={{ padding: "18px 0", textAlign: "center" }}>
            {profile.error ?? "Player not found."}
          </div>
        )}

        {profile?.ok && (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ borderRadius: 14, border: "2.5px solid var(--chibi-outline)", background: "#eaf4fd", padding: 4 }}>
                <PortraitCanvas appearance={profile.appearance ?? null} size={72} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: "1.05rem", overflowWrap: "anywhere" }}>
                  {profile.guildTag ? `[${profile.guildTag}] ` : ""}
                  {profile.name}
                </div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, marginTop: 2 }}>
                  <span style={{ color: profile.online ? "#2a8c5c" : "#9aa7b0" }}>
                    {profile.online ? "🟢 Online" : "⚪ Offline"}
                  </span>
                  <span className="chibi-text-muted"> · Lv {profile.level}</span>
                </div>
                {profile.guildName && (
                  <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>
                    🛡️ {profile.guildName}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
              {skillRows.map(([label, lvl]) => (
                <div key={label} className="chibi-card" style={{ padding: "6px 10px", fontSize: "0.76rem", fontWeight: 700 }}>
                  {label} <span style={{ float: "right", color: "#b8860b" }}>Lv {lvl ?? 1}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: "0.74rem", fontWeight: 700 }} className="chibi-text-muted">
              <span>🏆 PvP {profile.pvpRating ?? 1000}</span>
              <span>⚔️ Kills {profile.pvpKills ?? 0}</span>
              <span>🎖️ Honor {profile.honor ?? 0}</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="chibi-btn chibi-btn--secondary"
                style={{ flex: 1, padding: "9px 10px", fontSize: "0.8rem" }}
                onClick={() => {
                  playSfx("ui_click");
                  useGameStore.getState().setChatInsert({ text: `@${profile.name} `, at: Date.now() });
                  close();
                }}
              >
                💬 Tag in chat
              </button>
              <button
                type="button"
                className="chibi-btn chibi-btn--primary"
                style={{ flex: 1, padding: "9px 10px", fontSize: "0.8rem" }}
                onClick={() => {
                  playSfx("ui_open");
                  useGameStore.getState().setMailComposeTo({ name: profile.name!, at: Date.now() });
                  useGameStore.getState().setProfileFor(null);
                  useGameStore.getState().setMailOpen(true);
                }}
              >
                ✉️ Send mail
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
