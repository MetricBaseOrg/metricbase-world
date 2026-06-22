import type { GatherSkill } from "./resources.js";

export const ITEM_RUSTY_BLADE = "item_rusty_blade";
export const ITEM_GEL_KNIFE = "item_gel_knife";
export const ITEM_COPPER_DAGGER = "item_copper_dagger";

export const WEAPON_BONUS_DAMAGE: Record<string, number> = {
  [ITEM_RUSTY_BLADE]: 12,
  [ITEM_GEL_KNIFE]: 8,
  [ITEM_COPPER_DAGGER]: 18,
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

export interface PlayerEquipment {
  weaponId: string | null;
  toolId: string | null;
}

export const EMPTY_EQUIPMENT: PlayerEquipment = { weaponId: null, toolId: null };

export function normalizeEquipment(raw: Partial<PlayerEquipment> | null | undefined): PlayerEquipment {
  if (!raw || typeof raw !== "object") return { ...EMPTY_EQUIPMENT };
  const weaponId = typeof raw.weaponId === "string" ? raw.weaponId : null;
  const toolId = typeof raw.toolId === "string" ? raw.toolId : null;
  return {
    weaponId: weaponId && WEAPON_BONUS_DAMAGE[weaponId] !== undefined ? weaponId : null,
    toolId: toolId && TOOL_GATHER[toolId] !== undefined ? toolId : null,
  };
}
