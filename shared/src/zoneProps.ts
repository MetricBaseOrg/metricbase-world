// Shared metadata for placeable player-zone props: how many tiles they occupy
// and whether they block movement. The client uses this for rendering size and
// the server uses it for collision, so both stay in sync.

/** Buildings occupy an N×N footprint (anchored at their back corner). */
export const ZONE_BUILDING_FOOTPRINTS: Record<string, number> = {
  house: 3,
  mansion: 3,
  cabin: 3,
  "shop-blue": 3,
  "market-wheat": 2,
  "market-carrot": 2,
  windmill: 2,
};

/** Tiles occupied by a placed prop (defaults to 1×1). */
export function zonePropFootprint(id: string): number {
  return ZONE_BUILDING_FOOTPRINTS[id] ?? 1;
}

/**
 * Props that block movement in a player zone: buildings (their whole footprint)
 * plus thin barriers. Ground paint, trees, rocks, and decorative props stay
 * walkable, matching the built-in zones.
 */
export const SOLID_ZONE_PROPS = new Set<string>([
  ...Object.keys(ZONE_BUILDING_FOOTPRINTS),
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
