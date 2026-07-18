import type { NpcCombatConfig } from "./combat.js";
import type { FarmPlotNode } from "./farming.js";
import type { LandPlotNode } from "./housing.js";
import type { ZoneResourceNode } from "./resources.js";
import type { BillboardNode } from "./stats.js";
import type { CapturePoint } from "./territory.js";

export const ZONE_HUB = "zone_hub";
export const ZONE_WILDERNESS = "zone_wilderness";
export const ZONE_GROTTO = "zone_grotto";
export const ZONE_INTERIOR = "zone_interior";
export const ZONE_BLACK = "zone_black";
export const ZONE_JAIL = "zone_jail";

/** How long an arrested criminal is held in jail. */
export const JAIL_DURATION_MS = 2 * 60 * 1000;

/** $BASE that must be burned on-chain to unlock Black-zone access. */
export const BLACK_ZONE_BURN_AMOUNT = 1_000_000;

/** Alternative VIP Lodge access: a timed pass. Two tiers, both last VIP_PASS_DAYS. */
export const VIP_PASS_DAYS = 14;
/** Cheap pass: a small gold fee PLUS a $BASE burn. */
export const VIP_PASS_GOLD_COST = 100;
export const VIP_PASS_BURN_AMOUNT = 10_000;
/** Gold-only pass: no burn, just a larger gold fee. */
export const VIP_PASS_GOLD_ONLY_COST = 1_000;

export const MAX_PLAYERS_PER_ZONE = 20;

/** $BASE a wallet must hold to enter the VIP Community Lodge. */
export const VIP_LODGE_MIN_HOLD = 10_000_000;

/** How close (world pixels) a player must be to trigger a portal tile. */
export const PORTAL_TRIGGER_RANGE = 48;

export const CHAT_MAX_LENGTH = 800;
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
  /** If set, interacting opens this external arcade game URL (e.g. Base Rush). */
  arcadeUrl?: string;
  /** If true, interacting opens the in-lodge Blackjack table. */
  blackjack?: boolean;
}

/** External arcade game reachable from the Community Lodge arcade machine. */
export const BASE_RUSH_URL = "https://apps.metricbase.org/base-rush";

/** Decorative, non-interactive scenery (furniture, plants) placed in a zone. */
export interface SceneryNode {
  id: string;
  tileX: number;
  tileY: number;
  /** Renders the "scenery_<prop>" texture. */
  prop: string;
  /** Flat props (rugs) render beneath players; others depth-sort by position. */
  flat?: boolean;
  /** If set, walking up + interacting opens this activity (no NPC needed). */
  interact?: "arcade" | "blackjack";
  /** Arcade URL for interact === "arcade". */
  arcadeUrl?: string;
  /** Blocks movement on its tile (big furniture); decorative props don't. */
  solid?: boolean;
}

/** PvP danger tier of a zone. Drives PvP rules, death penalties, and UI tint. */
export type DangerTier = "safe" | "yellow" | "red" | "black";

