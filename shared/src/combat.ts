export const ATTACK_RANGE = 72;
export const ATTACK_COOLDOWN_MS = 450;
export const PLAYER_ATTACK_DAMAGE = 18;

export interface NpcCombatConfig {
  maxHp: number;
  rewardXp: number;
  respawnMs: number;
}

export interface MobHealthPayload {
  npcId: string;
  currentHp: number;
  maxHp: number;
}

export interface AttackResultPayload {
  npcId: string;
  damage: number;
  currentHp: number;
  maxHp: number;
  defeated: boolean;
}