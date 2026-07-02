import {
  emptyPlayerZoneBuild,
  MAX_ZONE_FARM_PLOTS,
  MAX_ZONE_LAND_PLOTS,
  MAX_ZONE_NAME_LENGTH,
  MAX_ZONE_PAINTED_TILES,
  MAX_ZONE_PASS_PRICE,
  MAX_ZONE_RESOURCES,
  MAX_ZONE_SCENERY,
  MIN_ZONE_PASS_PRICE,
  PLAYER_ZONE_GRID,
  PLAYER_ZONE_PREFIX,
  type PlayerZoneBuild,
  type PlayerZoneRecord,
} from "@metricbase/shared";
import {
  loadPlayerZones,
  loadZonePasses,
  savePlayerZone,
  saveZonePass,
  type StoredZonePass,
} from "../db/playerZones.js";

// Process-global registry of player-owned zones + visitor passes, shared across
// rooms and persisted so builds and access survive restarts. Mirrors the shape
// of housing/landRegistry.
const zones = new Map<string, PlayerZoneRecord>();
const passes = new Map<string, StoredZonePass>(); // key: `${zoneId}|${holderName}`

const passKey = (zoneId: string, holderName: string) => `${zoneId}|${holderName}`;

export async function initZoneRegistry(): Promise<void> {
  for (const zone of await loadPlayerZones()) zones.set(zone.zoneId, zone);
  for (const pass of await loadZonePasses()) passes.set(passKey(pass.zoneId, pass.holderName), pass);
}

export function getPlayerZone(zoneId: string): PlayerZoneRecord | undefined {
  return zones.get(zoneId);
}

export function isPlayerZoneId(zoneId: string): boolean {
  return zoneId.startsWith(PLAYER_ZONE_PREFIX);
}

/** Zones owned by a given player (by name), for the management UI. */
export function getZonesOwnedBy(ownerName: string): PlayerZoneRecord[] {
  return [...zones.values()].filter((z) => z.ownerName === ownerName);
}

/** Published zones for the Worlds directory, most-visited first. */
export function getPublishedZones(): PlayerZoneRecord[] {
  return [...zones.values()].filter((z) => z.published).sort((a, b) => b.visits - a.visits);
}

function generateZoneId(): string {
  return `${PLAYER_ZONE_PREFIX}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Create a fresh, empty, unpublished zone owned by the buyer. */
export function createPlayerZone(ownerName: string, ownerWallet: string | null): PlayerZoneRecord {
  let zoneId = generateZoneId();
  while (zones.has(zoneId)) zoneId = generateZoneId();
  const record: PlayerZoneRecord = {
    zoneId,
    ownerWallet,
    ownerName,
    displayName: `${ownerName}'s World`.slice(0, MAX_ZONE_NAME_LENGTH),
    passPrice: 0,
    published: false,
    earnings: 0,
    visits: 0,
    build: emptyPlayerZoneBuild(),
  };
  zones.set(zoneId, record);
  void savePlayerZone(record);
  return record;
}

const inBounds = (x: number, y: number) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < PLAYER_ZONE_GRID && y >= 0 && y < PLAYER_ZONE_GRID;

/**
 * Validate + clamp an owner-submitted build. Returns a sanitized build, or an
 * error string if it violates a hard cap. Never trusts client-supplied ids.
 */
