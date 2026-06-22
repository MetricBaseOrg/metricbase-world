import crypto from "node:crypto";
import {
  MAX_PARTY_SIZE,
  PARTY_INVITE_TTL_MS,
  type PartyDetail,
  type PartyStatePayload,
} from "@metricbase/shared";

// In-memory, process-global party registry. Parties are transient (no DB):
// they vanish when the last member leaves or the server restarts.
interface Party {
  id: string;
  leaderName: string;
  members: string[];
}

interface Invite {
  partyId: string;
  fromName: string;
  at: number;
}

const parties = new Map<string, Party>();
const memberIndex = new Map<string, string>(); // playerName -> partyId
const invites = new Map<string, Invite>(); // inviteeName -> invite

export function getPartyForMember(name: string): Party | undefined {
  const id = memberIndex.get(name);
  return id ? parties.get(id) : undefined;
}

export interface PartyMutation {
  ok: boolean;
  error?: string;
  /** Members to push fresh state to (post-mutation membership). */
  notify?: string[];
}

export function invitePlayer(fromName: string, toName: string): PartyMutation {
  if (toName === fromName) return { ok: false, error: "You can't invite yourself." };
  if (memberIndex.has(toName)) return { ok: false, error: "They're already in a party." };

  let party = getPartyForMember(fromName);
  if (!party) {
    party = { id: crypto.randomUUID(), leaderName: fromName, members: [fromName] };
    parties.set(party.id, party);
    memberIndex.set(fromName, party.id);
  }
  if (party.members.length >= MAX_PARTY_SIZE) return { ok: false, error: "Your party is full." };

  invites.set(toName, { partyId: party.id, fromName, at: Date.now() });
  return { ok: true, notify: [...party.members] };
}

export function acceptInvite(toName: string): PartyMutation {
  const invite = invites.get(toName);
  invites.delete(toName);
  if (!invite) return { ok: false, error: "That invite has expired." };
  if (Date.now() - invite.at > PARTY_INVITE_TTL_MS) return { ok: false, error: "That invite has expired." };
  if (memberIndex.has(toName)) return { ok: false, error: "You're already in a party." };

  const party = parties.get(invite.partyId);
  if (!party) return { ok: false, error: "That party no longer exists." };
  if (party.members.length >= MAX_PARTY_SIZE) return { ok: false, error: "That party is full." };

  party.members.push(toName);
  memberIndex.set(toName, party.id);
  return { ok: true, notify: [...party.members] };
}

export function declineInvite(toName: string): void {
  invites.delete(toName);
}

/** Remove a player; disbands the party if it drops below two members. */
export function leaveParty(name: string): PartyMutation {
  const party = getPartyForMember(name);
  if (!party) return { ok: false, error: "You're not in a party." };

  const others = party.members.filter((member) => member !== name);
  memberIndex.delete(name);

  // A lone remaining member isn't a party — disband and notify everyone.
  if (others.length <= 1) {
    for (const member of others) memberIndex.delete(member);
    parties.delete(party.id);
    return { ok: true, notify: [name, ...others] };
  }

  party.members = others;
  if (party.leaderName === name) party.leaderName = others[0];
  return { ok: true, notify: [name, ...others] };
}

function toDetail(party: Party): PartyDetail {
  return { id: party.id, leaderName: party.leaderName, members: [...party.members] };
}

export function buildPartyStatePayload(name: string): PartyStatePayload {
  const party = getPartyForMember(name);
  return { party: party ? toDetail(party) : null };
}
