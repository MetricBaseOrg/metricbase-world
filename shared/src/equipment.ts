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
export const ITEM_GILDED_ROD = "item_gilded_rod";
export const ITEM_ABYSSAL_ROD = "item_abyssal_rod";
export const ITEM_COPPER_HOE = "item_copper_hoe";
export const ITEM_IRON_HOE = "item_iron_hoe";
export const ITEM_STEEL_HOE = "item_steel_hoe";

export interface ToolGatherBonus {
  /** Which gather skill this tool accelerates. */
  skill: GatherSkill;
  /** Multiplier applied to gather duration (0.7 = 30% faster). */
  speedMultiplier: number;
  /** Chance (0–1) of yielding one bonus loot item per gather. Defaults to 0. */
  yieldBonus?: number;
  /** Extra skill XP per gather as a fraction (0.25 = +25%). Defaults to 0. */
  xpBonus?: number;
  /** Additive rare-drop chance (0–1) on top of the node's base. Defaults to 0. */
  rareBonus?: number;
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
  // Farming hoes: speed up tending crop patches (and see TOOL_GROWTH below).
  [ITEM_COPPER_HOE]: { skill: "farming", speedMultiplier: 0.7 },
  [ITEM_IRON_HOE]: { skill: "farming", speedMultiplier: 0.5 },
  [ITEM_STEEL_HOE]: { skill: "farming", speedMultiplier: 0.5, yieldBonus: 0.4 },
  // Master fishing tier: faster still, bonus catches, and real skill-XP gains.
  [ITEM_GILDED_ROD]: { skill: "fishing", speedMultiplier: 0.4, yieldBonus: 0.5, xpBonus: 0.25 },
  [ITEM_ABYSSAL_ROD]: {
    skill: "fishing",
    speedMultiplier: 0.35,
    yieldBonus: 0.6,
    xpBonus: 0.5,
    rareBonus: 0.04,
  },
};

/** Gather perks granted by equipped ACCESSORIES (worn in normal gear slots). */
export interface GatherAccessoryPerk {
  skill: GatherSkill;
  xpBonus?: number;
  rareBonus?: number;
  yieldBonus?: number;
}

export const GATHER_ACCESSORY: Record<string, GatherAccessoryPerk> = {
  // Fishing accessories — stack with the equipped rod.
  item_lucky_lure: { skill: "fishing", rareBonus: 0.05 },
  item_angler_ring: { skill: "fishing", xpBonus: 0.25 },
  item_angler_cap: { skill: "fishing", xpBonus: 0.1, yieldBonus: 0.1 },
  // Farming accessories — stack with the equipped hoe; also apply to
  // farm-plot harvests, not just crop-patch gathers.
  item_farmer_hat: { skill: "farming", xpBonus: 0.1, yieldBonus: 0.1 },
  item_grower_ring: { skill: "farming", xpBonus: 0.25 },
};

/**
 * Crop growth-time multiplier from the equipped farming tool, applied when a
 * seed is PLANTED (0.85 = ready 15% sooner). 1 when no hoe is equipped.
 */
export const TOOL_GROWTH: Record<string, number> = {
  [ITEM_COPPER_HOE]: 0.85,
  [ITEM_IRON_HOE]: 0.75,
  [ITEM_STEEL_HOE]: 0.65,
};

export function getFarmGrowthMultiplier(toolId: string | null | undefined): number {
  if (!toolId) return 1;
  return TOOL_GROWTH[toolId] ?? 1;
}

export interface GatherPerks {
  xpBonus: number;
  rareBonus: number;
  yieldBonus: number;
}

/**
 * Total gather perks for a skill from the equipped tool + every equipped
 * accessory. Tool speed stays separate (getToolSpeedMultiplier).
 */
