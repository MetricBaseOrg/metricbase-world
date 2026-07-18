import {
  buildZoneMap,
  isBlockingTile,
  isGroundPaintBlocking,
  isResourceNodeBlocking,
  isZonePropSolid,
  PLAYER_SPEED,
  TILE_WATER,
  tileToWorld,
  WALKWAY_ZONE_PROPS,
  worldToTile,
  zoneGroundFootprint,
  zonePropFootprint,
} from "@metricbase/shared";
import { isPlayerZoneId, resolveZoneConfig } from "./playerZoneConfig";

export type CollisionGrid = boolean[][]; // grid[y][x] === true means solid

/**
 * Build a client-side collision grid that mirrors the server: base map walls/
 * water, plus solid props. For player zones that means building footprints and
 * barriers; for built-in zones, solid scenery and built land plots.
 */
export function buildCollisionGrid(zoneId: string, builtLandPlots: Set<string> = new Set()): CollisionGrid {
  const config = resolveZoneConfig(zoneId);
  const player = isPlayerZoneId(zoneId);
  // Expanded player zones have a larger square map than the built-in 24×24.
  const ground = buildZoneMap(zoneId, player ? config.gridSize : undefined);
  const grid: CollisionGrid = ground.map((row) => row.map((t) => isBlockingTile(t)));
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const stamp = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) grid[y][x] = true;
  };
  // Walkways may only re-open water (painted river or base-map water) — never
  // border walls. Mirrors the server's unblock, which flips TILE_WATER only.
  const riverTiles = new Set<string>();
  const clear = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (riverTiles.has(`${x},${y}`) || ground[y][x] === TILE_WATER) grid[y][x] = false;
  };
  if (player) {
    // Blocking ground paint (rivers) is solid over its footprint; walkways
    // (bridges) laid on top open their footprint back up. Mirrors the server.
    for (const t of config.tiles ?? []) {
      if (!isGroundPaintBlocking(t.type)) continue;
      const n = zoneGroundFootprint(t.type);
      for (let dy = 0; dy < n; dy++) {
        for (let dx = 0; dx < n; dx++) {
          stamp(t.x + dx, t.y + dy);
          riverTiles.add(`${t.x + dx},${t.y + dy}`);
        }
      }
    }
    for (const node of config.scenery ?? []) {
      if (!WALKWAY_ZONE_PROPS.has(node.prop)) continue;
      const n = zonePropFootprint(node.prop);
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) clear(node.tileX + dx, node.tileY + dy);
    }
    // Fishing nodes (ponds/pools) are water: their tile blocks, fish from
    // the shore. After the walkway pass so a bridge can't clear a pond.
    for (const node of config.resources ?? []) {
      if (isResourceNodeBlocking(node)) stamp(node.tileX, node.tileY);
    }
  }
  for (const node of config.scenery ?? []) {
    if (player) {
      if (!isZonePropSolid(node.prop)) continue;
      const n = zonePropFootprint(node.prop);
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) stamp(node.tileX + dx, node.tileY + dy);
    } else if (node.solid) {
      // Solid built-in scenery blocks its whole footprint (1×1 arcade/table, or
      // a 2×2 market building), mirroring the server. Anchored at the back corner.
      const n = zonePropFootprint(node.prop);
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) stamp(node.tileX + dx, node.tileY + dy);
    }
  }
  if (!player) {
    for (const plot of config.landPlots ?? []) {
      if (!builtLandPlots.has(plot.id)) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) stamp(plot.tileX + dx, plot.tileY + dy);
    }
  }
  return grid;
}

function tileSolid(grid: CollisionGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || y >= grid.length || x >= (grid[0]?.length ?? 0)) return true;
  return grid[y]?.[x] ?? true;
}

/** Mirrors the server's isWalkable: the player occupies a single tile. */
export function isWorldWalkable(grid: CollisionGrid, worldX: number, worldY: number): boolean {
  const { tileX, tileY } = worldToTile(worldX, worldY);
  return !tileSolid(grid, tileX, tileY);
}

