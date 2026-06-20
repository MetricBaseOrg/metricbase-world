import { xpProgress } from "@metricbase/shared";
import { useGameStore } from "../store/gameStore";
import { shortenWallet } from "../wallet/solanaProvider";
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
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        padding: "12px 16px",
        borderRadius: 10,
        background: "rgba(8, 12, 24, 0.78)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        color: "#f4f7ff",
        backdropFilter: "blur(8px)",
        pointerEvents: "auto",
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>MetricBase World</div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>Zone: {zoneName}</div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
        {playerName} · Lv {playerLevel} · {playerGold} gold
      </div>
      {walletAddress ? (
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
          Wallet: {shortenWallet(walletAddress)}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <WalletConnectBar compact hint="Connect wallet to trade on the gold market (E at Pip)." />
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #4f8cff, #6c5ce7)",
            }}
          />
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
          XP {progress.current} / {progress.required}
        </div>
      </div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
        Status: {connected ? "Connected" : "Connecting..."}
      </div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Online: {playerCount}</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
        WASD move · E shop/market · Space attack · I inventory · Purple tiles = portals
      </div>
      <button
        type="button"
        onClick={onLeave}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "8px 10px",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 8,
          background: "rgba(255, 255, 255, 0.05)",
          color: "#f4f7ff",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Leave World
      </button>
    </div>
  );
}