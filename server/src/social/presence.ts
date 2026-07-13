// Cross-room presence: lets one zone room deliver a message to a specific
// online player no matter which zone room they're currently in. Used by guild
// and party chat / invites. All rooms run in one process, so a simple in-memory
// name -> sender map suffices.

type Send = (type: string, payload: unknown) => void;

interface Entry {
  /** The owning client, used to guard against stale removals on zone transfer. */
  client: unknown;
  send: Send;
}

const online = new Map<string, Entry>();

export function setOnline(name: string, client: unknown, send: Send): void {
  online.set(name, { client, send });
}

/** Remove a player's presence, but only if the entry still belongs to `client`
 * (so a zone transfer's late onLeave doesn't clobber the new room's entry). */
export function clearOnline(name: string, client: unknown): void {
  const entry = online.get(name);
  if (entry && entry.client === client) {
    online.delete(name);
  }
}

export function isOnline(name: string): boolean {
  return online.has(name);
}

/** Send a message to one online player. Returns false if they're offline. */
export function sendToPlayer(name: string, type: string, payload: unknown): boolean {
  const entry = online.get(name);
  if (!entry) return false;
  entry.send(type, payload);
  return true;
}

/** Force-disconnect one online player (admin ban). Returns false if offline. */
export function kickPlayer(name: string): boolean {
  const entry = online.get(name);
  if (!entry) return false;
  try {
    (entry.client as { leave?: (code?: number) => void }).leave?.(4402);
  } catch {
    /* connection already closing */
  }
  return true;
}

/** Send a message to every online player in `names`. Returns how many got it. */
export function sendToPlayers(names: Iterable<string>, type: string, payload: unknown): number {
  let delivered = 0;
  for (const name of names) {
    if (sendToPlayer(name, type, payload)) delivered++;
  }
  return delivered;
}
