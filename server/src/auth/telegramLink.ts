import crypto from "node:crypto";

/**
 * Short-lived codes for linking a Telegram account to an existing wallet
 * account.
 *
 * WHY A CODE AND NOT ONE REQUEST: linking needs proof of BOTH identities, and
 * they can never be proven in the same place. Inside Telegram the page has
 * signed initData but no wallet provider; inside a wallet's in-app browser it
 * has the wallet but no Telegram data. So Telegram proof is exchanged for a
 * code in one context, and redeemed against a wallet session in the other —
 * the same pattern Discord uses.
 *
 * In-memory on purpose: these live minutes, and a server restart invalidating
 * them is the safe failure (the player just generates another).
 */

interface PendingLink {
  telegramUserId: number;
  telegramUsername?: string;
  expiresAt: number;
}

const LINK_CODE_TTL_MS = 10 * 60 * 1000;
/** No 0/O/1/I — these get read off one screen and typed into another. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const pending = new Map<string, PendingLink>();

function sweepExpired(): void {
  const now = Date.now();
  for (const [code, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(code);
  }
}

/** Mint a code for a VERIFIED Telegram user. Caller must have checked initData. */
export function createLinkCode(telegramUserId: number, telegramUsername?: string): {
  code: string;
  expiresAt: number;
} {
  sweepExpired();

  // One live code per Telegram user: generating a new one retires the old, so a
  // code read off a screen earlier can't be redeemed later.
  for (const [code, entry] of pending) {
    if (entry.telegramUserId === telegramUserId) pending.delete(code);
  }

  let code = "";
  do {
    code = Array.from(crypto.randomBytes(CODE_LENGTH))
      .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
      .join("");
  } while (pending.has(code));

  const expiresAt = Date.now() + LINK_CODE_TTL_MS;
  pending.set(code, { telegramUserId, telegramUsername, expiresAt });
  return { code, expiresAt };
}

/**
 * Redeem a code. Single-use: consumed whether or not the caller goes on to
 * link successfully, so a leaked code can't be replayed.
 */
export function consumeLinkCode(rawCode: string): PendingLink | null {
  sweepExpired();
  const code = String(rawCode ?? "").trim().toUpperCase();
  if (!code) return null;
  const entry = pending.get(code);
  if (!entry) return null;
  pending.delete(code);
  return entry.expiresAt > Date.now() ? entry : null;
}
