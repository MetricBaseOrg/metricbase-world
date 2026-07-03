import { loadAssetInventory, saveAssetQty } from "../db/assetInventory.js";

// Process-global build-asset inventory: player name -> (assetId -> qty). Bought
// from the Build Shop / P2P, consumed when an asset is placed in a World, and
// returned when it is removed. Persisted so holdings survive restarts.
const inventories = new Map<string, Map<string, number>>();

export async function initAssetInventory(): Promise<void> {
  for (const row of await loadAssetInventory()) {
    let inv = inventories.get(row.playerName);
    if (!inv) inventories.set(row.playerName, (inv = new Map()));
    inv.set(row.assetId, row.qty);
  }
}

/** A player's owned assets as a plain record (only positive counts). */
export function getAssetInventory(playerName: string): Record<string, number> {
  const inv = inventories.get(playerName);
  if (!inv) return {};
  const out: Record<string, number> = {};
  for (const [id, qty] of inv) if (qty > 0) out[id] = qty;
  return out;
}

export function getAssetQty(playerName: string, assetId: string): number {
  return inventories.get(playerName)?.get(assetId) ?? 0;
}

/** Add (or subtract, with a negative delta) assets, clamped at 0. */
export function adjustAsset(playerName: string, assetId: string, delta: number): void {
  if (delta === 0) return;
  let inv = inventories.get(playerName);
  if (!inv) inventories.set(playerName, (inv = new Map()));
  const next = Math.max(0, (inv.get(assetId) ?? 0) + delta);
  inv.set(assetId, next);
  void saveAssetQty(playerName, assetId, next);
}

/** Consume one of an asset if owned; returns true on success. */
export function consumeAsset(playerName: string, assetId: string): boolean {
  const have = getAssetQty(playerName, assetId);
  if (have <= 0) return false;
  adjustAsset(playerName, assetId, -1);
  return true;
}
