import { xpProgress } from "@metricbase/shared";
import { useGameStore } from "../store/gameStore";
import { shortenWallet } from "../wallet/solanaProvider";
import { panelPosition } from "./chibiTheme";
import { WalletConnectBar } from "./WalletConnectBar";

interface HUDProps {
  onLeave: () => void;
}

export function HUD({ onLeave }: HUDProps) {
  const {
    playerName,
    playerLevel,
    playerXp,
    playerGold,
    walletAddress,
    connected,
    playerCount,
    zoneName,
  } = useGameStore();
  const progress = xpProgress(playerXp, playerLevel);
  const percent = Math.min(100, Math.round((progress.current / progress.required) * 100));

  return (
    <div className="chibi-panel chibi-panel--hud" style={panelPosition("top-left")}>
      <div className="chibi-title chibi-sparkle-title" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
        MetricBase World
      </div>

      <div className="chibi-stat-pill" style={{ marginBottom: 6 }}>
        <span>🗺️</span> {zoneName}
      </div>

      <div style={{ fontSize: "0.88rem", fontWeight: 700, marginTop: 8 }}>
        {playerName} · Lv {playerLevel} · <span style={{ color: "var(--chibi-gold-deep)" }}>🪙 {playerGold}</span>
      </div>

      {walletAddress ? (
        <div className="chibi-text-muted" style={{ marginTop: 6 }}>
          💳 {shortenWallet(walletAddress)}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <WalletConnectBar compact hint="Connect wallet to trade on the gold market (E at Pip)." />
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <div className="chibi-progress">
          <div className="chibi-progress__fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="chibi-text-muted" style={{ marginTop: 4 }}>
          XP {progress.current} / {progress.required}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span className={`chibi-badge ${connected ? "chibi-badge--online" : "chibi-badge--offline"}`}>
          {connected ? "Online" : "Connecting"}
        </span>
        <span className="chibi-stat-pill">👥 {playerCount}</span>
      </div>

      <div className="chibi-key-hint">
        WASD move · E shop · Space attack · I inventory · Purple tiles = portals
      </div>

      <button
        type="button"
        className="chibi-btn chibi-btn--secondary"
        onClick={onLeave}
        style={{ marginTop: 12, width: "100%", padding: "8px 10px", fontSize: "0.82rem" }}
      >
        Leave World
      </button>
    </div>
  );
}