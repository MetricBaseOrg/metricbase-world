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

export interface PlayerEquipment {
  weaponId: string | null;
}

export const EMPTY_EQUIPMENT: PlayerEquipment = { weaponId: null };

export function normalizeEquipment(raw: Partial<PlayerEquipment> | null | undefined): PlayerEquipment {
  if (!raw || typeof raw !== "object") return { ...EMPTY_EQUIPMENT };
  const weaponId = typeof raw.weaponId === "string" ? raw.weaponId : null;
  return { weaponId: weaponId && WEAPON_BONUS_DAMAGE[weaponId] !== undefined ? weaponId : null };
}