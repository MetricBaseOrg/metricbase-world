import { ZONE_WILDERNESS } from "./zones.js";

export const QUEST_GREET_ARIA = "quest_greet_aria";
export const QUEST_EXPLORE_WILDERNESS = "quest_explore_wilderness";

export type QuestObjectiveType = "talk_npc" | "visit_zone";

export interface QuestObjective {
  type: QuestObjectiveType;
  target: string;
  label: string;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewardXp: number;
  rewardGold?: number;
  startNpcId?: string;
  requiresCompleted?: string[];
}

export interface QuestProgress {
  active: string[];
  objectiveIndex: Record<string, number>;
  completed: string[];
}

export interface QuestStatePayload {
  active: QuestView[];
  completed: string[];
}

export interface QuestView {
  id: string;
  title: string;
  description: string;
  objectives: Array<{ label: string; done: boolean }>;
  rewardXp: number;
}

export const EMPTY_QUEST_PROGRESS: QuestProgress = {
  active: [],
  objectiveIndex: {},
  completed: [],
};

export const QUESTS: Record<string, QuestDefinition> = {
  [QUEST_GREET_ARIA]: {
    id: QUEST_GREET_ARIA,
    title: "Meet the Guide",
    description: "Aria can point you toward your first adventure.",
    objectives: [{ type: "talk_npc", target: "hub_guide", label: "Talk to Aria" }],
    rewardXp: 20,
    rewardGold: 10,
    startNpcId: "hub_guide",
  },
  [QUEST_EXPLORE_WILDERNESS]: {
    id: QUEST_EXPLORE_WILDERNESS,
    title: "Into the Wilderness",
    description: "Step through the portal and explore the outer zone.",
    objectives: [{ type: "visit_zone", target: ZONE_WILDERNESS, label: "Enter the Wilderness" }],
    rewardXp: 50,
    rewardGold: 25,
    startNpcId: "hub_guide",
    requiresCompleted: [QUEST_GREET_ARIA],
  },
};

export function getQuestDefinition(questId: string): QuestDefinition {
  const quest = QUESTS[questId];
  if (!quest) {
    throw new Error(`Unknown quest: ${questId}`);
  }
  return quest;
}

export function canStartQuest(progress: QuestProgress, questId: string): boolean {
  if (progress.completed.includes(questId) || progress.active.includes(questId)) {
    return false;
  }

  const quest = QUESTS[questId];
  if (!quest) return false;

  return (quest.requiresCompleted ?? []).every((required) => progress.completed.includes(required));
}

export function startQuest(progress: QuestProgress, questId: string): QuestProgress {
  if (!canStartQuest(progress, questId)) {
    return progress;
  }

  return {
    active: [...progress.active, questId],
    objectiveIndex: { ...progress.objectiveIndex, [questId]: 0 },
    completed: progress.completed,
  };
}

export function completeQuest(progress: QuestProgress, questId: string): QuestProgress {
  return {
    active: progress.active.filter((id) => id !== questId),
    objectiveIndex: Object.fromEntries(
      Object.entries(progress.objectiveIndex).filter(([id]) => id !== questId),
    ),
    completed: progress.completed.includes(questId)
      ? progress.completed
      : [...progress.completed, questId],
  };
}

export function advanceQuestObjective(
  progress: QuestProgress,
  questId: string,
): { progress: QuestProgress; completed: boolean } {
  const quest = QUESTS[questId];
  if (!quest || !progress.active.includes(questId)) {
    return { progress, completed: false };
  }

  const current = progress.objectiveIndex[questId] ?? 0;
  const nextIndex = current + 1;
  const updated: QuestProgress = {
    ...progress,
    objectiveIndex: { ...progress.objectiveIndex, [questId]: nextIndex },
  };

  return {
    progress: updated,
    completed: nextIndex >= quest.objectives.length,
  };
}

export function buildQuestViews(progress: QuestProgress): QuestStatePayload {
  const active = progress.active.map((questId) => {
    const quest = getQuestDefinition(questId);
    const doneCount = progress.objectiveIndex[questId] ?? 0;

    return {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      rewardXp: quest.rewardXp,
      objectives: quest.objectives.map((objective, index) => ({
        label: objective.label,
        done: index < doneCount,
      })),
    };
  });

  return {
    active,
    completed: progress.completed,
  };
}

export function getQuestsOfferedByNpc(npcId: string, progress: QuestProgress): string[] {
  return Object.values(QUESTS)
    .filter((quest) => quest.startNpcId === npcId)
    .filter((quest) => canStartQuest(progress, quest.id))
    .map((quest) => quest.id);
}