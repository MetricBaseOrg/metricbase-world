import { useGameStore } from "../store/gameStore";

export function QuestPanel() {
  const questState = useGameStore((state) => state.questState);
  const hasContent = questState.active.length > 0 || questState.completed.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 280,
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgba(8, 12, 24, 0.82)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        color: "#f4f7ff",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Quest Log</div>

      {questState.active.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.6 }}>No active quests.</div>
      ) : (
        questState.active.map((quest) => (
          <div key={quest.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ffd27f" }}>{quest.title}</div>
            <div style={{ fontSize: 12, opacity: 0.75, margin: "4px 0 6px" }}>{quest.description}</div>
            {quest.objectives.map((objective) => (
              <div
                key={objective.label}
                style={{
                  fontSize: 12,
                  opacity: objective.done ? 0.55 : 0.9,
                  textDecoration: objective.done ? "line-through" : "none",
                }}
              >
                {objective.done ? "✓" : "○"} {objective.label}
              </div>
            ))}
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>Reward: {quest.rewardXp} XP</div>
          </div>
        ))
      )}

      {questState.completed.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55 }}>
          Completed: {questState.completed.length}
        </div>
      )}
    </div>
  );
}