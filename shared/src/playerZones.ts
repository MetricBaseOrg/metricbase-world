import type { FarmPlotNode } from "./farming.js";
import type { LandPlotNode } from "./housing.js";
import { makePlayerZoneResource, type ZoneResourceNode } from "./resources.js";
import type { DangerTier, SceneryNode, ZoneConfig, ZonePortal } from "./zones.js";
import {
  isGroundPaintBlocking,
  isZonePropSolid,
  RESOURCE_PROPS,
  WALKWAY_ZONE_PROPS,
  zoneGroundFootprint,
  zonePropFootprint,
} from "./zoneProps.js";

/** Gold cost to buy a blank player-owned zone slot. Paid to the treasury. */
export const ZONE_SLOT_COST = 1_000_000;

/** Base square tile grid for a fresh player zone (same as built-in zones). */
export const PLAYER_ZONE_GRID = 24;

/**
 * World expansion: owners burn $BASE (on-chain, verified) to grow their zone's
 * grid in 3 steps. Each step is pricier than the last; sizes are square.
 */
export interface ZoneExpansionStep {
  /** Grid size (tiles per side) this step unlocks. */
  size: number;
  /** $BASE (UI amount) burned to unlock the step. */
  burnCost: number;
}

export const ZONE_EXPANSIONS: ZoneExpansionStep[] = [
  { size: 28, burnCost: 100_000 },
  { size: 32, burnCost: 250_000 },
  { size: 36, burnCost: 500_000 },
];

export const MAX_ZONE_EXPAND_LEVEL = ZONE_EXPANSIONS.length;

/** Grid size (tiles per side) for an expansion level (0 = base 24). */
export function zoneGridSize(expandLevel: number): number {
  if (!Number.isFinite(expandLevel) || expandLevel <= 0) return PLAYER_ZONE_GRID;
  return ZONE_EXPANSIONS[Math.min(MAX_ZONE_EXPAND_LEVEL, Math.floor(expandLevel)) - 1].size;
}

/** The next expansion step available at a level, or null when maxed. */
export function nextZoneExpansion(expandLevel: number): ZoneExpansionStep | null {
  return expandLevel >= MAX_ZONE_EXPAND_LEVEL ? null : ZONE_EXPANSIONS[Math.max(0, Math.floor(expandLevel))];
}

/** Prefix for generated player-zone ids (also the DB primary key). */
export const PLAYER_ZONE_PREFIX = "pz_";

/** Single Colyseus room type that serves every player-owned zone. */
export const PLAYER_ZONE_ROOM = "player_zone";

/** Bounds on a visitor pass price (gold). 0 = free to enter. */
export const MIN_ZONE_PASS_PRICE = 0;
export const MAX_ZONE_PASS_PRICE = 100_000;

/** How long a purchased visitor pass grants access. */
export const ZONE_PASS_DAYS = 7;
export const ZONE_PASS_MS = ZONE_PASS_DAYS * 24 * 60 * 60 * 1000;

/** Caps that keep a single build bounded (anti-abuse + render budget). */
export const MAX_ZONE_SCENERY = 120;
export const MAX_ZONE_LAND_PLOTS = 12;
export const MAX_ZONE_FARM_PLOTS = 16;
export const MAX_ZONE_RESOURCES = 24;
export const MAX_ZONE_PAINTED_TILES = PLAYER_ZONE_GRID * PLAYER_ZONE_GRID;

export const MAX_ZONE_NAME_LENGTH = 24;

/** A single ground-tile paint override (grass/water/soil/etc.). */
export interface ZoneTilePaint {
  x: number;
  y: number;
  /** Tile palette type — matches the ground textures the client understands. */
  type: string;
}

/** The buildable contents of a player zone — everything an owner can place. */
export interface PlayerZoneBuild {
  spawnTile: { x: number; y: number };
  scenery: SceneryNode[];
  landPlots: LandPlotNode[];
  farmPlots: FarmPlotNode[];
  resources: ZoneResourceNode[];
  /** Sparse ground-paint overrides; unlisted tiles fall back to the base map. */
  tiles: ZoneTilePaint[];
}