export function sanitizeBuild(input: unknown): { build?: PlayerZoneBuild; error?: string } {
  const base = emptyPlayerZoneBuild();
  if (!input || typeof input !== "object") return { error: "Invalid build." };
  const v = input as Partial<PlayerZoneBuild>;

  const spawn =
    v.spawnTile && inBounds(v.spawnTile.x, v.spawnTile.y) ? { x: v.spawnTile.x, y: v.spawnTile.y } : base.spawnTile;

  const scenery = (Array.isArray(v.scenery) ? v.scenery : []).filter((s) => s && inBounds(s.tileX, s.tileY));
  if (scenery.length > MAX_ZONE_SCENERY) return { error: `Too many props (max ${MAX_ZONE_SCENERY}).` };

  const landPlots = (Array.isArray(v.landPlots) ? v.landPlots : []).filter((p) => p && inBounds(p.tileX, p.tileY));
  if (landPlots.length > MAX_ZONE_LAND_PLOTS) return { error: `Too many building plots (max ${MAX_ZONE_LAND_PLOTS}).` };

  const farmPlots = (Array.isArray(v.farmPlots) ? v.farmPlots : []).filter((p) => p && inBounds(p.tileX, p.tileY));
  if (farmPlots.length > MAX_ZONE_FARM_PLOTS) return { error: `Too many farm plots (max ${MAX_ZONE_FARM_PLOTS}).` };

  const resources = (Array.isArray(v.resources) ? v.resources : []).filter((r) => r && inBounds(r.tileX, r.tileY));
  if (resources.length > MAX_ZONE_RESOURCES) return { error: `Too many resource nodes (max ${MAX_ZONE_RESOURCES}).` };

  const tiles = (Array.isArray(v.tiles) ? v.tiles : []).filter((t) => t && inBounds(t.x, t.y));
  if (tiles.length > MAX_ZONE_PAINTED_TILES) return { error: "Too many painted tiles." };

  return { build: { spawnTile: spawn, scenery, landPlots, farmPlots, resources, tiles } };
}

/** Replace a zone's build (owner-only; caller checks ownership). */
export function setZoneBuild(zoneId: string, build: PlayerZoneBuild): void {
  const zone = zones.get(zoneId);
  if (!zone) return;
  zone.build = build;
  void savePlayerZone(zone);
}

/** Update listing metadata (name/price/published) on a zone. */
export function setZoneMeta(
  zoneId: string,
  patch: { displayName?: string; passPrice?: number; published?: boolean },
): void {
  const zone = zones.get(zoneId);
  if (!zone) return;
  if (typeof patch.displayName === "string") {
    zone.displayName = patch.displayName.trim().slice(0, MAX_ZONE_NAME_LENGTH) || zone.displayName;
  }
  if (typeof patch.passPrice === "number" && Number.isFinite(patch.passPrice)) {
    zone.passPrice = Math.max(MIN_ZONE_PASS_PRICE, Math.min(MAX_ZONE_PASS_PRICE, Math.floor(patch.passPrice)));
  }
  if (typeof patch.published === "boolean") zone.published = patch.published;
  void savePlayerZone(zone);
}

/** Credit gold earned from a pass sale to the owner's withdrawable balance. */
export function addZoneEarnings(zoneId: string, gold: number): void {
  const zone = zones.get(zoneId);
  if (!zone || gold <= 0) return;
  zone.earnings += Math.floor(gold);
  zone.visits += 1;
  void savePlayerZone(zone);
}

/** Zero-out and return an owner's uncollected earnings for withdrawal. */
export function collectZoneEarnings(zoneId: string): number {
  const zone = zones.get(zoneId);
  if (!zone || zone.earnings <= 0) return 0;
  const amount = zone.earnings;
  zone.earnings = 0;
  void savePlayerZone(zone);
  return amount;
}

/** Grant a visitor pass to a player until `expiresAt` (epoch ms). */
export function grantZonePass(zoneId: string, holderName: string, expiresAt: number): void {
  const pass: StoredZonePass = { zoneId, holderName, expiresAt };
  passes.set(passKey(zoneId, holderName), pass);
  void saveZonePass(pass);
}

/** True if a player may currently enter a zone (owner, free, or valid pass). */
export function canEnterZone(zoneId: string, playerName: string, now = Date.now()): boolean {
  const zone = zones.get(zoneId);
  if (!zone) return false;
  if (zone.ownerName === playerName) return true;
  if (zone.passPrice <= 0) return true;
  const pass = passes.get(passKey(zoneId, playerName));
  return Boolean(pass && pass.expiresAt > now);
}
