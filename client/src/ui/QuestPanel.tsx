import { useGameStore } from "../store/gameStore";
import { panelPosition } from "./chibiTheme";

export function QuestPanel() {
  const questState = useGameStore((state) => state.questState);
  const hasContent = questState.active.length > 0 || questState.completed.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div
      className="chibi-panel chibi-panel--floating"
      style={{ ...panelPosition("top-right"), width: 280, padding: "12px 14px", pointerEvents: "none" }}
    >
      <div className="chibi-title chibi-title--sm chibi-sparkle-title" style={{ marginBottom: 8 }}>
        Quest Log
      </div>

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
              </div>
            ))}
            <div className="chibi-text-muted" style={{ marginTop: 4 }}>
              Reward: {quest.rewardXp} XP
            </div>
          </div>
        ))
      )}

      {questState.completed.length > 0 && (
        <div className="chibi-text-muted" style={{ marginTop: 8 }}>
          Completed: {questState.completed.length}
        </div>
      )}
    </div>
  );
}