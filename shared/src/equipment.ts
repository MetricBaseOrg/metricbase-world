import type { GatherSkill } from "./resources.js";

export const ITEM_RUSTY_BLADE = "item_rusty_blade";
export const ITEM_GEL_KNIFE = "item_gel_knife";
export const ITEM_COPPER_DAGGER = "item_copper_dagger";
export const ITEM_GEM_BLADE = "item_gem_blade";

export const WEAPON_BONUS_DAMAGE: Record<string, number> = {
  [ITEM_RUSTY_BLADE]: 12,
  [ITEM_GEL_KNIFE]: 8,
  [ITEM_COPPER_DAGGER]: 18,
  [ITEM_GEM_BLADE]: 30,
};

export function getWeaponBonusDamage(weaponId: string | null | undefined): number {
  if (!weaponId) return 0;
  return WEAPON_BONUS_DAMAGE[weaponId] ?? 0;
}

export const ITEM_COPPER_AXE = "item_copper_axe";
export const ITEM_COPPER_PICKAXE = "item_copper_pickaxe";
export const ITEM_FISHING_ROD = "item_fishing_rod";
export const ITEM_IRON_AXE = "item_iron_axe";
export const ITEM_IRON_PICKAXE = "item_iron_pickaxe";
export const ITEM_PRO_ROD = "item_pro_rod";
export const ITEM_STEEL_AXE = "item_steel_axe";
export const ITEM_STEEL_PICKAXE = "item_steel_pickaxe";
export const ITEM_HARVEST_NET = "item_harvest_net";

export interface ToolGatherBonus {
  /** Which gather skill this tool accelerates. */
  skill: GatherSkill;
  /** Multiplier applied to gather duration (0.7 = 30% faster). */
  speedMultiplier: number;
  /** Chance (0–1) of yielding one bonus loot item per gather. Defaults to 0. */
  yieldBonus?: number;
}

/** Equipped tools cut gather time for their matching skill. */
export const TOOL_GATHER: Record<string, ToolGatherBonus> = {
  [ITEM_COPPER_AXE]: { skill: "woodcutting", speedMultiplier: 0.7 },
  [ITEM_COPPER_PICKAXE]: { skill: "mining", speedMultiplier: 0.7 },
  [ITEM_FISHING_ROD]: { skill: "fishing", speedMultiplier: 0.7 },
  [ITEM_IRON_AXE]: { skill: "woodcutting", speedMultiplier: 0.5 },
  [ITEM_IRON_PICKAXE]: { skill: "mining", speedMultiplier: 0.5 },
  [ITEM_PRO_ROD]: { skill: "fishing", speedMultiplier: 0.5 },
  // Steel tier: same speed as iron, but a strong chance of a bonus drop.
  [ITEM_STEEL_AXE]: { skill: "woodcutting", speedMultiplier: 0.5, yieldBonus: 0.4 },
  [ITEM_STEEL_PICKAXE]: { skill: "mining", speedMultiplier: 0.5, yieldBonus: 0.4 },
  [ITEM_HARVEST_NET]: { skill: "fishing", speedMultiplier: 0.5, yieldBonus: 0.4 },
};

/**
 * Speed multiplier the equipped tool grants for a given gather skill.
 * Returns 1 (no bonus) when no matching tool is equipped.
 */
export function getToolSpeedMultiplier(
  toolId: string | null | undefined,
  skill: GatherSkill,
): number {
  if (!toolId) return 1;
  const bonus = TOOL_GATHER[toolId];
  return bonus && bonus.skill === skill ? bonus.speedMultiplier : 1;
}

/**
 * Chance (0–1) the equipped tool yields one bonus loot item for `skill`.
 * Returns 0 when no matching tool is equipped or the tool has no yield bonus.
 */
export function getToolYieldBonus(
  toolId: string | null | undefined,
  skill: GatherSkill,
): number {
  if (!toolId) return 0;
  const bonus = TOOL_GATHER[toolId];
  return bonus && bonus.skill === skill ? bonus.yieldBonus ?? 0 : 0;
}

import {
  BASE_CRIT_CHANCE,
  BASE_CRIT_MULT,
  PLAYER_ATTACK_DAMAGE,
} from "./combat.js";

