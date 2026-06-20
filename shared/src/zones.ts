import type { NpcCombatConfig } from "./combat.js";

export const ZONE_HUB = "zone_hub";
export const ZONE_WILDERNESS = "zone_wilderness";

export const MAX_PLAYERS_PER_ZONE = 20;

/** How close (world pixels) a player must be to trigger a portal tile. */
export const PORTAL_TRIGGER_RANGE = 48;

export const CHAT_MAX_LENGTH = 200;
export const CHAT_COOLDOWN_MS = 500;

export interface ZonePortal {
  tileX: number;
  tileY: number;
  targetZone: string;
  label: string;
}

export interface ZoneNpc {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  dialogue: string;
  shopId?: string;
  combat?: NpcCombatConfig;
}

export interface ZoneConfig {
  id: string;
  roomName: string;
  displayName: string;
  spawnTile: { x: number; y: number };
  portals: ZonePortal[];
  npcs: ZoneNpc[];
}

export const ZONE_CONFIGS: Record<string, ZoneConfig> = {
  [ZONE_HUB]: {
    id: ZONE_HUB,
    roomName: ZONE_HUB,
    displayName: "MetricBase Hub",
    spawnTile: { x: 12, y: 12 },
    portals: [
      {
        tileX: 20,
        tileY: 12,
        targetZone: ZONE_WILDERNESS,
        label: "Wilderness Gate",
      },
    ],
    npcs: [
      {
        id: "hub_guide",
        name: "Aria",
        tileX: 12,
        tileY: 10,
        dialogue:
          "Welcome to MetricBase Hub! I track quests for new adventurers. Purple tiles are portals to the Wilderness.",
      },
      {
        id: "hub_merchant",
        name: "Pip",
        tileX: 16,
        tileY: 14,
        shopId: "pip_general",
        dialogue:
          "Welcome to Pip's Provisions! Trade gold on the open market, or buy gear with in-game gold.",
      },
    ],
  },
  [ZONE_WILDERNESS]: {
    id: ZONE_WILDERNESS,
    roomName: ZONE_WILDERNESS,
    displayName: "Wilderness",
    spawnTile: { x: 4, y: 12 },
    portals: [
      {
        tileX: 2,
        tileY: 12,
        targetZone: ZONE_HUB,
        label: "Return Gate",
      },
    ],
    npcs: [
      {
        id: "wilderness_scout",
        name: "Rook",
        tileX: 8,
        tileY: 8,
        dialogue:
          "Head east to the Training Dummy, or south to hunt Wild Slimes. They hit back — keep potions handy!",
      },
      {
        id: "training_dummy",
        name: "Training Dummy",
        tileX: 14,
        tileY: 10,
        dialogue: "A sturdy straw dummy. It swings back when you attack — press Space or tap Attack.",
        combat: { maxHp: 90, rewardXp: 35, respawnMs: 12_000 },
      },
      {
        id: "wild_slime",
        name: "Wild Slime",
        tileX: 18,
        tileY: 14,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
    ],
  },
};

export function getZoneConfig(zoneId: string): ZoneConfig {
  const config = ZONE_CONFIGS[zoneId];
  if (!config) {
    throw new Error(`Unknown zone: ${zoneId}`);
  }
  return config;
}