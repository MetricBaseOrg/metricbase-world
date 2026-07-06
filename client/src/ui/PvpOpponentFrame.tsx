import { useEffect, useState } from "react";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { ITEM_ICONS } from "./InventoryPanel";

/**
 * PvP target frame — pinned top-centre while you have an opponent (a duel, or
 * anyone you've traded hits with in the last few seconds). Shows their HP,
 * energy, level, and the items they've just used, so fights are readable:
 * you can SEE the potion chug and the health bar it refilled.
 */

interface OpponentVitals {
  level: number;
  hp: number;
  maxHp: number;
  stamina: number;
  online: boolean;
}

const ITEM_MEMORY_MS = 12_000;

export function PvpOpponentFrame() {
  const opponent = useGameStore((s) => s.pvpOpponent);
  const worldEditing = useGameStore((s) => s.worldEditing);
  const [vitals, setVitals] = useState<OpponentVitals | null>(null);
  const [usedItems, setUsedItems] = useState<{ itemId: string; at: number }[]>([]);

  // Duels own the frame for their whole duration.
  useEffect(() => {
    const offStart = networkManager.onDuelStart((payload) => {
      useGameStore.getState().setPvpOpponent({ name: payload.opponent, until: payload.endsAt, duel: true });
      setUsedItems([]);
    });
    const offEnd = networkManager.onDuelEnd(() => {
      useGameStore.getState().setPvpOpponent(null);
    });
    return () => {
      offStart();
      offEnd();
    };
  }, []);

  // Track the opponent's consumptions (server broadcasts every item use).
  useEffect(() => {
    if (!opponent) return;
    const off = networkManager.onItemUsed((payload) => {
      if (payload.playerName !== opponent.name) return;
      setUsedItems((prev) => [...prev.slice(-3), { itemId: payload.itemId, at: Date.now() }]);
    });
    return () => {
      off();
    };
  }, [opponent?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll the synced roster for live vitals + handle frame expiry.
  useEffect(() => {
    if (!opponent) {
      setVitals(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      if (!opponent.duel && now > opponent.until) {
        useGameStore.getState().setPvpOpponent(null);
        return;
      }
      const remote = networkManager.getRemotePlayers().find((p) => p.name === opponent.name);
      setVitals(
        remote
          ? { level: remote.level, hp: remote.hp, maxHp: remote.maxHp, stamina: remote.stamina, online: true }
          : { level: 0, hp: 0, maxHp: 0, stamina: 0, online: false },
      );
      setUsedItems((prev) => prev.filter((u) => now - u.at < ITEM_MEMORY_MS));
    };
    tick();
    const id = window.setInterval(tick, 300);
    return () => window.clearInterval(id);
  }, [opponent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!opponent || worldEditing) return null;

  const hpPct = vitals && vitals.maxHp > 0 ? Math.max(0, Math.min(1, vitals.hp / vitals.maxHp)) : 0;
  const enPct = vitals ? Math.max(0, Math.min(1, vitals.stamina / 100)) : 0;
  const hpColor = hpPct > 0.5 ? "#4bc07f" : hpPct > 0.25 ? "#e0a92e" : "#d85f4f";

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(52px + var(--chibi-safe-top, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 18,
        pointerEvents: "none",
        width: "min(280px, 80vw)",
      }}
    >
      <div className="chibi-panel" style={{ padding: "8px 12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: "0.8rem" }}>{opponent.duel ? "🤺" : "⚔️"}</span>
          <span
            style={{
              fontWeight: 800,
              fontSize: "0.85rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              pointerEvents: "auto",
              cursor: "pointer",
            }}
            onClick={() => useGameStore.getState().setProfileFor(opponent.name)}
          >
            {opponent.name}
          </span>
          {vitals?.online ? (
            <span className="chibi-text-muted" style={{ fontSize: "0.7rem", marginLeft: "auto" }}>
              Lv {vitals.level}
            </span>
          ) : (
            <span className="chibi-text-muted" style={{ fontSize: "0.7rem", marginLeft: "auto" }}>gone</span>
          )}
        </div>
        {/* HP */}
        <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: "#efe0c2", border: "1.5px solid #d9c49a", overflow: "hidden" }}>
          <div style={{ width: `${hpPct * 100}%`, height: "100%", background: hpColor, borderRadius: 999, transition: "width .25s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", fontWeight: 700, marginTop: 2 }}>
          <span style={{ color: hpColor }}>❤️ {vitals ? `${Math.max(0, Math.round(vitals.hp))} / ${Math.round(vitals.maxHp)}` : "—"}</span>
          <span style={{ color: "#b8860b" }}>🍗 {vitals ? Math.round(vitals.stamina) : "—"}</span>
        </div>
        {/* Energy */}
        <div style={{ marginTop: 3, height: 6, borderRadius: 999, background: "#efe0c2", border: "1.5px solid #d9c49a", overflow: "hidden" }}>
          <div style={{ width: `${enPct * 100}%`, height: "100%", background: "#e0a92e", borderRadius: 999, transition: "width .25s ease" }} />
        </div>
        {/* Recently used items */}
        {usedItems.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: "0.66rem", fontWeight: 700 }}>
            <span className="chibi-text-muted">used:</span>
            {usedItems.map((u) => (
              <span key={u.at} style={{ fontSize: "0.95rem" }} title={u.itemId}>
                {ITEM_ICONS[u.itemId] ?? "🧪"}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
