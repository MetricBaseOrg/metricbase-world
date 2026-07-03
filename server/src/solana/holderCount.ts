import { METRICBASE_TOKEN_MINT, TOKEN_DECIMALS } from "@metricbase/shared";
import { jsonRpcCall, withRpcFallback } from "./rpc.js";

const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const REFRESH_MS = 5 * 60 * 1000;

/** Non-zero holder accounts + total $BASE (UI amount) held across all of them. */
export interface BaseHolderStats {
  holders: number;
  totalHeld: number;
}

let cached: BaseHolderStats | null = null;
let lastFetchAt = 0;
let inflight: Promise<BaseHolderStats | null> | null = null;

function getTokenMint(): string {
  return process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT;
}

interface ProgramAccount {
  account: { data: [string, string] };
}

/**
 * Enumerate all $BASE token accounts, counting non-zero holders and summing the
 * balances. We slice out just the 8-byte amount field (offset 64) of each
 * account so the RPC payload stays tiny even with many holders. Requires an RPC
 * that allows getProgramAccounts (e.g. Helius via SOLANA_RPC_URL); public RPCs
 * often reject it, in which case we keep the last known value.
 */
async function fetchHolderStats(): Promise<BaseHolderStats | null> {
  const mint = getTokenMint();
  return withRpcFallback(async (rpcUrl) => {
    const accounts = await jsonRpcCall<ProgramAccount[]>(
      rpcUrl,
      "getProgramAccounts",
      [
        TOKEN_2022_PROGRAM_ID,
        {
          encoding: "base64",
          dataSlice: { offset: 64, length: 8 },
          filters: [{ memcmp: { offset: 0, bytes: mint } }],
        },
      ],
      "Holder stats",
    );

    let holders = 0;
    let rawTotal = 0n;
    for (const entry of accounts) {
      const buf = Buffer.from(entry.account.data[0], "base64");
      if (buf.length < 8) continue;
      const amount = buf.readBigUInt64LE(0);
      if (amount > 0n) {
        holders++;
        rawTotal += amount;
      }
    }
    // Convert smallest units to a UI amount (safe: total fits well within f64).
    const totalHeld = Number(rawTotal) / 10 ** TOKEN_DECIMALS;
    return { holders, totalHeld };
  }, "Holder stats");
}

/** Returns cached holder stats, refreshing in the background when stale. */
export async function getBaseHolderStats(): Promise<BaseHolderStats | null> {
  const now = Date.now();
  if (cached !== null && now - lastFetchAt < REFRESH_MS) return cached;
  if (inflight) return inflight;

  inflight = fetchHolderStats()
    .then((stats) => {
      if (stats !== null) {
        cached = stats;
        lastFetchAt = now;
      }
      return cached;
    })
    .catch((error) => {
      console.warn("[holders] holder stats lookup failed; keeping last value.", error);
      return cached;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Returns the cached holder count, refreshing in the background when stale. */
export async function getBaseHolderCount(): Promise<number | null> {
  const stats = await getBaseHolderStats();
  return stats?.holders ?? null;
}

export function getCachedHolderCount(): number | null {
  return cached?.holders ?? null;
}

export function getCachedHolderStats(): BaseHolderStats | null {
  return cached;
}
