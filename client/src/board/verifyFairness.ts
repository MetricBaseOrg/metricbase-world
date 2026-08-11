// District Deeds — in-browser verification of a published roll log.
//
// The point of commit-reveal is that the player does not have to take our word
// for anything, so this recomputes every roll locally from the revealed seed
// using WebCrypto. It shares `boardRollMessage` and `diceFromDigest` with the
// server through @metricbase/shared, so there is exactly one definition of the
// mapping and the two implementations cannot drift.

import { boardRollMessage, bytesToHex, diceFromDigest } from "@metricbase/shared";

import type { FairnessPayload } from "./boardClient";

export interface RollCheck {
  nonce: number;
  seat: number;
  published: [number, number];
  computed: [number, number];
  matches: boolean;
}

export interface FairnessVerdict {
  /** sha256(revealed seed) === the hash published before anyone played. */
  hashMatches: boolean;
  publishedHash: string;
  computedHash: string;
  rolls: RollCheck[];
  allRollsMatch: boolean;
  /** Null while the table is still live — the seed is withheld on purpose. */
  ready: boolean;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

async function hmac(keyText: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

export async function verifyFairness(payload: FairnessPayload): Promise<FairnessVerdict> {
  if (!payload.serverSeed || !payload.combinedClientSeed) {
    return {
      ready: false,
      hashMatches: false,
      publishedHash: payload.serverSeedHash,
      computedHash: "",
      rolls: [],
      allRollsMatch: false,
    };
  }

  const computedHash = await sha256Hex(payload.serverSeed);
  const rolls: RollCheck[] = [];

  for (const roll of payload.rolls) {
    const digest = await hmac(
      payload.serverSeed,
      boardRollMessage(payload.tableId, payload.combinedClientSeed, roll.nonce),
    );
    let computed: [number, number];
    try {
      computed = diceFromDigest(digest);
    } catch {
      computed = [0, 0];
    }
    rolls.push({
      nonce: roll.nonce,
      seat: roll.seat,
      published: [roll.d1, roll.d2],
      computed,
      matches: computed[0] === roll.d1 && computed[1] === roll.d2,
    });
  }

  return {
    ready: true,
    hashMatches: computedHash === payload.serverSeedHash,
    publishedHash: payload.serverSeedHash,
    computedHash,
    rolls,
    allRollsMatch: rolls.every((r) => r.matches),
  };
}
