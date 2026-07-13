export const XP_PORTAL_TRAVEL = 25;
export const XP_NPC_INTERACT = 10;
export const NPC_INTERACT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const NPC_INTERACT_RANGE = 80;

/** The highest combat level a player can reach. */
export const MAX_LEVEL = 99;

/**
 * Cumulative XP required to reach each level (index = level - 1). The first ten
 * levels keep their hand-tuned values; beyond that the per-level cost keeps
 * climbing smoothly (delta starts at 1000 and grows 100 each level) out to
 * MAX_LEVEL, so there's a long-term progression goal past the early game.
 */
function buildLevelThresholds(): number[] {
  const thresholds = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4400]; // L1–L10
  let delta = 1000;
  for (let level = thresholds.length + 1; level <= MAX_LEVEL; level++) {
    thresholds.push(thresholds[thresholds.length - 1] + delta);
    delta += 100;
  }
  return thresholds;
}

export const LEVEL_XP_THRESHOLDS = buildLevelThresholds();

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
  const ceiling = LEVEL_XP_THRESHOLDS[level];
  // At max level there's no next threshold — show a full bar.
  if (ceiling === undefined) {
    return { current: 1, required: 1 };
  }
  return {
    current: Math.max(0, xp - floor),
    required: Math.max(1, ceiling - floor),
  };
}