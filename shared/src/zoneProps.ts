// Shared metadata for placeable player-zone props: how many tiles they occupy
// and whether they block movement. The client uses this for rendering size and
// the server uses it for collision, so both stay in sync.

/** Multi-tile props occupy an N×N footprint (anchored at their back corner). */
export const ZONE_BUILDING_FOOTPRINTS: Record<string, number> = {
  house: 3,
  mansion: 3,
  cabin: 3,
  "shop-blue": 3,
  "market-wheat": 2,
  "market-carrot": 2,
  windmill: 2,
  // The bridge spans 2×2 but is a WALKWAY, not a solid building.
  bridge: 2,
};

/** Tiles occupied by a placed prop (defaults to 1×1). */
export function zonePropFootprint(id: string): number {
  return ZONE_BUILDING_FOOTPRINTS[id] ?? 1;
}

/**
 * Props that block movement in a player zone: buildings (their whole footprint)
 * plus thin barriers. Ground paint, trees, rocks, and decorative props stay
 * walkable, matching the built-in zones. NOTE: the bridge is deliberately NOT
 * here — it's a walkway that players cross.
 */
export const SOLID_ZONE_PROPS = new Set<string>([
  "house",
  "mansion",
  "cabin",
  "shop-blue",
  "market-wheat",
  "market-carrot",
  "windmill",
  "fence",
  "gate",
  "well",
  "fontain",
  "statue",
  "king-crystal",
]);

export function isZonePropSolid(id: string): boolean {
  return SOLID_ZONE_PROPS.has(id);
}

// ---- Ground paint ----------------------------------------------------------

/** Painted ground types that block movement (a river needs a bridge to cross). */
export const BLOCKING_GROUND_PAINT = new Set<string>(["river"]);

export function isGroundPaintBlocking(type: string): boolean {
  return BLOCKING_GROUND_PAINT.has(type);
}

/** Multi-tile ground paints (footprint in tiles, back-corner anchored). */
export const ZONE_GROUND_FOOTPRINTS: Record<string, number> = {
  river: 2,
};

export function zoneGroundFootprint(type: string): number {
  return ZONE_GROUND_FOOTPRINTS[type] ?? 1;
}

/** Walkable structures that clear blocking ground beneath their footprint. */
export const WALKWAY_ZONE_PROPS = new Set<string>(["bridge"]);
