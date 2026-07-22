import { useEffect, useState } from "react";
import { isAnyPanelOpen, useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

/**
 * Always-on objective tracker.
 *
 * The world opens onto companies, an exchange, PvP, Worlds, farming, fishing,
 * crafting, guilds and a DAO, and every quest was gated behind finding Aria
 * first — so a new player had no indication of what to do. 71% of all
 * characters never passed level 3 and 14 never came back after one session.
 *
 * This keeps the current objective on screen permanently, so there is always a
 * next step visible without opening a panel. Deliberately small and dismissible
 * — it must not become clutter for players who already know where they're
 * going, and it hides itself entirely once the quest log is empty.
 */

const DISMISS_KEY = "mb.objectiveTracker.hidden";

export function ObjectiveTracker() {
  const questState = useGameStore((s) => s.questState);
  const anyPanelOpen = useGameStore(isAnyPanelOpen);
  const mobileLayout = useMobileLayout();
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [flash, setFlash] = useState(false);

  // The first active quest is the one to show — the chain is linear early on,
  // which is exactly when this matters.
  const quest = questState.active[0];
  const objective = quest?.objectives.find((o) => !o.done) ?? quest?.objectives[0];
  const label = objective?.label ?? null;

  // Pulse when the objective changes so progress is noticed without a panel.
  useEffect(() => {
    if (!label) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(t);
  }, [label]);

  // Nothing to guide toward, or the player put it away.
  if (!quest || !label || hidden) return null;
  // Never compete with an open panel for attention or space.
  if (anyPanelOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: mobileLayout ? 96 : 108,
        left: mobileLayout ? 8 : 16,
        zIndex: 12,
        pointerEvents: "auto",
        maxWidth: mobileLayout ? 190 : 240,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid rgba(79,184,168,0.55)",
        background: "rgba(10,10,10,0.72)",
        backdropFilter: "blur(3px)",
        boxShadow: flash ? "0 0 14px rgba(111,212,194,0.55)" : "0 2px 8px rgba(0,0,0,0.35)",
        transition: "box-shadow 400ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: 3,
        }}
      >
        <span style={{ fontSize: "0.6rem", letterSpacing: 1, color: "#6FD4C2", fontWeight: 800 }}>
          ◆ CURRENT QUEST
        </span>
        <button
          type="button"
          aria-label="Hide objective tracker"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setHidden(true);
          }}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
            fontSize: "0.72rem",
            lineHeight: 1,
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: mobileLayout ? "0.72rem" : "0.78rem", fontWeight: 800, color: "#fff" }}>
        {quest.title}
      </div>
      <div
        style={{
          fontSize: mobileLayout ? "0.66rem" : "0.72rem",
          color: "rgba(255,255,255,0.82)",
          marginTop: 2,
        }}
      >
        → {label}
        {objective?.progress ? ` (${objective.progress})` : ""}
      </div>
      {(quest.rewardXp > 0 || (quest.rewardGold ?? 0) > 0) && (
        <div style={{ fontSize: "0.62rem", color: "#C9A84C", marginTop: 3 }}>
          Reward: {quest.rewardXp} XP
          {quest.rewardGold ? ` · ${quest.rewardGold}g` : ""}
        </div>
      )}
    </div>
  );
}
