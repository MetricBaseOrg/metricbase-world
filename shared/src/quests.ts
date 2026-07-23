import { getItemDefinition, getItemQuantity, type InventoryEntry } from "./items.js";
import { ZONE_GROTTO, ZONE_WILDERNESS } from "./zones.js";

export const QUEST_GREET_ARIA = "quest_greet_aria";
export const QUEST_EXPLORE_WILDERNESS = "quest_explore_wilderness";
export const QUEST_DEFEAT_DUMMY = "quest_defeat_dummy";
export const QUEST_COLLECT_SCRAP = "quest_collect_scrap";
export const QUEST_VETERAN = "quest_veteran";
export const QUEST_SLIME_HUNTER = "quest_slime_hunter";
export const QUEST_SLIME_SAMPLES = "quest_slime_samples";
export const QUEST_ARIA_COMMENDATION = "quest_aria_commendation";
export const QUEST_EXPLORE_GROTTO = "quest_explore_grotto";
export const QUEST_DEFEAT_BRUTE = "quest_defeat_brute";
// Level 5-9 bridge — the Thornback tier + its bridge weapon, wedged between the
// Brute and the Ember chain so the objective tracker never runs dry mid-climb.
export const QUEST_THORNBACK = "quest_thornback";
export const QUEST_THORN_ARMS = "quest_thorn_arms";
export const QUEST_SMITH_INTRO = "quest_smith_intro";
export const QUEST_SMITH_IRON = "quest_smith_iron";
export const QUEST_SMITH_STEEL = "quest_smith_steel";
export const QUEST_SMITH_RARE = "quest_smith_rare";
export const QUEST_SMITH_MASTER = "quest_smith_master";
// Ember chain — the guided route into the level 5-9 content. Without it the
// Ember Slimes and the world boss were undiscoverable: the objective tracker
// runs dry after the smith chain and nothing tells a player they exist.
export const QUEST_EMBER_HUNTER = "quest_ember_hunter";
export const QUEST_EMBER_CORES = "quest_ember_cores";
export const QUEST_EMBER_ARMS = "quest_ember_arms";
export const QUEST_SENTINEL = "quest_sentinel";

export type QuestObjectiveType = "talk_npc" | "visit_zone" | "defeat_npc" | "collect_item";

