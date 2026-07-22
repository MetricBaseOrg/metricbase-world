import { getPool } from "./pool.js";
import { isWalletIdentity, telegramIdentity } from "../auth/telegramAuth.js";

/** The wallet identity a Telegram account is linked to, if any. */
export async function findWalletByTelegramId(telegramUserId: number): Promise<string | null> {
  const db = getPool();
  if (!db) return null;
  try {
    const res = await db.query<{ wallet_address: string | null }>(
      "SELECT wallet_address FROM characters WHERE telegram_id = $1 LIMIT 1",
      [telegramUserId],
    );
    const wallet = res.rows[0]?.wallet_address ?? null;
    // Only a real wallet identity is worth resolving to; a `tg:` row would
    // just be the standalone account we'd fall back to anyway.
    return isWalletIdentity(wallet) ? wallet : null;
  } catch (error) {
    console.warn("[telegram-link] lookup failed:", error);
    return null;
  }
}

export type LinkResult =
  | { ok: true; telegramId: number }
  | { ok: false; reason: string };

/**
 * Attach a Telegram account to a wallet account as a second LOGIN key.
 *
 * Identity does not change and nothing moves, so there is no merge. The one
 * case that must be refused is a Telegram account that already has its own
 * character: linking would point one Telegram id at two characters, and
 * silently choosing between them risks stranding real progress.
 */
export async function linkTelegramToWallet(
  wallet: string,
  telegramUserId: number,
): Promise<LinkResult> {
  const db = getPool();
  if (!db) return { ok: false, reason: "Database unavailable." };
  if (!isWalletIdentity(wallet)) {
    return { ok: false, reason: "Sign in with your wallet first, then link Telegram." };
  }

  try {
    // Refuse if that Telegram account already plays as its own character.
    const own = await db.query(
      "SELECT 1 FROM characters WHERE wallet_address = $1 LIMIT 1",
      [telegramIdentity(telegramUserId)],
    );
    if ((own.rowCount ?? 0) > 0) {
      return {
        ok: false,
        reason:
          "That Telegram account already has its own character in MetricBase World. " +
          "Keep playing it, or link a different Telegram account.",
      };
    }

    // Refuse if it's already linked to a different wallet.
    const existing = await db.query<{ wallet_address: string | null }>(
      "SELECT wallet_address FROM characters WHERE telegram_id = $1 LIMIT 1",
      [telegramUserId],
    );
    const holder = existing.rows[0]?.wallet_address ?? null;
    if (holder && holder !== wallet) {
      return { ok: false, reason: "That Telegram account is already linked to another player." };
    }

    const updated = await db.query(
      "UPDATE characters SET telegram_id = $1, updated_at = NOW() WHERE wallet_address = $2",
      [telegramUserId, wallet],
    );
    if (updated.rowCount === 0) {
      return { ok: false, reason: "No character bonded to this wallet yet — create one first." };
    }
    return { ok: true, telegramId: telegramUserId };
  } catch (error) {
    console.warn("[telegram-link] link failed:", error);
    return { ok: false, reason: "Could not link right now. Try again." };
  }
}

/** Detach Telegram from a wallet account (they can re-link any time). */
export async function unlinkTelegram(wallet: string): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  try {
    const res = await db.query(
      "UPDATE characters SET telegram_id = NULL, updated_at = NOW() WHERE wallet_address = $1",
      [wallet],
    );
    return (res.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Whether this wallet account has a Telegram login attached. */
export async function getLinkedTelegramId(wallet: string): Promise<number | null> {
  const db = getPool();
  if (!db) return null;
  try {
    const res = await db.query<{ telegram_id: string | null }>(
      "SELECT telegram_id FROM characters WHERE wallet_address = $1 LIMIT 1",
      [wallet],
    );
    const raw = res.rows[0]?.telegram_id;
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}
