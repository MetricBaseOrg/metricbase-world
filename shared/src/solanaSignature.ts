// Normalising a transaction signature the way people actually paste one.
//
// Asking a player for a "transaction signature" and then rejecting everything
// except the bare base58 string is a trap: the natural thing to copy is the
// explorer link, because that's the button the explorer gives you. Pasting
// https://solscan.io/tx/<sig> produced a raw RPC error — "Invalid param:
// WrongSize" — which tells the player nothing about what to do differently.
//
// So: accept the link, accept stray whitespace and quotes, and when it still
// isn't a signature say so precisely instead of forwarding it to an RPC that
// can only answer in Solana-speak.

/** Base58 alphabet — no 0, O, I or l. */
const BASE58_ONLY = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** A 64-byte signature is 86-88 base58 characters in practice. */
const MIN_SIGNATURE_CHARS = 84;
const MAX_SIGNATURE_CHARS = 90;

/**
 * Pull a usable signature out of whatever was pasted: a bare signature, an
 * explorer URL (Solscan, Solana Explorer, SolanaFM, XRAY…), or either of those
 * wrapped in quotes/whitespace. Returns "" when nothing usable is left.
 */
export function normalizeTxSignature(raw: string): string {
  let value = (raw ?? "").trim();
  if (!value) return "";

  // Zero-width characters ride along on copies from chat apps and web pages.
  value = value.replace(/[\s​-‍﻿]/g, "");
  // Wrapping quotes/brackets from a code block or a chat quote.
  value = value.replace(/^["'`<([]+/, "").replace(/["'`>)\]]+$/, "");

  // Explorer link → last path segment. Covers /tx/<sig>, /transaction/<sig>,
  // and anything else that puts the signature last, with ?cluster=… stripped.
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const segment = url.pathname.split("/").filter(Boolean).pop();
      value = segment ?? "";
    } catch {
      // Not a parseable URL — fall through and let validation reject it.
    }
  }

  // Sentence punctuation picked up from a message.
  value = value.replace(/[.,;!?]+$/, "");
  return value;
}

/** Whether this looks like a real transaction signature (shape only — the
 * chain is still the authority on whether it exists). */
export function isLikelyTxSignature(value: string): boolean {
  return (
    value.length >= MIN_SIGNATURE_CHARS &&
    value.length <= MAX_SIGNATURE_CHARS &&
    BASE58_ONLY.test(value)
  );
}

/** A specific reason the input isn't usable, or null when it looks fine.
 * Written for the player: name what's wrong AND what to do. */
export function describeSignatureProblem(value: string): string | null {
  if (!value) return "Paste the transaction signature (or its explorer link) first.";
  if (!BASE58_ONLY.test(value)) {
    return "That doesn't look like a transaction signature — it has characters a signature can't contain. Copy the signature (or the explorer link) from your wallet's activity.";
  }
  if (value.length < MIN_SIGNATURE_CHARS) {
    return `That signature looks incomplete — it's ${value.length} characters and should be about 88. Copy the whole thing.`;
  }
  if (value.length > MAX_SIGNATURE_CHARS) {
    return `That's longer than a signature (${value.length} characters). Paste just the signature, or the explorer link to it.`;
  }
  return null;
}

// ── Repairing a signature a WALLET mangled ──────────────────────────────────
//
// Distinct from the paste problem above: this one arrives from our own payment
// code, after the tokens have already moved.
//
// The wallet-standard `signAndSendTransaction` returns `signature` as raw
// bytes, so we base58-encode it. Some wallets instead hand back the base58
// STRING — and some hand back that string's ASCII BYTES. Those are still a
// Uint8Array, so encoding them produces a 119-character value that is perfectly
// valid base58 but decodes to 87 bytes instead of 64. Every RPC then answers
// "Invalid param: WrongSize", which reads like a network fault and is not one:
// the signature never referred to a transaction at all.
//
// Recovery is exact, because the original is still in there — decode the bad
// value and read the bytes back as text.

/** Base58 decode. Local so `shared` keeps no runtime dependency. */
function base58Decode(value: string): Uint8Array | null {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes: number[] = [0];
  for (const char of value) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    let carry = digit;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1's are leading zero bytes.
  for (let k = 0; k < value.length && value[k] === "1"; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

/** Base58 encode. Local so `shared` keeps no runtime dependency. */
function base58Encode(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (let k = 0; k < bytes.length && bytes[k] === 0; k++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}

/** Raw bytes of a 64-byte signature. */
const SIGNATURE_BYTES = 64;

/**
 * Best-effort repair of a signature that our own payment path produced.
 *
 * Returns a usable signature when it can, otherwise whatever normalising left —
 * so the caller still gets to reject it with a real message. NEVER throws: it
 * runs on a path where the player's money has already moved, and losing the
 * signature is the one outcome worse than a bad one.
 */
export function repairTxSignature(raw: string): string {
  const normalized = normalizeTxSignature(raw);
  if (!normalized || isLikelyTxSignature(normalized)) return normalized;

  const decoded = base58Decode(normalized);
  if (!decoded || decoded.length === 0) return normalized;

  // Case 1 — double-encoded: the bytes ARE the text of the real signature.
  try {
    const asText = new TextDecoder().decode(decoded).trim();
    const inner = normalizeTxSignature(asText);
    if (isLikelyTxSignature(inner)) return inner;
  } catch {
    // Not text — fall through.
  }

  // Case 2 — the wallet returned the whole SERIALIZED TRANSACTION instead of
  // the signature. A legacy transaction is laid out as:
  //   [compact-u16 signature count][64-byte signature]...[message]
  // so for the common single-signer case the signature is bytes 1..65. Nothing
  // is guessed at the player's expense: a wrong extraction simply fails
  // verification against the chain, exactly as an unknown signature would.
  if (decoded.length > SIGNATURE_BYTES) {
    const count = decoded[0];
    if (count >= 1 && count <= 8 && decoded.length >= 1 + count * SIGNATURE_BYTES) {
      const candidate = base58Encode(decoded.slice(1, 1 + SIGNATURE_BYTES));
      if (isLikelyTxSignature(candidate)) return candidate;
    }
    // Some bridges drop the count byte and hand back signature-then-message.
    const bare = base58Encode(decoded.slice(0, SIGNATURE_BYTES));
    if (isLikelyTxSignature(bare)) return bare;
  }

  return normalized;
}
