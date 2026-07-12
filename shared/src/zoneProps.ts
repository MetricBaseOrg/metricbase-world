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

/**
 * Painted ground types that block movement (lay a Bridge to cross). Matches
 * the built-in zones, where water is always solid. Owner builds saved before
 * water blocked may have a flooded spawn — playerZoneToConfig heals that by
 * relocating the spawn to the nearest walkable tile.
 */
export const BLOCKING_GROUND_PAINT = new Set<string>(["river", "water", "water2"]);

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

// ---- Resource props --------------------------------------------------------
// Which placeable props are gather nodes, and what they yield. Used to derive
// real resource nodes from LEGACY builds that stored them as scenery (early
// Worlds placed everything into scenery before nodes became functional).

export const RESOURCE_PROPS: Record<string, { kind: "tree" | "rock" | "fish"; label: string }> = {
  pine: { kind: "tree", label: "Pine" },
  "pine-small": { kind: "tree", label: "Small Pine" },
  sapling: { kind: "tree", label: "Sapling" },
  "young-oak": { kind: "tree", label: "Young Oak" },
  "wild-oak": { kind: "tree", label: "Wild Oak" },
  ironwood: { kind: "tree", label: "Ironwood" },
  hardwood: { kind: "tree", label: "Hardwood" },
  "ancient-hardwood": { kind: "tree", label: "Ancient Hardwood" },
  "cavern-hardwood": { kind: "tree", label: "Cavern Hardwood" },
  "berry-bush": { kind: "tree", label: "Berry Bush" },
  "crop-field": { kind: "tree", label: "Crop Field" },
  "crop-wheat": { kind: "tree", label: "Wheat Crop" },
  "copper-rock": { kind: "rock", label: "Copper Rock" },
  "iron-deposit": { kind: "rock", label: "Iron Deposit" },
  "iron-vein": { kind: "rock", label: "Iron Vein" },
  "gem-studded": { kind: "rock", label: "Gem Rock" },
  "obsidian-gem": { kind: "rock", label: "Obsidian Gem" },
  "fish-pond": { kind: "fish", label: "Fishing Spot" },
};