export function getGatherPerks(eq: PlayerEquipment | null | undefined, skill: GatherSkill): GatherPerks {
  const perks: GatherPerks = { xpBonus: 0, rareBonus: 0, yieldBonus: 0 };
  if (!eq) return perks;
  const tool = eq.toolId ? TOOL_GATHER[eq.toolId] : undefined;
  if (tool && tool.skill === skill) {
    perks.xpBonus += tool.xpBonus ?? 0;
    perks.rareBonus += tool.rareBonus ?? 0;
  }
  for (const field of ARMOR_FIELDS) {
    const itemId = eq[field] as string | null;
    const perk = itemId ? GATHER_ACCESSORY[itemId] : undefined;
    if (!perk || perk.skill !== skill) continue;
    perks.xpBonus += perk.xpBonus ?? 0;
    perks.rareBonus += perk.rareBonus ?? 0;
    perks.yieldBonus += perk.yieldBonus ?? 0;
  }
  return perks;
}

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
  | "mount"
  | "pet";

/** Cosmetic companion pets that can be equipped in the pet slot. */
export const PET_IDS = new Set<string>(["item_pet_cat", "item_pet_slime", "item_pet_owl", "item_pet_penguin"]);

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
  // Fishing accessories (gather perks live in GATHER_ACCESSORY).
  item_lucky_lure: { slot: "necklace", rarity: "rare", armor: 4, maxDurability: Infinity },
  item_angler_ring: { slot: "ring", rarity: "rare", maxDurability: Infinity },
  item_angler_cap: { slot: "helmet", rarity: "uncommon", armor: 10, maxDurability: 120 },
  // Farming accessories (gather perks live in GATHER_ACCESSORY).
  item_farmer_hat: { slot: "helmet", rarity: "uncommon", armor: 10, maxDurability: 120 },
  item_grower_ring: { slot: "ring", rarity: "rare", maxDurability: Infinity },
};

/** Max durability for wearable weapons (jewelry/none excluded). */
export const WEAPON_MAX_DURABILITY: Record<string, number> = {
  [ITEM_RUSTY_BLADE]: 60,
  [ITEM_GEL_KNIFE]: 50,
  [ITEM_COPPER_DAGGER]: 110,
  [ITEM_GEM_BLADE]: 220,
};

/**
 * Max durability for tools — one point per completed gather, so a copper axe
 * fells ~120 trees before it needs the smith. Higher tiers last longer.
 */
export const TOOL_MAX_DURABILITY: Record<string, number> = {
  item_copper_axe: 120,
  item_iron_axe: 200,
  item_steel_axe: 320,
  item_copper_pickaxe: 120,
  item_iron_pickaxe: 200,
  item_steel_pickaxe: 320,
  item_fishing_rod: 100,
  item_pro_rod: 180,
  item_gilded_rod: 280,
  item_abyssal_rod: 400,
  item_harvest_net: 150,
  item_copper_hoe: 120,
  item_iron_hoe: 200,
  item_steel_hoe: 320,
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
  petId: string | null;
  /** Per-slot remaining durability for gear that wears (weapon + armor). */
  durability?: Partial<Record<EquipmentSlot, number>>;
  /**
   * Missing durability stashed by ITEM id when damaged gear is unequipped —
   * re-equipping resumes the damage instead of resetting to max, so swapping
   * gear can't launder wear into a free repair. (Copies of the same item id
   * share this — an accepted approximation for a stack-based inventory.)
   */
  wear?: Record<string, number>;
  /** Per-slot enhancement level (+N) for combat gear. */
  enhance?: Partial<Record<EquipmentSlot, number>>;
  /**
   * Enhancement (+N) stashed by ITEM id when enhanced gear is unequipped — so
   * re-equipping the SAME item resumes its enhancement instead of losing it,
   * and swapping in a DIFFERENT item can't inherit the old slot's +N. Mirrors
   * `wear`; copies of an item id share the value (accepted approximation).
   */
  enhanceStash?: Record<string, number>;
}

/** Slots that can be enhanced with +N (combat gear; not tool/mount). */
export const ENHANCEABLE_SLOTS: EquipmentSlot[] = [
  "weapon",
  "helmet",
  "chest",
  "gloves",
  "boots",
  "ring1",
  "ring2",
  "necklace",
  "cape",
  "offhand",
];

/** Highest enhancement level. */
export const MAX_ENHANCE_LEVEL = 9;
/** Stat bonus per +1 (a +5 piece gives +40% of its stats). */
export const ENHANCE_BONUS_PER_LEVEL = 0.08;

