// Parties: small, transient groups for playing together. Unlike guilds they're
// in-memory only (no persistence) and formed via invites. Party chat and state
// are delivered cross-zone through the presence bus.

export const MAX_PARTY_SIZE = 4;
export const PARTY_INVITE_TTL_MS = 60_000;

// Combat grouping rewards. When a partied player lands a killing blow, every
// *other* party member fighting alongside them in the same zone (within
// `PARTY_ASSIST_RANGE` world units of the mob) counts as a nearby ally:
// - the killer earns a bonus on the kill XP, scaled per nearby ally (capped),
// - each nearby ally earns a share of the base kill XP as an assist and gets
//   shared credit toward their own "defeat" quest objectives.
export const PARTY_ASSIST_RANGE = 320; // ~5 tiles
export const PARTY_XP_BONUS_PER_MEMBER = 0.15;
export const PARTY_ASSIST_XP_SHARE = 0.5;

/** Kill XP for the killer, boosted by the number of nearby party allies. */
export function partyKillXp(baseXp: number, nearbyAllies: number): number {
  const allies = Math.max(0, Math.min(nearbyAllies, MAX_PARTY_SIZE - 1));
  return Math.round(baseXp * (1 + PARTY_XP_BONUS_PER_MEMBER * allies));
}

/** Assist XP each nearby party member earns from an ally's kill. */
export function partyAssistXp(baseXp: number): number {
  return Math.max(1, Math.round(baseXp * PARTY_ASSIST_XP_SHARE));
}

export interface PartyDetail {
  id: string;
  leaderName: string;
  members: string[];
}

export interface PartyStatePayload {
  /** The requesting player's party, or null if they're not in one. */
  party: PartyDetail | null;
}

export interface PartyResultPayload {
  ok: boolean;
  error?: string;
}

export interface PartyInvitePayload {
  fromName: string;
}
