import type { NpcCombatConfig } from "./combat.js";
import type { FarmPlotNode } from "./farming.js";
import type { LandPlotNode } from "./housing.js";
import type { ZoneResourceNode } from "./resources.js";
import type { BillboardNode } from "./stats.js";

export const ZONE_HUB = "zone_hub";
export const ZONE_WILDERNESS = "zone_wilderness";
export const ZONE_GROTTO = "zone_grotto";
export const ZONE_INTERIOR = "zone_interior";

export const MAX_PLAYERS_PER_ZONE = 20;

/** How close (world pixels) a player must be to trigger a portal tile. */
export const PORTAL_TRIGGER_RANGE = 48;

export const CHAT_MAX_LENGTH = 200;
export const CHAT_COOLDOWN_MS = 500;

export interface ZonePortal {
  tileX: number;
  tileY: number;
  targetZone: string;
  label: string;
}

export interface ZoneNpc {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  dialogue: string;
  shopId?: string;
  combat?: NpcCombatConfig;
}

/** Decorative, non-interactive scenery (furniture, plants) placed in a zone. */
export interface SceneryNode {
  id: string;
  tileX: number;
  tileY: number;
  /** Renders the "scenery_<prop>" texture. */
  prop: string;
  /** Flat props (rugs) render beneath players; others depth-sort by position. */
  flat?: boolean;
}

export interface ZoneConfig {
  id: string;
  roomName: string;
  displayName: string;
  spawnTile: { x: number; y: number };
  portals: ZonePortal[];
  npcs: ZoneNpc[];
  resources?: ZoneResourceNode[];
  farmPlots?: FarmPlotNode[];
  landPlots?: LandPlotNode[];
  billboards?: BillboardNode[];
  scenery?: SceneryNode[];
}

