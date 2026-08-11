// District Deeds — the provably-fair roll specification.
//
// This module is the SINGLE definition of how a roll is derived from the seed
// chain. The server produces rolls with it; the client re-derives every roll
// with it after the seed is revealed. Both sides supply HMAC-SHA256 and SHA-256
// from their own platform (node:crypto / WebCrypto) — only the *mapping* and
// the *message format* live here, so there is exactly one spec and no way for
// the two implementations to drift.
//
// Why this exists: crypto-strength randomness is not the same as VERIFIABLE
// randomness. A player who loses a real stake has no way to check a server-side
// randomInt(). Commit-reveal gives them one.
//
// The protocol:
//   1. COMMIT   — at table creation the server generates a 32-byte serverSeed,
//                 publishes sha256(serverSeed), and does not reveal the seed
//                 while the table is live.
//   2. SEEDS    — each seat submits a clientSeed before the table starts; all
//                 are published to all seats. Because the server committed
//                 FIRST, it cannot grind a serverSeed against known client
//                 seeds.
//   3. FREEZE   — at start the client seeds are combined and frozen.
//   4. ROLL     — roll N = HMAC_SHA256(serverSeed, rollMessage(...N)), mapped
//                 to dice by rejection sampling. The nonce is persisted in the
//                 same transaction as the resulting state, so a roll can never
//                 be silently re-taken.
//   5. REVEAL   — when the table ends, the serverSeed is published. Anyone can
//                 recompute every roll and check sha256(serverSeed) matches the
//                 hash committed at step 1.

/** Human-readable spec, shown in the Fairness panel next to the verifier. */
export const BOARD_FAIRNESS_SPEC = [
  "Before the table opened, the server generated a secret seed and published its SHA-256 hash.",
  "Every player added their own seed. The server was already committed, so it could not choose its seed to suit anyone's.",
  "Each roll N = HMAC-SHA256(secret seed, \"<table>:<combined player seeds>:<N>\"), read one byte at a time.",
  "Bytes of 252 or higher are skipped, so all six faces are exactly equally likely — taking a raw byte modulo 6 would very slightly favour 1 and 2.",
  "When the table ended the secret seed was published. Hash it yourself: it must match the hash from step one, and every roll must recompute exactly.",
] as const;

/** The string whose HMAC produces roll `nonce`. Colons are safe separators
 *  because table ids are hex and seeds are hashes. */
export function boardRollMessage(tableId: string, combinedClientSeed: string, nonce: number): string {
  return `${tableId}:${combinedClientSeed}:${nonce}`;
}

/** Card draws consume the same chain at a distinct sub-message, so a card draw
 *  can never collide with the dice for the same nonce. */
export function boardDrawMessage(tableId: string, combinedClientSeed: string, nonce: number): string {
  return `${tableId}:${combinedClientSeed}:${nonce}:card`;
}

/** The exact string that gets SHA-256'd to produce the combined client seed.
 *  Sorted so seat order cannot change the result. */
export function boardCombinedSeedInput(clientSeeds: string[]): string {
  return [...clientSeeds].sort().join("|");
}

/** Highest byte value usable for a fair 1–6 mapping: 252 = 6 × 42, so bytes
 *  0..251 cover each face exactly 42 times. Bytes 252..255 are discarded. */
export const BOARD_DIE_REJECT_AT = 252;

/**
 * Two dice from an HMAC digest, by rejection sampling.
 *
 * `byte % 6` is NOT uniform — 256 = 6×42 + 4, so faces 1 and 2 would come up
 * 43/256 of the time against 42/256 for the rest. That is a ~2% bias, small
 * enough to never notice in play and exactly the kind of thing someone
 * checking a real-stake game will find. Skipping the four overflow values
 * removes it completely.
 */
export function diceFromDigest(bytes: Uint8Array): [number, number] {
  const out: number[] = [];
  for (let i = 0; i < bytes.length && out.length < 2; i++) {
    const b = bytes[i];
    if (b < BOARD_DIE_REJECT_AT) out.push((b % 6) + 1);
  }
  if (out.length < 2) {
    // A 32-byte digest yields fewer than two usable bytes with probability
    // below 2^-100. Throwing is correct: silently reusing a byte would be a
    // real (if astronomically rare) bias.
    throw new Error("board: digest exhausted deriving dice");
  }
  return [out[0], out[1]];
}

/** Uniform index in [0, size) from a digest, same rejection principle. */
export function indexFromDigest(bytes: Uint8Array, size: number): number {
  if (size <= 0) throw new Error("board: index size must be positive");
  if (size === 1) return 0;
  const limit = Math.floor(256 / size) * size;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] < limit) return bytes[i] % size;
  }
  throw new Error("board: digest exhausted deriving index");
}

/** Hex string → bytes. Used by the browser verifier. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("board: odd-length hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Bytes → hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

/** One entry of the published roll log. */
export interface BoardFairnessRoll {
  nonce: number;
  d1: number;
  d2: number;
  seat: number;
}

/** What GET /api/board/tables/:id/fairness returns. `serverSeed` is null until
 *  the table has ended — serving it earlier would let a seated player predict
 *  every remaining roll. */
export interface BoardFairnessPayload {
  tableId: string;
  serverSeedHash: string;
  serverSeed: string | null;
  combinedClientSeed: string | null;
  clientSeeds: { seat: number; name: string; seed: string }[];
  rolls: BoardFairnessRoll[];
}
