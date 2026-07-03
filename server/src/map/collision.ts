import {
  buildZoneMap,
  getZoneConfig,
  isBlockingTile,
  MAP_HEIGHT,
  MAP_WIDTH,
  isZonePropSolid,
  PLAYER_ZONE_PREFIX,
  playerZoneToConfig,
  TILE_WALL,
  worldToTile,
  zonePropFootprint,
  type LandPlotNode,
  type ZoneConfig,
} from "@metricbase/shared";
import { getPlotOwner } from "../housing/landRegistry.js";
import { getPlayerZone } from "../zones/zoneRegistry.js";

const collisionCache = new Map<string, number[][]>();

/** Resolve a zone's config from the static table or the player-zone registry. */
function resolveConfig(zoneId: string): Pick<ZoneConfig, "landPlots" | "scenery"> {
  if (zoneId.startsWith(PLAYER_ZONE_PREFIX)) {
    const record = getPlayerZone(zoneId);
    return record ? playerZoneToConfig(record) : { landPlots: [], scenery: [] };
  }
  return getZoneConfig(zoneId);
}

/** Drop a zone's cached collision grid so it rebuilds (e.g. after a build edit). */
export function clearCollisionCache(zoneId: string): void {
  collisionCache.delete(zoneId);
}

function stampPlot(grid: number[][], plot: LandPlotNode) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = plot.tileX + dx;
      const y = plot.tileY + dy;
      if (x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT) {
        grid[y][x] = TILE_WALL;
      }
    }
  }
}

function getCollisionGrid(zoneId: string): number[][] {
  const cached = collisionCache.get(zoneId);
  if (cached) return cached;

  const map = buildZoneMap(zoneId);
  const playerZone = zoneId.startsWith(PLAYER_ZONE_PREFIX);

  // Only *built* structures block movement — an empty "for sale" plot is open
  // ground players can walk and farm on. Owned plots are solid (3x3 footprint).
  const config = resolveConfig(zoneId);
  for (const plot of config.landPlots ?? []) {
    if (getPlotOwner(plot.id)) stampPlot(map, plot);
  }

  const block = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT) map[y][x] = TILE_WALL;
  };
  for (const node of config.scenery ?? []) {
    if (playerZone) {
      // Player-zone builds: buildings block their whole N×N footprint (anchored
      // at the back corner), barriers block their tile. Trees/decor stay open.
      if (!isZonePropSolid(node.prop)) continue;
      const n = zonePropFootprint(node.prop);
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) block(node.tileX + dx, node.tileY + dy);
    } else if (node.solid) {
      // Built-in solid scenery (arcade cabinet / blackjack table) blocks its tile.
      block(node.tileX, node.tileY);
    }
  }

  collisionCache.set(zoneId, map);
  return map;
}

/** Mark a plot's footprint solid at runtime once a player builds on it. */
export function blockPlotFootprint(zoneId: string, plot: LandPlotNode) {
  const grid = collisionCache.get(zoneId);
  if (grid) stampPlot(grid, plot);
}

export function isWalkable(zoneId: string, worldX: number, worldY: number): boolean {
  const grid = getCollisionGrid(zoneId);
  const { tileX, tileY } = worldToTile(worldX, worldY);

  const samples = [
    [tileX, tileY],
    [tileX + 1, tileY],
    [tileX, tileY + 1],
    [tileX + 1, tileY + 1],
  ];

  for (const [x, y] of samples) {
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
      return false;
    }
    if (isBlockingTile(grid[y][x])) {
      return false;
    }
  }

  return true;
}