/** Gold cost to attempt the next enhancement from `level`. */
export function enhanceCost(level: number): number {
  return 100 * (level + 1);
}

/** Success chance (0–1) of the attempt from `level` (high levels are riskier). */
export function enhanceSuccessRate(level: number): number {
  return Math.max(0.25, 1 - level * 0.08);
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
  petId: null,
  durability: {},
  enhance: {},
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
  petId: null,
  durability: null,
  wear: null,
  enhance: null,
  enhanceStash: null,
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
  "tool",
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
  if (slot === "tool") return TOOL_MAX_DURABILITY[itemId] ?? 0;
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
    petId: typeof raw.petId === "string" && PET_IDS.has(raw.petId) ? raw.petId : null,
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
      ["tool", next.toolId],
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

  // Preserve stashed wear (damage on unequipped gear, keyed by item id).
  const rawWear = raw.wear;
  if (rawWear && typeof rawWear === "object") {
    const wear: Record<string, number> = {};
    for (const [itemId, value] of Object.entries(rawWear as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        wear[itemId] = Math.floor(value);
      }
    }
    if (Object.keys(wear).length > 0) next.wear = wear;
  }

  // Preserve stashed enhancement (+N on unequipped gear, keyed by item id).
  const rawEnhStash = raw.enhanceStash;
  if (rawEnhStash && typeof rawEnhStash === "object") {
    const stash: Record<string, number> = {};
    for (const [itemId, value] of Object.entries(rawEnhStash as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        stash[itemId] = Math.min(MAX_ENHANCE_LEVEL, Math.floor(value));
      }
    }
    if (Object.keys(stash).length > 0) next.enhanceStash = stash;
  }

  // Preserve enhancement levels for slots that still hold an item.
  const rawEnh = raw.enhance;
  if (rawEnh && typeof rawEnh === "object") {
    const enh: Partial<Record<EquipmentSlot, number>> = {};
    for (const [field, slot] of ALL_EQUIP_FIELDS) {
      if (!ENHANCEABLE_SLOTS.includes(slot)) continue;
      if (!(next as unknown as Record<string, unknown>)[field]) continue;
      const value = (rawEnh as Record<string, unknown>)[slot];
      if (typeof value === "number" && Number.isFinite(value)) {
        enh[slot] = Math.max(0, Math.min(MAX_ENHANCE_LEVEL, Math.floor(value)));
      }
    }
    next.enhance = enh;
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
  const enh = equipment.enhance ?? {};
  const weaponMul = 1 + (enh.weapon ?? 0) * ENHANCE_BONUS_PER_LEVEL;
  let attack = PLAYER_ATTACK_DAMAGE + getWeaponBonusDamage(equipment.weaponId) * weaponMul;
  let armor = 0;
  let critChance = BASE_CRIT_CHANCE;
  let critMult = BASE_CRIT_MULT;

  for (const field of ARMOR_FIELDS) {
    const itemId = equipment[field] as string | null;
    const stat = getGearStat(itemId);
    if (!stat) continue;
    // ARMOR_FIELDS are like "ring1Id" → enhance key "ring1".
    const enhKey = field.replace(/Id$/, "") as EquipmentSlot;
    const mul = 1 + (enh[enhKey] ?? 0) * ENHANCE_BONUS_PER_LEVEL;
    armor += (stat.armor ?? 0) * mul;
    critChance += (stat.critChance ?? 0) * mul;
    critMult += (stat.critMult ?? 0) * mul;
    attack += (stat.attack ?? 0) * mul;
  }

  return { attack, armor, critChance, critMult };
}

/** A single rolled-up "power" number from equipped gear + enhancements. */
export function computeGearScore(eq: PlayerEquipment | null | undefined): number {
  const equipment = normalizeEquipment(eq);
  const s = getEquipmentStats(equipment);
  let enhTotal = 0;
  for (const slot of ENHANCEABLE_SLOTS) enhTotal += equipment.enhance?.[slot] ?? 0;
  return Math.round(s.attack * 2 + s.armor * 2 + s.critChance * 300 + (s.critMult - 1) * 100 + enhTotal * 25);
}

export interface EquipmentSlotState {
  slot: EquipmentSlot;
  itemId: string;
  /** Present for wearable gear (weapon + armor); omitted for jewelry/tool. */
  durability?: number;
  maxDurability?: number;
  /** Enhancement level (+N), 0 when unenhanced. */
  enhance?: number;
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
  ["petId", "pet"],
];

/** Equipment field holding the item for an equip slot. */
export function fieldForEquipSlot(slot: EquipmentSlot): (keyof PlayerEquipment & string) | null {
  for (const [field, s] of ALL_EQUIP_FIELDS) if (s === slot) return field;
  return null;
}

/**
 * Stash the missing durability of the item currently in `slot` under its item
 * id (see PlayerEquipment.wear). Call BEFORE clearing/replacing the slot.
 */
export function stashSlotWear(eq: PlayerEquipment, slot: EquipmentSlot): void {
  const field = fieldForEquipSlot(slot);
  const itemId = field ? (eq[field] as string | null) : null;
  if (!itemId) return;

  // Stash the outgoing item's enhancement by item id and CLEAR the slot's
  // +N, so unequipping doesn't lose it (normalize drops empty-slot enhance)
  // and a different item swapped into the slot can't inherit it.
  if (ENHANCEABLE_SLOTS.includes(slot)) {
    const level = eq.enhance?.[slot] ?? 0;
    const stash = { ...(eq.enhanceStash ?? {}) };
    if (level > 0) stash[itemId] = Math.max(level, stash[itemId] ?? 0);
    eq.enhanceStash = stash;
    if (eq.enhance && eq.enhance[slot] !== undefined) {
      const enh = { ...eq.enhance };
      delete enh[slot];
      eq.enhance = enh;
    }
  }

  const max = maxDurabilityForSlot(slot, itemId);
  if (!Number.isFinite(max) || max <= 0) return;
  const current = eq.durability?.[slot] ?? max;
  const missing = Math.max(0, max - Math.max(0, current));
  const wear = { ...(eq.wear ?? {}) };
  if (missing > 0) wear[itemId] = Math.max(missing, wear[itemId] ?? 0);
  else delete wear[itemId];
  eq.wear = wear;
}

/** Set `slot` durability + enhancement for a newly equipped item, resuming any
 * stashed wear and +N for that item id. */
export function restoreSlotWear(eq: PlayerEquipment, slot: EquipmentSlot, itemId: string): void {
  // Resume stashed enhancement for this exact item id.
  if (ENHANCEABLE_SLOTS.includes(slot)) {
    const level = eq.enhanceStash?.[itemId] ?? 0;
    if (level > 0) {
      eq.enhance = { ...(eq.enhance ?? {}), [slot]: level };
      const stash = { ...eq.enhanceStash };
      delete stash[itemId];
      eq.enhanceStash = stash;
    }
  }

  const max = maxDurabilityForSlot(slot, itemId);
  if (!Number.isFinite(max) || max <= 0) return;
  const stashed = eq.wear?.[itemId] ?? 0;
  eq.durability = { ...(eq.durability ?? {}), [slot]: Math.max(1, max - stashed) };
  if (stashed > 0 && eq.wear) {
    const wear = { ...eq.wear };
    delete wear[itemId];
    eq.wear = wear;
  }
}

/** Build the client-facing equipment snapshot (slots + durability + aggregate stats). */
export function buildEquipmentState(raw: PlayerEquipment | null | undefined): EquipmentStatePayload {
  const eq = normalizeEquipment(raw);
  const slots: EquipmentSlotState[] = [];
  for (const [field, slot] of ALL_EQUIP_FIELDS) {
    const itemId = eq[field] as string | null;
    if (!itemId) continue;
    const enhance = eq.enhance?.[slot] ?? 0;
    const max = maxDurabilityForSlot(slot, itemId);
    if (Number.isFinite(max) && max > 0) {
      slots.push({
        slot,
        itemId,
        durability: eq.durability?.[slot] ?? max,
        maxDurability: max,
        enhance,
      });
    } else {
      slots.push({ slot, itemId, enhance });
    }
  }
  const stats = getEquipmentStats(eq);
  return { slots, ...stats };
}
