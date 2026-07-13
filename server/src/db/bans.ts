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
