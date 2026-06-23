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
];

export function getRecipe(recipeId: string): CraftRecipe | undefined {
  return CRAFT_RECIPES.find((recipe) => recipe.id === recipeId);
}
