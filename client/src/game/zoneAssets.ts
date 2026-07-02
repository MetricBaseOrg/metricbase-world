// Manifest + lazy loader for the hand-drawn PNG art used by player-owned zones
// ("Worlds"). These are the project's first real image assets; every other
// texture is procedurally baked in BootScene. Files are served from
// /assets/<file> (client/public/assets) and loaded on demand — never all at
// once, since together they weigh ~12 MB.

import Phaser from "phaser";
import { TILE_WIDTH } from "@metricbase/shared";

export type ZoneAssetCategory = "ground" | "structure" | "resource" | "decor";

export interface ZoneAsset {
  /** Prop id stored in a build; also the scenery_<id> texture key. */
  id: string;
  /** File under /assets. */
  file: string;
  label: string;
  category: ZoneAssetCategory;
  /** Target on-screen width in world px; scale is derived from this at load. */
  worldWidth: number;
  /** Vertical anchor (0..1); ground sits lower, upright props anchor at base. */
  anchorY: number;
  /** Footprint in tiles (per assets.md: buildings are 3×3, everything else 1×1). */
  footprint: number;
  /** True when the art carries its own ground base, so the default ground under
   *  its footprint is hidden (avoids a building's grass base stacking on grass). */
  clearsGround: boolean;
  /** True when the art has a baked-in ground tile at its base (all assets except
   *  barrel) — such props are bottom-anchored so their tile sits on the grid. */
  bakedTile: boolean;
  /** For resource props: which gather skill this node drives when placed. */
  resourceKind?: "tree" | "rock" | "fish";
}

// Per-asset anchor (0..1 of image height) = the "surface line" measured from the
// art's alpha: ground blocks use their top-face centre; props/buildings use the
// widest row of their baked base. Placing that line at the tile centre makes
// every surface land at the same level so nothing sits raised or sunken.
const ANCHOR: Record<string, number> = {
  // ground (top-face centre)
  grass: 0.445, grass2: 0.404, soil: 0.387, empty: 0.382, water: 0.429, water2: 0.365,
  river: 0.49, snow: 0.483, lava: 0.47, "stone-path": 0.481,
  // buildings (base surface)
  house: 0.708, mansion: 0.622, cabin: 0.629, "shop-blue": 0.64, "market-wheat": 0.697,
  "market-carrot": 0.699, windmill: 0.717, fence: 0.684, gate: 0.723, bridge: 0.499,
  // resources (base surface)
  pine: 0.791, "pine-small": 0.6, sapling: 0.559, "young-oak": 0.701, "wild-oak": 0.748,
  ironwood: 0.729, hardwood: 0.729, "ancient-hardwood": 0.73, "cavern-hardwood": 0.73,
  "copper-rock": 0.496, "iron-deposit": 0.523, "iron-vein": 0.501, "gem-studded": 0.497,
  "obsidian-gem": 0.498, "fish-pond": 0.499, "berry-bush": 0.492, "crop-field": 0.496, "crop-wheat": 0.507,
  // decor (base surface); barrel has no baked tile so it anchors near its foot
  well: 0.711, lamp: 0.6, torch: 0.693, bench: 0.661, flowerbed: 0.571, fontain: 0.523,
  statue: 0.594, crates: 0.499, signpost: 0.799, hedge: 0.668, "king-crystal": 0.519, barrel: 0.9,
};
const anchor = (id: string, fallback: number) => ANCHOR[id] ?? fallback;

// Sizing follows assets.md: the base fills ~all of the image width, so a 1×1
// tile ≈ TILE_WIDTH and an N×N building ≈ N×TILE_WIDTH.
const GROUND_W = Math.round(TILE_WIDTH / 0.97); // ~66
const PROP_W = 66; // 1×1 props: base ≈ one ground tile
const buildingWidth = (footprint: number) => TILE_WIDTH * footprint;

const g = (id: string, label: string): ZoneAsset =>
  ({ id, file: `${id}.png`, label, category: "ground", worldWidth: GROUND_W, anchorY: anchor(id, 0.44), footprint: 1, clearsGround: false, bakedTile: true });
const b = (
  id: string,
  label: string,
  opts: { footprint?: number; clearsGround?: boolean } = {},
): ZoneAsset => {
  const footprint = opts.footprint ?? 3;
  return {
    id,
    file: `${id}.png`,
    label,
    category: "structure",
    worldWidth: buildingWidth(footprint),
    anchorY: anchor(id, 0.65),
    footprint,
    // Buildings carry a baked-in N×N ground base, so the default ground under
    // their footprint is hidden and the building is laid flush into the terrain.
    clearsGround: opts.clearsGround ?? true,
    bakedTile: true,
  };
};
const r = (id: string, label: string, kind: "tree" | "rock" | "fish", worldWidth = PROP_W): ZoneAsset =>
  ({ id, file: `${id}.png`, label, category: "resource", worldWidth, anchorY: anchor(id, 0.7), footprint: 1, clearsGround: false, bakedTile: true, resourceKind: kind });
