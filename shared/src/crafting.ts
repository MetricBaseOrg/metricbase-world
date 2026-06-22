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
];

export function getRecipe(recipeId: string): CraftRecipe | undefined {
  return CRAFT_RECIPES.find((recipe) => recipe.id === recipeId);
}
