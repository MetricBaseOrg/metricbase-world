import { MAP_HEIGHT, MAP_WIDTH } from "./index.js";

export const TILE_GRASS = 0;
export const TILE_STONE = 1;
export const TILE_WATER = 2;
export const TILE_WALL = 3;
export const TILE_PORTAL = 4;

export type GroundLayer = number[][];

function createEmptyLayer(): GroundLayer {
  return Array.from({ length: MAP_HEIGHT }, () => Array.from({ length: MAP_WIDTH }, () => TILE_GRASS));
}

function stampObstacle(layer: GroundLayer, x1: number, y1: number, x2: number, y2: number) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      layer[y][x] = TILE_WALL;
    }
  }
}

function stampPortal(layer: GroundLayer, tileX: number, tileY: number) {
  layer[tileY][tileX] = TILE_PORTAL;
}

export function buildHubMap(): GroundLayer {
  const layer = createEmptyLayer();

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const isBorder = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
      if (isBorder) {
        layer[y][x] = TILE_WALL;
        continue;
      }

      const isWater = (x + y) % 7 === 0;
      layer[y][x] = isWater ? TILE_WATER : (x + y) % 5 === 0 ? TILE_STONE : TILE_GRASS;
    }
  }

  stampObstacle(layer, 8, 6, 10, 14);
  stampObstacle(layer, 14, 10, 18, 12);
  stampPortal(layer, 20, 12);

  return layer;
}

export function buildWildernessMap(): GroundLayer {
  const layer = createEmptyLayer();

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const isBorder = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
      if (isBorder) {
        layer[y][x] = TILE_WALL;
        continue;
      }

      const cluster = (x * 3 + y * 5) % 11 === 0;
      layer[y][x] = cluster ? TILE_STONE : ((x + y) % 9 === 0 ? TILE_WATER : TILE_GRASS);
    }
  }

  stampObstacle(layer, 10, 8, 14, 16);
  stampObstacle(layer, 16, 4, 18, 8);
  stampPortal(layer, 2, 12);

  return layer;
}

export const ZONE_MAP_BUILDERS: Record<string, () => GroundLayer> = {
  zone_hub: buildHubMap,
  zone_wilderness: buildWildernessMap,
};

export function buildZoneMap(zoneId: string): GroundLayer {
  const builder = ZONE_MAP_BUILDERS[zoneId];
  if (!builder) {
    throw new Error(`Unknown zone map: ${zoneId}`);
  }
  return builder();
}

export function isBlockingTile(tile: number): boolean {
  return tile === TILE_WALL;
}