/** Rarity tiers, ascending. Used for stat tier + UI colour. */
export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic"
  | "ancient"
  | "unique";

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "ancient",
  "unique",
];

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#b7c3cc",
  uncommon: "#5fbf6a",
  rare: "#4f8cff",
  epic: "#a55cff",
  legendary: "#ff9f1a",
  mythic: "#ff5a8c",
  ancient: "#19c2c2",
  unique: "#ffd000",
};

/** Equippable gear slots (armor + accessories). Weapon/tool handled separately. */
export type GearKindSlot =
  | "helmet"
  | "chest"
  | "gloves"
  | "boots"
  | "ring"
  | "necklace"
  | "cape"
  | "offhand";

/** All equipment slots on a player. Rings have two slots. */
export type EquipmentSlot =
  | "weapon"
  | "tool"
  | "helmet"
  | "chest"
  | "gloves"
  | "boots"
  | "ring1"
  | "ring2"
  | "necklace"
  | "cape"
  | "offhand"
  | "mount";

/** Movement-speed multiplier granted by each equippable mount (1 = base speed). */
export const MOUNT_SPEED: Record<string, number> = {
  item_pony: 1.25,
  item_steed: 1.45,
  item_dire_wolf: 1.7,
};

export function getMountSpeed(mountId: string | null | undefined): number {
  if (!mountId) return 1;
  return MOUNT_SPEED[mountId] ?? 1;
}

export interface GearStat {
  /** Which slot kind this piece fits (rings fit ring1/ring2). */
  slot: GearKindSlot;
  rarity: Rarity;
  armor?: number;
  /** Additive crit chance (0–1). */
  critChance?: number;
  /** Additive crit multiplier (added to the base 1.5). */
  critMult?: number;
  /** Additive attack power (e.g. an offhand). */
  attack?: number;
  /** Max durability; gear at 0 durability breaks. Jewelry has none (Infinity). */
  maxDurability: number;
}

/** Stats + slot for every equippable armor/accessory item. */
export const GEAR_STATS: Record<string, GearStat> = {
  // Copper set — common
  item_copper_helm: { slot: "helmet", rarity: "common", armor: 12, maxDurability: 80 },
  item_copper_chest: { slot: "chest", rarity: "common", armor: 22, maxDurability: 90 },
  item_copper_gloves: { slot: "gloves", rarity: "common", armor: 8, maxDurability: 70 },
  item_copper_boots: { slot: "boots", rarity: "common", armor: 10, maxDurability: 70 },
  // Iron set — uncommon
  item_iron_helm: { slot: "helmet", rarity: "uncommon", armor: 22, maxDurability: 140 },
  item_iron_chest: { slot: "chest", rarity: "uncommon", armor: 40, maxDurability: 160 },
  item_iron_gloves: { slot: "gloves", rarity: "uncommon", armor: 15, maxDurability: 120 },
  item_iron_boots: { slot: "boots", rarity: "uncommon", armor: 18, maxDurability: 120 },
  // Steel set — rare
  item_steel_helm: { slot: "helmet", rarity: "rare", armor: 34, maxDurability: 220 },
  item_steel_chest: { slot: "chest", rarity: "rare", armor: 60, maxDurability: 240 },
  item_steel_gloves: { slot: "gloves", rarity: "rare", armor: 24, maxDurability: 200 },
  item_steel_boots: { slot: "boots", rarity: "rare", armor: 28, maxDurability: 200 },
  // Accessories (no durability wear)
  item_gem_ring: { slot: "ring", rarity: "rare", critChance: 0.06, critMult: 0.1, maxDurability: Infinity },
  item_pearl_amulet: {
    slot: "necklace",
    rarity: "rare",
    armor: 10,
    critChance: 0.03,
    maxDurability: Infinity,
  },
  item_traveler_cape: { slot: "cape", rarity: "common", armor: 8, maxDurability: 100 },
};

/** Max durability for wearable weapons (jewelry/none excluded). */
export const WEAPON_MAX_DURABILITY: Record<string, number> = {
  [ITEM_RUSTY_BLADE]: 60,
  [ITEM_GEL_KNIFE]: 50,
  [ITEM_COPPER_DAGGER]: 110,
  [ITEM_GEM_BLADE]: 220,
};

