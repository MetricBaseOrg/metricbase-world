export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface CraftRecipe {
  id: string;
  name: string;
  description: string;
  inputs: RecipeIngredient[];
  output: RecipeIngredient;
  /** Forge fee in gold — a sink that removes gold from the economy. */
  goldCost: number;
}

export interface CraftResultPayload {
  ok: boolean;
  recipeId?: string;
  error?: string;
  gold?: number;
  inventory?: import("./items.js").InventoryStatePayload;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: "craft_plank",
    name: "Wooden Plank",
    description: "Smooth two logs into a sturdy plank.",
    inputs: [{ itemId: "item_wood", quantity: 2 }],
    output: { itemId: "item_plank", quantity: 1 },
    goldCost: 2,
  },
  {
    id: "craft_copper_bar",
    name: "Copper Bar",
    description: "Smelt copper ore into a workable bar.",
    inputs: [{ itemId: "item_ore", quantity: 2 }],
    output: { itemId: "item_copper_bar", quantity: 1 },
    goldCost: 3,
  },
  {
    id: "craft_cooked_fish",
    name: "Cooked Fish",
    description: "Grill a fresh catch into a filling meal (+40 HP).",
    inputs: [{ itemId: "item_fish", quantity: 1 }],
    output: { itemId: "item_cooked_fish", quantity: 1 },
    goldCost: 1,
  },
  {
    id: "craft_bread",
    name: "Bread",
    description: "Bake wheat into bread (+30 HP).",
    inputs: [{ itemId: "item_wheat", quantity: 3 }],
    output: { itemId: "item_bread", quantity: 1 },
    goldCost: 2,
  },
  {
    id: "craft_copper_dagger",
    name: "Copper Dagger",
    description: "Forge a keen blade. +18 attack when equipped.",
    inputs: [
      { itemId: "item_plank", quantity: 1 },
      { itemId: "item_copper_bar", quantity: 2 },
    ],
    output: { itemId: "item_copper_dagger", quantity: 1 },
    goldCost: 20,
  },
  {
    id: "craft_copper_axe",
    name: "Copper Axe",
    description: "Forge a felling axe. Chops trees 30% faster when equipped.",
    inputs: [
      { itemId: "item_plank", quantity: 2 },
      { itemId: "item_copper_bar", quantity: 2 },
    ],
    output: { itemId: "item_copper_axe", quantity: 1 },
    goldCost: 25,
  },
  {
    id: "craft_copper_pickaxe",
    name: "Copper Pickaxe",
    description: "Forge a mining pick. Mines rocks 30% faster when equipped.",
    inputs: [
      { itemId: "item_plank", quantity: 2 },
      { itemId: "item_copper_bar", quantity: 2 },
    ],
    output: { itemId: "item_copper_pickaxe", quantity: 1 },
    goldCost: 25,
  },
  {
    id: "craft_fishing_rod",
    name: "Sturdy Fishing Rod",
    description: "Assemble a fishing rod. Reels in catches 30% faster when equipped.",
    inputs: [
      { itemId: "item_plank", quantity: 3 },
      { itemId: "item_copper_bar", quantity: 1 },
    ],
    output: { itemId: "item_fishing_rod", quantity: 1 },
    goldCost: 25,
  },
  {
    id: "craft_iron_bar",
    name: "Iron Bar",
    description: "Smelt iron ore into a workable bar.",
    inputs: [{ itemId: "item_iron_ore", quantity: 2 }],
    output: { itemId: "item_iron_bar", quantity: 1 },
    goldCost: 5,
  },
  {
    id: "craft_iron_axe",
    name: "Iron Axe",
    description: "Forge a hardened axe. Chops trees 50% faster when equipped.",
    inputs: [
      { itemId: "item_plank", quantity: 2 },
      { itemId: "item_iron_bar", quantity: 3 },
    ],
    output: { itemId: "item_iron_axe", quantity: 1 },
    goldCost: 60,
  },
  {
    id: "craft_iron_pickaxe",
    name: "Iron Pickaxe",
    description: "Forge a hardened pick. Mines rocks 50% faster when equipped.",
    inputs: [
      { itemId: "item_plank", quantity: 2 },
      { itemId: "item_iron_bar", quantity: 3 },
    ],
    output: { itemId: "item_iron_pickaxe", quantity: 1 },
    goldCost: 60,
  },
  {
    id: "craft_hardwood_plank",
    name: "Hardwood Plank",
    description: "Mill dense hardwood into a reinforced plank.",
    inputs: [{ itemId: "item_hardwood", quantity: 2 }],
    output: { itemId: "item_hardwood_plank", quantity: 1 },
    goldCost: 4,
  },
  {
    id: "craft_grilled_salmon",
    name: "Grilled Salmon",
    description: "Grill a prized salmon into a hearty meal (+60 HP).",
    inputs: [{ itemId: "item_salmon", quantity: 1 }],
    output: { itemId: "item_grilled_salmon", quantity: 1 },
    goldCost: 2,
  },
  {
    id: "craft_pro_rod",
    name: "Angler's Pro Rod",
    description: "Assemble a master rod from hardwood and iron. Reels in catches 50% faster.",
    inputs: [
      { itemId: "item_hardwood_plank", quantity: 2 },
      { itemId: "item_iron_bar", quantity: 2 },
    ],
    output: { itemId: "item_pro_rod", quantity: 1 },
    goldCost: 70,
  },
  {
    id: "craft_steel_bar",
    name: "Steel Bar",
    description: "Temper iron with charred hardwood into tough steel.",
    inputs: [
      { itemId: "item_iron_bar", quantity: 2 },
      { itemId: "item_hardwood_plank", quantity: 1 },
    ],
    output: { itemId: "item_steel_bar", quantity: 1 },
    goldCost: 8,
  },
  {
    id: "craft_steel_axe",
    name: "Steel Axe",
    description: "Forge a master axe. Chops 50% faster and often yields a bonus log.",
    inputs: [
      { itemId: "item_hardwood_plank", quantity: 1 },
      { itemId: "item_steel_bar", quantity: 3 },
    ],
    output: { itemId: "item_steel_axe", quantity: 1 },
    goldCost: 110,
  },
  {
    id: "craft_steel_pickaxe",
    name: "Steel Pickaxe",
    description: "Forge a master pick. Mines 50% faster and often yields a bonus ore.",
    inputs: [
      { itemId: "item_hardwood_plank", quantity: 1 },
      { itemId: "item_steel_bar", quantity: 3 },
    ],
    output: { itemId: "item_steel_pickaxe", quantity: 1 },
    goldCost: 110,
  },
  {
    id: "craft_harvest_net",
    name: "Trawler's Net",
    description: "Rig a weighted steel net. Reels in 50% faster and often lands a bonus catch.",
    inputs: [
      { itemId: "item_hardwood_plank", quantity: 2 },
      { itemId: "item_steel_bar", quantity: 3 },
    ],
    output: { itemId: "item_harvest_net", quantity: 1 },
    goldCost: 120,
  },
  {
    id: "craft_lamp_oil",
    name: "Lamp Oil",
    description: "Render fish into oil for a building light's lantern.",
    inputs: [
      { itemId: "item_fish", quantity: 2 },
      { itemId: "item_wood", quantity: 1 },
    ],
    output: { itemId: "item_lamp_oil", quantity: 1 },
    goldCost: 2,
  },
  {
    id: "craft_gem_blade",
    name: "Gemforged Blade",
    description: "Set a rare gemstone into a steel sword. +30 attack when equipped.",
    inputs: [
      { itemId: "item_steel_bar", quantity: 3 },
      { itemId: "item_hardwood_plank", quantity: 1 },
      { itemId: "item_gemstone", quantity: 1 },
    ],
    output: { itemId: "item_gem_blade", quantity: 1 },
    goldCost: 200,
  },

  // ---- Armor (Phase 1) ----
  {
    id: "craft_copper_helm",
    name: "Copper Helm",
    description: "Beat copper into a light helm. +12 armor.",
    inputs: [{ itemId: "item_copper_bar", quantity: 2 }],
    output: { itemId: "item_copper_helm", quantity: 1 },
    goldCost: 18,
  },
  {
    id: "craft_copper_chest",
    name: "Copper Chestplate",
    description: "Forge a copper breastplate. +22 armor.",
    inputs: [{ itemId: "item_copper_bar", quantity: 4 }],
    output: { itemId: "item_copper_chest", quantity: 1 },
    goldCost: 28,
  },
  {
    id: "craft_copper_gloves",
    name: "Copper Gauntlets",
    description: "Plate gloves in copper. +8 armor.",
    inputs: [{ itemId: "item_copper_bar", quantity: 2 }],
    output: { itemId: "item_copper_gloves", quantity: 1 },
    goldCost: 14,
  },
  {
    id: "craft_copper_boots",
    name: "Copper Greaves",
    description: "Shod boots in copper. +10 armor.",
    inputs: [{ itemId: "item_copper_bar", quantity: 2 }],
    output: { itemId: "item_copper_boots", quantity: 1 },
    goldCost: 16,
  },
  {
    id: "craft_iron_helm",
    name: "Iron Helm",
    description: "Forge a sturdy iron helm. +22 armor.",
    inputs: [{ itemId: "item_iron_bar", quantity: 3 }],
    output: { itemId: "item_iron_helm", quantity: 1 },
    goldCost: 45,
  },
  {
    id: "craft_iron_chest",
    name: "Iron Chestplate",
    description: "Forge a heavy iron cuirass. +40 armor.",
    inputs: [{ itemId: "item_iron_bar", quantity: 5 }],
    output: { itemId: "item_iron_chest", quantity: 1 },
    goldCost: 70,
  },
  {
    id: "craft_iron_gloves",
    name: "Iron Gauntlets",
    description: "Forge heavy iron gauntlets. +15 armor.",
    inputs: [{ itemId: "item_iron_bar", quantity: 3 }],
    output: { itemId: "item_iron_gloves", quantity: 1 },
    goldCost: 38,
  },
  {
    id: "craft_iron_boots",
    name: "Iron Greaves",
    description: "Forge heavy iron greaves. +18 armor.",
    inputs: [{ itemId: "item_iron_bar", quantity: 3 }],
    output: { itemId: "item_iron_boots", quantity: 1 },
    goldCost: 42,
  },
  {
    id: "craft_steel_helm",
    name: "Steel Helm",
    description: "Master-forge a steel helm. +34 armor.",
    inputs: [{ itemId: "item_steel_bar", quantity: 3 }],
    output: { itemId: "item_steel_helm", quantity: 1 },
    goldCost: 90,
  },
  {
    id: "craft_steel_chest",
    name: "Steel Chestplate",
    description: "Master-forge a steel cuirass. +60 armor.",
    inputs: [
      { itemId: "item_steel_bar", quantity: 5 },
      { itemId: "item_hardwood_plank", quantity: 1 },
    ],
    output: { itemId: "item_steel_chest", quantity: 1 },
    goldCost: 140,
  },
  {
    id: "craft_steel_gloves",
    name: "Steel Gauntlets",
    description: "Master-forge steel gauntlets. +24 armor.",
    inputs: [{ itemId: "item_steel_bar", quantity: 3 }],
    output: { itemId: "item_steel_gloves", quantity: 1 },
    goldCost: 80,
  },
  {
    id: "craft_steel_boots",
    name: "Steel Greaves",
    description: "Master-forge steel greaves. +28 armor.",
    inputs: [{ itemId: "item_steel_bar", quantity: 3 }],
    output: { itemId: "item_steel_boots", quantity: 1 },
    goldCost: 85,
  },
  {
    id: "craft_gem_ring",
    name: "Gemstone Ring",
    description: "Set a gemstone in a copper band. +6% crit, +0.1 crit power.",
    inputs: [
      { itemId: "item_copper_bar", quantity: 1 },
      { itemId: "item_gemstone", quantity: 1 },
    ],
    output: { itemId: "item_gem_ring", quantity: 1 },
    goldCost: 90,
  },
  {
    id: "craft_pearl_amulet",
    name: "Pearl Amulet",
    description: "String a pearl on a steel chain. +10 armor, +3% crit.",
    inputs: [
      { itemId: "item_steel_bar", quantity: 1 },
      { itemId: "item_pearl", quantity: 1 },
    ],
    output: { itemId: "item_pearl_amulet", quantity: 1 },
    goldCost: 90,
  },
  {
    id: "craft_traveler_cape",
    name: "Traveler's Cape",
    description: "Weave a hardwearing cape. +8 armor.",
    inputs: [
      { itemId: "item_plank", quantity: 1 },
      { itemId: "item_hardwood_plank", quantity: 1 },
    ],
    output: { itemId: "item_traveler_cape", quantity: 1 },
    goldCost: 30,
  },

  // ---- Mounts ----
  {
    id: "craft_pony",
    name: "Sturdy Pony",
    description: "Rig up tack for a pony. +25% movement speed.",
    inputs: [
      { itemId: "item_plank", quantity: 4 },
      { itemId: "item_wheat", quantity: 5 },
    ],
    output: { itemId: "item_pony", quantity: 1 },
    goldCost: 120,
  },
  {
    id: "craft_steed",
    name: "Swift Steed",
    description: "Outfit a fast horse. +45% movement speed.",
    inputs: [
      { itemId: "item_hardwood_plank", quantity: 3 },
      { itemId: "item_iron_bar", quantity: 2 },
      { itemId: "item_wheat", quantity: 10 },
    ],
    output: { itemId: "item_steed", quantity: 1 },
    goldCost: 320,
  },
  {
    id: "craft_dire_wolf",
    name: "Dire Wolf",
    description: "Tame a dire wolf with steel barding. +70% movement speed.",
    inputs: [
      { itemId: "item_steel_bar", quantity: 3 },
      { itemId: "item_slime_core", quantity: 2 },
      { itemId: "item_grilled_salmon", quantity: 3 },
    ],
    output: { itemId: "item_dire_wolf", quantity: 1 },
    goldCost: 600,
  },
];

