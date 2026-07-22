import crypto from "node:crypto";

/**
 * Telegram Mini App login.
 *
 * Telegram hands the page an `initData` query string describing the user. It is
 * CLIENT-SUPPLIED and therefore worthless on its own — anyone can POST any user
 * id. It is trustworthy only after verifying the HMAC that Telegram computed
 * with the bot token, which is why TELEGRAM_BOT_TOKEN is required for Telegram
 * login to work at all: without it we cannot tell a real Telegram user from a
 * forged one, so we refuse rather than trust.
 *
 * Algorithm (Telegram "Validating data received via the Mini App"):
 *   secret     = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *   check_str  = all fields except `hash`, as "k=v", sorted by key, joined "\n"
 *   expected   = HMAC_SHA256(key=secret, msg=check_str)  -> hex
 */

/** How old an initData payload may be. Telegram stamps auth_date at launch;
 *  bounding it stops a captured payload being replayed indefinitely. */
const MAX_AUTH_AGE_MS = 24 * 60 * 60 * 1000;

export interface TelegramUser {
  id: number;
  username?: string;
  firstName?: string;
}

export function isTelegramLoginConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/**
 * Verify an initData string and return the user it describes.
 * Returns null for ANY failure (unconfigured, malformed, bad HMAC, stale) —
 * callers must treat null as "not authenticated" and never fall back to
 * trusting the raw payload.
 */
export function verifyTelegramInitData(initData: string): TelegramUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !initData) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get("hash");
  if (!hash) return null;

  // Every field EXCEPT hash participates, sorted by key.
  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const checkString = pairs.join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  // Timing-safe compare; equal length is required by timingSafeEqual itself.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // Reject stale payloads (replay bound).
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  if (Date.now() - authDate * 1000 > MAX_AUTH_AGE_MS) return null;

  const rawUser = params.get("user");
  if (!rawUser) return null;
  try {
    const parsed = JSON.parse(rawUser) as { id?: number; username?: string; first_name?: string };
    if (typeof parsed.id !== "number" || !Number.isFinite(parsed.id) || parsed.id <= 0) return null;
    return { id: parsed.id, username: parsed.username, firstName: parsed.first_name };
  } catch {
    return null;
  }
}

/**
 * The identity key a Telegram player is stored under.
 *
 * Player identity is wallet-canonical everywhere (characters.wallet_address is
 * the upsert conflict target, and every runtime map is keyed by it), so rather
 * than fork that machinery a Telegram player gets a synthetic key in the same
 * column. It is deliberately NOT a valid base58 pubkey, so it can never be
 * mistaken for a real wallet — anything that would move tokens must call
 * isWalletIdentity() first.
 */
export function telegramIdentity(telegramUserId: number): string {
  return `tg:${telegramUserId}`;
}

/** True when a player key is a Telegram identity rather than a Solana wallet. */
export function isTelegramIdentity(playerKey: string | null | undefined): boolean {
  return typeof playerKey === "string" && playerKey.startsWith("tg:");
}

/**
 * True when a player key is a real wallet, i.e. safe to use as an on-chain
 * address. Guard EVERY token transfer, balance lookup and payout with this —
 * a Telegram player has no wallet until they link one.
 */
export function isWalletIdentity(playerKey: string | null | undefined): boolean {
  return typeof playerKey === "string" && playerKey.length > 0 && !isTelegramIdentity(playerKey);
}
