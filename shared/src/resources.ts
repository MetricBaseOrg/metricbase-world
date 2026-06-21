export interface WoodcuttingConfig {
  treeLevel: number;
  requiredLevel?: number;
  skillXp: number;
  respawnMs: number;
  lootItemId: string;
  lootQuantity: number;
}

export interface MiningConfig {
  rockLevel: number;
  requiredLevel?: number;
  skillXp: number;
  respawnMs: number;
  lootItemId: string;
  lootQuantity: number;
}

export interface FishingConfig {
  spotLevel: number;
  requiredLevel?: number;
  skillXp: number;
  respawnMs: number;
  lootItemId: string;
  lootQuantity: number;
}

export type ResourceKind = "tree" | "rock" | "fish";
export type GatherSkill = "woodcutting" | "mining" | "fishing" | "farming";

export interface ZoneResourceNode {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  kind: ResourceKind;
  /** Present on tree nodes. */
  woodcutting?: WoodcuttingConfig;
  /** Present on rock nodes. */
  mining?: MiningConfig;
  /** Present on fishing-spot nodes. */
  fishing?: FishingConfig;
}

export interface ResourceHealthPayload {
  resourceId: string;
  available: boolean;
  chopperName?: string;
  chopStartedAt?: number;
  chopEndsAt?: number;
  chopDurationMs?: number;
}

export interface ChopStartPayload {
  resourceId: string;
  playerName: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
}

export interface ChopCancelPayload {
  resourceId: string;
  playerName: string;
  reason?: string;
}

export interface ChopResultPayload {
  resourceId: string;
  available: boolean;
  depleted: boolean;
  skillXpGained: number;
  woodcuttingLevel: number;
  /** Which gathering skill this node trains. Defaults to woodcutting. */
  skill?: GatherSkill;
  /** Resulting level of the trained skill (mirrors woodcuttingLevel for rocks). */
  skillLevel?: number;
  playerName?: string;
  ok?: boolean;
  error?: string;
}