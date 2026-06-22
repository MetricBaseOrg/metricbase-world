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

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
}

function setTile(layer: GroundLayer, x: number, y: number, tile: number) {
  if (inBounds(x, y)) layer[y][x] = tile;
}

function fillRect(layer: GroundLayer, x1: number, y1: number, x2: number, y2: number, tile: number) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      setTile(layer, x, y, tile);
    }
  }
}

function stampBorder(layer: GroundLayer) {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1) {
        layer[y][x] = TILE_WALL;
      }
    }
  }
}

function stampPortal(layer: GroundLayer, tileX: number, tileY: number) {
  layer[tileY][tileX] = TILE_PORTAL;
}

/** Carve a rounded lake: a filled rectangle with the four corners softened. */
function stampLake(layer: GroundLayer, x1: number, y1: number, x2: number, y2: number) {
  fillRect(layer, x1, y1, x2, y2, TILE_WATER);
  for (const [cx, cy] of [
    [x1, y1],
    [x2, y1],
    [x1, y2],
    [x2, y2],
  ]) {
    setTile(layer, cx, cy, TILE_GRASS);
  }
}

export function buildHubMap(): GroundLayer {
  const layer = createEmptyLayer();
  stampBorder(layer);

  // Central stone town square around the spawn point.
  fillRect(layer, 10, 9, 14, 13, TILE_STONE);
  // A main avenue running north from the square to the neighbourhood.
  fillRect(layer, 12, 4, 12, 9, TILE_STONE);
  // A lane west toward the quarry and a lane east toward the gate.
  fillRect(layer, 5, 12, 10, 12, TILE_STONE);
  fillRect(layer, 14, 12, 20, 12, TILE_STONE);

  // South-east lake (fished from the grassy shore).
  stampLake(layer, 16, 15, 21, 20);

  // Western quarry floor (rocky ground, still walkable).
  fillRect(layer, 2, 10, 5, 15, TILE_STONE);

  // Gate to the Wilderness.
  stampPortal(layer, 20, 12);

  return layer;
}

export function buildWildernessMap(): GroundLayer {
  const layer = createEmptyLayer();
  stampBorder(layer);

  // Rocky outcrops scattered through the grass (decorative, walkable).
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if ((x * 3 + y * 5) % 11 === 0) layer[y][x] = TILE_STONE;
    }
  }

  // A river cutting across the zone, with stepping-stone gaps as crossings.
  fillRect(layer, 11, 1, 12, MAP_HEIGHT - 2, TILE_WATER);
  fillRect(layer, 11, 6, 12, 7, TILE_GRASS);
  fillRect(layer, 11, 15, 12, 16, TILE_GRASS);

  stampPortal(layer, 2, 12);
  stampPortal(layer, 22, 14);

  return layer;
}

export function buildGrottoMap(): GroundLayer {
  const layer = createEmptyLayer();
  stampBorder(layer);

  // Cavern stone floor with grassy patches.
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if ((x * 2 + y) % 3 !== 0) layer[y][x] = TILE_STONE;
    }
  }

  // Underground pools.
  stampLake(layer, 4, 4, 7, 7);
  stampLake(layer, 15, 14, 19, 18);

  stampPortal(layer, 2, 12);

  return layer;
}

export const ZONE_MAP_BUILDERS: Record<string, () => GroundLayer> = {
  zone_hub: buildHubMap,
  zone_wilderness: buildWildernessMap,
  zone_grotto: buildGrottoMap,
};

export function buildZoneMap(zoneId: string): GroundLayer {
  const builder = ZONE_MAP_BUILDERS[zoneId];
  if (!builder) {
    throw new Error(`Unknown zone map: ${zoneId}`);
  }
  return builder();
}

/** Walls and water block movement; grass and stone (and portals) are walkable. */
export function isBlockingTile(tile: number): boolean {
  return tile === TILE_WALL || tile === TILE_WATER;
}
