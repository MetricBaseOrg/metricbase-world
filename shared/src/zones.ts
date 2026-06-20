export const ZONE_HUB = "zone_hub";
export const ZONE_WILDERNESS = "zone_wilderness";

export const MAX_PLAYERS_PER_ZONE = 20;

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
        dialogue: "Welcome to MetricBase Hub. Purple tiles are portals — the wilderness awaits!",
      },
      {
        id: "hub_merchant",
        name: "Pip",
        tileX: 16,
        tileY: 14,
        dialogue: "Shops aren't open yet, but keep exploring. Every journey earns experience.",
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
        dialogue: "The wilderness is dangerous — for now. Walk the purple gate to return to the hub.",
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