import crypto from "node:crypto";
import {
  MAX_GUILD_MEMBERS,
  isValidGuildName,
  isValidGuildTag,
  type GuildDetail,
  type GuildStatePayload,
  type GuildSummary,
} from "@metricbase/shared";
import { deleteGuild, loadGuilds, saveGuild, type StoredGuild } from "../db/guilds.js";

// Process-global registry of guilds, shared across zone rooms and persisted to
// the DB so memberships survive restarts.
const guilds = new Map<string, StoredGuild>();
// playerName -> guildId, for fast "what guild is this player in" lookups.
const memberIndex = new Map<string, string>();

function reindex() {
  memberIndex.clear();
  for (const guild of guilds.values()) {
    for (const name of guild.members) memberIndex.set(name, guild.id);
  }
}

export async function initGuildRegistry(): Promise<void> {
  guilds.clear();
  for (const guild of await loadGuilds()) {
    guilds.set(guild.id, guild);
  }
  reindex();
}

export function getGuildForMember(name: string): StoredGuild | undefined {
  const id = memberIndex.get(name);
  return id ? guilds.get(id) : undefined;
}

/** The tag a player wears on their nameplate, or "" if unguilded. */
export function tagForMember(name: string): string {
  return getGuildForMember(name)?.tag ?? "";
}

export interface GuildActionResult {
  ok: boolean;
  error?: string;
}

export function createGuild(name: string, tag: string, leaderName: string): GuildActionResult {
  if (memberIndex.has(leaderName)) {
    return { ok: false, error: "You're already in a guild." };
  }
  if (!isValidGuildName(name)) return { ok: false, error: "Invalid guild name." };
  if (!isValidGuildTag(tag)) return { ok: false, error: "Tag must be 2-4 letters/numbers." };

  const lowerName = name.toLowerCase();
  const upperTag = tag.toUpperCase();
  for (const guild of guilds.values()) {
    if (guild.name.toLowerCase() === lowerName) return { ok: false, error: "Name already taken." };
    if (guild.tag.toUpperCase() === upperTag) return { ok: false, error: "Tag already taken." };
  }

  const record: StoredGuild = {
    id: crypto.randomUUID(),
    name,
    tag: upperTag,
    leaderName,
    members: [leaderName],
  };
  guilds.set(record.id, record);
  memberIndex.set(leaderName, record.id);
  void saveGuild(record);
  return { ok: true };
}

export function joinGuild(name: string, guildId: string): GuildActionResult {
  if (memberIndex.has(name)) return { ok: false, error: "You're already in a guild." };
  const guild = guilds.get(guildId);
  if (!guild) return { ok: false, error: "That guild no longer exists." };
  if (guild.members.length >= MAX_GUILD_MEMBERS) return { ok: false, error: "That guild is full." };

  guild.members.push(name);
  memberIndex.set(name, guild.id);
  void saveGuild(guild);
  return { ok: true };
}

export function leaveGuild(name: string): GuildActionResult {
  const guild = getGuildForMember(name);
  if (!guild) return { ok: false, error: "You're not in a guild." };

  guild.members = guild.members.filter((member) => member !== name);
  memberIndex.delete(name);

  if (guild.members.length === 0) {
    guilds.delete(guild.id);
    void deleteGuild(guild.id);
    return { ok: true };
  }

  // Hand leadership to the next member if the leader left.
  if (guild.leaderName === name) {
    guild.leaderName = guild.members[0];
  }
  void saveGuild(guild);
  return { ok: true };
}

function toSummary(guild: StoredGuild): GuildSummary {
  return {
    id: guild.id,
    name: guild.name,
    tag: guild.tag,
    leaderName: guild.leaderName,
    memberCount: guild.members.length,
  };
}

export function buildGuildStatePayload(playerName: string): GuildStatePayload {
  const mine = getGuildForMember(playerName);
  const myGuild: GuildDetail | null = mine
    ? { ...toSummary(mine), members: [...mine.members] }
    : null;
  const list = [...guilds.values()]
    .map(toSummary)
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));
  return { myGuild, guilds: list };
}