const d = (id: string, label: string, worldWidth = PROP_W, bakedTile = true): ZoneAsset =>
  ({ id, file: `${id}.png`, label, category: "decor", worldWidth, anchorY: anchor(id, 0.7), footprint: 1, clearsGround: false, bakedTile });

export const ZONE_ASSETS: ZoneAsset[] = [
  // Ground paint (1×1 tiles)
  g("grass", "Grass"),
  g("grass2", "Meadow"),
  g("soil", "Soil"),
  g("empty", "Bare Dirt"),
  g("water", "Water"),
  g("water2", "Deep Water"),
  g("river", "River"),
  g("snow", "Snow"),
  g("lava", "Lava"),
  g("stone-path", "Stone Path"),
  // Buildings — 3×3 homes, 2×2 markets/windmill (carry their own ground base)
  b("house", "House"),
  b("mansion", "Mansion"),
  b("cabin", "Cabin"),
  b("shop-blue", "Shop"),
  b("market-wheat", "Wheat Market", { footprint: 2 }),
  b("market-carrot", "Carrot Market", { footprint: 2 }),
  b("windmill", "Windmill", { footprint: 2 }),
  // Barriers: thin 1×1 structures without a full ground base (don't clear ground).
  b("fence", "Fence", { footprint: 1, clearsGround: false }),
  b("gate", "Gate", { footprint: 1, clearsGround: false }),
  b("bridge", "Bridge", { footprint: 1, clearsGround: false }),
  // Resource nodes (functional gather nodes)
  r("pine", "Pine", "tree"),
  r("pine-small", "Small Pine", "tree"),
  r("sapling", "Sapling", "tree"),
  r("young-oak", "Young Oak", "tree"),
  r("wild-oak", "Wild Oak", "tree"),
  r("ironwood", "Ironwood", "tree"),
  r("hardwood", "Hardwood", "tree"),
  r("ancient-hardwood", "Ancient Hardwood", "tree"),
  r("cavern-hardwood", "Cavern Hardwood", "tree"),
  r("copper-rock", "Copper Rock", "rock"),
  r("iron-deposit", "Iron Deposit", "rock"),
  r("iron-vein", "Iron Vein", "rock"),
  r("gem-studded", "Gem Rock", "rock"),
  r("obsidian-gem", "Obsidian Gem", "rock"),
  r("fish-pond", "Fishing Spot", "fish", 72),
  r("berry-bush", "Berry Bush", "tree", 52),
  r("crop-field", "Crop Field", "tree", 72),
  r("crop-wheat", "Wheat Crop", "tree", 64),
  // Decor (1×1, ground-anchored)
  d("well", "Well", 64),
  d("lamp", "Lamp"),
  d("torch", "Torch"),
  d("bench", "Bench"),
  d("flowerbed", "Flowerbed"),
  d("fontain", "Fountain", 72),
  d("statue", "Statue"),
  d("barrel", "Barrel", 40, false), // the one prop with no baked tile

  d("crates", "Crates"),
  d("signpost", "Signpost"),
  d("hedge", "Hedge"),
  d("king-crystal", "Crystal", 72),
];

const BY_ID = new Map<string, ZoneAsset>(ZONE_ASSETS.map((a) => [a.id, a]));

export function getZoneAsset(id: string): ZoneAsset | undefined {
  return BY_ID.get(id);
}

/** Texture key a placed prop renders under. A dedicated namespace avoids
 *  colliding with the built-in procedural `scenery_<id>` textures (e.g. hedge,
 *  bench, signpost exist in both), which would otherwise mask the PNG art. */
export function zoneAssetTextureKey(id: string): string {
  return `pz_${id}`;
}

/**
 * Ensure the scenery texture for a prop id is loaded into the scene, invoking
 * `onReady` once available. No-ops (and still fires onReady) if already loaded.
 * Unknown ids simply never fire — callers fall back to a placeholder.
 */
export function ensureZoneAssetLoaded(scene: Phaser.Scene, id: string, onReady?: () => void): void {
  const asset = BY_ID.get(id);
  if (!asset) return;
  const key = zoneAssetTextureKey(id);
  if (scene.textures.exists(key)) {
    onReady?.();
    return;
  }
  const url = `/assets/${asset.file}`;
  const done = () => onReady?.();
  scene.load.once(`filecomplete-image-${key}`, done);
  scene.load.image(key, url);
  if (!scene.load.isLoading()) scene.load.start();
}

/** Scale factor to render an asset's texture at its target world width. */
export function zoneAssetScale(scene: Phaser.Scene, id: string): number {
  const asset = BY_ID.get(id);
  const key = zoneAssetTextureKey(id);
  if (!asset || !scene.textures.exists(key)) return 1;
  const srcW = scene.textures.get(key).getSourceImage().width || asset.worldWidth;
  return asset.worldWidth / srcW;
}
