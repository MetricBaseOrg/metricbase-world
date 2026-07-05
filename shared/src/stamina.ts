// Stamina (a.k.a. "energy"): the food/hunger system. Working activities —
// gathering, fighting, and farming — burn stamina. When you don't have enough,
// you can't keep working until you eat. Food (cooked meals, bread) is the main
// way to restore it; a slow passive trickle keeps players from ever hard-locking
// with no food and no gold.

import { FISH_DISHES } from "./fishSpecies.js";

export const MAX_STAMINA = 100;
export const STARTING_STAMINA = 100;

/** Stamina each activity consumes (work is demanding — keep food on hand). */
export const STAMINA_COST_GATHER = 8;
export const STAMINA_COST_ATTACK = 5;
export const STAMINA_COST_FARM = 6;

/** Slow out-of-action trickle so nobody gets permanently stuck. */
export const STAMINA_REGEN_AMOUNT = 1;
export const STAMINA_REGEN_INTERVAL_MS = 12_000;

/** Stamina restored by eating each food item (on top of any HP heal). */
export const CONSUMABLE_STAMINA: Record<string, number> = {
  item_bread: 25,
  item_cooked_fish: 35,
  item_grilled_salmon: 55,
  // A health potion is medicine, not a meal — it heals HP but not hunger.
  item_health_potion: 0,
};

// Fish dishes restore stamina per the FISH_DISHES table (fishSpecies.ts).
for (const dish of FISH_DISHES) {
  CONSUMABLE_STAMINA[dish.itemId] = dish.stamina;
}

export function getConsumableStamina(itemId: string): number {
  return CONSUMABLE_STAMINA[itemId] ?? 0;
}

export function clampStamina(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_STAMINA, Math.floor(value)));
}

/** True when the player has enough stamina to start an activity. */
export function hasStaminaFor(stamina: number, cost: number): boolean {
  return stamina >= cost;
}
