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
  /** One-line brief shown in the builder palette + Build Shop. */
  desc: string;
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
  /** Virtual assets have no PNG (rendered by other systems, e.g. mob dens);
   *  the palette shows their emoji instead. */
  virtual?: boolean;
  emoji?: string;
}

// Per-asset anchor (0..1 of image height) = the "surface line" measured from the
// art's alpha: ground blocks use their top-face centre; props/buildings use the
// widest row of their baked base. Placing that line at the tile centre makes
// every surface land at the same level so nothing sits raised or sunken.
const ANCHOR: Record<string, number> = {
  // ground (top-face centre)
  grass: 0.445, grass2: 0.404, soil: 0.387, empty: 0.382, water: 0.329, water2: 0.331,
  river: 0.49, snow: 0.483, lava: 0.414, "stone-path": 0.481, sand: 0.356,
  "autumn-grass": 0.445, "cave-floor": 0.343, "farm-carrot": 0.445, swamp: 0.340, "wood-floor": 0.445,
  // buildings — the base diamond's CENTRE (its widest row), mapped onto the
  // footprint centre so the base tile replaces the 3×3/2×2 ground 1:1.
  house: 0.71, mansion: 0.622, cabin: 0.629, "shop-blue": 0.64, "market-wheat": 0.697,
  "market-carrot": 0.699, windmill: 0.717, fence: 0.684, gate: 0.723, bridge: 0.499,
  // Sweet Harvest market stall (world/scenery-stall.webp): tall awning + sign
  // above, baked cobblestone base in the lower third → base sits fairly low.
  stall: 0.78,
  bakery: 0.65, "bakery-stall": 0.65, barn: 0.65, blacksmith: 0.65, church: 0.65,
  "guard-tower": 0.65, library: 0.65, mosque: 0.65, stable: 0.65, tavern: 0.65, townhall: 0.65,
  // resources (base surface)
  pine: 0.791, "pine-small": 0.6, sapling: 0.559, "young-oak": 0.701, "wild-oak": 0.748,
  ironwood: 0.729, hardwood: 0.729, "ancient-hardwood": 0.73, "cavern-hardwood": 0.73,
  "copper-rock": 0.496, "iron-deposit": 0.523, "iron-vein": 0.501, "gem-studded": 0.497,
  "obsidian-gem": 0.498, "fish-pond": 0.387, "berry-bush": 0.535, "crop-field": 0.496, "crop-wheat": 0.507,
  "sakura-tree": 0.742, rock: 0.678, "deep-pool": 0.387, "crop-carrot": 0.5,
  // decor (base surface); barrel has no baked tile so it anchors near its foot
  well: 0.711, lamp: 0.6, torch: 0.693, bench: 0.661, flowerbed: 0.571, fontain: 0.523,
  statue: 0.594, crates: 0.499, signpost: 0.799, hedge: 0.668, "king-crystal": 0.519, barrel: 0.9,
};
const anchor = (id: string, fallback: number) => ANCHOR[id] ?? fallback;

