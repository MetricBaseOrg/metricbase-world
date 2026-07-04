// Client-side cache of player-owned zone ("World") configs. Built-in zones come
// from the static shared ZONE_CONFIGS; player zones are pushed by the server on
// join and cached here. `resolveZoneConfig` transparently returns whichever
// applies, so call sites don't need to know which kind of zone they're in.

import {
  getZoneConfig,
  PLAYER_ZONE_PREFIX,
  PLAYER_ZONE_GRID,
  playerZoneExitPortal,
  type ZoneConfig,
} from "@metricbase/shared";

const dynamic = new Map<string, ZoneConfig>();

export function isPlayerZoneId(zoneId: string): boolean {
  return zoneId.startsWith(PLAYER_ZONE_PREFIX);
}

/** Store a server-pushed player-zone config for later resolution. */
export function setPlayerZoneConfig(config: ZoneConfig): void {
  dynamic.set(config.id, config);
}

export function hasPlayerZoneConfig(zoneId: string): boolean {
  return dynamic.has(zoneId);
}

/** A blank stand-in so rendering never throws before the real config arrives. */
function placeholderConfig(zoneId: string): ZoneConfig {
  const mid = Math.floor(PLAYER_ZONE_GRID / 2);
  return {
    id: zoneId,
    roomName: zoneId,
    displayName: "World",
    dangerTier: "safe",
    spawnTile: { x: mid, y: mid },
    portals: [playerZoneExitPortal()],
    npcs: [],
    resources: [],
    farmPlots: [],
    landPlots: [],
    scenery: [],
    gridSize: PLAYER_ZONE_GRID,
  };
}

/**
 * Resolve any zone id to a config: cached player zone, then static built-in,
 * then a safe empty placeholder for a player zone whose config hasn't arrived.
 */
export function resolveZoneConfig(zoneId: string): ZoneConfig {
  const cached = dynamic.get(zoneId);
  if (cached) return cached;
  if (isPlayerZoneId(zoneId)) return placeholderConfig(zoneId);
  return getZoneConfig(zoneId);
}
