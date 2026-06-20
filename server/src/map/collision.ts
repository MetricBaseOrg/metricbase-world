import {
  buildZoneMap,
  isBlockingTile,
  MAP_HEIGHT,
  MAP_WIDTH,
  worldToTile,
} from "@metricbase/shared";

const collisionCache = new Map<string, number[][]>();

function getCollisionGrid(zoneId: string): number[][] {
  const cached = collisionCache.get(zoneId);
  if (cached) return cached;

  const map = buildZoneMap(zoneId);
  collisionCache.set(zoneId, map);
  return map;
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