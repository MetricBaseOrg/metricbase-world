export const XP_PORTAL_TRAVEL = 25;
export const XP_NPC_INTERACT = 10;
export const NPC_INTERACT_COOLDOWN_MS = 30_000;
export const NPC_INTERACT_RANGE = 80;

/** Cumulative XP required to reach each level (index = level - 1). */
export const LEVEL_XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4400];

export function levelFromXp(xp: number): number {
  let level = 1;
  for (let index = 1; index < LEVEL_XP_THRESHOLDS.length; index++) {
    if (xp >= LEVEL_XP_THRESHOLDS[index]) {
      level = index + 1;
    } else {
      break;
    }
  }
  return level;
}

export function xpProgress(xp: number, level: number): { current: number; required: number } {
  const floor = LEVEL_XP_THRESHOLDS[level - 1] ?? 0;
  const ceiling = LEVEL_XP_THRESHOLDS[level] ?? floor + 1000;
  return {
    current: Math.max(0, xp - floor),
    required: Math.max(1, ceiling - floor),
  };
}