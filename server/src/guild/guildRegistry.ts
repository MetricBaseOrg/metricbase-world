import crypto from "node:crypto";
import {
  GUILD_MAX_TAX_RATE,
  MAX_GUILD_MEMBERS,
  guildRankOf,
  isValidGuildName,
  isValidGuildTag,
  type GuildDetail,
  type GuildRank,
  type GuildStatePayload,
  type GuildSummary,
  type GuildWarInfo,
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
    officers: [],
    bank: 0,
    taxRate: 0,
    wars: [],
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
  guild.officers = guild.officers.filter((member) => member !== name);
  memberIndex.delete(name);

  if (guild.members.length === 0) {
    guilds.delete(guild.id);
    removeGuildFromAllWars(guild.id);
    void deleteGuild(guild.id);
    return { ok: true };
  }

  // Hand leadership to the next member if the leader left.
  if (guild.leaderName === name) {
    guild.leaderName = guild.members[0];
    guild.officers = guild.officers.filter((member) => member !== guild.leaderName);
  }
  void saveGuild(guild);
  return { ok: true };
}

/** Remove a (deleted) guild id from every other guild's war list. */
function removeGuildFromAllWars(deletedId: string) {
  for (const guild of guilds.values()) {
    if (guild.wars.includes(deletedId)) {
      guild.wars = guild.wars.filter((id) => id !== deletedId);
      void saveGuild(guild);
    }
  }
}

export function getGuildRank(name: string): GuildRank | null {
  const guild = getGuildForMember(name);
  if (!guild) return null;
  return guildRankOf(name, guild.leaderName, guild.officers);
}

/** Whether two players are in guilds currently at war with each other. */
export function arePlayersAtWar(a: string, b: string): boolean {
  const ga = getGuildForMember(a);
  const gb = getGuildForMember(b);
  if (!ga || !gb || ga.id === gb.id) return false;
  return ga.wars.includes(gb.id) && gb.wars.includes(ga.id);
}

export function promoteMember(actor: string, target: string): GuildActionResult {
  const guild = getGuildForMember(actor);
  if (!guild) return { ok: false, error: "You're not in a guild." };
  if (guild.leaderName !== actor) return { ok: false, error: "Only the leader can promote." };
  if (!guild.members.includes(target)) return { ok: false, error: "They're not in your guild." };
  if (target === guild.leaderName) return { ok: false, error: "They're already the leader." };
  if (guild.officers.includes(target)) return { ok: false, error: "They're already an officer." };
  guild.officers.push(target);
  void saveGuild(guild);
  return { ok: true };
}

export function demoteMember(actor: string, target: string): GuildActionResult {
  const guild = getGuildForMember(actor);
  if (!guild) return { ok: false, error: "You're not in a guild." };
  if (guild.leaderName !== actor) return { ok: false, error: "Only the leader can demote." };
  if (!guild.officers.includes(target)) return { ok: false, error: "They're not an officer." };
  guild.officers = guild.officers.filter((member) => member !== target);
  void saveGuild(guild);
  return { ok: true };
}

export function kickMember(actor: string, target: string): GuildActionResult {
  const guild = getGuildForMember(actor);
  if (!guild) return { ok: false, error: "You're not in a guild." };
  const actorRank = guildRankOf(actor, guild.leaderName, guild.officers);
  if (actorRank === "member") return { ok: false, error: "Only officers and the leader can kick." };
  if (target === actor) return { ok: false, error: "Use Leave to exit your own guild." };
  if (!guild.members.includes(target)) return { ok: false, error: "They're not in your guild." };
  if (target === guild.leaderName) return { ok: false, error: "You can't kick the leader." };
  // Officers can't kick other officers — only the leader can.
  if (guild.officers.includes(target) && actorRank !== "leader") {
    return { ok: false, error: "Only the leader can kick an officer." };
  }
  guild.members = guild.members.filter((member) => member !== target);
  guild.officers = guild.officers.filter((member) => member !== target);
  memberIndex.delete(target);
  void saveGuild(guild);
  return { ok: true };
}

export function setGuildTax(actor: string, rate: number): GuildActionResult {
  const guild = getGuildForMember(actor);
  if (!guild) return { ok: false, error: "You're not in a guild." };
  if (guild.leaderName !== actor) return { ok: false, error: "Only the leader can set tax." };
  if (!Number.isFinite(rate) || rate < 0 || rate > GUILD_MAX_TAX_RATE) {
    return { ok: false, error: `Tax must be 0–${Math.round(GUILD_MAX_TAX_RATE * 100)}%.` };
  }
  guild.taxRate = rate;
  void saveGuild(guild);
  return { ok: true };
}

