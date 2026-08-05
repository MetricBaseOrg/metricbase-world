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
 * Normally identity does not change and nothing moves — this is just a second
 * login key on an existing wallet character. The one genuinely ambiguous case
 * is a Telegram account that already has its OWN standalone character (played
 * inside the Mini App with no wallet ever connected) while the target wallet
 * ALSO already has its own real character: linking would point one Telegram
 * id at two characters with real progress, and silently choosing between them
 * risks stranding one. That case is refused.
 *
 * But when the Telegram account has its own standalone character and the
 * wallet does NOT (a fresh/never-played wallet), there is nothing to choose
 * between — the wallet side is empty. Rather than refuse and leave the
 * player stuck between "keep my progress" and "get a wallet", the standalone
 * character is UPGRADED in place: its `characters.wallet_address` is re-keyed
 * from the synthetic `tg:<id>` to the real wallet. Every other table
 * (mail/jobs/guilds/zones/land/farms/inventory/etc — see renameCharacter)
 * references players by the durable NAME, not this column, so re-keying just
 * this one row carries the character's full progress over untouched. Callers
 * MUST force a reconnect afterwards so wallet-keyed in-memory state rebuilds
 * under the new key (same requirement as renameCharacter).
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
    const tgIdentity = telegramIdentity(telegramUserId);

    // Refuse if it's already linked (as a second login key) to a different wallet.
    const existing = await db.query<{ wallet_address: string | null }>(
      "SELECT wallet_address FROM characters WHERE telegram_id = $1 LIMIT 1",
      [telegramUserId],
    );
    const holder = existing.rows[0]?.wallet_address ?? null;
    if (holder && holder !== wallet) {
      return { ok: false, reason: "That Telegram account is already linked to another player." };
    }

    // Does this Telegram account also play as its own standalone character?
    const own = await db.query(
      "SELECT 1 FROM characters WHERE wallet_address = $1 LIMIT 1",
      [tgIdentity],
    );
    if ((own.rowCount ?? 0) > 0) {
      const walletHasCharacter = await db.query(
        "SELECT 1 FROM characters WHERE wallet_address = $1 LIMIT 1",
        [wallet],
      );
      if ((walletHasCharacter.rowCount ?? 0) > 0) {
        return {
          ok: false,
          reason:
            "That Telegram account already has its own character in MetricBase World, and so does this wallet. " +
            "Keep playing one of them, or link a different Telegram account.",
        };
      }

      // Fresh wallet + real Telegram progress: upgrade in place, no data loss.
      const upgraded = await db.query(
        "UPDATE characters SET wallet_address = $1, telegram_id = $2, updated_at = NOW() WHERE wallet_address = $3",
        [wallet, telegramUserId, tgIdentity],
      );
      if (upgraded.rowCount === 0) {
        return { ok: false, reason: "Could not link right now. Try again." };
      }
      return { ok: true, telegramId: telegramUserId };
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
