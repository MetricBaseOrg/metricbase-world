import {
  buildZoneMap,
  getZoneConfig,
  isBlockingTile,
  isGroundPaintBlocking,
  isResourceNodeBlocking,
  isZonePropSolid,
  PLAYER_ZONE_PREFIX,
  playerZoneToConfig,
  TILE_GRASS,
  TILE_WALL,
  TILE_WATER,
  WALKWAY_ZONE_PROPS,
  worldToTile,
  zoneGridSize,
  zoneGroundFootprint,
  zonePropFootprint,
  type LandPlotNode,
  type ZoneConfig,
} from "@metricbase/shared";
import { getPlotOwner } from "../housing/landRegistry.js";
import { getPlayerZone } from "../zones/zoneRegistry.js";

const collisionCache = new Map<string, number[][]>();

/** Resolve a zone's config from the static table or the player-zone registry. */
function resolveConfig(zoneId: string): Pick<ZoneConfig, "landPlots" | "scenery" | "tiles" | "resources"> {
  if (zoneId.startsWith(PLAYER_ZONE_PREFIX)) {
    const record = getPlayerZone(zoneId);
    return record ? playerZoneToConfig(record) : { landPlots: [], scenery: [], tiles: [], resources: [] };
  }
  return getZoneConfig(zoneId);
}

/** Drop a zone's cached collision grid so it rebuilds (e.g. after a build edit). */
export function clearCollisionCache(zoneId: string): void {
  collisionCache.delete(zoneId);
}

function stampPlot(grid: number[][], plot: LandPlotNode) {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = plot.tileX + dx;
      const y = plot.tileY + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) {
        grid[y][x] = TILE_WALL;
      }
    }
  }
}

function getCollisionGrid(zoneId: string): number[][] {
  const cached = collisionCache.get(zoneId);
  if (cached) return cached;

  const playerZone = zoneId.startsWith(PLAYER_ZONE_PREFIX);
  // Expanded player zones have a larger square map.
  const gridSize = playerZone ? zoneGridSize(getPlayerZone(zoneId)?.expandLevel ?? 0) : undefined;
  const map = buildZoneMap(zoneId, gridSize);
  const mapH = map.length;
  const mapW = map[0]?.length ?? 0;

  // Only *built* structures block movement — an empty "for sale" plot is open
  // ground players can walk and farm on. Owned plots are solid (3x3 footprint).
  const config = resolveConfig(zoneId);
  for (const plot of config.landPlots ?? []) {
    if (getPlotOwner(plot.id)) stampPlot(map, plot);
  }

  const block = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < mapW && y < mapH) map[y][x] = TILE_WALL;
  };
  const unblock = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < mapW && y < mapH && map[y][x] === TILE_WATER) map[y][x] = TILE_GRASS;
  };

  if (playerZone) {
    // Blocking ground paint (rivers) stamps water over its footprint…
    for (const t of config.tiles ?? []) {
      if (!isGroundPaintBlocking(t.type)) continue;
      const n = zoneGroundFootprint(t.type);
      for (let dy = 0; dy < n; dy++) {
        for (let dx = 0; dx < n; dx++) {
          const x = t.x + dx;
          const y = t.y + dy;
          if (x >= 0 && y >= 0 && x < mapW && y < mapH) map[y][x] = TILE_WATER;
        }
      }
    }
    // …and walkways (bridges) laid over it make their footprint passable again.
    for (const node of config.scenery ?? []) {
      if (!WALKWAY_ZONE_PROPS.has(node.prop)) continue;
      const n = zonePropFootprint(node.prop);
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) unblock(node.tileX + dx, node.tileY + dy);
    }
    // Fishing nodes (ponds/pools) are water: their tile blocks, fish from
    // the shore. After the walkway pass so a bridge can't clear a pond.
    for (const node of config.resources ?? []) {
      if (isResourceNodeBlocking(node)) block(node.tileX, node.tileY);
    }
  }

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

  // The player occupies a single tile: only the tile under their feet has to be
  // clear. Bounds come from the grid itself (expanded player zones are bigger
  // than the built-in MAP_WIDTH×MAP_HEIGHT).
  if (tileX < 0 || tileY < 0 || tileY >= grid.length || tileX >= (grid[0]?.length ?? 0)) return false;
  return !isBlockingTile(grid[tileY][tileX]);
}
