export interface WoodcuttingConfig {
  treeLevel: number;
  requiredLevel?: number;
  skillXp: number;
  respawnMs: number;
  lootItemId: string;
  lootQuantity: number;
  /** Mixed-yield nodes: each gather grants ONE random item from this pool
   *  instead of lootItemId (which stays as the fallback for stale clients). */
  lootPool?: string[];
  /** Skill credited for the gather (crop nodes train Farming, not Woodcutting). */
  skill?: "woodcutting" | "farming";
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

/** Per-prop yield overrides for player-zone gather nodes, keyed by asset id.
 *  Lets the mined/felled material depend on which deposit/tree prop was placed
 *  (an Iron Deposit yields iron, a Gem Rock yields gemstones, etc.) instead of
 *  every rock minting Copper Ore. Levels stay modest so Worlds don't out-earn
 *  the wild zones. Props without an entry fall back to the basic per-kind loot. */
const PROP_MINING_YIELD: Record<string, Pick<MiningConfig, "rockLevel" | "requiredLevel" | "skillXp" | "respawnMs" | "lootItemId">> = {
  "copper-rock": { rockLevel: 1, requiredLevel: 1, skillXp: 12, respawnMs: 30_000, lootItemId: "item_ore" },
  "iron-deposit": { rockLevel: 3, requiredLevel: 3, skillXp: 28, respawnMs: 45_000, lootItemId: "item_iron_ore" },
  "iron-vein": { rockLevel: 3, requiredLevel: 3, skillXp: 28, respawnMs: 45_000, lootItemId: "item_iron_ore" },
  "gem-studded": { rockLevel: 6, requiredLevel: 6, skillXp: 45, respawnMs: 60_000, lootItemId: "item_gemstone" },
  "obsidian-gem": { rockLevel: 8, requiredLevel: 8, skillXp: 60, respawnMs: 75_000, lootItemId: "item_gemstone" },
};

const PROP_WOODCUTTING_YIELD: Record<
  string,
  Pick<WoodcuttingConfig, "treeLevel" | "requiredLevel" | "skillXp" | "respawnMs" | "lootItemId" | "lootPool" | "skill">
> = {
  hardwood: { treeLevel: 3, requiredLevel: 3, skillXp: 26, respawnMs: 40_000, lootItemId: "item_hardwood" },
  "ancient-hardwood": { treeLevel: 6, requiredLevel: 6, skillXp: 42, respawnMs: 55_000, lootItemId: "item_hardwood" },
  "cavern-hardwood": { treeLevel: 8, requiredLevel: 8, skillXp: 55, respawnMs: 70_000, lootItemId: "item_hardwood" },
  // Crop / forage nodes gather their edible produce, not logs.
  "berry-bush": { treeLevel: 1, requiredLevel: 1, skillXp: 8, respawnMs: 20_000, lootItemId: "item_berries" },
  // Crop patches yield SEEDS (not the crop itself) so World nodes feed the
  // farming loop — plant the seed, grow it, harvest — instead of bypassing it.
  // They also train FARMING, not Woodcutting: nothing is being chopped.
  "crop-carrot": {
    treeLevel: 1,
    requiredLevel: 1,
    skillXp: 8,
    respawnMs: 20_000,
    lootItemId: "item_carrot_seed",
    skill: "farming",
  },
  "crop-wheat": {
    treeLevel: 1,
    requiredLevel: 1,
    skillXp: 8,
    respawnMs: 20_000,
    lootItemId: "item_wheat_seed",
    skill: "farming",
  },
  // The generic planted field is a grab-bag: a random seed type per gather.
  "crop-field": {
    treeLevel: 1,
    requiredLevel: 1,
    skillXp: 8,
    respawnMs: 20_000,
    lootItemId: "item_wheat_seed",
    lootPool: ["item_wheat_seed", "item_carrot_seed"],
    skill: "farming",
  },
};

/** Per-prop fishing yields so a placed Deep Pool lands salmon like the wild one. */
const PROP_FISHING_YIELD: Record<string, Pick<FishingConfig, "spotLevel" | "requiredLevel" | "skillXp" | "respawnMs" | "lootItemId">> = {
  "deep-pool": { spotLevel: 3, requiredLevel: 3, skillXp: 16, respawnMs: 20_000, lootItemId: "item_salmon" },
  "fish-pond": { spotLevel: 1, skillXp: 11, respawnMs: 15_000, lootItemId: "item_fish" },
};

/** Build a gatherable resource node from a placed player-zone asset. The yielded
 *  material follows the placed prop (see PROP_*_YIELD); unmapped props fall back
 *  to basic loot so player Worlds don't mint high-tier materials by default. */
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
    const y = PROP_MINING_YIELD[assetId];
    node.mining = y
      ? { ...y, lootQuantity: 1 }
      : { rockLevel: 1, skillXp: 12, respawnMs: 30_000, lootItemId: "item_ore", lootQuantity: 1 };
  } else if (kind === "fish") {
    const y = PROP_FISHING_YIELD[assetId];
    node.fishing = y
      ? { ...y, lootQuantity: 1 }
      : { spotLevel: 1, skillXp: 11, respawnMs: 15_000, lootItemId: "item_fish", lootQuantity: 1 };
  } else {
    const y = PROP_WOODCUTTING_YIELD[assetId];
    node.woodcutting = y
      ? { ...y, lootQuantity: 1 }
      : { treeLevel: 1, skillXp: 10, respawnMs: 25_000, lootItemId: "item_wood", lootQuantity: 1 };
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
  /** Fishing only: which species was caught (see fishSpecies.ts). */
  caughtItemId?: string;
  /** Fishing only: rarity tier of the catch, for the celebration UI. */
  caughtRarity?: string;
  /** Fishing only: how many of the species were landed (incl. bonus catches). */
  caughtQuantity?: number;
}