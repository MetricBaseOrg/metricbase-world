export const SKILL_WOODCUTTING = "woodcutting";
export const SKILL_MINING = "mining";
export const SKILL_FISHING = "fishing";
export const SKILL_FARMING = "farming";

export const CHOP_RANGE = 80;
export const MINE_RANGE = 80;
export const FISH_RANGE = 110;
export const FARM_RANGE = 120;

/** Base chop time per tree level (level-1 trees take 60 seconds at Woodcutting 1). */
export const WOODCUTTING_CHOP_BASE_MS = 60_000;

/** Minimum fraction of base chop time (high Woodcutting still takes a while). */
export const WOODCUTTING_CHOP_MIN_MULTIPLIER = 0.35;

/** Each Woodcutting level above 1 reduces chop time by this fraction. */
export const WOODCUTTING_CHOP_LEVEL_REDUCTION = 0.06;

export function computeChopDurationMs(treeLevel: number, woodcuttingLevel: number): number {
  const level = Math.max(1, Math.floor(treeLevel));
  const skillLevel = Math.max(1, Math.floor(woodcuttingLevel));
  const baseMs = WOODCUTTING_CHOP_BASE_MS * level;
  const multiplier = Math.max(
    WOODCUTTING_CHOP_MIN_MULTIPLIER,
    1 - (skillLevel - 1) * WOODCUTTING_CHOP_LEVEL_REDUCTION,
  );
  return Math.round(baseMs * multiplier);
}

/** Mining shares woodcutting's timing curve (rocks are tougher per level). */
export function computeMineDurationMs(rockLevel: number, miningLevel: number): number {
  return computeChopDurationMs(rockLevel, miningLevel);
}

/** Fishing is a bit quicker per level — biting is luck, not effort. */
export function computeFishDurationMs(spotLevel: number, fishingLevel: number): number {
  return Math.round(computeChopDurationMs(spotLevel, fishingLevel) * 0.7);
}

/** Cumulative woodcutting XP required to reach each level (index = level - 1). */
export const WOODCUTTING_LEVEL_XP_THRESHOLDS = [
  0, 50, 120, 220, 360, 550, 800, 1100, 1500, 2000, 2600,
];

export interface SkillXpMap {
  woodcutting: number;
  mining: number;
  fishing: number;
  farming: number;
}

export interface WoodcuttingSkillView {
  level: number;
  xp: number;
}

/** A generic level/xp view for any gathering skill. */
export type SkillView = WoodcuttingSkillView;

export interface SkillStatePayload {
  woodcutting: WoodcuttingSkillView;
  /** Optional so older clients/payloads keep type-checking. */
  mining?: SkillView;
  fishing?: SkillView;
  farming?: SkillView;
}

export const EMPTY_SKILLS: SkillXpMap = {
  woodcutting: 0,
  mining: 0,
  fishing: 0,
  farming: 0,
};

export function woodcuttingLevelFromXp(xp: number): number {
  let level = 1;
  for (let index = 1; index < WOODCUTTING_LEVEL_XP_THRESHOLDS.length; index++) {
    if (xp >= WOODCUTTING_LEVEL_XP_THRESHOLDS[index]) {
      level = index + 1;
    } else {
      break;
    }
  }
  return level;
}

export function woodcuttingXpProgress(
  xp: number,
  level: number,
): { current: number; required: number } {
  const currentThreshold = WOODCUTTING_LEVEL_XP_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = WOODCUTTING_LEVEL_XP_THRESHOLDS[level] ?? currentThreshold + 500;
  return {
    current: Math.max(0, xp - currentThreshold),
    required: Math.max(1, nextThreshold - currentThreshold),
  };
}

/** Mining and fishing share the woodcutting XP curve. */
export const miningLevelFromXp = woodcuttingLevelFromXp;
export const miningXpProgress = woodcuttingXpProgress;
export const fishingLevelFromXp = woodcuttingLevelFromXp;
export const fishingXpProgress = woodcuttingXpProgress;
export const farmingLevelFromXp = woodcuttingLevelFromXp;
export const farmingXpProgress = woodcuttingXpProgress;

function normalizeXpValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function normalizeSkills(raw?: Partial<SkillXpMap> | null): SkillXpMap {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_SKILLS };
  }

  return {
    woodcutting: normalizeXpValue(raw.woodcutting),
    mining: normalizeXpValue(raw.mining),
    fishing: normalizeXpValue(raw.fishing),
    farming: normalizeXpValue(raw.farming),
  };
}

export function buildSkillStatePayload(skills: SkillXpMap): SkillStatePayload {
  return {
    woodcutting: {
      level: woodcuttingLevelFromXp(skills.woodcutting),
      xp: skills.woodcutting,
    },
    mining: {
      level: miningLevelFromXp(skills.mining),
      xp: skills.mining,
    },
    fishing: {
      level: fishingLevelFromXp(skills.fishing),
      xp: skills.fishing,
    },
    farming: {
      level: farmingLevelFromXp(skills.farming),
      xp: skills.farming,
    },
  };
}