/**
 * Castle Siege (Phase 5). On a recurring schedule the Black Zone's King Crystal
 * becomes vulnerable; guilds race to destroy it. The guild that lands the
 * killing blow is crowned Sovereign of MetricBase until the next siege and wins
 * a large prize into its guild bank.
 */

/** King Crystal total HP — guild-scale so a siege takes a coordinated push. */
export const KING_CRYSTAL_MAX_HP = 75_000;

/**
 * Crystal armor (same diminishing-returns curve as players). At ARMOR_K=100
 * this shaves ~37% off every hit, so gear quality genuinely matters and a
 * lone endgame player can no longer finish inside a siege window.
 */
export const KING_CRYSTAL_ARMOR = 60;

/** Gold prize paid into the victor guild's bank when the crystal falls. */
export const SIEGE_PRIZE = 50_000;

/** Tile in the Black Zone where the King Crystal stands. */
export const KING_CRYSTAL_TILE = { x: 12, y: 6 };

/** Range (world px) within which a player can strike the crystal. */
export const SIEGE_ATTACK_RANGE = 96;

// Siege schedule: the crystal is vulnerable for SIEGE_DURATION_MS at the start
// of every SIEGE_PERIOD_MS window (epoch-aligned, so all rooms agree). Tunable.
export const SIEGE_PERIOD_MS = 4 * 60 * 60 * 1000; // every 4 hours
export const SIEGE_DURATION_MS = 15 * 60 * 1000; // open for 15 min

export interface SiegeWindow {
  active: boolean;
  /** Epoch ms when the current phase (active/closed) flips. */
  nextChangeAt: number;
}

export function getSiegeWindow(now: number): SiegeWindow {
  const intoPeriod = now % SIEGE_PERIOD_MS;
  if (intoPeriod < SIEGE_DURATION_MS) {
    return { active: true, nextChangeAt: now - intoPeriod + SIEGE_DURATION_MS };
  }
  return { active: false, nextChangeAt: now - intoPeriod + SIEGE_PERIOD_MS };
}

export interface SiegeStatePayload {
  /** Is the crystal currently vulnerable? */
  active: boolean;
  hp: number;
  maxHp: number;
  /** Tag of the reigning Sovereign guild, or "" if none. */
  sovereignTag: string;
  /** Epoch ms when the siege window opens/closes next. */
  nextChangeAt: number;
}
