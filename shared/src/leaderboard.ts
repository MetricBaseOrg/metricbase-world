// Leaderboard: top players by combat level and by wealth. Sourced from the
// persisted character rows, so it reflects everyone who has ever played.

export interface LeaderboardEntry {
  name: string;
  level: number;
  gold: number;
  /** Total gathering-skill level (only set on the skill board). */
  skill?: number;
}

export interface LeaderboardPayload {
  topLevel: LeaderboardEntry[];
  topGold: LeaderboardEntry[];
  topSkill: LeaderboardEntry[];
}