export const ZONE_CONFIGS: Record<string, ZoneConfig> = {
  [ZONE_HUB]: {
    id: ZONE_HUB,
    roomName: ZONE_HUB,
    displayName: "MetricBase Hub",
    spawnTile: { x: 12, y: 12 },
    portals: [
      // Portals sit at the map edges so players don't wander into them.
      {
        tileX: 22,
        tileY: 12,
        targetZone: ZONE_WILDERNESS,
        label: "Wilderness Gate",
      },
      {
        tileX: 1,
        tileY: 8,
        targetZone: ZONE_INTERIOR,
        label: "Community Lodge",
      },
    ],
    npcs: [
      {
        id: "hub_guide",
        name: "Aria",
        tileX: 10,
        tileY: 10,
        dialogue:
          "Welcome to MetricBase Hub! Chop the oaks in the northwest woods, mine the western quarry, or fish the southeast lake. Sell your haul to Pip. The east gate leads to the Wilderness.",
      },
      {
        id: "hub_merchant",
        name: "Pip",
        tileX: 14,
        tileY: 13,
        shopId: "pip_general",
        dialogue:
          "Welcome to Pip's Provisions! Trade gold on the open market, or buy gear with in-game gold.",
      },
      {
        id: "hub_smith",
        name: "Brenna",
        tileX: 13,
        tileY: 10,
        dialogue:
          "The forge is hot, friend. Bring me iron, temper it into steel, and who knows — strike lucky and we'll set a gemstone in a real blade. Got the makings of a smith in you?",
      },
      {
        id: "wild_slime_1",
        name: "Wild Slime",
        tileX: 2,
        tileY: 5,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
      {
        id: "wild_slime_2",
        name: "Wild Slime",
        tileX: 12,
        tileY: 18,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
      {
        id: "wild_slime_3",
        name: "Wild Slime",
        tileX: 20,
        tileY: 14,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
    ],
    // Resources sit in themed regions: a NW forest, a W quarry, and the SE lake.
    resources: [
      {
        id: "hub_tree_north",
        name: "Young Oak",
        tileX: 4,
        tileY: 4,
        kind: "tree",
        woodcutting: {
          treeLevel: 1,
          skillXp: 10,
          respawnMs: 25_000,
          lootItemId: "item_wood",
          lootQuantity: 1,
        },
      },
      {
        id: "hub_tree_south",
        name: "Young Oak",
        tileX: 6,
        tileY: 7,
        kind: "tree",
        woodcutting: {
          treeLevel: 1,
          skillXp: 10,
          respawnMs: 25_000,
          lootItemId: "item_wood",
          lootQuantity: 1,
        },
      },
      {
        id: "hub_tree_east",
        name: "Sapling",
        tileX: 8,
        tileY: 5,
        kind: "tree",
        woodcutting: {
          treeLevel: 1,
          skillXp: 8,
          respawnMs: 20_000,
          lootItemId: "item_wood",
          lootQuantity: 1,
        },
      },
      {
        id: "hub_rock_west",
        name: "Copper Rock",
        tileX: 3,
        tileY: 11,
        kind: "rock",
        mining: {
          rockLevel: 1,
          skillXp: 12,
          respawnMs: 30_000,
          lootItemId: "item_ore",
          lootQuantity: 1,
        },
      },
      {
        id: "hub_rock_east",
        name: "Copper Rock",
        tileX: 4,
        tileY: 14,
        kind: "rock",
        mining: {
          rockLevel: 1,
          skillXp: 12,
          respawnMs: 30_000,
          lootItemId: "item_ore",
          lootQuantity: 1,
        },
      },
      {
        id: "hub_fish_north",
        name: "Fishing Spot",
        tileX: 16,
        tileY: 16,
        kind: "fish",
        fishing: {
          spotLevel: 1,
          skillXp: 11,
          respawnMs: 15_000,
          lootItemId: "item_fish",
          lootQuantity: 1,
        },
      },
      {
        id: "hub_fish_east",
        name: "Fishing Spot",
        tileX: 18,
        tileY: 15,
        kind: "fish",
        fishing: {
          spotLevel: 1,
          skillXp: 11,
          respawnMs: 15_000,
          lootItemId: "item_fish",
          lootQuantity: 1,
        },
      },
    ],
    // Farms (2x2, anchored top-left) in the SW field; houses (3x3, centred)
    // in the NE neighbourhood. Empty plots are open ground — only built homes
    // become solid.
    farmPlots: [
      { id: "hub_plot_1", tileX: 3, tileY: 16 },
      { id: "hub_plot_2", tileX: 6, tileY: 16 },
      { id: "hub_plot_3", tileX: 4, tileY: 19 },
      // Expanded south-central field — more tilled plots for farmers.
      { id: "hub_plot_4", tileX: 8, tileY: 16 },
      { id: "hub_plot_5", tileX: 10, tileY: 16 },
      { id: "hub_plot_6", tileX: 8, tileY: 19 },
      { id: "hub_plot_7", tileX: 10, tileY: 19 },
    ],
    landPlots: [
      { id: "hub_land_1", tileX: 16, tileY: 4 },
      { id: "hub_land_2", tileX: 20, tileY: 4 },
      { id: "hub_land_3", tileX: 18, tileY: 8 },
      // More homesteads ringing the plaza — NW, N, and E open grass.
      { id: "hub_land_4", tileX: 15, tileY: 7 },
      { id: "hub_land_5", tileX: 7, tileY: 3 },
      { id: "hub_land_6", tileX: 4, tileY: 7 },
      { id: "hub_land_7", tileX: 21, tileY: 8 },
    ],
    billboards: [{ id: "hub_billboard", tileX: 12, tileY: 7 }],
    // Pip's market: a stall directly behind him (he stands at 14,13) with a
    // crate and a produce basket flanking his counter at the same screen row,
    // so it reads as a real marketplace instead of a lone NPC.
    scenery: [
      { id: "pip_stall", tileX: 13, tileY: 12, prop: "stall" },
      { id: "pip_crate_l", tileX: 13, tileY: 14, prop: "crate" },
      { id: "pip_produce_r", tileX: 15, tileY: 12, prop: "produce" },
      // Brenna's forge (she stands at 13,10): furnace behind, anvil + quench
      // barrel flanking her at the same screen row.
      { id: "forge_furnace", tileX: 12, tileY: 9, prop: "forge" },
      { id: "forge_anvil", tileX: 14, tileY: 9, prop: "anvil" },
      { id: "forge_quench", tileX: 12, tileY: 11, prop: "quench" },
      // Plaza dressing — lamp posts framing the square, a hedge border, a bench,
      // and a signpost on the east lane toward the Wilderness gate.
      { id: "plaza_lamp_nw", tileX: 10, tileY: 9, prop: "lamppost" },
      { id: "plaza_lamp_sw", tileX: 10, tileY: 13, prop: "lamppost" },
      { id: "plaza_lamp_ne", tileX: 16, tileY: 9, prop: "lamppost" },
      { id: "plaza_lamp_se", tileX: 16, tileY: 13, prop: "lamppost" },
      { id: "plaza_hedge_1", tileX: 9, tileY: 10, prop: "hedge" },
      { id: "plaza_hedge_2", tileX: 9, tileY: 11, prop: "hedge" },
      { id: "plaza_bench", tileX: 16, tileY: 11, prop: "bench" },
      { id: "plaza_sign", tileX: 17, tileY: 12, prop: "signpost" },
    ],
  },
  [ZONE_WILDERNESS]: {
    id: ZONE_WILDERNESS,
    roomName: ZONE_WILDERNESS,
    displayName: "Wilderness",
    spawnTile: { x: 4, y: 12 },
    portals: [
      {
        tileX: 1,
        tileY: 12,
        targetZone: ZONE_HUB,
        label: "Return Gate",
      },
      {
        tileX: 22,
        tileY: 14,
        targetZone: ZONE_GROTTO,
        label: "Slime Grotto",
      },
    ],
    npcs: [
      {
        id: "wilderness_scout",
        name: "Rook",
        tileX: 8,
        tileY: 8,
        dialogue:
          "Chop trees in the west grove for wood and Woodcutting XP. Head east for the Training Dummy, or south to hunt Wild Slimes.",
      },
      {
        id: "training_dummy",
        name: "Training Dummy",
        tileX: 14,
        tileY: 10,
        dialogue: "A sturdy straw dummy. It swings back when you attack — press Space or tap Attack.",
        combat: { maxHp: 90, rewardXp: 35, respawnMs: 12_000 },
      },
      {
        id: "wild_slime",
        name: "Wild Slime",
        tileX: 18,
        tileY: 14,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
      {
        id: "wild_slime_2",
        name: "Wild Slime",
        tileX: 6,
        tileY: 18,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
      {
        id: "wild_slime_3",
        name: "Wild Slime",
        tileX: 20,
        tileY: 6,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
    ],
    resources: [
      {
        id: "wild_tree_west_1",
        name: "Wild Oak",
        tileX: 6,
        tileY: 10,
        kind: "tree",
        woodcutting: {
          treeLevel: 2,
          skillXp: 14,
          respawnMs: 30_000,
          lootItemId: "item_wood",
          lootQuantity: 1,
        },
      },
      {
        id: "wild_tree_west_2",
        name: "Wild Oak",
        tileX: 6,
        tileY: 16,
        kind: "tree",
        woodcutting: {
          treeLevel: 2,
          skillXp: 14,
          respawnMs: 30_000,
          lootItemId: "item_wood",
          lootQuantity: 1,
        },
      },
      {
        id: "wild_tree_north",
        name: "Pine",
        tileX: 10,
        tileY: 6,
        kind: "tree",
        woodcutting: {
          treeLevel: 2,
          requiredLevel: 2,
          skillXp: 18,
          respawnMs: 35_000,
          lootItemId: "item_wood",
          lootQuantity: 2,
        },
      },
      {
        id: "wild_tree_south",
        name: "Wild Oak",
        tileX: 12,
        tileY: 18,
        kind: "tree",
        woodcutting: {
          treeLevel: 2,
          skillXp: 14,
          respawnMs: 30_000,
          lootItemId: "item_wood",
          lootQuantity: 1,
        },
      },
      {
        id: "wild_tree_east",
        name: "Ironwood",
        tileX: 20,
        tileY: 8,
        kind: "tree",
        woodcutting: {
          treeLevel: 4,
          requiredLevel: 4,
          skillXp: 28,
          respawnMs: 45_000,
          lootItemId: "item_wood",
          lootQuantity: 2,
        },
      },
      {
        id: "wild_iron_east",
        name: "Iron Deposit",
        tileX: 18,
        tileY: 10,
        kind: "rock",
        mining: {
          rockLevel: 3,
          requiredLevel: 3,
          skillXp: 28,
          respawnMs: 45_000,
          lootItemId: "item_iron_ore",
          lootQuantity: 1,
        },
      },
      {
        id: "wild_iron_west",
        name: "Iron Deposit",
        tileX: 8,
        tileY: 13,
        kind: "rock",
        mining: {
          rockLevel: 3,
          requiredLevel: 3,
          skillXp: 28,
          respawnMs: 45_000,
          lootItemId: "item_iron_ore",
          lootQuantity: 1,
        },
      },
      {
        id: "wild_hardwood_north",
        name: "Hardwood",
        tileX: 16,
        tileY: 6,
        kind: "tree",
        woodcutting: {
          treeLevel: 3,
          requiredLevel: 3,
          skillXp: 26,
          respawnMs: 45_000,
          lootItemId: "item_hardwood",
          lootQuantity: 1,
        },
      },
      {
        id: "wild_hardwood_west",
        name: "Hardwood",
        tileX: 4,
        tileY: 7,
        kind: "tree",
        woodcutting: {
          treeLevel: 3,
          requiredLevel: 3,
          skillXp: 26,
          respawnMs: 45_000,
          lootItemId: "item_hardwood",
          lootQuantity: 1,
        },
      },
      {
        id: "wild_deepfish_north",
        name: "Deep Pool",
        tileX: 12,
        tileY: 3,
        kind: "fish",
        fishing: {
          spotLevel: 3,
          requiredLevel: 3,
          skillXp: 24,
          respawnMs: 30_000,
          lootItemId: "item_salmon",
          lootQuantity: 1,
        },
      },
      {
        id: "wild_deepfish_south",
        name: "Deep Pool",
        tileX: 11,
        tileY: 11,
        kind: "fish",
        fishing: {
          spotLevel: 3,
          requiredLevel: 3,
          skillXp: 24,
          respawnMs: 30_000,
          lootItemId: "item_salmon",
          lootQuantity: 1,
        },
      },
    ],
    // Frontier homesteads + a tilled field, all on dry grass and clear of the
    // river, the mobs, the gather nodes, and the two portals.
    farmPlots: [
      { id: "wild_plot_1", tileX: 3, tileY: 18 },
      { id: "wild_plot_2", tileX: 8, tileY: 18 },
      { id: "wild_plot_3", tileX: 15, tileY: 3 },
    ],
    landPlots: [
      { id: "wild_land_1", tileX: 4, tileY: 4 },
      { id: "wild_land_2", tileX: 15, tileY: 18 },
      { id: "wild_land_3", tileX: 20, tileY: 18 },
    ],
    // Frontier dressing — signposts at the two gates, lamp posts lighting the
    // trail, a trailside bench, and a hedge row by the south homesteads.
    scenery: [
      { id: "wild_sign_hub", tileX: 3, tileY: 13, prop: "signpost" },
      { id: "wild_sign_grotto", tileX: 20, tileY: 13, prop: "signpost" },
      { id: "wild_lamp_1", tileX: 5, tileY: 10, prop: "lamppost" },
      { id: "wild_lamp_2", tileX: 16, tileY: 12, prop: "lamppost" },
      { id: "wild_bench", tileX: 7, tileY: 5, prop: "bench" },
      { id: "wild_hedge_1", tileX: 10, tileY: 18, prop: "hedge" },
      { id: "wild_hedge_2", tileX: 10, tileY: 17, prop: "hedge" },
    ],
  },
  [ZONE_GROTTO]: {
    id: ZONE_GROTTO,
    roomName: ZONE_GROTTO,
    displayName: "Slime Grotto",
    spawnTile: { x: 20, y: 12 },
    portals: [
      {
        tileX: 1,
        tileY: 12,
        targetZone: ZONE_WILDERNESS,
        label: "Grotto Exit",
      },
    ],
    npcs: [
      {
        id: "grotto_warden",
        name: "Moss",
        tileX: 10,
        tileY: 10,
        dialogue:
          "Drip… drip… The Slime Brute guards the deepest pool. Defeat it if you dare — its core fetches a fine price at Pip's.",
      },
      {
        id: "slime_brute",
        name: "Slime Brute",
        tileX: 16,
        tileY: 16,
        dialogue: "GLORP! A massive slime blocks the cavern.",
        combat: { maxHp: 150, rewardXp: 55, respawnMs: 20_000 },
      },
      {
        id: "wild_slime_1",
        name: "Wild Slime",
        tileX: 8,
        tileY: 8,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
      {
        id: "wild_slime_2",
        name: "Wild Slime",
        tileX: 13,
        tileY: 6,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
      {
        id: "wild_slime_3",
        name: "Wild Slime",
        tileX: 19,
        tileY: 8,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
    ],
    // A small cavern settlement — cave dwellings and mushroom beds on the dry
    // floor, set well clear of both pools and the Brute's lair.
    farmPlots: [
      { id: "grotto_plot_1", tileX: 8, tileY: 3 },
      { id: "grotto_plot_2", tileX: 20, tileY: 8 },
      { id: "grotto_plot_3", tileX: 11, tileY: 20 },
    ],
    landPlots: [
      { id: "grotto_land_1", tileX: 11, tileY: 3 },
      { id: "grotto_land_2", tileX: 20, tileY: 5 },
    ],
    // Cavern dressing — a signpost by the exit and lamp posts lighting the dark
    // cave (no hedges/benches underground; lamps fit the grotto's gloom).
    scenery: [
      { id: "grotto_sign_exit", tileX: 3, tileY: 12, prop: "signpost" },
      { id: "grotto_lamp_1", tileX: 6, tileY: 8, prop: "lamppost" },
      { id: "grotto_lamp_2", tileX: 14, tileY: 10, prop: "lamppost" },
      { id: "grotto_lamp_3", tileX: 17, tileY: 13, prop: "lamppost" },
    ],
  },
  [ZONE_INTERIOR]: {
    id: ZONE_INTERIOR,
    roomName: ZONE_INTERIOR,
    displayName: "Community Lodge",
    spawnTile: { x: 11, y: 9 },
    portals: [
      {
        tileX: 11,
        tileY: 15,
        targetZone: ZONE_HUB,
        label: "Lodge Exit",
      },
    ],
    npcs: [
      {
        id: "lodge_keeper",
        name: "Hearth",
        tileX: 11,
        tileY: 7,
        dialogue:
          "Welcome to the Community Lodge — a warm indoor place to gather with other adventurers. Step on the south doormat to head back out.",
      },
    ],
    scenery: [
      // North wall: a fireplace flanked by warm lanterns, bookshelves, plants.
      { id: "lodge_fire", tileX: 11, tileY: 6, prop: "fireplace" },
      { id: "lodge_lantern_l", tileX: 9, tileY: 6, prop: "lantern" },
      { id: "lodge_lantern_r", tileX: 13, tileY: 6, prop: "lantern" },
      { id: "lodge_shelf_l", tileX: 8, tileY: 6, prop: "bookshelf" },
      { id: "lodge_shelf_r", tileX: 14, tileY: 6, prop: "bookshelf" },
      { id: "lodge_plant_l", tileX: 7, tileY: 6, prop: "plant" },
      { id: "lodge_plant_r", tileX: 15, tileY: 6, prop: "plant" },
      // West wall: a reading shelf, a storage crate, and a plant.
      { id: "lodge_shelf_w", tileX: 7, tileY: 8, prop: "bookshelf" },
      { id: "lodge_crate_w", tileX: 7, tileY: 11, prop: "crate" },
      { id: "lodge_plant_w", tileX: 7, tileY: 14, prop: "plant" },
      // East wall: mirror it.
      { id: "lodge_shelf_e", tileX: 16, tileY: 8, prop: "bookshelf" },
      { id: "lodge_crate_e", tileX: 16, tileY: 11, prop: "crate" },
      { id: "lodge_plant_e", tileX: 16, tileY: 14, prop: "plant" },
      // A central rug + an entrance runner leading to the south door.
      { id: "lodge_rug", tileX: 11, tileY: 11, prop: "rug", flat: true },
      { id: "lodge_rug_door", tileX: 11, tileY: 13, prop: "rug", flat: true },
      // Two seating nooks, each with a pair of chairs round the table.
      { id: "lodge_table_l", tileX: 8, tileY: 12, prop: "table" },
      { id: "lodge_chair_l", tileX: 8, tileY: 13, prop: "chair" },
      { id: "lodge_chair_l2", tileX: 8, tileY: 11, prop: "chair" },
      { id: "lodge_table_r", tileX: 14, tileY: 12, prop: "table" },
      { id: "lodge_chair_r", tileX: 14, tileY: 11, prop: "chair" },
      { id: "lodge_chair_r2", tileX: 14, tileY: 13, prop: "chair" },
      // Plants flanking the exit doormat.
      { id: "lodge_plant_door_l", tileX: 9, tileY: 15, prop: "plant" },
      { id: "lodge_plant_door_r", tileX: 13, tileY: 15, prop: "plant" },
    ],
  },
};

export function getZoneConfig(zoneId: string): ZoneConfig {
  const config = ZONE_CONFIGS[zoneId];
  if (!config) {
    throw new Error(`Unknown zone: ${zoneId}`);
  }
  return config;
}