import {
  GAME_VERSION,
  fishingXpProgress,
  getItemDefinition,
  miningXpProgress,
  woodcuttingXpProgress,
  xpProgress,
} from "@metricbase/shared";
import { useState } from "react";
import { isSoundEnabled, playSfx, setSoundEnabled } from "../audio/soundEffects";
import { isMusicEnabled, setMusicEnabled } from "../audio/backgroundMusic";
import { useGameStore } from "../store/gameStore";
import { shortenWallet } from "../wallet/solanaProvider";
import { CircleGauge } from "./CircleGauge";
import { useMobileLayout } from "./useMobileLayout";
import { WalletConnectBar } from "./WalletConnectBar";

interface HUDProps {
  onLeave: () => void;
}

export function HUD({ onLeave }: HUDProps) {
  const mobileLayout = useMobileLayout();
  const [expanded, setExpanded] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [musicOn, setMusicOn] = useState(isMusicEnabled);
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
    miningLevel,
    miningXp,
    fishingLevel,
    fishingXp,
  } = useGameStore();
  const progress = xpProgress(playerXp, playerLevel);
  const xpRatio = progress.required > 0 ? progress.current / progress.required : 0;
  const miningProgress = miningXpProgress(miningXp, miningLevel);
  const miningRatio =
    miningProgress.required > 0 ? miningProgress.current / miningProgress.required : 0;
  const fishingProgress = fishingXpProgress(fishingXp, fishingLevel);
  const fishingRatio =
    fishingProgress.required > 0 ? fishingProgress.current / fishingProgress.required : 0;
  const woodcuttingProgress = woodcuttingXpProgress(woodcuttingXp, woodcuttingLevel);
  const woodcuttingRatio =
    woodcuttingProgress.required > 0
      ? woodcuttingProgress.current / woodcuttingProgress.required
      : 0;
  const hpRatio = playerMaxHp > 0 ? playerHp / playerMaxHp : 0;
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
        <div className="chibi-title chibi-sparkle-title" style={{ fontSize: "1.1rem", marginBottom: 6 }}>
          MetricBase World
        </div>
      )}

      {(!mobileLayout || expanded) && (
        <div className="chibi-hud-details">
          <div className="chibi-stat-pill" style={{ marginBottom: 6 }}>
            <span>🗺️</span> {zoneName}
          </div>

          {!mobileLayout && (
            <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>
              {playerName} · Lv {playerLevel} ·{" "}
              <span style={{ color: "var(--chibi-gold-deep)" }}>🪙 {playerGold}</span>
            </div>
          )}

          <div className="chibi-hud-gauges">
            <div className="chibi-hud-gauge-item">
              <CircleGauge
                value={hpRatio}
                label={`${playerHp}`}
                detail={`/${playerMaxHp}`}
                title={`HP ${playerHp} / ${playerMaxHp}`}
                color="#ff6b6b"
              />
              <span className="chibi-hud-gauge-caption">HP</span>
            </div>
            <div className="chibi-hud-gauge-item">
              <CircleGauge
                value={xpRatio}
                label={`${playerLevel}`}
                title={`Combat XP ${progress.current} / ${progress.required}`}
                color="var(--chibi-lavender)"
              />
              <span className="chibi-hud-gauge-caption">Level</span>
            </div>
            <div className="chibi-hud-gauge-item">
              <CircleGauge
                value={woodcuttingRatio}
                label={`${woodcuttingLevel}`}
                title={`Woodcutting ${woodcuttingProgress.current} / ${woodcuttingProgress.required} XP`}
                color="#43a047"
              />
              <span className="chibi-hud-gauge-caption">Wood</span>
            </div>
            <div className="chibi-hud-gauge-item">
              <CircleGauge
                value={miningRatio}
                label={`${miningLevel}`}
                title={`Mining ${miningProgress.current} / ${miningProgress.required} XP`}
                color="#b0833a"
              />
              <span className="chibi-hud-gauge-caption">Mining</span>
            </div>
            <div className="chibi-hud-gauge-item">
              <CircleGauge
                value={fishingRatio}
                label={`${fishingLevel}`}
                title={`Fishing ${fishingProgress.current} / ${fishingProgress.required} XP`}
                color="#3690cf"
              />
              <span className="chibi-hud-gauge-caption">Fishing</span>
            </div>
          </div>

          {equippedWeaponId && (
            <div className="chibi-text-muted" style={{ marginTop: 6, fontSize: "0.72rem" }}>
              ⚔️ {getItemDefinition(equippedWeaponId).name}
            </div>
          )}

          {walletAddress ? (
            <div className="chibi-text-muted" style={{ marginTop: 6, fontSize: "0.72rem" }}>
              💳 {shortenWallet(walletAddress)}
            </div>
          ) : (
            !mobileLayout && (
              <div style={{ marginTop: 8 }}>
                <WalletConnectBar compact hint="Connect wallet to trade on the gold market (E at Pip)." />
              </div>
            )
          )}

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
            <button
              type="button"
              className="chibi-btn chibi-btn--ghost"
              style={{ padding: "4px 8px", fontSize: "0.78rem", opacity: musicOn ? 1 : 0.4 }}
              onClick={() => {
                const next = !musicOn;
                setMusicEnabled(next);
                setMusicOn(next);
                if (next && soundOn) playSfx("ui_click");
              }}
              aria-label={musicOn ? "Mute music" : "Enable music"}
            >
              {musicOn ? "🎵" : "🎵̶"}
            </button>
          </div>

          {activeQuest && (
            <div className="chibi-card chibi-card--info" style={{ marginTop: 8, padding: "8px 10px" }}>
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
              WASD move · E interact · Space attack/chop · F chop · G fish · I inventory · C craft
            </div>
          )}

          <div className="chibi-text-muted" style={{ marginTop: 8, fontSize: "0.68rem", textAlign: "center" }}>
            client v{GAME_VERSION}
          </div>

          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            onClick={onLeave}
            style={{ marginTop: 10, width: "100%", padding: "8px 10px", fontSize: "0.82rem" }}
          >
            Leave World
          </button>
        </div>
      )}
    </div>
  );
}