import { TRAINING_DUMMY_GOLD_REWARD, TRAINING_DUMMY_NPC_ID } from "./combat.js";

export const WILD_SLIME_NPC_ID = "wild_slime";
export const WILD_SLIME_GOLD_REWARD = 3;

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
};

export function getMobRewardConfig(npcId: string): MobRewardConfig | null {
  return MOB_REWARDS[npcId] ?? null;
}