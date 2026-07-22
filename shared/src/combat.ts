import { getWeaponBonusDamage } from "./equipment.js";

export const ATTACK_RANGE = 72;
export const ATTACK_COOLDOWN_MS = 450;
export const PLAYER_ATTACK_DAMAGE = 18;
// PvP retune (0.40.0): a bigger HP pool so positioning, armor, and crits
// matter rather than fights ending in two hits.
export const PLAYER_MAX_HP_BASE = 60;
export const PLAYER_MAX_HP_PER_LEVEL = 10;
export const RESPAWN_GOLD_COST = 100;

// ---- Combat stat model ----
/** Baseline crit chance (0–1) before gear bonuses. */
export const BASE_CRIT_CHANCE = 0.05;
/** Baseline crit damage multiplier before gear bonuses. */
export const BASE_CRIT_MULT = 1.5;
/** Armor constant for diminishing returns — at armor == K, damage is halved. */
export const ARMOR_K = 100;

/**
 * Fraction of damage mitigated by `armor`, with diminishing returns:
 * 0 armor → 0%, armor == ARMOR_K → 50%, asymptotic toward 100%.
 */
export function armorReduction(armor: number): number {
  if (armor <= 0) return 0;
  return armor / (armor + ARMOR_K);
}

export interface HitInput {
  /** Attacker's total attack power (base + weapon). */
  attack: number;
  /** Crit chance 0–1. */
  critChance: number;
  /** Crit damage multiplier (e.g. 1.5). */
  critMult: number;
  /** Defender's total armor. */
  targetArmor: number;
  /** Skill/ability damage multiplier (1 for a basic swing). */
  skillMult?: number;
}

export interface HitResult {
  damage: number;
  crit: boolean;
}

/**
 * Resolve a single hit: Attack × SkillMod × Crit − ArmorReduction.
 * Always deals at least 1 damage. `rng` is injectable for deterministic tests.
 */
export function rollHit(input: HitInput, rng: () => number = Math.random): HitResult {
  const critChance = Math.max(0, Math.min(0.95, input.critChance));
  const crit = rng() < critChance;
  const raw = input.attack * (input.skillMult ?? 1) * (crit ? input.critMult : 1);
  const reduced = raw * (1 - armorReduction(Math.max(0, input.targetArmor)));
  return { damage: Math.max(1, Math.round(reduced)), crit };
}
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

/**
 * Counter-attack damage per mob, keyed by npc id (numbered variants like
 * `wild_slime_2` match on prefix).
 *
 * A table rather than an if-chain because the old chain fell through to the
 * TRAINING DUMMY's value for anything unlisted — so the Void Brute, with 420 HP,
 * hit softer than a Slime Brute. Anything new must be added here deliberately;
 * an unknown id now falls back to the weakest mob, not a mid-tier one.
 */
export const MOB_COUNTER_DAMAGE: Record<string, number> = {
  training_dummy: 0, // safe practice target — never hits back
  wild_slime: 30,
  slime_brute: 72,
  ember_slime: 90,
  void_brute: 130,
  black_warden: 180, // apex boss
};

export function mobCounterDamage(npcId: string): number {
  if (npcId in MOB_COUNTER_DAMAGE) return MOB_COUNTER_DAMAGE[npcId];
  for (const key of Object.keys(MOB_COUNTER_DAMAGE)) {
    if (npcId.startsWith(key)) return MOB_COUNTER_DAMAGE[key];
  }
  return MOB_COUNTER_DAMAGE.wild_slime;
}
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
  /** True when the hit rolled a critical strike (Phase 1+). Drives gold crit numbers. */
  crit?: boolean;
  /** Gold actually granted to the killer on this hit (0/absent unless defeated). Drives the coin-burst FX. */
  goldReward?: number;
  /** XP granted to the killer on this hit (absent unless defeated). Drives the +XP float. */
  xpReward?: number;
}