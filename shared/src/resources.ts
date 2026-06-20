export interface WoodcuttingConfig {
  treeLevel: number;
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
  playerName?: string;
  ok?: boolean;
  error?: string;
}