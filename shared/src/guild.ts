// Guilds: persistent player organizations. Founding one costs gold (an economy
// sink); members carry the guild's tag on their nameplate. Membership lives in a
// process-global registry persisted to the `guilds` table.

/** Gold cost to found a guild — a deliberate long-term sink. */
export const GUILD_CREATE_COST = 1000;

export const GUILD_NAME_MAX_LENGTH = 24;
export const GUILD_NAME_MIN_LENGTH = 3;
export const GUILD_TAG_MAX_LENGTH = 4;
export const GUILD_TAG_MIN_LENGTH = 2;
export const MAX_GUILD_MEMBERS = 30;

/** Guild ranks, ascending in authority. */
export type GuildRank = "member" | "officer" | "leader";

/** Max guild income tax rate (fraction of members' gold earnings). */
export const GUILD_MAX_TAX_RATE = 0.1;

/** A guild this guild is currently at war with. */
export interface GuildWarInfo {
  id: string;
  name: string;
  tag: string;
}

export interface GuildSummary {
  id: string;
  name: string;
  tag: string;
  leaderName: string;
  memberCount: number;
}

export interface GuildDetail extends GuildSummary {
  /** Member display names (leader included). */
  members: string[];
  /** Officer names (subset of members). */
  officers: string[];
  /** Shared guild bank balance (gold). */
  bank: number;
  /** Income tax rate (0–GUILD_MAX_TAX_RATE) skimmed from members' earnings to the bank. */
  taxRate: number;
  /** Guilds this guild is at war with. */
  wars: GuildWarInfo[];
  /** The requesting player's rank in this guild. */
  myRank: GuildRank;
  /** Pending join requests (applicant names) — leaders/officers approve these. */
  joinRequests: string[];
}

/** Resolve a member's rank from the guild's leader + officer lists. */
export function guildRankOf(
  member: string,
  leaderName: string,
  officers: string[],
): GuildRank {
  if (member === leaderName) return "leader";
  return officers.includes(member) ? "officer" : "member";
}

export interface GuildStatePayload {
  /** The requesting player's guild, or null if they're unguilded. */
  myGuild: GuildDetail | null;
  /** All guilds, for the browse/join list. */
  guilds: GuildSummary[];
  /** Guild id the player has a pending join request with, or null. */
  myRequestGuildId: string | null;
}

export interface GuildResultPayload {
  ok: boolean;
  error?: string;
  /** Updated gold after a create charge, when relevant. */
  gold?: number;
}

/** Clean a guild name: drop control chars, collapse whitespace, trim, cap. */
export function sanitizeGuildName(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, GUILD_NAME_MAX_LENGTH);
}

/** Clean a guild tag: uppercase A-Z/0-9 only, capped to the max length. */
export function sanitizeGuildTag(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, GUILD_TAG_MAX_LENGTH);
}

export function isValidGuildName(name: string): boolean {
  return name.length >= GUILD_NAME_MIN_LENGTH && name.length <= GUILD_NAME_MAX_LENGTH;
}

export function isValidGuildTag(tag: string): boolean {
  return (
    tag.length >= GUILD_TAG_MIN_LENGTH &&
    tag.length <= GUILD_TAG_MAX_LENGTH &&
    /^[A-Z0-9]+$/.test(tag)
  );
}
