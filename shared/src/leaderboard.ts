// Leaderboard: top players by combat level and by wealth. Sourced from the
// persisted character rows, so it reflects everyone who has ever played.

export interface LeaderboardEntry {
  name: string;
  level: number;
  gold: number;
  /**
   * Total net worth in gold (only set on the richest board): gold on hand +
   * pending gold + inventory items at vendor value + build assets (owned and
   * escrowed in market listings) + owned Worlds (slot cost + placed build +
   * unclaimed earnings) + owned plots (plot cost + shop stock + unclaimed
   * earnings).
   */
  netWorth?: number;
  /** Total gathering-skill level (only set on the skill board). */
  skill?: number;
  /** PvP rating (only set on the PvP board). */
  rating?: number;
  /** PvP rank label (only set on the PvP board). */
  rank?: string;
  /** Season points (only set on the season board). */
  points?: number;
}

export interface LeaderboardPayload {
  topLevel: LeaderboardEntry[];
  /** Richest players ranked by net worth (field keeps its old name for wire compat). */
  topGold: LeaderboardEntry[];
  topSkill: LeaderboardEntry[];
  /** Top players by PvP rating this season. */
  topPvp: LeaderboardEntry[];
  /** Top players by Season points this season. */
  topSeason: LeaderboardEntry[];
  /** Current PvP season number. */
  season: number;
  /** Current competitive Season number (the 30-day points season). */
  seasonNumber: number;
  /** When the current Season ends (epoch ms). */
  seasonEndsAt: number;
  /** Live $BASE reward pool for the current Season (admin wallet balance, incl.
   * ad revenue; floored at the Season-1 baseline). */
  rewardPool: number;
}
