import {
  ITEM_RUSTY_BLADE,
  ITEM_GEL_KNIFE,
  ITEM_COPPER_DAGGER,
  ITEM_GEM_BLADE,
} from "./equipment.js";

/**
 * Weapon-driven abilities (Phase 1). The equipped weapon determines which 5
 * skills fill the hotbar — there are no fixed classes. For now every ability is
 * a single-target damage strike with its own cooldown/stamina/multiplier;
 * status effects + AOE arrive in later phases.
 */
export type WeaponType = "fist" | "sword" | "dagger" | "hammer" | "axe" | "spear" | "bow" | "staff";

export interface AbilityDef {
  id: string;
  name: string;
  icon: string;
  /** Hotbar key label (1–5). */
  key: string;
  cooldownMs: number;
  staminaCost: number;
  /** Damage multiplier applied to the attacker's attack power. */
  damageMult: number;
  description: string;
}

/** Which weapon type each equippable weapon item behaves as. */
export const WEAPON_TYPES: Record<string, WeaponType> = {
  [ITEM_RUSTY_BLADE]: "sword",
  [ITEM_GEM_BLADE]: "sword",
  [ITEM_GEL_KNIFE]: "dagger",
  [ITEM_COPPER_DAGGER]: "dagger",
};

export function getWeaponType(weaponId: string | null | undefined): WeaponType {
  if (!weaponId) return "fist";
  return WEAPON_TYPES[weaponId] ?? "sword";
}

const SWORD_ABILITIES: AbilityDef[] = [
  { id: "sword_slash", name: "Slash", icon: "🗡️", key: "1", cooldownMs: 3000, staminaCost: 8, damageMult: 1.6, description: "A heavy slash for 160% damage." },
  { id: "sword_lunge", name: "Lunge", icon: "💨", key: "2", cooldownMs: 5000, staminaCost: 10, damageMult: 1.9, description: "A driving thrust for 190% damage." },
  { id: "sword_whirl", name: "Whirlwind", icon: "🌀", key: "3", cooldownMs: 8000, staminaCost: 14, damageMult: 2.3, description: "A spinning strike for 230% damage." },
  { id: "sword_guard", name: "Riposte", icon: "🛡️", key: "4", cooldownMs: 10000, staminaCost: 12, damageMult: 2.0, description: "A guarded counter for 200% damage." },
  { id: "sword_execute", name: "Execute", icon: "💥", key: "5", cooldownMs: 16000, staminaCost: 20, damageMult: 3.2, description: "A finishing blow for 320% damage." },
];

const DAGGER_ABILITIES: AbilityDef[] = [
  { id: "dagger_jab", name: "Jab", icon: "🔪", key: "1", cooldownMs: 2200, staminaCost: 6, damageMult: 1.4, description: "A fast jab for 140% damage." },
  { id: "dagger_backstab", name: "Backstab", icon: "🗡️", key: "2", cooldownMs: 4500, staminaCost: 9, damageMult: 2.1, description: "A vicious stab for 210% damage." },
  { id: "dagger_flurry", name: "Flurry", icon: "🌀", key: "3", cooldownMs: 7000, staminaCost: 12, damageMult: 2.4, description: "A flurry of cuts for 240% damage." },
  { id: "dagger_poison", name: "Envenom", icon: "🧪", key: "4", cooldownMs: 9000, staminaCost: 11, damageMult: 2.0, description: "A poisoned strike for 200% damage." },
  { id: "dagger_assassinate", name: "Assassinate", icon: "💀", key: "5", cooldownMs: 15000, staminaCost: 18, damageMult: 3.4, description: "A killing strike for 340% damage." },
];

const FIST_ABILITIES: AbilityDef[] = [
  { id: "fist_punch", name: "Punch", icon: "👊", key: "1", cooldownMs: 2500, staminaCost: 6, damageMult: 1.3, description: "A solid punch for 130% damage." },
  { id: "fist_kick", name: "Kick", icon: "🦶", key: "2", cooldownMs: 4500, staminaCost: 8, damageMult: 1.6, description: "A strong kick for 160% damage." },
];

/** Abilities granted by each weapon type. */
export const WEAPON_ABILITIES: Record<WeaponType, AbilityDef[]> = {
  fist: FIST_ABILITIES,
  sword: SWORD_ABILITIES,
  dagger: DAGGER_ABILITIES,
  // Until dedicated kits exist, other weapon types reuse the sword set.
  hammer: SWORD_ABILITIES,
  axe: SWORD_ABILITIES,
  spear: SWORD_ABILITIES,
  bow: SWORD_ABILITIES,
  staff: SWORD_ABILITIES,
};

export function getAbilitiesForWeapon(weaponId: string | null | undefined): AbilityDef[] {
  return WEAPON_ABILITIES[getWeaponType(weaponId)];
}

export function getAbilityById(abilityId: string): AbilityDef | null {
  for (const list of Object.values(WEAPON_ABILITIES)) {
    const found = list.find((ability) => ability.id === abilityId);
    if (found) return found;
  }
  return null;
}

/** Does the equipped weapon grant this ability? (Server-side validation.) */
export function weaponGrantsAbility(weaponId: string | null | undefined, abilityId: string): boolean {
  return getAbilitiesForWeapon(weaponId).some((ability) => ability.id === abilityId);
}
