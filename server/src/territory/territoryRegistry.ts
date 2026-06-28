import { deleteTerritory, loadTerritories, saveTerritory } from "../db/territory.js";

// Global point-id -> owning guild-id map, persisted to the DB. Each capture
// point belongs to exactly one zone room, so there's no cross-room contention.
const owners = new Map<string, string>();

export async function initTerritoryRegistry(): Promise<void> {
  owners.clear();
  for (const t of await loadTerritories()) {
    owners.set(t.pointId, t.guildId);
  }
}

export function getTerritoryOwner(pointId: string): string | null {
  return owners.get(pointId) ?? null;
}

export function setTerritoryOwner(pointId: string, zoneId: string, guildId: string): void {
  owners.set(pointId, guildId);
  void saveTerritory({ pointId, zoneId, guildId });
}

export function clearTerritoryOwner(pointId: string): void {
  if (!owners.has(pointId)) return;
  owners.delete(pointId);
  void deleteTerritory(pointId);
}

/** Release every point held by a (disbanded) guild. */
export function releaseGuildTerritories(guildId: string): void {
  for (const [pointId, owner] of owners) {
    if (owner === guildId) clearTerritoryOwner(pointId);
  }
}

/** Count of points a guild currently holds (for income). */
export function ownedPointCount(guildId: string): number {
  let count = 0;
  for (const owner of owners.values()) {
    if (owner === guildId) count++;
  }
  return count;
}
