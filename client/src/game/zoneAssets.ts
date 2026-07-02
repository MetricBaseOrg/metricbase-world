// Manifest + lazy loader for the hand-drawn PNG art used by player-owned zones
// ("Worlds"). These are the project's first real image assets; every other
// texture is procedurally baked in BootScene. Files are served from
// /assets/<file> (client/public/assets) and loaded on demand — never all at
// once, since together they weigh ~12 MB.

import Phaser from "phaser";

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
  /** For resource props: which gather skill this node drives when placed. */
  resourceKind?: "tree" | "rock" | "fish";
}

// Per-category defaults keep the table terse; entries override as needed.
const GROUND_W = 74; // slightly over a 64px tile so painted ground overlaps cleanly
const STRUCT_W = 168; // ~3 tiles, matching the procedural house footprint
const RESOURCE_W = 60;
const DECOR_W = 52;

const g = (id: string, label: string): ZoneAsset => ({ id, file: `${id}.png`, label, category: "ground", worldWidth: GROUND_W, anchorY: 0.72 });
const s = (id: string, label: string, worldWidth = STRUCT_W): ZoneAsset => ({ id, file: `${id}.png`, label, category: "structure", worldWidth, anchorY: 0.92 });
const r = (id: string, label: string, kind: "tree" | "rock" | "fish", worldWidth = RESOURCE_W): ZoneAsset => ({ id, file: `${id}.png`, label, category: "resource", worldWidth, anchorY: 0.9, resourceKind: kind });
const d = (id: string, label: string, worldWidth = DECOR_W): ZoneAsset => ({ id, file: `${id}.png`, label, category: "decor", worldWidth, anchorY: 0.9 });

export const ZONE_ASSETS: ZoneAsset[] = [
  // Ground paint
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
  // Structures
  s("house", "House"),
  s("mansion", "Mansion"),
  s("cabin", "Cabin"),
  s("shop-blue", "Shop"),
  s("market-wheat", "Wheat Market"),
  s("market-carrot", "Carrot Market"),
  s("windmill", "Windmill", 150),
  s("well", "Well", 96),
  s("fence", "Fence", 80),
  s("gate", "Gate", 90),
  s("bridge", "Bridge", 120),
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
  // Decor
  d("lamp", "Lamp"),
  d("torch", "Torch"),
  d("bench", "Bench"),
  d("flowerbed", "Flowerbed"),
  d("fontain", "Fountain", 72),
  d("statue", "Statue"),
  d("barrel", "Barrel", 40),
  d("crates", "Crates"),
  d("signpost", "Signpost"),
  d("hedge", "Hedge"),
  d("king-crystal", "Crystal", 72),
];

const BY_ID = new Map<string, ZoneAsset>(ZONE_ASSETS.map((a) => [a.id, a]));

export function getZoneAsset(id: string): ZoneAsset | undefined {
  return BY_ID.get(id);
}

/** Texture key a placed prop renders under (matches GameScene's scenery path). */
export function zoneAssetTextureKey(id: string): string {
  return `scenery_${id}`;
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
