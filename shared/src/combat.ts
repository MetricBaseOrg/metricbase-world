import { getWeaponBonusDamage } from "./equipment.js";

export const ATTACK_RANGE = 72;
export const ATTACK_COOLDOWN_MS = 450;
export const PLAYER_ATTACK_DAMAGE = 18;
export const PLAYER_MAX_HP_BASE = 40;
export const PLAYER_MAX_HP_PER_LEVEL = 8;
export const RESPAWN_GOLD_COST = 100;
export const RESPAWN_WAIT_MS = 30 * 60 * 1000;
export const HP_REGEN_AMOUNT = 1;
export const HP_REGEN_INTERVAL_MS = 3000;
export const COMBAT_RECENT_MS = 5000;

export interface PlayerDamagePayload {
  amount: number;
  currentHp: number;
  maxHp: number;
  knockedOut?: boolean;
  freeRespawnAt?: number | null;
}

export const TRAINING_DUMMY_NPC_ID = "training_dummy";
export const TRAINING_DUMMY_GOLD_REWARD = 5;
export const TRAINING_DUMMY_COUNTER_DAMAGE = 48;
export const POTION_HEAL_AMOUNT = 25;

export function getPlayerMaxHp(level: number): number {
  return PLAYER_MAX_HP_BASE + Math.max(0, level - 1) * PLAYER_MAX_HP_PER_LEVEL;
}

export function getPlayerAttackDamage(weaponId: string | null | undefined): number {
  return PLAYER_ATTACK_DAMAGE + getWeaponBonusDamage(weaponId);
}

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
  attackerName?: string;
}