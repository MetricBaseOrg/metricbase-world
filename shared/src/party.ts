// Parties: small, transient groups for playing together. Unlike guilds they're
// in-memory only (no persistence) and formed via invites. Party chat and state
// are delivered cross-zone through the presence bus.

export const MAX_PARTY_SIZE = 4;
export const PARTY_INVITE_TTL_MS = 60_000;

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