export function getGearStat(itemId: string | null | undefined): GearStat | null {
  if (!itemId) return null;
  return GEAR_STATS[itemId] ?? null;
}

/** The PlayerEquipment field name that holds a given gear-kind slot. */
export function fieldForGearSlot(slot: GearKindSlot, preferSecondRing = false): EquipmentSlot {
  switch (slot) {
    case "ring":
      return preferSecondRing ? "ring2" : "ring1";
    case "helmet":
      return "helmet";
    case "chest":
      return "chest";
    case "gloves":
      return "gloves";
    case "boots":
      return "boots";
    case "necklace":
      return "necklace";
    case "cape":
      return "cape";
    case "offhand":
      return "offhand";
  }
}

export interface PlayerEquipment {
  weaponId: string | null;
  toolId: string | null;
  helmetId: string | null;
  chestId: string | null;
  glovesId: string | null;
  bootsId: string | null;
  ring1Id: string | null;
  ring2Id: string | null;
  necklaceId: string | null;
  capeId: string | null;
  offhandId: string | null;
  mountId: string | null;
  /** Per-slot remaining durability for gear that wears (weapon + armor). */
  durability?: Partial<Record<EquipmentSlot, number>>;
}

export const EMPTY_EQUIPMENT: PlayerEquipment = {
  weaponId: null,
  toolId: null,
  helmetId: null,
  chestId: null,
  glovesId: null,
  bootsId: null,
  ring1Id: null,
  ring2Id: null,
  necklaceId: null,
  capeId: null,
  offhandId: null,
  mountId: null,
  durability: {},
};

/** Map of equipment field -> the itemId currently in it. */
const GEAR_FIELD_TO_SLOT: Record<keyof PlayerEquipment & string, GearKindSlot | null> = {
  weaponId: null,
  toolId: null,
  helmetId: "helmet",
  chestId: "chest",
  glovesId: "gloves",
  bootsId: "boots",
  ring1Id: "ring",
  ring2Id: "ring",
  necklaceId: "necklace",
  capeId: "cape",
  offhandId: "offhand",
  mountId: null,
  durability: null,
};

/** Equipment fields that hold armor/accessory items, in display order. */
export const ARMOR_FIELDS: (keyof PlayerEquipment & string)[] = [
  "helmetId",
  "chestId",
  "glovesId",
  "bootsId",
  "ring1Id",
  "ring2Id",
  "necklaceId",
  "capeId",
  "offhandId",
];

/** Equipment slots whose gear wears down in combat (weapon + armor, not jewelry). */
export const WEARABLE_SLOTS: EquipmentSlot[] = [
  "weapon",
  "helmet",
  "chest",
  "gloves",
  "boots",
  "cape",
  "offhand",
];

export function maxDurabilityForSlot(slot: EquipmentSlot, itemId: string | null): number {
  if (!itemId) return 0;
  if (slot === "weapon") return WEAPON_MAX_DURABILITY[itemId] ?? 0;
  return GEAR_STATS[itemId]?.maxDurability ?? 0;
}

function isValidGearForField(field: keyof PlayerEquipment & string, itemId: string): boolean {
  const expected = GEAR_FIELD_TO_SLOT[field];
  if (expected === null) return false;
  return GEAR_STATS[itemId]?.slot === expected;
}

