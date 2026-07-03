import { getPool } from "./pool.js";

/** Per-player daily-quest state persisted across restarts and zone transfers. */
export interface DailyRow {
  day: string;
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
  loginClaimed: boolean;
  streak: number;
  lastLoginDay: string | null;
}

export function emptyDailyRow(day: string): DailyRow {
  return { day, progress: {}, claimed: {}, loginClaimed: false, streak: 0, lastLoginDay: null };
}

export async function loadDailyState(playerName: string): Promise<DailyRow | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const res = await pool.query<{
      day: string;
      progress: Record<string, number> | null;
      claimed: Record<string, boolean> | null;
      login_claimed: boolean | null;
      streak: number | null;
      last_login_day: string | null;
    }>(
      "SELECT day, progress, claimed, login_claimed, streak, last_login_day FROM daily_state WHERE player_name = $1",
      [playerName],
    );
    if (!res.rowCount) return null;
    const r = res.rows[0];
    return {
      day: r.day,
      progress: r.progress ?? {},
      claimed: r.claimed ?? {},
      loginClaimed: Boolean(r.login_claimed),
      streak: r.streak ?? 0,
      lastLoginDay: r.last_login_day,
    };
  } catch (error) {
    console.warn("[daily] load failed:", error);
    return null;
  }
}

export async function saveDailyState(playerName: string, row: DailyRow): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO daily_state (player_name, day, progress, claimed, login_claimed, streak, last_login_day)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
       ON CONFLICT (player_name)
       DO UPDATE SET day = EXCLUDED.day, progress = EXCLUDED.progress, claimed = EXCLUDED.claimed,
                     login_claimed = EXCLUDED.login_claimed, streak = EXCLUDED.streak,
                     last_login_day = EXCLUDED.last_login_day`,
      [
        playerName,
        row.day,
        JSON.stringify(row.progress),
        JSON.stringify(row.claimed),
        row.loginClaimed,
        row.streak,
        row.lastLoginDay,
      ],
    );
  } catch (error) {
    console.warn("[daily] save failed:", error);
  }
}
