// Daily quests + login streak rewards. Three tasks rotate each UTC day
// (deterministically from the date, so every server/client agrees), plus an
// escalating consecutive-login gold bonus. Rewards are claimed manually so the
// player gets the little dopamine hit of pressing the button.

export interface DailyTaskDef {
  /** Stable task id — also the progress-counter key. */
  id: string;
  label: string;
  emoji: string;
  target: number;
  gold: number;
  gems: number;
}

export const DAILY_TASK_POOL: DailyTaskDef[] = [
  { id: "gather", label: "Gather resources", emoji: "🧺", target: 10, gold: 150, gems: 0 },
  { id: "mobs", label: "Defeat mobs", emoji: "⚔️", target: 8, gold: 200, gems: 0 },
  { id: "craft", label: "Craft items", emoji: "🔨", target: 3, gold: 150, gems: 0 },
  { id: "harvest", label: "Harvest crops", emoji: "🌾", target: 4, gold: 120, gems: 0 },
  { id: "sell", label: "Sell items", emoji: "💰", target: 5, gold: 100, gems: 0 },
  { id: "visitWorld", label: "Visit a player World", emoji: "🌍", target: 1, gold: 100, gems: 1 },
];

/** UTC day key (YYYY-MM-DD) daily state is bucketed by. */
export function dailyDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** The 3 tasks active on a given day — deterministic hash pick from the pool. */
export function dailyTasksFor(day: string): DailyTaskDef[] {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = [...DAILY_TASK_POOL];
  const out: DailyTaskDef[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    out.push(pool.splice(h % pool.length, 1)[0]);
    h = (h * 2654435761 + 97) >>> 0;
  }
  return out;
}

/** Login bonus per consecutive-day streak (day 1, 2, … capped at the last). */
export const LOGIN_STREAK_GOLD = [100, 150, 200, 300, 400, 500, 1000];

export function loginRewardGold(streak: number): number {
  const idx = Math.max(0, Math.min(LOGIN_STREAK_GOLD.length - 1, streak - 1));
  return LOGIN_STREAK_GOLD[idx];
}

export interface DailyTaskState extends DailyTaskDef {
  progress: number;
  claimed: boolean;
}

export interface DailyStatePayload {
  day: string;
  /** Consecutive login days including today. */
  streak: number;
  loginClaimed: boolean;
  /** Gold the current streak's login reward pays. */
  loginGold: number;
  tasks: DailyTaskState[];
}

export interface DailyResultPayload {
  ok: boolean;
  message?: string;
  error?: string;
}
