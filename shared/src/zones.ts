import type { NpcCombatConfig } from "./combat.js";
import type { FarmPlotNode } from "./farming.js";
import type { LandPlotNode } from "./housing.js";
import type { ZoneResourceNode } from "./resources.js";
import type { BillboardNode } from "./stats.js";

export const ZONE_HUB = "zone_hub";
export const ZONE_WILDERNESS = "zone_wilderness";
export const ZONE_GROTTO = "zone_grotto";

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
}

export const ZONE_CONFIGS: Record<string, ZoneConfig> = {
  [ZONE_HUB]: {
    id: ZONE_HUB,
    roomName: ZONE_HUB,
    displayName: "MetricBase Hub",
    spawnTile: { x: 12, y: 12 },
    portals: [
      {
        tileX: 20,
        tileY: 12,
        targetZone: ZONE_WILDERNESS,
        label: "Wilderness Gate",
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
    ],
    landPlots: [
      { id: "hub_land_1", tileX: 16, tileY: 4 },
      { id: "hub_land_2", tileX: 20, tileY: 4 },
      { id: "hub_land_3", tileX: 18, tileY: 8 },
    ],
    billboards: [{ id: "hub_billboard", tileX: 12, tileY: 7 }],
  },
  [ZONE_WILDERNESS]: {
    id: ZONE_WILDERNESS,
    roomName: ZONE_WILDERNESS,
    displayName: "Wilderness",
    spawnTile: { x: 4, y: 12 },
    portals: [
      {
        tileX: 2,
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
  },
  [ZONE_GROTTO]: {
    id: ZONE_GROTTO,
    roomName: ZONE_GROTTO,
    displayName: "Slime Grotto",
    spawnTile: { x: 20, y: 12 },
    portals: [
      {
        tileX: 2,
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