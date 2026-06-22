import {
  buildZoneMap,
  getZoneConfig,
  isBlockingTile,
  MAP_HEIGHT,
  MAP_WIDTH,
  TILE_WALL,
  worldToTile,
  type LandPlotNode,
} from "@metricbase/shared";
import { getPlotOwner } from "../housing/landRegistry.js";

const collisionCache = new Map<string, number[][]>();

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

  // Only *built* structures block movement — an empty "for sale" plot is open
  // ground players can walk and farm on. Owned plots are solid (3x3 footprint).
  for (const plot of getZoneConfig(zoneId).landPlots ?? []) {
    if (getPlotOwner(plot.id)) stampPlot(map, plot);
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
