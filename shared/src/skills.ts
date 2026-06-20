export const SKILL_WOODCUTTING = "woodcutting";

export const CHOP_RANGE = 80;

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

/** Cumulative woodcutting XP required to reach each level (index = level - 1). */
export const WOODCUTTING_LEVEL_XP_THRESHOLDS = [
  0, 50, 120, 220, 360, 550, 800, 1100, 1500, 2000, 2600,
];

export interface SkillXpMap {
  woodcutting: number;
}

export interface WoodcuttingSkillView {
  level: number;
  xp: number;
}

export interface SkillStatePayload {
  woodcutting: WoodcuttingSkillView;
}

export const EMPTY_SKILLS: SkillXpMap = {
  woodcutting: 0,
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

export function normalizeSkills(raw?: Partial<SkillXpMap> | null): SkillXpMap {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_SKILLS };
  }

  const woodcutting =
    typeof raw.woodcutting === "number" && Number.isFinite(raw.woodcutting) && raw.woodcutting >= 0
      ? Math.floor(raw.woodcutting)
      : 0;

  return { woodcutting };
}

export function buildSkillStatePayload(skills: SkillXpMap): SkillStatePayload {
  const xp = skills.woodcutting;
  return {
    woodcutting: {
      level: woodcuttingLevelFromXp(xp),
      xp,
    },
  };
}