export interface ZoneConfig {
  id: string;
  roomName: string;
  displayName: string;
  /** PvP danger tier (defaults to "safe" when omitted). */
  dangerTier?: DangerTier;
  /** Minimum $BASE (UI amount) a wallet must hold to enter — VIP-gated zones. */
  vipMinHold?: number;
  spawnTile: { x: number; y: number };
  portals: ZonePortal[];
  npcs: ZoneNpc[];
  resources?: ZoneResourceNode[];
  farmPlots?: FarmPlotNode[];
  landPlots?: LandPlotNode[];
  billboards?: BillboardNode[];
  scenery?: SceneryNode[];
  /** Guild-capturable control points (Territory Control). */
  capturePoints?: CapturePoint[];
  /** Ground-paint overrides (player zones only): sparse per-tile palette types. */
  tiles?: { x: number; y: number; type: string }[];
  /** Square grid size for player zones (24 base, larger when expanded). */
  gridSize?: number;
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
        tileY: 12,
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
        tileX: 6,
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
      // Wild Slimes moved to Obsidian Reach (v0.116.0) — the Hub stays a
      // combat-free starter town; first fights happen in the Wilderness.
    ],
    // Resources sit in themed regions: a NW forest, a W quarry, and the SE lake.
    resources: [
      {
        id: "hub_tree_north",
        name: "Young Oak",
        tileX: 2,
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
        id: "hub_tree_south",
        name: "Young Oak",
        tileX: 3,
        tileY: 9,
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
        tileX: 5,
        tileY: 9,
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
      { id: "hub_land_5", tileX: 8, tileY: 4 },
      { id: "hub_land_6", tileX: 5, tileY: 4 },
      { id: "hub_land_7", tileX: 21, tileY: 8 },
    ],
    billboards: [{ id: "hub_billboard", tileX: 12, tileY: 7 }],
    // Pip's marketplace: two 2×2 market stalls flanking him on free grass east
    // of his counter (he stands at 6,13). They're solid buildings — their whole
    // footprint blocks walking like other buildings — and functional: visitors
    // buy seeds and sell crops at the wheat & carrot markets.
    scenery: [
      { id: "pip_market_wheat", tileX: 7, tileY: 13, prop: "market-wheat", solid: true },
      { id: "pip_market_carrot", tileX: 9, tileY: 13, prop: "market-carrot", solid: true },
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
    dangerTier: "yellow",
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
        id: "wilderness_merchant",
        name: "Mara",
        tileX: 8,
        tileY: 4,
        shopId: "pip_general",
        dialogue:
          "Camp store's open! Out here we pay what the CAMP needs, not what the Hub does — check the regional prices before you haul your goods to town.",
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
        // Was (12,18) — that column is the river, so the oak floated on water
        // beside Yama's Shop. Moved one step east onto the dry grass shore.
        tileX: 13,
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
      {
        id: "wild_copper_north",
        name: "Copper Rock",
        tileX: 4,
        tileY: 8,
        kind: "rock",
        mining: {
          rockLevel: 1,
          skillXp: 16,
          respawnMs: 35_000,
          lootItemId: "item_ore",
          lootQuantity: 2,
        },
      },
      {
        id: "wild_oak_extra",
        name: "Wild Oak",
        tileX: 4,
        tileY: 12,
        kind: "tree",
        woodcutting: {
          treeLevel: 2,
          skillXp: 14,
          respawnMs: 30_000,
          lootItemId: "item_wood",
          lootQuantity: 2,
        },
      },
      {
        id: "wild_iron_south",
        name: "Iron Deposit",
        tileX: 16,
        tileY: 16,
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
        id: "wild_fish_mid",
        name: "Deep Pool",
        tileX: 12,
        tileY: 9,
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
      // Corner greenery + a few camp touches to fill the frontier out.
      { id: "wild_plant_nw", tileX: 3, tileY: 3, prop: "plant" },
      { id: "wild_plant_ne", tileX: 20, tileY: 3, prop: "plant" },
      { id: "wild_plant_sw", tileX: 3, tileY: 20, prop: "plant" },
      { id: "wild_plant_se", tileX: 20, tileY: 20, prop: "plant" },
      // (6,20): clear of wild_plot_1's 2×2 footprint (built-in plots span
      // tileX..+1 × tileY..+1 — don't place scenery inside that square).
      { id: "wild_crate_1", tileX: 6, tileY: 20, prop: "crate" },
      { id: "wild_crate_2", tileX: 18, tileY: 5, prop: "crate" },
      { id: "wild_hedge_3", tileX: 14, tileY: 17, prop: "hedge" },
      { id: "wild_hedge_4", tileX: 15, tileY: 17, prop: "hedge" },
      { id: "wild_bench_2", tileX: 18, tileY: 18, prop: "bench" },
    ],
    capturePoints: [{ id: "wild_point", name: "Frontier Outpost", tileX: 16, tileY: 8 }],
  },
  [ZONE_GROTTO]: {
    id: ZONE_GROTTO,
    roomName: ZONE_GROTTO,
    displayName: "Slime Grotto",
    dangerTier: "red",
    spawnTile: { x: 20, y: 12 },
    portals: [
      {
        tileX: 1,
        tileY: 12,
        targetZone: ZONE_WILDERNESS,
        label: "Grotto Exit",
      },
      {
        tileX: 12,
        tileY: 1,
        targetZone: ZONE_BLACK,
        label: "Black Gate",
      },
    ],
    npcs: [
      {
        id: "grotto_merchant",
        name: "Fen",
        tileX: 11,
        tileY: 11,
        shopId: "pip_general",
        dialogue:
          "Supplies for the deep grotto — and I pay grotto prices. Lamp oil and hot meals fetch more down here than they ever will up top.",
      },
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
        tileY: 13,
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
    // Red-zone resources — richer iron, hardwood, gemstone, and deep-pool fish,
    // all on solid floor / pool edges clear of the lakes, NPCs, and plots.
    resources: [
      {
        id: "grotto_iron_1",
        name: "Iron Vein",
        tileX: 8,
        tileY: 12,
        kind: "rock",
        mining: {
          rockLevel: 4,
          requiredLevel: 4,
          skillXp: 32,
          respawnMs: 45_000,
          lootItemId: "item_iron_ore",
          lootQuantity: 2,
        },
      },
      {
        id: "grotto_iron_2",
        name: "Iron Vein",
        tileX: 4,
        tileY: 12,
        kind: "rock",
        mining: {
          rockLevel: 4,
          requiredLevel: 4,
          skillXp: 32,
          respawnMs: 45_000,
          lootItemId: "item_iron_ore",
          lootQuantity: 2,
        },
      },
      {
        id: "grotto_gem_1",
        name: "Gem-Studded Rock",
        tileX: 6,
        tileY: 19,
        kind: "rock",
        mining: {
          rockLevel: 6,
          requiredLevel: 6,
          skillXp: 48,
          respawnMs: 90_000,
          lootItemId: "item_gemstone",
          lootQuantity: 1,
        },
      },
      {
        id: "grotto_hardwood_1",
        name: "Cavern Hardwood",
        tileX: 3,
        tileY: 3,
        kind: "tree",
        woodcutting: {
          treeLevel: 4,
          requiredLevel: 4,
          skillXp: 30,
          respawnMs: 45_000,
          lootItemId: "item_hardwood",
          lootQuantity: 2,
        },
      },
      {
        id: "grotto_hardwood_2",
        name: "Cavern Hardwood",
        tileX: 21,
        tileY: 3,
        kind: "tree",
        woodcutting: {
          treeLevel: 4,
          requiredLevel: 4,
          skillXp: 30,
          respawnMs: 45_000,
          lootItemId: "item_hardwood",
          lootQuantity: 2,
        },
      },
      {
        id: "grotto_fish_1",
        name: "Deep Grotto Pool",
        tileX: 5,
        tileY: 5,
        kind: "fish",
        fishing: {
          spotLevel: 4,
          requiredLevel: 4,
          skillXp: 28,
          respawnMs: 30_000,
          lootItemId: "item_salmon",
          lootQuantity: 1,
        },
      },
      {
        id: "grotto_fish_2",
        name: "Deep Grotto Pool",
        tileX: 15,
        tileY: 16,
        kind: "fish",
        fishing: {
          spotLevel: 4,
          requiredLevel: 4,
          skillXp: 28,
          respawnMs: 30_000,
          lootItemId: "item_salmon",
          lootQuantity: 1,
        },
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
      { id: "grotto_land_1", tileX: 16, tileY: 4 },
      { id: "grotto_land_2", tileX: 20, tileY: 5 },
    ],
    // Cavern dressing — a signpost by the exit and lamp posts lighting the dark
    // cave (no hedges/benches underground; lamps fit the grotto's gloom).
    scenery: [
      { id: "grotto_sign_exit", tileX: 3, tileY: 12, prop: "signpost" },
      { id: "grotto_lamp_1", tileX: 6, tileY: 8, prop: "lamppost" },
      { id: "grotto_lamp_2", tileX: 14, tileY: 10, prop: "lamppost" },
      { id: "grotto_lamp_3", tileX: 17, tileY: 13, prop: "lamppost" },
      // Cavern dressing: crates of ore, mossy plants, and a few lanterns.
      { id: "grotto_crate_1", tileX: 11, tileY: 4, prop: "crate" }, // clear of grotto_plot_1's 2×2
      { id: "grotto_crate_2", tileX: 18, tileY: 5, prop: "crate" },
      { id: "grotto_plant_1", tileX: 3, tileY: 18, prop: "plant" },
      { id: "grotto_plant_2", tileX: 10, tileY: 17, prop: "plant" },
      { id: "grotto_plant_3", tileX: 20, tileY: 7, prop: "plant" },
      { id: "grotto_lantern_1", tileX: 10, tileY: 5, prop: "lantern" },
      { id: "grotto_lantern_2", tileX: 13, tileY: 15, prop: "lantern" },
    ],
    capturePoints: [{ id: "grotto_point", name: "Grotto Heart", tileX: 12, tileY: 10 }],
  },
  [ZONE_BLACK]: {
    id: ZONE_BLACK,
    roomName: ZONE_BLACK,
    displayName: "Obsidian Reach",
    dangerTier: "black",
    // Solid ground near the exit — clear of the lava pools (x3-5/18-20, y10-13)
    // and the wall pillars. (3,12) was inside the west lava pool.
    spawnTile: { x: 3, y: 7 },
    portals: [
      {
        tileX: 1,
        tileY: 12,
        targetZone: ZONE_GROTTO,
        label: "Flee the Reach",
      },
    ],
    npcs: [
      {
        id: "black_warden",
        name: "Charred Sentinel",
        tileX: 12,
        tileY: 4,
        dialogue:
          "You burned your way in. Few leave the Obsidian Reach with their loot — fall here and you lose everything.",
      },
      {
        id: "void_brute",
        name: "Void Brute",
        tileX: 12,
        tileY: 12,
        dialogue: "A monstrous obsidian slime radiates heat.",
        combat: { maxHp: 420, rewardXp: 180, respawnMs: 30_000 },
      },
      {
        id: "wild_slime_1",
        name: "Ember Slime",
        tileX: 8,
        tileY: 8,
        dialogue: "An ember-cored slime hisses.",
        combat: { maxHp: 90, rewardXp: 45, respawnMs: 10_000 },
      },
      {
        id: "wild_slime_2",
        name: "Ember Slime",
        tileX: 16,
        tileY: 16,
        dialogue: "An ember-cored slime hisses.",
        combat: { maxHp: 90, rewardXp: 45, respawnMs: 10_000 },
      },
      // Relocated from the Hub (v0.116.0): tiles validated walkable, free of
      // entities/portals/capture points, and BFS-reachable from spawn.
      {
        id: "wild_slime_3",
        name: "Wild Slime",
        tileX: 10,
        tileY: 3,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
      {
        id: "wild_slime_4",
        name: "Wild Slime",
        tileX: 4,
        tileY: 17,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
      {
        id: "wild_slime_5",
        name: "Wild Slime",
        tileX: 19,
        tileY: 18,
        dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
        combat: { maxHp: 45, rewardXp: 20, respawnMs: 8_000 },
      },
    ],
    // Black-zone resources — the richest in the world: clustered gemstone veins,
    // ancient hardwood, and dense iron. High level gates + slow respawns make
    // the full-loot risk worth it. All on solid floor clear of lava + pillars.
    resources: [
      {
        id: "black_gem_1",
        name: "Obsidian Gem Vein",
        tileX: 9,
        tileY: 4,
        kind: "rock",
        mining: {
          rockLevel: 8,
          requiredLevel: 8,
          skillXp: 70,
          respawnMs: 120_000,
          lootItemId: "item_gemstone",
          lootQuantity: 2,
        },
      },
      {
        id: "black_gem_2",
        name: "Obsidian Gem Vein",
        tileX: 15,
        tileY: 4,
        kind: "rock",
        mining: {
          rockLevel: 8,
          requiredLevel: 8,
          skillXp: 70,
          respawnMs: 120_000,
          lootItemId: "item_gemstone",
          lootQuantity: 2,
        },
      },
      {
        id: "black_gem_3",
        name: "Obsidian Gem Vein",
        tileX: 8,
        tileY: 15,
        kind: "rock",
        mining: {
          rockLevel: 8,
          requiredLevel: 8,
          skillXp: 70,
          respawnMs: 120_000,
          lootItemId: "item_gemstone",
          lootQuantity: 2,
        },
      },
      {
        id: "black_iron_1",
        name: "Dense Iron Lode",
        tileX: 15,
        tileY: 15,
        kind: "rock",
        mining: {
          rockLevel: 6,
          requiredLevel: 6,
          skillXp: 44,
          respawnMs: 60_000,
          lootItemId: "item_iron_ore",
          lootQuantity: 3,
        },
      },
      {
        id: "black_hardwood_1",
        name: "Ancient Hardwood",
        tileX: 4,
        tileY: 4,
        kind: "tree",
        woodcutting: {
          treeLevel: 6,
          requiredLevel: 6,
          skillXp: 50,
          respawnMs: 60_000,
          lootItemId: "item_hardwood",
          lootQuantity: 3,
        },
      },
      {
        id: "black_hardwood_2",
        name: "Ancient Hardwood",
        tileX: 20,
        tileY: 4,
        kind: "tree",
        woodcutting: {
          treeLevel: 6,
          requiredLevel: 6,
          skillXp: 50,
          respawnMs: 60_000,
          lootItemId: "item_hardwood",
          lootQuantity: 3,
        },
      },
      {
        id: "black_hardwood_3",
        name: "Ancient Hardwood",
        tileX: 9,
        tileY: 18,
        kind: "tree",
        woodcutting: {
          treeLevel: 6,
          requiredLevel: 6,
          skillXp: 50,
          respawnMs: 60_000,
          lootItemId: "item_hardwood",
          lootQuantity: 3,
        },
      },
    ],
    scenery: [
      { id: "black_lamp_1", tileX: 6, tileY: 6, prop: "lamppost" },
      { id: "black_lamp_2", tileX: 17, tileY: 17, prop: "lamppost" },
      { id: "black_sign", tileX: 3, tileY: 14, prop: "signpost" },
      // Eerie braziers + scorched debris around the obsidian arena.
      { id: "black_lantern_1", tileX: 9, tileY: 5, prop: "lantern" },
      { id: "black_lantern_2", tileX: 15, tileY: 5, prop: "lantern" },
      { id: "black_lantern_3", tileX: 8, tileY: 17, prop: "lantern" }, // was on the Ancient Hardwood's tile
      { id: "black_lantern_4", tileX: 15, tileY: 18, prop: "lantern" },
      { id: "black_crate_1", tileX: 5, tileY: 18, prop: "crate" },
      { id: "black_crate_2", tileX: 18, tileY: 6, prop: "crate" },
    ],
    capturePoints: [
      { id: "black_point_n", name: "Obsidian Throne", tileX: 12, tileY: 8 },
      { id: "black_point_s", name: "Ashen Altar", tileX: 12, tileY: 16 },
    ],
  },
  [ZONE_INTERIOR]: {
    id: ZONE_INTERIOR,
    roomName: ZONE_INTERIOR,
    displayName: "Community Lodge",
    vipMinHold: VIP_LODGE_MIN_HOLD,
    spawnTile: { x: 11, y: 11 },
    portals: [
      {
        tileX: 11,
        tileY: 19,
        targetZone: ZONE_HUB,
        label: "Lodge Exit",
      },
    ],
    npcs: [
      {
        id: "lodge_keeper",
        name: "Hearth",
        tileX: 11,
        tileY: 6,
        dialogue:
          "Welcome to the Community Lodge — a warm place to gather, play the arcade, and try the Blackjack table. Step on the south doormat to head back out.",
      },
    ],
    scenery: [
      // North wall: a fireplace flanked by warm lanterns, bookshelves, plants.
      { id: "lodge_fire", tileX: 11, tileY: 5, prop: "fireplace" },
      { id: "lodge_lantern_l", tileX: 8, tileY: 5, prop: "lantern" },
      { id: "lodge_lantern_r", tileX: 14, tileY: 5, prop: "lantern" },
      { id: "lodge_shelf_l", tileX: 6, tileY: 5, prop: "bookshelf" },
      { id: "lodge_shelf_r", tileX: 16, tileY: 5, prop: "bookshelf" },
      // Corner plants.
      { id: "lodge_plant_nw", tileX: 4, tileY: 4, prop: "plant" },
      { id: "lodge_plant_ne", tileX: 19, tileY: 4, prop: "plant" },
      { id: "lodge_plant_sw", tileX: 4, tileY: 18, prop: "plant" },
      { id: "lodge_plant_se", tileX: 19, tileY: 18, prop: "plant" },
      // The Blackjack table (NW) with two chairs — walk up + interact to play.
      { id: "lodge_blackjack", tileX: 7, tileY: 9, prop: "blackjack", interact: "blackjack", solid: true },
      { id: "lodge_bj_chair_l", tileX: 6, tileY: 10, prop: "chair" },
      { id: "lodge_bj_chair_r", tileX: 8, tileY: 10, prop: "chair" },
      // The Arcade cabinet (NE) — walk up + interact to play Base Rush.
      { id: "lodge_arcade", tileX: 16, tileY: 9, prop: "arcade", interact: "arcade", arcadeUrl: BASE_RUSH_URL, solid: true },
      { id: "lodge_arcade_plant", tileX: 17, tileY: 10, prop: "plant" },
      // West + east storage crates.
      { id: "lodge_crate_w", tileX: 5, tileY: 14, prop: "crate" },
      { id: "lodge_crate_e", tileX: 18, tileY: 14, prop: "crate" },
      // A central rug + an entrance runner leading to the south door.
      { id: "lodge_rug", tileX: 11, tileY: 11, prop: "rug", flat: true },
      { id: "lodge_rug_mid", tileX: 11, tileY: 15, prop: "rug", flat: true },
      { id: "lodge_rug_door", tileX: 11, tileY: 17, prop: "rug", flat: true },
      // A seating nook (SE) round a table.
      { id: "lodge_table_r", tileX: 15, tileY: 14, prop: "table" },
      { id: "lodge_chair_r", tileX: 14, tileY: 14, prop: "chair" },
      { id: "lodge_chair_r2", tileX: 16, tileY: 14, prop: "chair" },
      // Plants flanking the exit doormat.
      { id: "lodge_plant_door_l", tileX: 9, tileY: 18, prop: "plant" },
      { id: "lodge_plant_door_r", tileX: 13, tileY: 18, prop: "plant" },
    ],
  },
  [ZONE_JAIL]: {
    id: ZONE_JAIL,
    roomName: ZONE_JAIL,
    displayName: "Jail",
    spawnTile: { x: 11, y: 10 },
    portals: [
      {
        tileX: 11,
        tileY: 14,
        targetZone: ZONE_HUB,
        label: "Released",
      },
    ],
    npcs: [
      {
        id: "jail_guard",
        name: "Warden",
        tileX: 11,
        tileY: 8,
        dialogue: "Crime doesn't pay. Sit tight — you'll be released when your sentence is up.",
      },
    ],
    scenery: [
      { id: "jail_lamp", tileX: 9, tileY: 8, prop: "lamppost" },
      { id: "jail_crate", tileX: 13, tileY: 12, prop: "crate" },
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

export interface DangerTierMeta {
  tier: DangerTier;
  label: string;
  /** UI accent colour for the zone banner/tint. */
  color: string;
  /** Short rule summary shown to players entering the zone. */
  rule: string;
  /** Whether players can damage each other here. */
  pvp: boolean;
}

export const DANGER_TIER_META: Record<DangerTier, DangerTierMeta> = {
  safe: { tier: "safe", label: "Safe Zone", color: "#6ad27e", rule: "No PvP. Rest easy.", pvp: false },
  yellow: {
    tier: "yellow",
    label: "Yellow Zone",
    color: "#ffce4d",
    rule: "Opt-in PvP. Flag up to fight; small penalty on death.",
    pvp: true,
  },
  red: {
    tier: "red",
    label: "Red Zone",
    color: "#ff7a4d",
    rule: "Open PvP. Drop gathered resources on death — gear survives.",
    pvp: true,
  },
  black: {
    tier: "black",
    label: "Black Zone",
    color: "#b15cff",
    rule: "Full loot. Drop everything on death. Highest rewards.",
    pvp: true,
  },
};

export function getZoneDangerTier(zoneId: string): DangerTier {
  return ZONE_CONFIGS[zoneId]?.dangerTier ?? "safe";
}

export function getDangerTierMeta(zoneId: string): DangerTierMeta {
  return DANGER_TIER_META[getZoneDangerTier(zoneId)];
}