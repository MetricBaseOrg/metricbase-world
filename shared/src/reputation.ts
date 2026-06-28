/**
 * Crime, reputation, and anti-grief rules (Phase 2). Attacking a non-consenting
 * player turns you Criminal (red name, barred from Safe zones); a bounty can be
 * placed on criminals and claimed by whoever knocks them out.
 */
export type ReputationTier =
  | "legend"
  | "friendly"
  | "neutral"
  | "suspicious"
  | "criminal"
  | "outlaw";

/** How long a criminal flag lasts after an unlawful attack. */
export const CRIMINAL_DURATION_MS = 10 * 60 * 1000;

/** Players below this level can neither attack nor be attacked in PvP. */
export const STARTER_PROTECTION_LEVEL = 5;

/** Grace period (ms) after entering a zone during which a player can't be hit. */
export const SPAWN_IMMUNITY_MS = 5_000;

/** Minimum gold for a bounty placement. */
export const MIN_BOUNTY = 50;

export function reputationTier(score: number): ReputationTier {
  if (score <= -100) return "outlaw";
  if (score < 0) return "criminal";
  if (score < 25) return "suspicious";
  if (score < 100) return "neutral";
  if (score < 500) return "friendly";
  return "legend";
}

export const REPUTATION_COLORS: Record<ReputationTier, string> = {
  legend: "#ffd000",
  friendly: "#5fbf6a",
  neutral: "#dfe6e9",
  suspicious: "#ffce4d",
  criminal: "#ff7a4d",
  outlaw: "#ff3b3b",
};

export interface BountyPayload {
  target: string;
  gold: number;
}

export interface BountyListPayload {
  bounties: BountyPayload[];
}
