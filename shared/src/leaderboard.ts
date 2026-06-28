// Leaderboard: top players by combat level and by wealth. Sourced from the
// persisted character rows, so it reflects everyone who has ever played.

export interface LeaderboardEntry {
  name: string;
  level: number;
  gold: number;
  /** Total gathering-skill level (only set on the skill board). */
  skill?: number;
  /** PvP rating (only set on the PvP board). */
  rating?: number;
  /** PvP rank label (only set on the PvP board). */
  rank?: string;
}

export interface LeaderboardPayload {
  topLevel: LeaderboardEntry[];
  topGold: LeaderboardEntry[];
  topSkill: LeaderboardEntry[];
  /** Top players by PvP rating this season. */
  topPvp: LeaderboardEntry[];
  /** Current PvP season number. */
  season: number;
}
