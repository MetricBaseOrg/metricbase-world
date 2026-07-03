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
  /** Player-zone nodes render this PNG art id (e.g. "pine", "copper-rock"). */
  prop?: string;
}

/** Build a gatherable resource node from a placed player-zone asset. Uses basic
 *  loot per skill so player Worlds don't mint high-tier materials. */
export function makePlayerZoneResource(
  id: string,
  assetId: string,
  kind: ResourceKind,
  name: string,
  tileX: number,
  tileY: number,
): ZoneResourceNode {
  const node: ZoneResourceNode = { id, name, tileX, tileY, kind, prop: assetId };
  if (kind === "rock") {
    node.mining = { rockLevel: 1, skillXp: 12, respawnMs: 30_000, lootItemId: "item_ore", lootQuantity: 1 };
  } else if (kind === "fish") {
    node.fishing = { spotLevel: 1, skillXp: 11, respawnMs: 15_000, lootItemId: "item_fish", lootQuantity: 1 };
  } else {
    node.woodcutting = { treeLevel: 1, skillXp: 10, respawnMs: 25_000, lootItemId: "item_wood", lootQuantity: 1 };
  }
  return node;
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