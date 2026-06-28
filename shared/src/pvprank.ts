/**
 * PvP Seasons (Phase 6). Players earn a PvP rating from kills (and lose some on
 * death). Rating maps to a rank tier. Seasons last 90 days; at each rollover a
 * player's rating resets to the baseline on their next login (lazy reset).
 */

export type PvpRank =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master"
  | "Grandmaster"
  | "Legend";

export const STARTING_PVP_RATING = 1000;
/** Rating gained by the victor of a PvP knockout. */
export const PVP_KILL_RATING = 25;
/** Rating lost by the loser of a PvP knockout (never below 0). */
export const PVP_DEATH_RATING = 15;

/** A PvP season lasts 90 days. */
export const PVP_SEASON_LENGTH_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Anchor for season counting — Season 1 begins here. Without this, seasons were
 * measured from the Unix epoch (1970), so the count read ~228 instead of 1.
 */
export const SEASON_EPOCH_MS = Date.UTC(2026, 5, 1); // 2026-06-01

/** Zero-based season index since the anchor (display as `season + 1`). */
export function getPvpSeason(now: number): number {
  return Math.max(0, Math.floor((now - SEASON_EPOCH_MS) / PVP_SEASON_LENGTH_MS));
}

/** Epoch ms when the current season ends / the next begins. */
export function getSeasonEndsAt(now: number): number {
  return SEASON_EPOCH_MS + (getPvpSeason(now) + 1) * PVP_SEASON_LENGTH_MS;
}

interface RankBand {
  rank: PvpRank;
  min: number;
}

// Ascending rating thresholds. Baseline 1000 = Bronze.
const RANK_BANDS: RankBand[] = [
  { rank: "Legend", min: 2900 },
  { rank: "Grandmaster", min: 2400 },
  { rank: "Master", min: 2000 },
  { rank: "Diamond", min: 1700 },
  { rank: "Platinum", min: 1450 },
  { rank: "Gold", min: 1250 },
  { rank: "Silver", min: 1100 },
  { rank: "Bronze", min: 0 },
];

export function getPvpRank(rating: number): PvpRank {
  for (const band of RANK_BANDS) {
    if (rating >= band.min) return band.rank;
  }
  return "Bronze";
}

export const PVP_RANK_COLORS: Record<PvpRank, string> = {
  Bronze: "#b08d57",
  Silver: "#c0c7cf",
  Gold: "#ffce4d",
  Platinum: "#5fd0c4",
  Diamond: "#5fa8ff",
  Master: "#b15cff",
  Grandmaster: "#ff7a4d",
  Legend: "#ffd000",
};
