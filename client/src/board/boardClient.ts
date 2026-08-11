// District Deeds — the /board transport.
//
// Deliberately its OWN manager, not an extension of game/network.ts. That file
// is a 2,800-line singleton holding exactly one Colyseus room, and the board
// needs neither Colyseus nor a second competing socket. A 45-second turn is
// comfortably served by long-poll, and long-poll is what makes surviving a
// server restart tractable: there is no session to lose, just a cursor to
// resume from.
//
// The poll is also the heartbeat. The server reads it as "this seat is still
// here", so a client that stops polling starts a forfeit clock — which is
// exactly the intent.

import { getHttpServerUrl } from "../game/serverUrl";
import type { BoardStatePayload, BoardTableSummary, BoardAction } from "@metricbase/shared";

export interface BoardConfig {
  currencies: string[];
  stakeTiers: Record<string, number[]>;
  seatLimits: Record<string, { min: number; max: number }>;
  moneyEnabled: boolean;
  houseWallet: string | null;
  rpcUrl: string;
  mint: string | null;
  hasWallet: boolean;
  terms: string[];
}

export interface BoardLobby {
  open: BoardTableSummary[];
  mine: BoardTableSummary[];
  invites: { tableId: string; fromName: string }[];
}

export interface BoardApiResult<T = unknown> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

let accessToken = "";

export function setBoardToken(token: string): void {
  accessToken = token;
}

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<BoardApiResult<T>> {
  try {
    const response = await fetch(`${getHttpServerUrl()}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok) {
      return { ok: false, status: response.status, error: json?.error ?? "Something went wrong." };
    }
    return { ok: true, status: response.status, data: json ?? undefined };
  } catch (error) {
    if (signal?.aborted) return { ok: false, status: 0, error: "aborted" };
    return { ok: false, status: 0, error: error instanceof Error ? error.message : "Network error." };
  }
}

// ── config, bank, lobby ─────────────────────────────────────────────────────

export const getBoardConfig = () => call<BoardConfig>("GET", "/board/config");
export const getBoardBank = () => call<{ balances: Record<string, number> }>("GET", "/board/bank");
export const getLobby = () => call<BoardLobby>("GET", "/board/tables");

export const depositToBank = (currencyId: string, signature: string, minUiAmount: number) =>
  call<{ credited: number; balances: Record<string, number> }>("POST", "/board/bank/deposit", {
    currencyId,
    signature,
    minUiAmount,
  });

/** Move gold from the character into the table bank. Works whether or not the
 *  player is currently standing in the world — the server routes it through
 *  ZoneRoom either way, since that owns live gold. */
export const fundGold = (amount: number) =>
  call<{ moved: number; balances: Record<string, number> }>("POST", "/board/bank/fund-gold", {
    amount,
    requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

export const cashOutBank = (currencyId: string, amount: number) =>
  call<{ paid?: number; signature?: string; balances: Record<string, number> }>(
    "POST",
    "/board/bank/cashout",
    { currencyId, amount },
  );

export const createTable = (body: {
  currencyId: string;
  stake: number;
  seatCount: number;
  aiCount: number;
  aiDifficulty: string;
  name: string;
}) => call<{ tableId: string }>("POST", "/board/tables", body);

export const joinTable = (id: string) => call("POST", `/board/tables/${id}/join`);
export const leaveTable = (id: string) => call("POST", `/board/tables/${id}/leave`);
export const setSeed = (id: string, clientSeed: string) => call("POST", `/board/tables/${id}/seed`, { clientSeed });
export const setReady = (id: string, ready: boolean) => call("POST", `/board/tables/${id}/ready`, { ready });
export const invitePlayer = (id: string, toName: string) => call("POST", `/board/tables/${id}/invite`, { toName });
export const startTable = (id: string) => call("POST", `/board/tables/${id}/start`);
export const sendAction = (id: string, action: BoardAction) =>
  call("POST", `/board/tables/${id}/action`, { action });

export interface FairnessPayload {
  tableId: string;
  serverSeedHash: string;
  serverSeed: string | null;
  combinedClientSeed: string | null;
  clientSeeds: { seat: number; name: string; seed: string }[];
  rolls: { nonce: number; d1: number; d2: number; seat: number }[];
}
export const getFairness = (id: string) => call<FairnessPayload>("GET", `/board/tables/${id}/fairness`);

// ── the poll loop ───────────────────────────────────────────────────────────

export interface BoardSubscription {
  stop: () => void;
}

/**
 * Follow one table. Calls `onState` whenever the server's version moves past
 * ours, and keeps re-arming until stopped.
 *
 * Backoff exists because the failure mode that matters is a server restart:
 * every client's poll fails at once, and a tight retry loop from all of them is
 * exactly what a just-booted process does not need. Backs off to 8s, and resets
 * the moment a poll succeeds.
 */
export function subscribeToTable(
  tableId: string,
  onState: (payload: BoardStatePayload) => void,
  onError?: (message: string) => void,
): BoardSubscription {
  let stopped = false;
  let since = 0;
  let backoff = 1000;
  let controller: AbortController | null = null;

  const loop = async () => {
    while (!stopped) {
      controller = new AbortController();
      const result = await call<BoardStatePayload>(
        "GET",
        `/board/tables/${tableId}/state?since=${since}`,
        undefined,
        controller.signal,
      );
      if (stopped) return;

      if (result.ok && result.data) {
        backoff = 1000;
        // A rotated boot id means the server restarted under us. The cursor is
        // still valid (version is persisted), so there is nothing to reset —
        // but the state we get back may be older than what we last saw, so
        // take the server's number rather than assuming ours is ahead.
        since = result.data.version;
        onState(result.data);
        continue;
      }

      if (result.error === "aborted") return;
      if (result.status === 404) {
        onError?.("That table is gone.");
        return;
      }
      if (result.status === 401) {
        onError?.("Your session expired — sign in again.");
        return;
      }
      onError?.(result.error ?? "Lost contact with the table.");
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(8000, backoff * 2);
    }
  };

  void loop();

  return {
    stop: () => {
      stopped = true;
      controller?.abort();
    },
  };
}
