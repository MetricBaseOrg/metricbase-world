import { TRAINING_DUMMY_GOLD_REWARD, TRAINING_DUMMY_NPC_ID } from "./combat.js";

export const WILD_SLIME_NPC_ID = "wild_slime";
export const WILD_SLIME_GOLD_REWARD = 3;
export const SLIME_BRUTE_NPC_ID = "slime_brute";
export const SLIME_BRUTE_GOLD_REWARD = 8;

export interface MobRewardConfig {
  lootItemId: string | null;
  lootQuantity: number;
  goldReward: number;
  goldOnceOnly: boolean;
}

export const MOB_REWARDS: Record<string, MobRewardConfig> = {
  [TRAINING_DUMMY_NPC_ID]: {
    lootItemId: "item_training_scrap",
    lootQuantity: 1,
    goldReward: TRAINING_DUMMY_GOLD_REWARD,
    goldOnceOnly: true,
  },
  [WILD_SLIME_NPC_ID]: {
    lootItemId: "item_slime_gel",
    lootQuantity: 1,
    goldReward: WILD_SLIME_GOLD_REWARD,
    goldOnceOnly: false,
  },
  [SLIME_BRUTE_NPC_ID]: {
    lootItemId: "item_slime_core",
    lootQuantity: 1,
    goldReward: SLIME_BRUTE_GOLD_REWARD,
    goldOnceOnly: false,
  },
};

export function getMobRewardConfig(npcId: string): MobRewardConfig | null {
  if (npcId in MOB_REWARDS) return MOB_REWARDS[npcId];
  // Wild slimes across all zones share the same reward config.
  if (npcId.startsWith("wild_slime")) return MOB_REWARDS[WILD_SLIME_NPC_ID];
  // Player-World mob dens: loot + XP only — NO direct gold, so a stocked World
  // can't be farmed as an infinite gold faucet (the loot still sells at shops,
  // which have price pressure).
  if (npcId.startsWith("pzmob_brute-den")) {
    return { lootItemId: "item_slime_core", lootQuantity: 1, goldReward: 0, goldOnceOnly: true };
  }
  if (npcId.startsWith("pzmob_slime-den")) {
    return { lootItemId: "item_slime_gel", lootQuantity: 1, goldReward: 0, goldOnceOnly: true };
  }
  return null;
}