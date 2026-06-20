export const SKILL_WOODCUTTING = "woodcutting";

export const CHOP_COOLDOWN_MS = 900;
export const CHOP_RANGE = 80;
export const WOODCUTTING_XP_PER_CHOP = 12;

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