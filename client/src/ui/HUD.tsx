import { useGameStore } from "../store/gameStore";

export function HUD() {
  const { playerName, playerLevel, connected, playerCount, zoneName } = useGameStore();

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
        pointerEvents: "none",
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>MetricBase World</div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>Zone: {zoneName}</div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
        {playerName} · Lv {playerLevel}
      </div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
        Status: {connected ? "Connected" : "Connecting..."}
      </div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Online: {playerCount}</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
        WASD to move. Purple tiles are zone portals.
      </div>
    </div>
  );
}