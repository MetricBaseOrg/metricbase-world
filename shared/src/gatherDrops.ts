import type { GatherSkill } from "./resources.js";

// Rare gather drops: a small, luck-based bonus on top of a node's normal loot.
// Each gather skill has its own rare material; higher-tier nodes roll slightly
// better odds. These feed high-value Pip sales and a prestige weapon craft.
export interface RareGatherDrop {
  itemId: string;
  /** Base chance (0–1) at node level 1. */
  baseChance: number;
}

export const RARE_GATHER_DROP: Partial<Record<GatherSkill, RareGatherDrop>> = {
  woodcutting: { itemId: "item_amber", baseChance: 0.03 },
  mining: { itemId: "item_gemstone", baseChance: 0.03 },
  fishing: { itemId: "item_pearl", baseChance: 0.03 },
};

/**
 * Roll a node's rare drop. Returns the rare item id when it hits, else null.
 * Higher-tier nodes (`nodeLevel`) add a small bonus to the base chance.
 */
export function rollRareGatherDrop(
  skill: GatherSkill,
  nodeLevel: number,
  bonusChance = 0,
  rng: () => number = Math.random,
): string | null {
  const drop = RARE_GATHER_DROP[skill];
  if (!drop) return null;
  const chance = drop.baseChance + Math.max(0, nodeLevel - 1) * 0.01 + bonusChance;
  return rng() < chance ? drop.itemId : null;
}
