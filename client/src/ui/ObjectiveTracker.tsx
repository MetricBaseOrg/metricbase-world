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

/** Breathing room between the bottom of the HUD panel and this card. */
const TRACKER_GAP = 10;
/** Used only when the top bar can't be found — matches its old hardcoded guess. */
const FALLBACK_TOP = { mobile: 96, desktop: 108 };

/**
 * Track the bottom edge of the top-left HUD panel.
 *
 * This used to be a hardcoded `top: 96/108`, which was a guess at the HUD's
 * height — and the HUD's height is not fixed. It grows with the notification
 * badge, a long player name, the gold row wrapping, and the safe-area inset on
 * mobile/TWA, and it shrinks when minimised. Whenever it grew past the guess,
 * this card ended up underneath it and the current quest was invisible.
 *
 * Measuring means it is right for every one of those states instead of one.
 */
function useTopBarBottom(mobileLayout: boolean): number {
  const fallback = mobileLayout ? FALLBACK_TOP.mobile : FALLBACK_TOP.desktop;
  const [top, setTop] = useState(fallback);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let observed: Element | null = null;

    const measure = () => {
      const bar = document.querySelector(".chibi-topbar");
      if (!bar) {
        setTop(fallback);
        return;
      }
      // Measure the HUD rows only. The ⚙️ and 🔔 dropdowns live inside the same
      // element and can be several hundred pixels tall, so following the panel's
      // full height would fling this card down the screen every time one opens.
      let bottom = 0;
      for (const child of Array.from(bar.children)) {
        if (child.classList.contains("chibi-topbar__menu")) continue;
        bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
      }
      if (bottom === 0) bottom = bar.getBoundingClientRect().bottom;

      // Clear the panel's own padding and border before adding the gap.
      const next = bottom + 11 + TRACKER_GAP;
      // Only guard against running off the bottom of a short screen. An earlier
      // version clamped to 45% of the viewport height, which on a 360x640 phone
      // resolved to 288px — above the 306px bottom of the HUD, quietly putting
      // the card back underneath it. Any ceiling below the HUD recreates the
      // exact bug this is fixing, so the floor has to win.
      const ceiling = Math.max(next, window.innerHeight - 130);
      setTop(Math.round(Math.min(next, ceiling)));
    };

    // The top bar is swapped for a different element when it minimises, so the
    // observer has to be re-attached rather than bound once.
    const attach = () => {
      const bar = document.querySelector(".chibi-topbar");
      if (bar === observed) return;
      resizeObserver?.disconnect();
      observed = bar;
      if (bar) {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(bar);
      }
      measure();
    };

    attach();
    const mutationObserver = new MutationObserver(attach);
    if (document.body) mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [fallback]);

  return top;
}

export function ObjectiveTracker() {
  const questState = useGameStore((s) => s.questState);
  const anyPanelOpen = useGameStore(isAnyPanelOpen);
  const mobileLayout = useMobileLayout();
  const trackerTop = useTopBarBottom(mobileLayout);
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
        top: trackerTop,
        left: mobileLayout ? 8 : 16,
        // Just under the top bar's 18 (.chibi-anchor--top-left), not below it by
        // six: at 12 this card lost to the HUD panel on any overlap and simply
        // vanished. Staying under 18 keeps the ⚙️/🔔 dropdowns layered over it.
        zIndex: 17,
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