// One-line briefs for the builder palette + Build Shop. Honest about gameplay:
// footprint, whether it blocks walking, and whether it's a functional node.
const DESC: Record<string, string> = {
  // ground paint
  grass: "Classic green ground — free to paint anywhere.",
  grass2: "Lighter flowery meadow for cozy clearings.",
  soil: "Tilled farm plot — plant wheat, carrot & future seeds here, then harvest.",
  empty: "Plain bare dirt — free to paint anywhere.",
  water: "Sparkling shallow water for lakes and moats — blocks walking; lay a Bridge to cross.",
  water2: "Darker deep water — blocks walking; pairs well with Water edges.",
  river: "Flowing 2×2 river — blocks walking; lay a Bridge to cross.",
  snow: "Frosty ground for winter builds.",
  lava: "Molten ground for dramatic, dangerous-looking flair.",
  "stone-path": "Paved stone walkway to guide visitors around.",
  // buildings & barriers
  house: "Cozy starter home. 3×3 tiles, blocks walking.",
  mansion: "Grand estate for a wealthy plot. 3×3, blocks walking.",
  cabin: "Rustic woodland cabin. 3×3, blocks walking.",
  "shop-blue": "Blue-roofed shop building. 3×3, blocks walking.",
  "market-wheat": "Working market: visitors buy wheat seeds & sell wheat here. 2×2, blocks walking.",
  "market-carrot": "Working market: visitors buy carrot seeds & sell carrots here. 2×2, blocks walking.",
  stall: "Sweet Harvest market stall — a cozy vendor booth. 2×2, blocks walking.",
  windmill: "Countryside windmill. 2×2, blocks walking.",
  fence: "Thin barrier — blocks walking. Chain into walls.",
  gate: "Ornate fence gate — solid; leave an open tile beside it.",
  bridge: "2×2 wooden bridge — makes river tiles under it walkable.",
  // resource nodes (functional)
  pine: "Evergreen pine — a real Woodcutting node visitors can chop.",
  "pine-small": "Little pine — quick Woodcutting node.",
  sapling: "Young sapling — starter Woodcutting node.",
  "young-oak": "Sturdy young oak Woodcutting node.",
  "wild-oak": "Broad wild oak Woodcutting node.",
  ironwood: "Tough ironwood — premium Woodcutting node.",
  hardwood: "Dense hardwood Woodcutting node.",
  "ancient-hardwood": "Ancient giant — top-tier Woodcutting node.",
  "cavern-hardwood": "Cave-grown hardwood Woodcutting node.",
  "copper-rock": "Copper rock — a Mining node visitors can mine.",
  "iron-deposit": "Iron deposit Mining node.",
  "iron-vein": "Rich iron vein Mining node.",
  "gem-studded": "Gem-studded rock — sparkly Mining node.",
  "obsidian-gem": "Obsidian gem rock — rare-looking Mining node.",
  "fish-pond": "Stocked pond — a Fishing node visitors fish from the shore; blocks walking.",
  "slime-den": "Spawns a real Wild Slime visitors can fight — XP + slime gel (no gold).",
  "brute-den": "Spawns a Slime Brute — a tough fight for XP + a slime core (no gold).",
  "berry-bush": "Berry bush — quick gather node.",
  "crop-field": "Planted field — each gather yields a random seed to plant.",
  "crop-wheat": "Golden wheat patch — gather Wheat Seeds to plant.",
  "crop-carrot": "Ripe carrot patch — gather Carrot Seeds to plant.",
  "sakura-tree": "Cherry blossom sakura tree Woodcutting node.",
  rock: "Basic mining rock node.",
  "deep-pool": "Deep pool — darker salmon waters, fished from the shore; blocks walking.",
  "autumn-grass": "Warm orange autumn grass tile.",
  "cave-floor": "Dark stone cave floor floor paint.",
  "farm-carrot": "Ground tile painted with growing carrots.",
  swamp: "Murky swamp mud and water paint.",
  "wood-floor": "Cozy wooden planks floor paint.",
  sand: "Warm desert sand tile paint.",
  bakery: "A cozy bakery building — blocks walking.",
  "bakery-stall": "Bakery stall showing fresh breads.",
  barn: "Sturdy barn for storing farm tools.",
  blacksmith: "A working blacksmith shop.",
  church: "A historic church showing stained glass windows.",
  "guard-tower": "Watchtower to guard the borders of your land.",
  library: "Quiet library for researching old logs.",
  mosque: "Beautiful mosque showing peaceful architecture.",
  stable: "Stable for keeping horses and mounts.",
  tavern: "Local tavern for travelers to rest.",
  townhall: "Grand town hall for governing your World.",
  // decor
  well: "Stone well centrepiece — solid, blocks walking.",
  lamp: "Decorative street lamp for paths and plazas.",
  torch: "Rustic torch post for entrances.",
  bench: "Park bench for scenic rest spots.",
  flowerbed: "Bright flower patch to add colour.",
  fontain: "Ornate plaza fountain — solid, blocks walking.",
  statue: "Stone statue landmark — solid, blocks walking.",
  barrel: "Storage barrel — tuck beside houses and shops.",
  crates: "Stacked supply crates for markets and docks.",
  signpost: "Wooden signpost for entrances and crossroads.",
  hedge: "Trimmed hedge for garden borders (walkable).",
  "king-crystal": "Glowing crystal monument — solid showpiece.",
};
const desc = (id: string) => DESC[id] ?? "";

// Sizing follows assets.md: the base fills ~all of the image width, so a 1×1
// tile ≈ TILE_WIDTH and an N×N building ≈ N×TILE_WIDTH.
const GROUND_W = Math.round(TILE_WIDTH / 0.97); // ~66
const PROP_W = 66; // 1×1 props: base ≈ one ground tile
const buildingWidth = (footprint: number) => TILE_WIDTH * footprint;

const g = (id: string, label: string, footprint = 1): ZoneAsset =>
  ({ id, file: `${id}.webp`, label, desc: desc(id), category: "ground", worldWidth: GROUND_W * footprint, anchorY: anchor(id, 0.44), footprint, clearsGround: false, bakedTile: true });
