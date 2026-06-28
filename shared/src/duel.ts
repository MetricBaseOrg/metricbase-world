/**
 * Duels (Arena-lite). A consensual 1v1 anywhere — even in safe towns — with no
 * loot, no crime, and no knockout penalty. The loser is simply restored; the
 * winner gets bragging rights (and a broadcast).
 */

/** How long a duel can run before it's called a draw. */
export const DUEL_MAX_MS = 90_000;

/** How long a pending challenge waits for a response. */
export const DUEL_CHALLENGE_TTL_MS = 20_000;

/** Max distance (world px) between challenger and target to start a duel. */
export const DUEL_CHALLENGE_RANGE = 140;

export interface DuelInvitePayload {
  fromName: string;
}

export interface DuelStartPayload {
  opponent: string;
  endsAt: number;
}

export interface DuelEndPayload {
  /** Winner name, or "" for a draw. */
  winner: string;
  opponent: string;
  /** "win" | "loss" | "draw" from the recipient's perspective. */
  result: "win" | "loss" | "draw";
}
