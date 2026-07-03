import type { PlayerZoneBuild } from "./playerZones.js";

// Gold cost to PLACE each asset in a player-owned World. Grass and bare dirt are
// free; other ground is cheap, decor moderate, buildings pricey, and resource
// ("source") nodes the most expensive since they earn the owner gather-tax
// income. Admin wallets build everything for free (enforced server-side).
export const ZONE_ASSET_PRICES: Record<string, number> = {
  // --- Ground (grass + bare dirt are FREE) ---
  grass: 0,
  empty: 0,
  grass2: 20,
  soil: 20,
  "stone-path": 25,
  snow: 30,
  sand: 30,
  water: 60,
  water2: 60,
  river: 60,
  lava: 100,
  // --- Decor ---
  barrel: 60,
  crates: 60,
  signpost: 80,
  hedge: 80,
  torch: 120,
  flowerbed: 150,
  lamp: 150,
  bench: 180,
  well: 300,
  fontain: 450,
  statue: 450,
  "king-crystal": 900,
  // --- Buildings ---
  fence: 120,
  gate: 180,
  bridge: 250,
  cabin: 2_000,
  windmill: 3_500,
  house: 3_000,
  "shop-blue": 3_500,
  "market-wheat": 4_000,
  "market-carrot": 4_000,
  mansion: 6_000,
  // --- Resource "source" nodes (priciest — they generate gather-tax income) ---
  "pine-small": 4_000,
  sapling: 4_000,
  "berry-bush": 4_000,
  pine: 6_000,
  "young-oak": 6_000,
  "crop-wheat": 5_000,
  "crop-field": 5_000,
  "fish-pond": 6_000,
  "copper-rock": 6_000,
  "wild-oak": 8_000,
  hardwood: 10_000,
  ironwood: 10_000,
  "iron-deposit": 10_000,
  "cavern-hardwood": 12_000,
  "iron-vein": 12_000,
  "ancient-hardwood": 15_000,
  "gem-studded": 18_000,
  "obsidian-gem": 20_000,
};

/** Fallback price for any asset not explicitly listed. */
export const DEFAULT_ZONE_ASSET_PRICE = 100;

export function zoneAssetPrice(id: string): number {
  return ZONE_ASSET_PRICES[id] ?? DEFAULT_ZONE_ASSET_PRICE;
}

/** Total gold value of everything currently placed in a build. */
export function zoneBuildCost(build: PlayerZoneBuild): number {
  let cost = 0;
  for (const t of build.tiles) cost += zoneAssetPrice(t.type);
  for (const s of build.scenery) cost += zoneAssetPrice(s.prop);
  for (const r of build.resources) cost += zoneAssetPrice(r.prop ?? r.name);
  return cost;
}