/** Collision-aware movement step (slides along walls like the server). */
export function collisionStep(
  grid: CollisionGrid,
  pos: { x: number; y: number },
  dx: number,
  dy: number,
  deltaMs: number,
  speedMult = 1,
): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len === 0) return pos;
  const speed = PLAYER_SPEED * (speedMult || 1) * (deltaMs / 1000);
  const nextX = pos.x + (dx / len) * speed;
  const nextY = pos.y + (dy / len) * speed;
  let x = pos.x;
  let y = pos.y;
  if (isWorldWalkable(grid, nextX, y)) x = nextX;
  if (isWorldWalkable(grid, x, nextY)) y = nextY;
  return { x, y };
}

/** A tile the player can stand on (centre passes the footprint collision test). */
function canStand(grid: CollisionGrid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || ty >= grid.length || tx >= (grid[0]?.length ?? 0)) return false;
  const w = tileToWorld(tx, ty);
  return isWorldWalkable(grid, w.x, w.y);
}

function nearestWalkable(grid: CollisionGrid, tx: number, ty: number): { x: number; y: number } | null {
  for (let r = 0; r <= 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (canStand(grid, tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
      }
    }
  }
  return null;
}

const NEIGHBORS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * A* from the player to a clicked world point over the collision grid. Returns
 * world-space waypoints (tile centres). Empty if there's no route.
 */
export function findPath(
  grid: CollisionGrid,
  fromWorld: { x: number; y: number },
  toWorld: { x: number; y: number },
): { x: number; y: number }[] {
  const s = worldToTile(fromWorld.x, fromWorld.y);
  let goal = worldToTile(toWorld.x, toWorld.y);
  if (!canStand(grid, goal.tileX, goal.tileY)) {
    const near = nearestWalkable(grid, goal.tileX, goal.tileY);
    if (!near) return [];
    goal = { tileX: near.x, tileY: near.y };
  }
  const startKey = `${s.tileX},${s.tileY}`;
  const goalKey = `${goal.tileX},${goal.tileY}`;
  if (startKey === goalKey) return [];

  const h = (x: number, y: number) => Math.abs(x - goal.tileX) + Math.abs(y - goal.tileY);
  const open = new Map<string, { x: number; y: number; g: number; f: number }>();
  const came = new Map<string, string>();
  const gScore = new Map<string, number>();
  open.set(startKey, { x: s.tileX, y: s.tileY, g: 0, f: h(s.tileX, s.tileY) });
  gScore.set(startKey, 0);

  let iterations = 0;
  while (open.size && iterations++ < 4000) {
    // Pop the lowest-f node.
    let bestKey = "";
    let best = Infinity;
    for (const [k, n] of open) if (n.f < best) ((best = n.f), (bestKey = k));
    const cur = open.get(bestKey)!;
    open.delete(bestKey);
    if (bestKey === goalKey) {
      // Reconstruct.
      const tiles: [number, number][] = [];
      let k: string | undefined = goalKey;
      while (k) {
        const [x, y] = k.split(",").map(Number);
        tiles.push([x, y]);
        k = came.get(k);
      }
      tiles.reverse();
      tiles.shift(); // drop the start tile
      return tiles.map(([x, y]) => tileToWorld(x, y));
    }
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!canStand(grid, nx, ny)) continue;
      // Don't cut diagonally through a solid corner.
      if (dx !== 0 && dy !== 0 && (!canStand(grid, cur.x + dx, cur.y) || !canStand(grid, cur.x, cur.y + dy))) continue;
      const step = dx !== 0 && dy !== 0 ? 1.4 : 1;
      const nk = `${nx},${ny}`;
      const tentative = (gScore.get(bestKey) ?? Infinity) + step;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, bestKey);
        gScore.set(nk, tentative);
        open.set(nk, { x: nx, y: ny, g: tentative, f: tentative + h(nx, ny) });
      }
    }
  }
  return [];
}