const b = (
  id: string,
  label: string,
  opts: { footprint?: number; clearsGround?: boolean } = {},
): ZoneAsset => {
  const footprint = opts.footprint ?? 3;
  return {
    id,
    file: `${id}.webp`,
    label,
    desc: desc(id),
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
  ({ id, file: `${id}.webp`, label, desc: desc(id), category: "resource", worldWidth, anchorY: anchor(id, 0.7), footprint: 1, clearsGround: false, bakedTile: true, resourceKind: kind });
const d = (id: string, label: string, worldWidth = PROP_W, bakedTile = true): ZoneAsset =>
  ({ id, file: `${id}.webp`, label, desc: desc(id), category: "decor", worldWidth, anchorY: anchor(id, 0.7), footprint: 1, clearsGround: false, bakedTile });

export const ZONE_ASSETS: ZoneAsset[] = [
  // Ground paint (1×1 tiles)
  g("grass", "Grass"),
  g("grass2", "Meadow"),
  g("soil", "Soil"),
  g("empty", "Bare Dirt"),
  g("water", "Water"),
  g("water2", "Deep Water"),
  g("river", "River", 2),
  g("snow", "Snow"),
  g("lava", "Lava"),
  g("stone-path", "Stone Path"),
  g("sand", "Sand"),
  g("autumn-grass", "Autumn Grass"),
  g("cave-floor", "Cave Floor"),
  g("farm-carrot", "Carrot Patch"),
  g("swamp", "Swamp Paint"),
  g("wood-floor", "Wood Floor"),
  // Buildings — 3×3 homes, 2×2 markets/windmill (carry their own ground base)
  b("house", "House"),
  b("mansion", "Mansion"),
  b("cabin", "Cabin"),
  b("shop-blue", "Shop"),
  b("market-wheat", "Wheat Market", { footprint: 2 }),
  b("market-carrot", "Carrot Market", { footprint: 2 }),
  // Market stall lives under /assets/world (not the flat /assets root like the
  // other buildings), so it can't use the b() helper's `${id}.webp` path.
  {
    id: "stall",
    file: "world/scenery-stall.webp",
    label: "Market Stall",
    desc: desc("stall"),
    category: "structure",
    worldWidth: buildingWidth(2),
    anchorY: anchor("stall", 0.78),
    footprint: 2,
    clearsGround: true,
    bakedTile: true,
  },
  b("windmill", "Windmill", { footprint: 2 }),
  b("bakery", "Bakery"),
  b("bakery-stall", "Bakery Stall", { footprint: 2 }),
  b("barn", "Barn"),
  b("blacksmith", "Blacksmith", { footprint: 2 }),
  b("church", "Church"),
  b("guard-tower", "Guard Tower", { footprint: 2 }),
  b("library", "Library"),
  b("mosque", "Mosque"),
  b("stable", "Stable", { footprint: 2 }),
  b("tavern", "Tavern"),
  b("townhall", "Town Hall"),
  // Barriers: thin 1×1 structures without a full ground base (don't clear ground).
  b("fence", "Fence", { footprint: 1, clearsGround: false }),
  b("gate", "Gate", { footprint: 1, clearsGround: false }),
  b("bridge", "Bridge", { footprint: 2, clearsGround: false }),
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
  r("sakura-tree", "Sakura Tree", "tree", 96),
  r("copper-rock", "Copper Rock", "rock"),
  r("iron-deposit", "Iron Deposit", "rock"),
  r("iron-vein", "Iron Vein", "rock"),
  r("gem-studded", "Gem Rock", "rock"),
  r("obsidian-gem", "Obsidian Gem", "rock"),
  r("rock", "Rock", "rock"),
  r("fish-pond", "Fishing Spot", "fish", 72),
  r("deep-pool", "Deep Pool", "fish", 72),
  r("berry-bush", "Berry Bush", "tree", 68),
  r("crop-field", "Crop Field", "tree", 72),
  r("crop-wheat", "Wheat Crop", "tree", 64),
  r("crop-carrot", "Carrot Crop", "tree", 67),
  // Mob dens — virtual: they spawn real combat NPCs rather than a PNG prop.
  { id: "slime-den", file: "", emoji: "🟢", virtual: true, label: "Slime Den", desc: desc("slime-den"), category: "resource", worldWidth: 0, anchorY: 0.5, footprint: 1, clearsGround: false, bakedTile: false },
  { id: "brute-den", file: "", emoji: "🐸", virtual: true, label: "Brute Den", desc: desc("brute-den"), category: "resource", worldWidth: 0, anchorY: 0.5, footprint: 1, clearsGround: false, bakedTile: false },
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
  if (!asset || !asset.file) return;
  const key = zoneAssetTextureKey(id);
  if (scene.textures.exists(key)) {
    onReady?.();
    return;
  }
  const url = `/assets/${asset.file}`;
  const done = () => onReady?.();
  scene.load.once(`filecomplete-image-${key}`, done);
  
  // Robust fallback for missing hand-drawn files
  const onError = (fileObj: any) => {
    if (fileObj && fileObj.key === key) {
      if (!scene.textures.exists(key)) {
        const g = scene.make.graphics({ x: 0, y: 0 });
        g.fillStyle(0x7c2d12, 0.7); // warm brick-like color
        g.fillRect(0, 0, 64, 64);
        g.lineStyle(2, 0xfebf24);
        g.strokeRect(0, 0, 64, 64);
        g.generateTexture(key, 64, 64);
        g.destroy();
      }
      done();
    }
  };
  scene.load.once(`loaderror`, onError);
  
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
