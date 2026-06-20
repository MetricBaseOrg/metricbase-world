export interface WoodcuttingConfig {
  maxChops: number;
  requiredLevel?: number;
  skillXp: number;
  respawnMs: number;
  lootItemId: string;
  lootQuantity: number;
}

export interface ZoneResourceNode {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  kind: "tree";
  woodcutting: WoodcuttingConfig;
}

export interface ResourceHealthPayload {
  resourceId: string;
  currentChops: number;
  maxChops: number;
}

export interface ChopResultPayload {
  resourceId: string;
  currentChops: number;
  maxChops: number;
  depleted: boolean;
  skillXpGained: number;
  woodcuttingLevel: number;
  playerName?: string;
  ok?: boolean;
  error?: string;
}