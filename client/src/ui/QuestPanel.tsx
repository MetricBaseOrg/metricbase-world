import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

function QuestLogContent() {
  const questState = useGameStore((state) => state.questState);

  return (
    <>
      {questState.active.length === 0 ? (
        <div className="chibi-text-muted">No active quests.</div>
      ) : (
        questState.active.map((quest) => (
          <div key={quest.id} className="chibi-card" style={{ marginBottom: 10 }}>
            <div className="chibi-quest-title">{quest.title}</div>
            <div className="chibi-text-muted" style={{ margin: "4px 0 6px" }}>
              {quest.description}
            </div>
            {quest.objectives.map((objective) => (
              <div
                key={objective.label}
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  opacity: objective.done ? 0.55 : 1,
                  textDecoration: objective.done ? "line-through" : "none",
                }}
              >
                {objective.done ? "✅" : "⭕"} {objective.label}
                {!objective.done && objective.progress && (
                  <span style={{ color: "var(--chibi-gold-deep)", marginLeft: 6 }}>({objective.progress})</span>
                )}
              </div>
            ))}
            <div className="chibi-text-muted" style={{ marginTop: 4 }}>
              Reward: {quest.rewardXp} XP
              {quest.rewardGold ? ` · 🪙 ${quest.rewardGold} gold` : ""}
              {quest.rewardItemName ? ` · ⚔️ ${quest.rewardItemName}` : ""}
            </div>
          </div>
        ))
      )}

      {questState.completed.length > 0 && (
        <div className="chibi-text-muted" style={{ marginTop: 8 }}>
          Completed: {questState.completed.length}
        </div>
      )}
    </>
  );
}

export function QuestPanel() {
  const questState = useGameStore((state) => state.questState);
  const inventoryOpen = useGameStore((state) => state.inventoryOpen);
  const mobileLayout = useMobileLayout();
  const [open, setOpen] = useState(false);
  const hasContent = questState.active.length > 0 || questState.completed.length > 0;

  if (!hasContent || inventoryOpen) {
    return null;
  }

  if (mobileLayout && !open) {
    return (
      <button
        type="button"
        className="chibi-quest-fab"
        onClick={() => {
          playSfx("ui_open");
          setOpen(true);
        }}
        aria-label="Open quest log"
      >
        📜
        {questState.active.length > 0 && (
          <span className="chibi-chat-fab__badge">{questState.active.length}</span>
        )}
      </button>
    );
  }

  if (mobileLayout) {
    return (
      <>
        <button
          type="button"
          className="chibi-chat-backdrop"
          aria-label="Close quest log"
          onClick={() => {
            playSfx("ui_close");
            setOpen(false);
          }}
        />
        <div className="chibi-quest-sheet">
          <div className="chibi-chat-sheet__header">
            <span className="chibi-title chibi-title--sm">Quest Log</span>
            <button
              type="button"
              className="chibi-btn chibi-btn--ghost"
              onClick={() => {
                playSfx("ui_close");
                setOpen(false);
              }}
              aria-label="Close quest log"
            >
              ×
            </button>
          </div>
          <QuestLogContent />
        </div>
      </>
    );
  }

  return (
    <div className="chibi-panel chibi-panel--floating chibi-panel--side chibi-panel--quest chibi-anchor chibi-anchor--top-right">
      <div className="chibi-title chibi-title--sm chibi-sparkle-title" style={{ marginBottom: 8 }}>
        Quest Log
      </div>
      <QuestLogContent />
    </div>
  );
}