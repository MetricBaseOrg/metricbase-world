// District Deeds — the committed seed chain behind every roll.
//
// See shared/src/boardFairness.ts for the protocol and the reasoning. This is
// the server half: it holds the secret seed, produces rolls, and (once a table
// has ended) hands over everything needed to check them.
//
// The nonce is the load-bearing detail. `makeRandom` starts from the table's
// persisted nonce and the caller writes `rand.nonce` back in the SAME
// transaction as the resulting state. If that ever came apart — state saved,
// nonce not — a crash could let the same nonce produce a second, different
// roll, and the published log would no longer match the board.

import { createHash, createHmac, randomBytes } from "node:crypto";

import {
  boardCombinedSeedInput,
  boardDrawMessage,
  boardRollMessage,
  diceFromDigest,
  indexFromDigest,
  type BoardFairnessRoll,
} from "@metricbase/shared";

import type { BoardRandom } from "./rules.js";

/** A fresh 32-byte secret seed, hex. One per table, never reused. */
export function newSeed(): string {
  return randomBytes(32).toString("hex");
}

/** The commitment published before anyone plays. */
export function commit(seed: string): string {
  return createHash("sha256").update(seed, "utf8").digest("hex");
}

/** Frozen at table start from every seat's client seed. */
export function combineClientSeeds(clientSeeds: string[]): string {
  return createHash("sha256").update(boardCombinedSeedInput(clientSeeds), "utf8").digest("hex");
}

function digest(serverSeed: string, message: string): Uint8Array {
  return new Uint8Array(createHmac("sha256", serverSeed).update(message, "utf8").digest());
}

/** The dice for one nonce. Pure given the seed chain — this is the function a
 *  player re-runs in their browser after the reveal. */
export function rollAt(
  serverSeed: string,
  tableId: string,
  combinedClientSeed: string,
  nonce: number,
): [number, number] {
  return diceFromDigest(digest(serverSeed, boardRollMessage(tableId, combinedClientSeed, nonce)));
}

/** A uniform index for one nonce (card draws and deck shuffles). */
export function indexAt(
  serverSeed: string,
  tableId: string,
  combinedClientSeed: string,
  nonce: number,
  size: number,
): number {
  return indexFromDigest(digest(serverSeed, boardDrawMessage(tableId, combinedClientSeed, nonce)), size);
}

export interface BoardRandomSource extends BoardRandom {
  /** Dice produced during this action, for appending to the published log. */
  readonly rolls: BoardFairnessRoll[];
}

/**
 * Bind the seed chain to a rules-engine `BoardRandom`, starting at
 * `startNonce`. `seatForLog` is stamped onto each roll so the published log
 * says who rolled what.
 */
export function makeRandom(
  serverSeed: string,
  tableId: string,
  combinedClientSeed: string,
  startNonce: number,
  seatForLog = -1,
): BoardRandomSource {
  let nonce = startNonce;
  const rolls: BoardFairnessRoll[] = [];
  return {
    dice(): [number, number] {
      const n = nonce++;
      const [d1, d2] = rollAt(serverSeed, tableId, combinedClientSeed, n);
      rolls.push({ nonce: n, d1, d2, seat: seatForLog });
      return [d1, d2];
    },
    index(size: number): number {
      const n = nonce++;
      return indexAt(serverSeed, tableId, combinedClientSeed, n, size);
    },
    get nonce() {
      return nonce;
    },
    get rolls() {
      return rolls;
    },
  };
}

/**
 * Independent re-derivation of a published roll log. Used by the verification
 * script and by the ops console; the browser does the same thing with
 * WebCrypto so a player never has to take our word for it.
 */
export function verifyRolls(
  serverSeed: string,
  serverSeedHash: string,
  tableId: string,
  combinedClientSeed: string,
  rolls: BoardFairnessRoll[],
): { ok: boolean; badNonce?: number; hashOk: boolean } {
  const hashOk = commit(serverSeed) === serverSeedHash;
  for (const r of rolls) {
    const [d1, d2] = rollAt(serverSeed, tableId, combinedClientSeed, r.nonce);
    if (d1 !== r.d1 || d2 !== r.d2) return { ok: false, badNonce: r.nonce, hashOk };
  }
  return { ok: hashOk, hashOk };
}
