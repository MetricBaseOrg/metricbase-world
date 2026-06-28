/**
 * Territory Control (Phase 4). Guilds capture flagged points in PvP zones by
 * standing on them uncontested; holding a point pays passive income into the
 * guild bank and grants the owning guild a gather bonus in that zone.
 */

/** World-pixel radius around a capture point that counts for capture/contest. */
export const CAPTURE_RANGE = 90;

/** Continuous uncontested seconds (ms) a guild must hold a point to claim it. */
export const CAPTURE_TIME_MS = 12_000;

/** How often owned territories pay income into the guild bank. */
export const TERRITORY_INCOME_INTERVAL_MS = 5 * 60 * 1000;

/** Gold paid per owned territory each income tick. */
export const TERRITORY_INCOME = 250;

/** Gather-speed multiplier for the owning guild's members in that zone (<1 = faster). */
export const TERRITORY_GATHER_BONUS = 0.85;

/** A capturable control point, declared on a zone config. */
export interface CapturePoint {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
}

export interface TerritoryPointState {
  id: string;
  name: string;
  /** Owning guild id, or null when neutral. */
  ownerGuildId: string | null;
  /** Owning guild tag for display, or "" when neutral. */
  ownerTag: string;
  /** Tag of the guild currently capturing it, or "" if none. */
  capturingTag: string;
  /** Capture progress 0–1 (only meaningful while capturingTag is set). */
  progress: number;
  /** True when rival guilds are both present (capture is frozen). */
  contested: boolean;
}

export interface TerritoryStatePayload {
  points: TerritoryPointState[];
}