export interface QuestObjective {
  type: QuestObjectiveType;
  target: string;
  label: string;
  count?: number;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewardXp: number;
  rewardGold?: number;
  rewardItemId?: string;
  rewardItemQuantity?: number;
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
  objectives: Array<{ label: string; done: boolean; progress?: string }>;
  rewardXp: number;
  rewardGold?: number;
  rewardItemName?: string;
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
  [QUEST_DEFEAT_DUMMY]: {
    id: QUEST_DEFEAT_DUMMY,
    title: "Practice Makes Perfect",
    description: "The Training Dummy in the Wilderness is waiting. Show it what you've learned.",
    objectives: [
      { type: "defeat_npc", target: "training_dummy", label: "Defeat the Training Dummy" },
    ],
    rewardXp: 75,
    rewardGold: 30,
    startNpcId: "hub_guide",
    requiresCompleted: [QUEST_EXPLORE_WILDERNESS],
  },
  [QUEST_COLLECT_SCRAP]: {
    id: QUEST_COLLECT_SCRAP,
    title: "Salvage the Scrap",
    description: "Bring back training materials from defeated dummies.",
    objectives: [
      {
        type: "collect_item",
        target: "item_training_scrap",
        count: 3,
        label: "Collect 3 Training Scrap",
      },
    ],
    rewardXp: 40,
    rewardGold: 20,
    startNpcId: "hub_guide",
    requiresCompleted: [QUEST_DEFEAT_DUMMY],
  },
  [QUEST_VETERAN]: {
    id: QUEST_VETERAN,
    title: "Veteran Adventurer",
    description: "Aria wants to recognize your progress in the hub.",
    objectives: [{ type: "talk_npc", target: "hub_guide", label: "Report back to Aria" }],
    rewardXp: 100,
    rewardGold: 50,
    startNpcId: "hub_guide",
    requiresCompleted: [QUEST_COLLECT_SCRAP],
  },
  [QUEST_SLIME_HUNTER]: {
    id: QUEST_SLIME_HUNTER,
    title: "Slime Patrol",
    description: "Rook needs the Wild Slime near the south path cleared.",
    objectives: [{ type: "defeat_npc", target: "wild_slime", label: "Defeat a Wild Slime" }],
    rewardXp: 60,
    rewardGold: 15,
    startNpcId: "wilderness_scout",
    requiresCompleted: [QUEST_VETERAN],
  },
  [QUEST_SLIME_SAMPLES]: {
    id: QUEST_SLIME_SAMPLES,
    title: "Gel Collection",
    description: "Harvest slime gel for Rudi's alchemy supplies.",
    objectives: [
      {
        type: "collect_item",
        target: "item_slime_gel",
        count: 5,
        label: "Collect 5 Slime Gel",
      },
    ],
    rewardXp: 80,
    rewardGold: 35,
    startNpcId: "wilderness_scout",
    requiresCompleted: [QUEST_SLIME_HUNTER],
  },
  [QUEST_ARIA_COMMENDATION]: {
    id: QUEST_ARIA_COMMENDATION,
    title: "Commendation",
    description: "Rook says Aria will want to hear about your patrol work.",
    objectives: [{ type: "talk_npc", target: "hub_guide", label: "Report to Aria in the Hub" }],
    rewardXp: 120,
    rewardGold: 60,
    rewardItemId: "item_gel_knife",
    rewardItemQuantity: 1,
    startNpcId: "wilderness_scout",
    requiresCompleted: [QUEST_SLIME_SAMPLES],
  },
  [QUEST_EXPLORE_GROTTO]: {
    id: QUEST_EXPLORE_GROTTO,
    title: "Into the Grotto",
    description: "Rook heard rumors of a deeper cave past the Wilderness slimes.",
    objectives: [{ type: "visit_zone", target: ZONE_GROTTO, label: "Enter the Slime Grotto" }],
    rewardXp: 90,
    rewardGold: 40,
    startNpcId: "wilderness_scout",
    requiresCompleted: [QUEST_ARIA_COMMENDATION],
  },
  [QUEST_DEFEAT_BRUTE]: {
    id: QUEST_DEFEAT_BRUTE,
    title: "Brute Force",
    description: "Moss says the Slime Brute guards the cavern's heart.",
    objectives: [{ type: "defeat_npc", target: "slime_brute", label: "Defeat the Slime Brute" }],
    rewardXp: 150,
    rewardGold: 75,
    startNpcId: "grotto_warden",
    requiresCompleted: [QUEST_EXPLORE_GROTTO],
  },
  [QUEST_THORNBACK]: {
    id: QUEST_THORNBACK,
    title: "Thin the Herd",
    description:
      "Moss says thornback slimes have crept up from the deep pools — tougher than the little ones, but nothing like the Brute. Clear a few out.",
    objectives: [
      { type: "defeat_npc", target: "thorn_slime", label: "Defeat a Thornback Slime" },
    ],
    rewardXp: 180,
    rewardGold: 80,
    startNpcId: "grotto_warden",
    requiresCompleted: [QUEST_DEFEAT_BRUTE],
  },
  [QUEST_THORN_ARMS]: {
    id: QUEST_THORN_ARMS,
    title: "Cut from Thorn",
    description:
      "Brenna can barb a steel cleaver with hardened thorn gel — a real blade to carry into the deep. Gather the gel and forge one.",
    objectives: [
      { type: "collect_item", target: "item_thorn_cleaver", count: 1, label: "Forge a Thorn Cleaver" },
    ],
    rewardXp: 260,
    rewardGold: 120,
    startNpcId: "hub_smith",
    requiresCompleted: [QUEST_THORNBACK],
  },
  [QUEST_SMITH_INTRO]: {
    id: QUEST_SMITH_INTRO,
    title: "The Blacksmith's Call",
    description: "Brenna the smith has set up her forge in the hub. See what she needs.",
    objectives: [{ type: "talk_npc", target: "hub_smith", label: "Talk to Brenna" }],
    rewardXp: 60,
    rewardGold: 20,
    startNpcId: "hub_smith",
    requiresCompleted: [QUEST_VETERAN],
  },
  [QUEST_SMITH_IRON]: {
    id: QUEST_SMITH_IRON,
    title: "Iron in the Blood",
    description: "Brenna needs raw iron from the Wilderness deposits (Mining 3) to stoke the forge.",
    objectives: [
      { type: "collect_item", target: "item_iron_ore", count: 5, label: "Collect 5 Iron Ore" },
    ],
    rewardXp: 100,
    rewardGold: 45,
    startNpcId: "hub_smith",
    requiresCompleted: [QUEST_SMITH_INTRO],
  },
  [QUEST_SMITH_STEEL]: {
    id: QUEST_SMITH_STEEL,
    title: "Tempered Steel",
    description: "Smelt iron with hardwood into steel bars and bring two to prove your craft.",
    objectives: [
      { type: "collect_item", target: "item_steel_bar", count: 2, label: "Forge 2 Steel Bars" },
    ],
    rewardXp: 150,
    rewardGold: 70,
    startNpcId: "hub_smith",
    requiresCompleted: [QUEST_SMITH_IRON],
  },
  [QUEST_SMITH_RARE]: {
    id: QUEST_SMITH_RARE,
    title: "A Rare Find",
    description: "Brenna wants a gemstone — keep gathering and luck will turn one up.",
    objectives: [
      { type: "collect_item", target: "item_gemstone", count: 1, label: "Find 1 Gemstone" },
    ],
    rewardXp: 220,
    rewardGold: 120,
    startNpcId: "hub_smith",
    requiresCompleted: [QUEST_SMITH_STEEL],
  },
  [QUEST_SMITH_MASTER]: {
    id: QUEST_SMITH_MASTER,
    title: "Master Smith",
    description: "Return to Brenna — she has a master-forged tool for a smith of your standing.",
    objectives: [{ type: "talk_npc", target: "hub_smith", label: "Report back to Brenna" }],
    rewardXp: 300,
    rewardGold: 100,
    rewardItemId: "item_steel_pickaxe",
    rewardItemQuantity: 1,
    startNpcId: "hub_smith",
    requiresCompleted: [QUEST_SMITH_RARE],
  },
  [QUEST_EMBER_HUNTER]: {
    id: QUEST_EMBER_HUNTER,
    title: "Something Hotter",
    description:
      "Moss has seen slimes with burning cores — north in the Wilderness, and deep in the Grotto. They hit far harder than a Brute.",
    objectives: [{ type: "defeat_npc", target: "ember_slime", label: "Defeat an Ember Slime" }],
    rewardXp: 220,
    rewardGold: 90,
    startNpcId: "grotto_warden",
    requiresCompleted: [QUEST_THORN_ARMS],
  },
  [QUEST_EMBER_CORES]: {
    id: QUEST_EMBER_CORES,
    title: "Fire in the Forge",
    description: "Brenna wants Ember Cores — she thinks she can work the heat straight into steel.",
    objectives: [
      { type: "collect_item", target: "item_ember_core", count: 3, label: "Collect 3 Ember Cores" },
    ],
    rewardXp: 260,
    rewardGold: 120,
    startNpcId: "hub_smith",
    requiresCompleted: [QUEST_EMBER_HUNTER],
  },
  [QUEST_EMBER_ARMS]: {
    id: QUEST_EMBER_ARMS,
    title: "Ember-Forged",
    description:
      "Brenna has the technique. Forge an Ember Blade at the crafting bench and show her what it can do.",
    objectives: [
      { type: "collect_item", target: "item_ember_blade", count: 1, label: "Craft an Ember Blade" },
    ],
    rewardXp: 400,
    rewardGold: 200,
    rewardItemId: "item_ember_helm",
    rewardItemQuantity: 1,
    startNpcId: "hub_smith",
    requiresCompleted: [QUEST_EMBER_CORES],
  },
  [QUEST_SENTINEL]: {
    id: QUEST_SENTINEL,
    title: "The Charred Sentinel",
    description:
      "Something enormous guards the Obsidian Reach. Moss doubts it can be done — bring back a shard and prove otherwise.",
    objectives: [
      { type: "defeat_npc", target: "black_warden", label: "Defeat the Charred Sentinel" },
    ],
    rewardXp: 1200,
    rewardGold: 600,
    startNpcId: "grotto_warden",
    requiresCompleted: [QUEST_EMBER_ARMS],
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

function objectiveProgressLabel(
  objective: QuestObjective,
  inventory: InventoryEntry[],
): string | undefined {
  if (objective.type !== "collect_item") return undefined;
  const required = objective.count ?? 1;
  const owned = getItemQuantity(inventory, objective.target);
  return `${Math.min(owned, required)}/${required}`;
}

export function isCollectObjectiveMet(
  objective: QuestObjective,
  inventory: InventoryEntry[],
): boolean {
  if (objective.type !== "collect_item") return false;
  return getItemQuantity(inventory, objective.target) >= (objective.count ?? 1);
}

export function buildQuestViews(
  progress: QuestProgress,
  inventory: InventoryEntry[] = [],
): QuestStatePayload {
  const active = progress.active.map((questId) => {
    const quest = getQuestDefinition(questId);
    const doneCount = progress.objectiveIndex[questId] ?? 0;

    return {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      rewardXp: quest.rewardXp,
      rewardGold: quest.rewardGold,
      rewardItemName: quest.rewardItemId
        ? getItemDefinition(quest.rewardItemId).name
        : undefined,
      objectives: quest.objectives.map((objective, index) => ({
        label: objective.label,
        done: index < doneCount,
        progress:
          index === doneCount && objective.type === "collect_item"
            ? objectiveProgressLabel(objective, inventory)
            : undefined,
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