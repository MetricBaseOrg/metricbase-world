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
}

export interface GuildStatePayload {
  /** The requesting player's guild, or null if they're unguilded. */
  myGuild: GuildDetail | null;
  /** All guilds, for the browse/join list. */
  guilds: GuildSummary[];
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
