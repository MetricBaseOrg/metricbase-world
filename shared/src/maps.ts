import { MAP_HEIGHT, MAP_WIDTH } from "./index.js";

export const TILE_GRASS = 0;
export const TILE_STONE = 1;
export const TILE_WATER = 2;
export const TILE_WALL = 3;
export const TILE_PORTAL = 4;

export type GroundLayer = number[][];

function createEmptyLayer(width = MAP_WIDTH, height = MAP_HEIGHT): GroundLayer {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => TILE_GRASS));
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
  const height = layer.length;
  const width = layer[0]?.length ?? 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
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

  // Gate to the Wilderness — east edge so nobody triggers it by accident.
  stampPortal(layer, 22, 12);

  // Doorway into the Community Lodge interior — west edge.
  stampPortal(layer, 1, 12);

  return layer;
}

export function buildInteriorMap(): GroundLayer {
  // Everything is solid wall except a carved-out stone-floored room, so the
  // player is enclosed indoors.
  const layer = createEmptyLayer();
  fillRect(layer, 0, 0, MAP_WIDTH - 1, MAP_HEIGHT - 1, TILE_WALL);
  // Spacious lodge floor — roomier as the player base grows.
  fillRect(layer, 4, 4, 19, 19, TILE_STONE);
  // Exit doormat near the south wall (well clear of the spawn so you don't
  // immediately bounce back out).
  stampPortal(layer, 11, 19);

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

  stampPortal(layer, 1, 12);
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

  stampPortal(layer, 1, 12);
  // Sealed gate down into the Black Zone (burn-gated on entry).
  stampPortal(layer, 12, 1);

  return layer;
}

export function buildBlackMap(): GroundLayer {
  const layer = createEmptyLayer();
  stampBorder(layer);

  // A scorched obsidian arena: mostly stone with jagged wall pillars and lava
  // pools (rendered as water tiles — impassable hazards).
  fillRect(layer, 1, 1, MAP_WIDTH - 2, MAP_HEIGHT - 2, TILE_STONE);

  // Pillars dotted through the arena for cover.
  for (const [px, py] of [
    [6, 6],
    [17, 6],
    [6, 17],
    [17, 17],
    [12, 11],
  ]) {
    setTile(layer, px, py, TILE_WALL);
  }

  // Lava pools (hazard — block movement like water).
  stampLake(layer, 3, 10, 5, 13);
  stampLake(layer, 18, 10, 20, 13);

  // Exit back to the Grotto.
  stampPortal(layer, 1, 12);

  return layer;
}

export function buildJailMap(): GroundLayer {
  // A small stone cell enclosed in wall; the exit portal only releases you once
  // your sentence is served.
  const layer = createEmptyLayer();
  fillRect(layer, 0, 0, MAP_WIDTH - 1, MAP_HEIGHT - 1, TILE_WALL);
  fillRect(layer, 9, 8, 14, 14, TILE_STONE);
  stampPortal(layer, 11, 14);
  return layer;
}

export const ZONE_MAP_BUILDERS: Record<string, () => GroundLayer> = {
  zone_hub: buildHubMap,
  zone_wilderness: buildWildernessMap,
  zone_grotto: buildGrottoMap,
  zone_interior: buildInteriorMap,
  zone_black: buildBlackMap,
  zone_jail: buildJailMap,
};

/**
 * Base map for a player-owned zone ("World"): open, walkable grass with a wall
 * border and a single exit portal on the west edge. Owner-placed structures and
 * ground paint are layered on top separately (client render + server collision).
 */
export function buildPlayerZoneMap(gridSize = MAP_WIDTH): GroundLayer {
  const size = Math.max(MAP_WIDTH, Math.floor(gridSize));
  const layer = createEmptyLayer(size, size);
  stampBorder(layer);
  stampPortal(layer, 1, Math.floor(size / 2));
  return layer;
}

export function buildZoneMap(zoneId: string, playerZoneGridSize?: number): GroundLayer {
  const builder = ZONE_MAP_BUILDERS[zoneId];
  if (builder) return builder();
  // Player-owned zones aren't in the static builder table — they all share the
  // same open base map (id prefix mirrors PLAYER_ZONE_PREFIX in playerZones.ts),
  // sized by the zone's expansion level.
  if (zoneId.startsWith("pz_")) return buildPlayerZoneMap(playerZoneGridSize);
  throw new Error(`Unknown zone map: ${zoneId}`);
}

/** Walls and water block movement; grass and stone (and portals) are walkable. */
export function isBlockingTile(tile: number): boolean {
  return tile === TILE_WALL || tile === TILE_WATER;
}
