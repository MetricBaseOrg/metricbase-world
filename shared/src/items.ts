export type ItemKind = "material" | "consumable" | "weapon" | "tool" | "armor" | "mount" | "pet";

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  maxStack: number;
  kind: ItemKind;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface InventoryStatePayload {
  items: InventoryEntry[];
  capacity: number;
  equippedWeaponId?: string | null;
}

export interface InventoryResultPayload {
  ok: boolean;
  error?: string;
  inventory?: InventoryStatePayload;
  hp?: number;
  maxHp?: number;
  equippedWeaponId?: string | null;
  equippedToolId?: string | null;
}

export const INVENTORY_CAPACITY = 16;

export const ITEMS: Record<string, ItemDefinition> = {
  item_health_potion: {
    id: "item_health_potion",
    name: "Health Potion",
    description: "Restores 25 HP when used.",
    stackable: true,
    maxStack: 20,
    kind: "consumable",
  },
  item_training_scrap: {
    id: "item_training_scrap",
    name: "Training Scrap",
    description: "Fibers from a battered dummy. Useful for crafting.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_rusty_blade: {
    id: "item_rusty_blade",
    name: "Rusty Blade",
    description: "A worn practice sword. +12 attack damage when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "weapon",
  },
  item_wood: {
    id: "item_wood",
    name: "Wood",
    description: "Logs from felled trees. Pip buys these for crafting supplies.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_ore: {
    id: "item_ore",
    name: "Copper Ore",
    description: "Chunks of raw copper from the rocks. Pip buys these for the forge.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_fish: {
    id: "item_fish",
    name: "River Fish",
    description: "A fresh catch from the shallows. Pip buys these for the kitchen.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_slime_gel: {
    id: "item_slime_gel",
    name: "Slime Gel",
    description: "Sticky residue from a defeated slime. Pip buys these for alchemy.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_slime_core: {
    id: "item_slime_core",
    name: "Slime Core",
    description: "A dense nucleus from a Slime Brute. Pip pays top gold for these.",
    stackable: true,
    maxStack: 20,
    kind: "material",
  },
  item_gel_knife: {
    id: "item_gel_knife",
    name: "Gel-Edged Knife",
    description: "A blade coated in hardened slime gel. +8 attack damage when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "weapon",
  },
  item_wheat_seed: {
    id: "item_wheat_seed",
    name: "Wheat Seed",
    description: "Plant in a farm plot, then harvest wheat once it grows.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_wheat: {
    id: "item_wheat",
    name: "Wheat",
    description: "Golden grain harvested from the fields. Mill it into bread.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_bread: {
    id: "item_bread",
    name: "Bread",
    description: "A warm loaf. Restores 30 HP when eaten.",
    stackable: true,
    maxStack: 20,
    kind: "consumable",
  },
  item_plank: {
    id: "item_plank",
    name: "Wooden Plank",
    description: "Smoothed timber. A building block for tools and gear.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_copper_bar: {
    id: "item_copper_bar",
    name: "Copper Bar",
    description: "Smelted copper, ready for the forge.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_cooked_fish: {
    id: "item_cooked_fish",
    name: "Cooked Fish",
    description: "A hearty grilled fish. Restores 40 HP when eaten.",
    stackable: true,
    maxStack: 20,
    kind: "consumable",
  },
  item_copper_dagger: {
    id: "item_copper_dagger",
    name: "Copper Dagger",
    description: "A keen crafted blade. +18 attack damage when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "weapon",
  },
  item_copper_axe: {
    id: "item_copper_axe",
    name: "Copper Axe",
    description: "A proper felling axe. Chops trees 30% faster when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_copper_pickaxe: {
    id: "item_copper_pickaxe",
    name: "Copper Pickaxe",
    description: "A sturdy mining pick. Mines rocks 30% faster when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_fishing_rod: {
    id: "item_fishing_rod",
    name: "Sturdy Fishing Rod",
    description: "A balanced rod with a fine line. Reels in catches 30% faster when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_iron_ore: {
    id: "item_iron_ore",
    name: "Iron Ore",
    description: "Dense ore from a deep iron deposit. Smelt it into iron bars.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_iron_bar: {
    id: "item_iron_bar",
    name: "Iron Bar",
    description: "Smelted iron, ready to forge into hardier tools.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_iron_axe: {
    id: "item_iron_axe",
    name: "Iron Axe",
    description: "A hardened felling axe. Chops trees 50% faster when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_iron_pickaxe: {
    id: "item_iron_pickaxe",
    name: "Iron Pickaxe",
    description: "A hardened mining pick. Mines rocks 50% faster when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_hardwood: {
    id: "item_hardwood",
    name: "Hardwood",
    description: "Dense timber from an old hardwood tree. Mills into reinforced planks.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_hardwood_plank: {
    id: "item_hardwood_plank",
    name: "Hardwood Plank",
    description: "A reinforced plank. The backbone of master-tier gear.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_salmon: {
    id: "item_salmon",
    name: "Prized Salmon",
    description: "A prized catch from the deep pools. Grills into a hearty meal.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_grilled_salmon: {
    id: "item_grilled_salmon",
    name: "Grilled Salmon",
    description: "A rich, flaky fillet. Restores 60 HP when eaten.",
    stackable: true,
    maxStack: 20,
    kind: "consumable",
  },
  item_pro_rod: {
    id: "item_pro_rod",
    name: "Angler's Pro Rod",
    description: "A master angler's rod of hardwood and iron. Reels in catches 50% faster when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_steel_bar: {
    id: "item_steel_bar",
    name: "Steel Bar",
    description: "Iron tempered with charred hardwood into tough steel. The core of master-tier tools.",
    stackable: true,
    maxStack: 99,
    kind: "material",
  },
  item_steel_axe: {
    id: "item_steel_axe",
    name: "Steel Axe",
    description: "A master felling axe. Chops 50% faster and often yields an extra log.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_steel_pickaxe: {
    id: "item_steel_pickaxe",
    name: "Steel Pickaxe",
    description: "A master mining pick. Mines 50% faster and often yields an extra ore.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_harvest_net: {
    id: "item_harvest_net",
    name: "Trawler's Net",
    description: "A weighted steel-rigged net. Reels in 50% faster and often lands an extra catch.",
    stackable: false,
    maxStack: 1,
    kind: "tool",
  },
  item_amber: {
    id: "item_amber",
    name: "Amber",
    description: "A rare bead of fossilised resin, sometimes found in old trees. Pip pays handsomely.",
    stackable: true,
    maxStack: 50,
    kind: "material",
  },
  item_gemstone: {
    id: "item_gemstone",
    name: "Gemstone",
    description: "A rare cut stone struck from deep rock. Pip pays handsomely — or forge it into a blade.",
    stackable: true,
    maxStack: 50,
    kind: "material",
  },
  item_pearl: {
    id: "item_pearl",
    name: "Pearl",
    description: "A rare lustrous pearl pulled from the deep. Pip pays handsomely.",
    stackable: true,
    maxStack: 50,
    kind: "material",
  },
  item_gem_blade: {
    id: "item_gem_blade",
    name: "Gemforged Blade",
    description: "A masterwork sword set with a gemstone. +30 attack damage when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "weapon",
  },
  item_lamp_oil: {
    id: "item_lamp_oil",
    name: "Lamp Oil",
    description: "Rendered fish oil in a flask. Refuels a building's light at the housing panel.",
    stackable: true,
    maxStack: 50,
    kind: "material",
  },

  // ---- Armor (Phase 1). Stats + slot live in GEAR_STATS (equipment.ts). ----
  item_copper_helm: {
    id: "item_copper_helm",
    name: "Copper Helm",
    description: "A simple beaten-copper cap. Light protection for the head.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_copper_chest: {
    id: "item_copper_chest",
    name: "Copper Chestplate",
    description: "A copper breastplate. Solid early protection for the torso.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_copper_gloves: {
    id: "item_copper_gloves",
    name: "Copper Gauntlets",
    description: "Copper-plated gloves. A little armor and a steadier grip.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_copper_boots: {
    id: "item_copper_boots",
    name: "Copper Greaves",
    description: "Copper-shod boots. Light armor for the legs.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_iron_helm: {
    id: "item_iron_helm",
    name: "Iron Helm",
    description: "A forged iron helmet. Sturdy protection for the head.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_iron_chest: {
    id: "item_iron_chest",
    name: "Iron Chestplate",
    description: "A heavy iron breastplate. Strong protection for the torso.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_iron_gloves: {
    id: "item_iron_gloves",
    name: "Iron Gauntlets",
    description: "Heavy iron gauntlets. Strong armor for the hands.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_iron_boots: {
    id: "item_iron_boots",
    name: "Iron Greaves",
    description: "Heavy iron greaves. Strong armor for the legs.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_steel_helm: {
    id: "item_steel_helm",
    name: "Steel Helm",
    description: "A master-forged steel helm. Superb protection for the head.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_steel_chest: {
    id: "item_steel_chest",
    name: "Steel Chestplate",
    description: "A master-forged steel cuirass. Superb protection for the torso.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_steel_gloves: {
    id: "item_steel_gloves",
    name: "Steel Gauntlets",
    description: "Master-forged steel gauntlets. Superb armor for the hands.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_steel_boots: {
    id: "item_steel_boots",
    name: "Steel Greaves",
    description: "Master-forged steel greaves. Superb armor for the legs.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_gem_ring: {
    id: "item_gem_ring",
    name: "Gemstone Ring",
    description: "A ring set with a cut gemstone. Sharpens your critical strikes.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_pearl_amulet: {
    id: "item_pearl_amulet",
    name: "Pearl Amulet",
    description: "An amulet strung with a lustrous pearl. Lends a touch of armor and crit power.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },
  item_traveler_cape: {
    id: "item_traveler_cape",
    name: "Traveler's Cape",
    description: "A hardwearing woven cape. Light protection against the wilds.",
    stackable: false,
    maxStack: 1,
    kind: "armor",
  },

  // ---- Mounts (speed). Multiplier lives in MOUNT_SPEED (equipment.ts). ----
  item_pony: {
    id: "item_pony",
    name: "Sturdy Pony",
    description: "A dependable little pony. +25% movement speed when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "mount",
  },
  item_steed: {
    id: "item_steed",
    name: "Swift Steed",
    description: "A fleet-footed horse. +45% movement speed when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "mount",
  },
  item_dire_wolf: {
    id: "item_dire_wolf",
    name: "Dire Wolf",
    description: "A fearsome mount from the deep wilds. +70% movement speed when equipped.",
    stackable: false,
    maxStack: 1,
    kind: "mount",
  },

  // ---- Pets (cosmetic companions) ----
  item_pet_cat: {
    id: "item_pet_cat",
    name: "Hearth Kitten",
    description: "A cosy lodge kitten that pads along beside you.",
    stackable: false,
    maxStack: 1,
    kind: "pet",
  },
  item_pet_slime: {
    id: "item_pet_slime",
    name: "Pet Slime",
    description: "A friendly slimelet that bounces at your heel.",
    stackable: false,
    maxStack: 1,
    kind: "pet",
  },
  item_pet_owl: {
    id: "item_pet_owl",
    name: "Spirit Owl",
    description: "A wise owl companion that drifts above your shoulder.",
    stackable: false,
    maxStack: 1,
    kind: "pet",
  },
};

/** HP restored by each consumable when used. */
export const CONSUMABLE_HEAL: Record<string, number> = {
  item_health_potion: 25,
  item_cooked_fish: 40,
  item_bread: 30,
  item_grilled_salmon: 60,
};

export function getConsumableHeal(itemId: string): number {
  return CONSUMABLE_HEAL[itemId] ?? 0;
}

export const EMPTY_INVENTORY: InventoryEntry[] = [];

export function getItemDefinition(itemId: string): ItemDefinition {
  const item = ITEMS[itemId];
  if (!item) {
    throw new Error(`Unknown item: ${itemId}`);
  }
  return item;
}

export function normalizeInventory(raw: InventoryEntry[] | null | undefined): InventoryEntry[] {
  if (!Array.isArray(raw)) return [];

  const merged = new Map<string, number>();

  for (const entry of raw) {
    if (!entry || typeof entry.itemId !== "string" || typeof entry.quantity !== "number") {
      continue;
    }
    if (!ITEMS[entry.itemId] || entry.quantity <= 0) continue;
    merged.set(entry.itemId, (merged.get(entry.itemId) ?? 0) + Math.floor(entry.quantity));
  }

  const items: InventoryEntry[] = [];
  for (const [itemId, quantity] of merged) {
    const definition = ITEMS[itemId];
    items.push({
      itemId,
      quantity: definition.stackable ? Math.min(quantity, definition.maxStack) : 1,
    });
  }

  return items.slice(0, INVENTORY_CAPACITY);
}

export function getItemQuantity(inventory: InventoryEntry[], itemId: string): number {
  return normalizeInventory(inventory).find((entry) => entry.itemId === itemId)?.quantity ?? 0;
}

export function removeItemFromInventory(
  inventory: InventoryEntry[],
  itemId: string,
  quantity = 1,
): { inventory: InventoryEntry[]; removed: number } {
  const definition = ITEMS[itemId];
  if (!definition || quantity <= 0) {
    return { inventory: normalizeInventory(inventory), removed: 0 };
  }

  const next = normalizeInventory(inventory);
  const index = next.findIndex((entry) => entry.itemId === itemId);
  if (index < 0) {
    return { inventory: next, removed: 0 };
  }

  const entry = next[index];
  const removed = Math.min(quantity, entry.quantity);
  entry.quantity -= removed;
  if (entry.quantity <= 0) {
    next.splice(index, 1);
  }

  return { inventory: next, removed };
}

export function addItemToInventory(
  inventory: InventoryEntry[],
  itemId: string,
  quantity = 1,
): { inventory: InventoryEntry[]; added: number } {
  const definition = ITEMS[itemId];
  if (!definition || quantity <= 0) {
    return { inventory: normalizeInventory(inventory), added: 0 };
  }

  const next = normalizeInventory(inventory);
  const existing = next.find((entry) => entry.itemId === itemId);

  if (existing) {
    const remaining = definition.maxStack - existing.quantity;
    const added = Math.min(quantity, remaining);
    existing.quantity += added;
    return { inventory: next, added };
  }

  if (next.length >= INVENTORY_CAPACITY) {
    return { inventory: next, added: 0 };
  }

  const added = definition.stackable ? Math.min(quantity, definition.maxStack) : 1;
  next.push({ itemId, quantity: added });
  return { inventory: next, added };
}

export function buildInventoryPayload(
  inventory: InventoryEntry[],
  equippedWeaponId: string | null = null,
): InventoryStatePayload {
  return {
    items: normalizeInventory(inventory),
    capacity: INVENTORY_CAPACITY,
    equippedWeaponId,
  };
}