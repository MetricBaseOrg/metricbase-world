// Banned accounts (bots, abusers), keyed by wallet — the canonical player
// identity, so a ban survives renames and any still-valid access tokens.
// Enforced at /auth/verify (no new JWTs) and at ZoneRoom join (no entry with
// an old JWT). The set is tiny, so it's cached whole with a short TTL.

import { getPool } from "./pool.js";

const TTL_MS = 60_000;
let cache = new Set<string>();
let cachedAt = 0;

async function refresh(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    const res = await pool.query<{ wallet_address: string }>("SELECT wallet_address FROM banned_players");
    cache = new Set(res.rows.map((r) => r.wallet_address));
    cachedAt = Date.now();
  } catch (error) {
    console.warn("[bans] refresh failed:", error);
  }
}

export async function isWalletBanned(wallet: string): Promise<boolean> {
  if (Date.now() - cachedAt > TTL_MS) await refresh();
  return cache.has(wallet);
}

/** Record a ban (idempotent) and make it effective immediately in this process. */
export async function banWallet(wallet: string, name: string | null, reason: string): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query(
    `INSERT INTO banned_players (wallet_address, name, reason) VALUES ($1, $2, $3)
     ON CONFLICT (wallet_address) DO UPDATE SET name = $2, reason = $3`,
    [wallet, name, reason],
  );
  cache.add(wallet);
}

export async function unbanWallet(wallet: string): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query("DELETE FROM banned_players WHERE wallet_address = $1", [wallet]);
  cache.delete(wallet);
}

export interface BanRecord {
  wallet: string;
  name: string | null;
  reason: string;
  bannedAt: number;
}

export async function listBans(): Promise<BanRecord[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    "SELECT wallet_address, name, reason, banned_at FROM banned_players ORDER BY banned_at DESC",
  );
  return res.rows.map((r) => ({
    wallet: r.wallet_address as string,
    name: (r.name as string | null) ?? null,
    reason: (r.reason as string) ?? "",
    bannedAt: new Date(r.banned_at as string).getTime(),
  }));
}

/** Erase a banned bot's character row + its net-worth snapshots. Trade/mail
 *  history rows are deliberately kept as audit trail. */
export async function deleteCharacterTraces(wallet: string, name: string): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const del = await pool.query("DELETE FROM characters WHERE wallet_address = $1 OR name = $2", [wallet, name]);
  await pool.query("DELETE FROM net_worth_daily WHERE player_key IN ($1, $2)", [wallet, name]);
  return del.rowCount ?? 0;
}
