import { getItemDefinition, woodcuttingXpProgress, xpProgress } from "@metricbase/shared";
import { useState } from "react";
import { isSoundEnabled, playSfx, setSoundEnabled } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";
import { shortenWallet } from "../wallet/solanaProvider";
import { useMobileLayout } from "./useMobileLayout";
import { WalletConnectBar } from "./WalletConnectBar";

interface HUDProps {
  onLeave: () => void;
}

export function HUD({ onLeave }: HUDProps) {
  const mobileLayout = useMobileLayout();
  const [expanded, setExpanded] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const {
    playerName,
    playerLevel,
    playerXp,
    playerGold,
    playerHp,
    playerMaxHp,
    equippedWeaponId,
    walletAddress,
    connected,
    playerCount,
    zoneName,
    questState,
    woodcuttingLevel,
    woodcuttingXp,
  } = useGameStore();
  const progress = xpProgress(playerXp, playerLevel);
  const percent = Math.min(100, Math.round((progress.current / progress.required) * 100));
  const woodcuttingProgress = woodcuttingXpProgress(woodcuttingXp, woodcuttingLevel);
  const woodcuttingPercent = Math.min(
    100,
    Math.round((woodcuttingProgress.current / woodcuttingProgress.required) * 100),
  );
  const activeQuest = questState.active[0];

  return (
    <div
      className={`chibi-panel chibi-panel--hud chibi-anchor chibi-anchor--top-left${
        mobileLayout ? " chibi-panel--hud-mobile" : ""
      }${mobileLayout && expanded ? " chibi-panel--hud-expanded" : ""}`}
    >
      {mobileLayout ? (
        <button
          type="button"
          className="chibi-hud-compact-bar"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          <span className="chibi-hud-compact-bar__name">
            {playerName} · Lv {playerLevel}
          </span>
          <span className="chibi-hud-compact-bar__stats">
            <span>❤️ {playerHp}</span>
            <span>🪙 {playerGold}</span>
            {activeQuest && <span className="chibi-hud-compact-bar__quest">📜</span>}
          </span>
          <span className="chibi-hud-compact-bar__chevron">{expanded ? "▲" : "▼"}</span>
        </button>
      ) : (
        <div className="chibi-title chibi-sparkle-title" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
          MetricBase World
        </div>
      )}

      {(!mobileLayout || expanded) && (
        <div className="chibi-hud-details">
          {!mobileLayout && (
            <div className="chibi-stat-pill" style={{ marginBottom: 6 }}>
              <span>🗺️</span> {zoneName}
            </div>
          )}

          {mobileLayout && (
            <div className="chibi-stat-pill" style={{ marginBottom: 6 }}>
              <span>🗺️</span> {zoneName}
            </div>
          )}

          {!mobileLayout && (
            <div style={{ fontSize: "0.88rem", fontWeight: 700, marginTop: 8 }}>
              {playerName} · Lv {playerLevel} ·{" "}
              <span style={{ color: "var(--chibi-gold-deep)" }}>🪙 {playerGold}</span>
            </div>
          )}

          <div style={{ marginTop: mobileLayout ? 8 : 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              <span>❤️ HP</span>
              <span>
                {playerHp} / {playerMaxHp}
              </span>
            </div>
            <div className="chibi-progress" style={{ marginTop: 4 }}>
              <div
                className="chibi-progress__fill"
                style={{
                  width: `${playerMaxHp > 0 ? Math.round((playerHp / playerMaxHp) * 100) : 0}%`,
                  background: "linear-gradient(90deg, #ff6b6b, #ff8f8f)",
                }}
              />
            </div>
            {equippedWeaponId && (
              <div className="chibi-text-muted" style={{ marginTop: 4 }}>
                ⚔️ {getItemDefinition(equippedWeaponId).name} equipped
              </div>
            )}
          </div>

          {walletAddress ? (
            <div className="chibi-text-muted" style={{ marginTop: 6 }}>
              💳 {shortenWallet(walletAddress)}
            </div>
          ) : (
            !mobileLayout && (
              <div style={{ marginTop: 8 }}>
                <WalletConnectBar compact hint="Connect wallet to trade on the gold market (E at Pip)." />
              </div>
            )
          )}

          <div style={{ marginTop: 10 }}>
            <div className="chibi-progress">
              <div className="chibi-progress__fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="chibi-text-muted" style={{ marginTop: 4 }}>
              XP {progress.current} / {progress.required}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              <span>🪓 Woodcutting Lv {woodcuttingLevel}</span>
              <span>
                {woodcuttingProgress.current} / {woodcuttingProgress.required}
              </span>
            </div>
            <div className="chibi-progress" style={{ marginTop: 4 }}>
              <div
                className="chibi-progress__fill"
                style={{
                  width: `${woodcuttingPercent}%`,
                  background: "linear-gradient(90deg, #43a047, #81c784)",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className={`chibi-badge ${connected ? "chibi-badge--online" : "chibi-badge--offline"}`}>
              {connected ? "Online" : "Connecting"}
            </span>
            <span className="chibi-stat-pill">👥 {playerCount}</span>
            <button
              type="button"
              className="chibi-btn chibi-btn--ghost"
              style={{ padding: "4px 8px", fontSize: "0.78rem" }}
              onClick={() => {
                const next = !soundOn;
                setSoundEnabled(next);
                setSoundOn(next);
                if (next) playSfx("ui_click");
              }}
              aria-label={soundOn ? "Mute sound effects" : "Enable sound effects"}
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
          </div>

          {activeQuest && (
            <div className="chibi-card chibi-card--info" style={{ marginTop: 10, padding: "8px 10px" }}>
              <div className="chibi-quest-title">{activeQuest.title}</div>
              {activeQuest.objectives.map((objective) => (
                <div key={objective.label} className="chibi-text-muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                  {objective.done ? "✅" : "⭕"} {objective.label}
                  {!objective.done && objective.progress ? ` (${objective.progress})` : ""}
                </div>
              ))}
            </div>
          )}

          {!mobileLayout && (
            <div className="chibi-key-hint chibi-key-hint--desktop">
              WASD move · E interact · Space attack/chop · F chop tree · I inventory
            </div>
          )}

          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            onClick={onLeave}
            style={{ marginTop: 12, width: "100%", padding: "8px 10px", fontSize: "0.82rem" }}
          >
            Leave World
          </button>
        </div>
      )}
    </div>
  );
}