export function getRecipe(recipeId: string): CraftRecipe | undefined {
  return CRAFT_RECIPES.find((recipe) => recipe.id === recipeId);
}

/** The recipe that produces `itemId`, if any (first match). */
export function getRecipeForOutput(itemId: string): CraftRecipe | undefined {
  return CRAFT_RECIPES.find((recipe) => recipe.output.itemId === itemId);
}

/** Fraction of crafting materials recovered when dismantling an item. */
export const DISMANTLE_REFUND_RATIO = 0.5;

/**
 * Materials returned for dismantling ONE unit of `itemId`, or null if the item
 * has no recipe (and therefore can't be salvaged).
 */
export function getDismantleRefund(itemId: string): RecipeIngredient[] | null {
  const recipe = getRecipeForOutput(itemId);
  if (!recipe) return null;
  const perUnit = Math.max(1, recipe.output.quantity);
  const refund = recipe.inputs
    .map((input) => ({
      itemId: input.itemId,
      quantity: Math.max(1, Math.floor((input.quantity / perUnit) * DISMANTLE_REFUND_RATIO)),
    }))
    .filter((input) => input.quantity > 0);
  return refund.length > 0 ? refund : null;
}

// Crafting takes real time at the workbench — a base spell plus a bit per unit
// of material, so heavier gear takes longer to forge. Capped so it never
// outlasts the client's wait.
export const CRAFT_BASE_MS = 4_000;
export const CRAFT_PER_INPUT_MS = 1_000;
export const CRAFT_MAX_MS = 12_000;

export function getCraftDurationMs(recipe: CraftRecipe): number {
  const inputUnits = recipe.inputs.reduce((sum, input) => sum + input.quantity, 0);
  return Math.min(CRAFT_MAX_MS, CRAFT_BASE_MS + inputUnits * CRAFT_PER_INPUT_MS);
}