/** Ownership + listing metadata for a player zone (everything but the build). */
export interface PlayerZoneMeta {
  zoneId: string;
  ownerWallet: string | null;
  ownerName: string;
  displayName: string;
  /** Gold charged to visitors for a pass (0 = free). */
  passPrice: number;
  /** Only published zones appear in the Worlds directory / accept visitors. */
  published: boolean;
  /** Uncollected gold earned from pass sales + gather tax, withdrawable. */
  earnings: number;
  /** Lifetime visitor entries (unique per visitor per day), for the directory. */
  visits: number;
  /** Percent of a visitor's haul value (Pip prices) paid to the owner per gather (0 = free). */
  gatherTax: number;
  /** Lifetime passes purchased. */
  passesSold: number;
  /** Lifetime gold earned from pass sales. */
  passGold: number;
  /** Lifetime gold earned from gather tax. */
  taxGold: number;
  /** Lifetime gold earned in total (pass + tax), never reset by collection. */
  lifetimeEarnings: number;
  /** Founding time (epoch ms), for "New" sorting in the directory. */
  createdAt: number;
  /** Expansion steps purchased (0 = base 24×24; see ZONE_EXPANSIONS). */
  expandLevel: number;
  /** PvP danger tier the owner set (safe/yellow/red/black; default safe). */
  dangerTier: DangerTier;
}

/** Danger tiers an owner may set on their World, easiest → deadliest. */
export const PLAYER_ZONE_DANGER_TIERS: DangerTier[] = ["safe", "yellow", "red", "black"];

export function normalizePlayerZoneTier(tier: unknown): DangerTier {
  return PLAYER_ZONE_DANGER_TIERS.includes(tier as DangerTier) ? (tier as DangerTier) : "safe";
}

/**
 * Bound on the gather tax an owner can charge, as a PERCENT of the value the
 * visitor earned (the haul's Pip sell value). Legacy zones stored a flat gold
 * fee up to 1,000 — those are clamped to this cap at load.
 */
export const MAX_GATHER_TAX = 25;

/** Gold owed for one gather: `taxPct`% of the haul's shop value, rounded. */
export function gatherTaxGold(taxPct: number, haulValueGold: number): number {
  if (!Number.isFinite(taxPct) || taxPct <= 0 || haulValueGold <= 0) return 0;
  return Math.round((Math.min(MAX_GATHER_TAX, taxPct) / 100) * haulValueGold);
}

/** A full player-zone record: metadata plus its build. */
export interface PlayerZoneRecord extends PlayerZoneMeta {
  build: PlayerZoneBuild;
}

/**
 * True when a tile is unwalkable within a build: covered by a solid prop's
 * footprint, or by blocking ground paint (river) with no walkway (bridge) over
 * it. Used to keep the visitor spawn tile walkable on both client and server.
 */
export function isBuildTileBlocked(build: PlayerZoneBuild, x: number, y: number): boolean {
  const covers = (tileX: number, tileY: number, n: number) => x >= tileX && x < tileX + n && y >= tileY && y < tileY + n;
  for (const s of build.scenery) {
    if (isZonePropSolid(s.prop) && covers(s.tileX, s.tileY, zonePropFootprint(s.prop))) return true;
  }
  let inRiver = false;
  for (const t of build.tiles) {
    if (isGroundPaintBlocking(t.type) && covers(t.x, t.y, zoneGroundFootprint(t.type))) {
      inRiver = true;
      break;
    }
  }
  if (!inRiver) return false;
  for (const s of build.scenery) {
    if (WALKWAY_ZONE_PROPS.has(s.prop) && covers(s.tileX, s.tileY, zonePropFootprint(s.prop))) return false;
  }
  return true;
}

/** A fresh, empty build centred on a default spawn. */
export function emptyPlayerZoneBuild(): PlayerZoneBuild {
  const mid = Math.floor(PLAYER_ZONE_GRID / 2);
  return {
    spawnTile: { x: mid, y: mid },
    scenery: [],
    landPlots: [],
    farmPlots: [],
    resources: [],
    tiles: [],
  };
}

