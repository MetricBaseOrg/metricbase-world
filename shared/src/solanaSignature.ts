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