export function depositToBank(name: string, amount: number): GuildActionResult {
  const guild = getGuildForMember(name);
  if (!guild) return { ok: false, error: "You're not in a guild." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a positive amount." };
  guild.bank += Math.floor(amount);
  void saveGuild(guild);
  return { ok: true };
}

/** Withdraw from the bank (officers + leader only). Returns the amount on success. */
export function withdrawFromBank(
  actor: string,
  amount: number,
): GuildActionResult & { amount?: number } {
  const guild = getGuildForMember(actor);
  if (!guild) return { ok: false, error: "You're not in a guild." };
  const rank = guildRankOf(actor, guild.leaderName, guild.officers);
  if (rank === "member") return { ok: false, error: "Only officers and the leader can withdraw." };
  const want = Math.floor(amount);
  if (!Number.isFinite(want) || want <= 0) return { ok: false, error: "Enter a positive amount." };
  if (guild.bank < want) return { ok: false, error: "The guild bank doesn't have that much." };
  guild.bank -= want;
  void saveGuild(guild);
  return { ok: true, amount: want };
}

/** Add taxed gold straight to a member's guild bank. Returns the amount skimmed. */
export function applyGuildTax(name: string, grossGold: number): number {
  const guild = getGuildForMember(name);
  if (!guild || guild.taxRate <= 0 || grossGold <= 0) return 0;
  const tax = Math.floor(grossGold * guild.taxRate);
  if (tax <= 0) return 0;
  guild.bank += tax;
  void saveGuild(guild);
  return tax;
}

/** Declare war (mutual hostility). Officers + leader. */
export function declareWar(actor: string, targetGuildId: string): GuildActionResult & { against?: StoredGuild } {
  const guild = getGuildForMember(actor);
  if (!guild) return { ok: false, error: "You're not in a guild." };
  const rank = guildRankOf(actor, guild.leaderName, guild.officers);
  if (rank === "member") return { ok: false, error: "Only officers and the leader can declare war." };
  const target = guilds.get(targetGuildId);
  if (!target) return { ok: false, error: "That guild no longer exists." };
  if (target.id === guild.id) return { ok: false, error: "You can't war your own guild." };
  if (guild.wars.includes(target.id)) return { ok: false, error: "You're already at war with them." };
  guild.wars.push(target.id);
  if (!target.wars.includes(guild.id)) target.wars.push(guild.id);
  void saveGuild(guild);
  void saveGuild(target);
  return { ok: true, against: target };
}

/** End war with a guild (mutual). Officers + leader. */
export function endWar(actor: string, targetGuildId: string): GuildActionResult & { against?: StoredGuild } {
  const guild = getGuildForMember(actor);
  if (!guild) return { ok: false, error: "You're not in a guild." };
  const rank = guildRankOf(actor, guild.leaderName, guild.officers);
  if (rank === "member") return { ok: false, error: "Only officers and the leader can end war." };
  const target = guilds.get(targetGuildId);
  guild.wars = guild.wars.filter((id) => id !== targetGuildId);
  if (target) target.wars = target.wars.filter((id) => id !== guild.id);
  void saveGuild(guild);
  if (target) void saveGuild(target);
  return { ok: true, against: target };
}

/** Online member names of the guild a player belongs to (for state broadcasts). */
export function guildMemberNames(name: string): string[] {
  return getGuildForMember(name)?.members ?? [];
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
  let myGuild: GuildDetail | null = null;
  if (mine) {
    const wars: GuildWarInfo[] = mine.wars
      .map((id) => guilds.get(id))
      .filter((g): g is StoredGuild => Boolean(g))
      .map((g) => ({ id: g.id, name: g.name, tag: g.tag }));
    myGuild = {
      ...toSummary(mine),
      members: [...mine.members],
      officers: [...mine.officers],
      bank: mine.bank,
      taxRate: mine.taxRate,
      wars,
      myRank: guildRankOf(playerName, mine.leaderName, mine.officers),
    };
  }
  const list = [...guilds.values()]
    .map(toSummary)
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));
  return { myGuild, guilds: list };
}