/**
 * Placeable mob dens: scenery props that become live combat NPCs in the zone.
 * Dens grant XP + loot only (no direct gold) so player Worlds can't be farmed
 * as an infinite gold faucet — slime gel/cores still sell at the shop.
 */
export const MOB_DENS: Record<
  string,
  { name: string; maxHp: number; rewardXp: number; respawnMs: number; dialogue: string }
> = {
  "slime-den": {
    name: "Wild Slime",
    maxHp: 45,
    rewardXp: 20,
    respawnMs: 12_000,
    dialogue: "Gloop! A squishy slime. Easier than the dummy, but still fights back.",
  },
  "brute-den": {
    name: "Slime Brute",
    maxHp: 150,
    rewardXp: 55,
    respawnMs: 25_000,
    dialogue: "GLORP! A massive slime guards this den.",
  },
};

/** Prefix on npc ids derived from placed mob dens (also keys their rewards). */
export const PZ_MOB_PREFIX = "pzmob_";

/** Portal that always returns a visitor from a player zone back to the Hub. */
export function playerZoneExitPortal(gridSize = PLAYER_ZONE_GRID): ZonePortal {
  return { tileX: 1, tileY: Math.floor(gridSize / 2), targetZone: "zone_hub", label: "Leave World" };
}

/**
 * Project a player-zone record into a runtime {@link ZoneConfig} the ZoneRoom
 * can consume. Player zones are always "safe" tier and carry a single exit
 * portal back to the Hub; the rest of the layout comes from the owner's build.
 */
export function playerZoneToConfig(record: PlayerZoneRecord): ZoneConfig {
  const build = record.build;
  const gridSize = zoneGridSize(record.expandLevel);
  // Every painted SOIL tile is a working farm plot: plant any seed (wheat,
  // carrot, future crops) and harvest. Ids are derived from the tile position
  // so farm state stays attached to the tile across saves.
  const soilPlots = (build.tiles ?? [])
    .filter((t) => t.type === "soil")
    .map((t) => ({ id: `soil_${t.x}_${t.y}`, tileX: t.x, tileY: t.y }));
  // Derived soil plots are NOT part of the stored build — but the editor once
  // copied them into drafts, so older saves may contain them. Strip them here
  // (they re-derive from the painted tiles) so they can never duplicate.
  const ownFarmPlots = build.farmPlots.filter((p) => !p.id.startsWith("soil_"));
  // LEGACY MIGRATION: early Worlds stored gather nodes (trees/rocks/ponds) as
  // plain scenery, which rendered but couldn't be gathered. Derive real
  // resource nodes from them and drop them from the scenery list; the next
  // build save persists them properly.
  const legacyResources = build.scenery
    .filter((s) => RESOURCE_PROPS[s.prop])
    .map((s) => {
      const def = RESOURCE_PROPS[s.prop];
      return makePlayerZoneResource(`sres_${s.id}`, s.prop, def.kind, def.label, s.tileX, s.tileY);
    });
  const scenery = build.scenery.filter((s) => !RESOURCE_PROPS[s.prop]);
  // Placed mob dens become real combat NPCs (id prefix keys their rewards).
  const mobs = build.scenery
    .filter((s) => MOB_DENS[s.prop])
    .map((s) => {
      const den = MOB_DENS[s.prop];
      return {
        id: `${PZ_MOB_PREFIX}${s.prop}_${s.id}`,
        name: den.name,
        tileX: s.tileX,
        tileY: s.tileY,
        dialogue: den.dialogue,
        combat: { maxHp: den.maxHp, rewardXp: den.rewardXp, respawnMs: den.respawnMs },
      };
    });
  return {
    id: record.zoneId,
    roomName: PLAYER_ZONE_ROOM,
    displayName: record.displayName,
    dangerTier: normalizePlayerZoneTier(record.dangerTier),
    spawnTile: build.spawnTile,
    portals: [playerZoneExitPortal(gridSize)],
    npcs: mobs,
    resources: [...build.resources, ...legacyResources],
    farmPlots: [...ownFarmPlots, ...soilPlots],
    landPlots: build.landPlots,
    scenery,
    tiles: build.tiles,
    gridSize,
  };
}
