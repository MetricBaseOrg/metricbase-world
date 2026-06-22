import { METRICBASE_TOKEN_MINT } from "@metricbase/shared";
import { jsonRpcCall, withRpcFallback } from "./rpc.js";

const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const REFRESH_MS = 5 * 60 * 1000;

let cached: number | null = null;
let lastFetchAt = 0;
let inflight: Promise<number | null> | null = null;

function getTokenMint(): string {
  return process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT;
}

interface ProgramAccount {
  account: { data: [string, string] };
}

/**
 * Count token accounts holding a non-zero $BASE balance. We slice out just the
 * 8-byte amount field (offset 64) of each account so the RPC payload stays tiny
 * even with many holders. Requires an RPC that allows getProgramAccounts
 * (e.g. Helius via SOLANA_RPC_URL); public RPCs often reject it, in which case
 * we keep the last known value.
 */
async function fetchHolderCount(): Promise<number | null> {
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
      "Holder count",
    );

    let holders = 0;
    for (const entry of accounts) {
      const buf = Buffer.from(entry.account.data[0], "base64");
      if (buf.length >= 8 && buf.readBigUInt64LE(0) > 0n) holders++;
    }
    return holders;
  }, "Holder count");
}

/** Returns the cached holder count, refreshing in the background when stale. */
export async function getBaseHolderCount(): Promise<number | null> {
  const now = Date.now();
  if (cached !== null && now - lastFetchAt < REFRESH_MS) return cached;
  if (inflight) return inflight;

  inflight = fetchHolderCount()
    .then((count) => {
      if (count !== null) {
        cached = count;
        lastFetchAt = now;
      }
      return cached;
    })
    .catch((error) => {
      console.warn("[holders] holder count lookup failed; keeping last value.", error);
      return cached;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function getCachedHolderCount(): number | null {
  return cached;
}