export function normalizeEquipment(raw: Partial<PlayerEquipment> | null | undefined): PlayerEquipment {
  if (!raw || typeof raw !== "object") return { ...EMPTY_EQUIPMENT, durability: {} };

  const weaponId = typeof raw.weaponId === "string" ? raw.weaponId : null;
  const toolId = typeof raw.toolId === "string" ? raw.toolId : null;

  const next: PlayerEquipment = {
    weaponId: weaponId && WEAPON_BONUS_DAMAGE[weaponId] !== undefined ? weaponId : null,
    toolId: toolId && TOOL_GATHER[toolId] !== undefined ? toolId : null,
    helmetId: null,
    chestId: null,
    glovesId: null,
    bootsId: null,
    ring1Id: null,
    ring2Id: null,
    necklaceId: null,
    capeId: null,
    offhandId: null,
    mountId: typeof raw.mountId === "string" && MOUNT_SPEED[raw.mountId] !== undefined ? raw.mountId : null,
    durability: {},
  };

  for (const field of ARMOR_FIELDS) {
    const value = (raw as Record<string, unknown>)[field];
    if (typeof value === "string" && isValidGearForField(field, value)) {
      (next as unknown as Record<string, unknown>)[field] = value;
    }
  }

  // Preserve durability only for slots that still hold an item.
  const rawDur = raw.durability;
  if (rawDur && typeof rawDur === "object") {
    const dur: Partial<Record<EquipmentSlot, number>> = {};
    const slotPairs: [EquipmentSlot, string | null][] = [
      ["weapon", next.weaponId],
      ["helmet", next.helmetId],
      ["chest", next.chestId],
      ["gloves", next.glovesId],
      ["boots", next.bootsId],
      ["cape", next.capeId],
      ["offhand", next.offhandId],
    ];
    for (const [slot, itemId] of slotPairs) {
      if (!itemId) continue;
      const value = (rawDur as Record<string, unknown>)[slot];
      const max = maxDurabilityForSlot(slot, itemId);
      if (typeof value === "number" && Number.isFinite(value)) {
        dur[slot] = Math.max(0, Math.min(max, Math.floor(value)));
      }
    }
    next.durability = dur;
  }

  return next;
}

export interface CombatStats {
  /** Total attack power (base + weapon + gear). */
  attack: number;
  /** Total armor. */
  armor: number;
  /** Crit chance 0–1. */
  critChance: number;
  /** Crit damage multiplier. */
  critMult: number;
}

/** Aggregate combat stats from base values + all equipped gear. */
export function getEquipmentStats(eq: PlayerEquipment | null | undefined): CombatStats {
  const equipment = normalizeEquipment(eq);
  let attack = PLAYER_ATTACK_DAMAGE + getWeaponBonusDamage(equipment.weaponId);
  let armor = 0;
  let critChance = BASE_CRIT_CHANCE;
  let critMult = BASE_CRIT_MULT;

  for (const field of ARMOR_FIELDS) {
    const itemId = equipment[field] as string | null;
    const stat = getGearStat(itemId);
    if (!stat) continue;
    armor += stat.armor ?? 0;
    critChance += stat.critChance ?? 0;
    critMult += stat.critMult ?? 0;
    attack += stat.attack ?? 0;
  }

  return { attack, armor, critChance, critMult };
}

export interface EquipmentSlotState {
  slot: EquipmentSlot;
  itemId: string;
  /** Present for wearable gear (weapon + armor); omitted for jewelry/tool. */
  durability?: number;
  maxDurability?: number;
}

export interface EquipmentStatePayload {
  slots: EquipmentSlotState[];
  attack: number;
  armor: number;
  critChance: number;
  critMult: number;
}

const ALL_EQUIP_FIELDS: [keyof PlayerEquipment & string, EquipmentSlot][] = [
  ["weaponId", "weapon"],
  ["toolId", "tool"],
  ["helmetId", "helmet"],
  ["chestId", "chest"],
  ["glovesId", "gloves"],
  ["bootsId", "boots"],
  ["ring1Id", "ring1"],
  ["ring2Id", "ring2"],
  ["necklaceId", "necklace"],
  ["capeId", "cape"],
  ["offhandId", "offhand"],
  ["mountId", "mount"],
];

/** Build the client-facing equipment snapshot (slots + durability + aggregate stats). */
export function buildEquipmentState(raw: PlayerEquipment | null | undefined): EquipmentStatePayload {
  const eq = normalizeEquipment(raw);
  const slots: EquipmentSlotState[] = [];
  for (const [field, slot] of ALL_EQUIP_FIELDS) {
    const itemId = eq[field] as string | null;
    if (!itemId) continue;
    const max = maxDurabilityForSlot(slot, itemId);
    if (Number.isFinite(max) && max > 0) {
      slots.push({
        slot,
        itemId,
        durability: eq.durability?.[slot] ?? max,
        maxDurability: max,
      });
    } else {
      slots.push({ slot, itemId });
    }
  }
  const stats = getEquipmentStats(eq);
  return { slots, ...stats };
}
