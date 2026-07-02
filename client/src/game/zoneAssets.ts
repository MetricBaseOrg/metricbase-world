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

// Sizing follows assets.md: 1×1 tiles/props, plus 2×2 and 3×3 buildings.
// The grass top face fills ~97% of the image, so scale so the top face ≈ one
// tile wide (TILE_WIDTH) and the bottom-anchored blocks tessellate cleanly.
const GROUND_W = Math.round(TILE_WIDTH / 0.97); // ~66
const RESOURCE_W = 60;
const DECOR_W = 56;
// A building's baked base fills ~94% of the image width, so scale so the base
// covers its N×N footprint (N×TILE_WIDTH wide).
const buildingWidth = (footprint: number) => Math.round((TILE_WIDTH * footprint) / 0.94);

const g = (id: string, label: string): ZoneAsset =>
  ({ id, file: `${id}.png`, label, category: "ground", worldWidth: GROUND_W, anchorY: 0.72, footprint: 1, clearsGround: false, bakedTile: true });
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
    anchorY: 0.7,
    footprint,
    // Buildings carry a baked-in N×N ground base, so the default ground under
    // their footprint is hidden and the building is laid into the terrain.
    clearsGround: opts.clearsGround ?? true,
    bakedTile: true,
  };
};
const r = (id: string, label: string, kind: "tree" | "rock" | "fish", worldWidth = RESOURCE_W): ZoneAsset =>
  ({ id, file: `${id}.png`, label, category: "resource", worldWidth, anchorY: 0.9, footprint: 1, clearsGround: false, bakedTile: true, resourceKind: kind });
const d = (id: string, label: string, worldWidth = DECOR_W, bakedTile = true): ZoneAsset =>
  ({ id, file: `${id}.png`, label, category: "decor", worldWidth, anchorY: 0.9, footprint: 1, clearsGround: false, bakedTile });

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
