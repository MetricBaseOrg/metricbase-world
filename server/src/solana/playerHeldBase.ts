import { METRICBASE_TOKEN_MINT, TOKEN_DECIMALS } from "@metricbase/shared";
import { PublicKey } from "@solana/web3.js";
import { getPool } from "../db/pool.js";
import { jsonRpcCall, withRpcFallback } from "./rpc.js";

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const REFRESH_MS = 5 * 60 * 1000;

/** $BASE actually held by wallets bonded to game characters (not the whole supply). */
export interface PlayerHeldBase {
  totalHeld: number;
  holders: number;
}

let cached: PlayerHeldBase | null = null;
let lastFetchAt = 0;
let inflight: Promise<PlayerHeldBase | null> | null = null;

function getTokenMint(): string {
  return process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT;
}

function associatedTokenAddress(mint: PublicKey, owner: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

interface MultipleAccounts {
  value: ({ data: [string, string] } | null)[];
}

/**
 * Sum the on-chain $BASE balance of every wallet bonded to a game character.
 * We derive each wallet's associated token account for both the SPL Token and
 * Token-2022 programs (a mint lives under exactly one, so the other resolves to
 * an empty account) and read the 8-byte amount field via getMultipleAccounts in
 * batches of 100 — a handful of RPC calls regardless of player count.
 */
async function fetchPlayerHeld(): Promise<PlayerHeldBase | null> {
  const pool = getPool();
  if (!pool) return null;

  const res = await pool.query<{ wallet_address: string }>(
    "SELECT DISTINCT wallet_address FROM characters WHERE wallet_address IS NOT NULL",
  );
  const wallets = res.rows.map((r) => r.wallet_address).filter(Boolean);
  if (wallets.length === 0) return { totalHeld: 0, holders: 0 };

  const mint = new PublicKey(getTokenMint());
  const atas: string[] = [];
  const owners: string[] = [];
  for (const wallet of wallets) {
    let owner: PublicKey;
    try {
      owner = new PublicKey(wallet);
    } catch {
      continue; // skip malformed wallet strings
    }
    for (const programId of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
      atas.push(associatedTokenAddress(mint, owner, programId).toBase58());
      owners.push(wallet);
    }
  }

  return withRpcFallback(async (rpcUrl) => {
    const heldByWallet = new Map<string, bigint>();
    for (let i = 0; i < atas.length; i += 100) {
      const chunk = atas.slice(i, i + 100);
      const ownerChunk = owners.slice(i, i + 100);
      const resp = await jsonRpcCall<MultipleAccounts>(
        rpcUrl,
        "getMultipleAccounts",
        [chunk, { encoding: "base64", dataSlice: { offset: 64, length: 8 } }],
        "Player $BASE held",
      );
      const values = resp.value ?? [];
      for (let j = 0; j < values.length; j++) {
        const acc = values[j];
        if (!acc) continue;
        const buf = Buffer.from(acc.data[0], "base64");
        if (buf.length < 8) continue;
        const amount = buf.readBigUInt64LE(0);
        if (amount > 0n) heldByWallet.set(ownerChunk[j], (heldByWallet.get(ownerChunk[j]) ?? 0n) + amount);
      }
    }
    let raw = 0n;
    for (const amount of heldByWallet.values()) raw += amount;
    return { totalHeld: Number(raw) / 10 ** TOKEN_DECIMALS, holders: heldByWallet.size };
  }, "Player $BASE held");
}

/** Cached player-held $BASE, refreshed in the background when stale. */
export async function getPlayerHeldBase(): Promise<PlayerHeldBase | null> {
  const now = Date.now();
  if (cached !== null && now - lastFetchAt < REFRESH_MS) return cached;
  if (inflight) return inflight;

  inflight = fetchPlayerHeld()
    .then((stats) => {
      if (stats !== null) {
        cached = stats;
        lastFetchAt = now;
      }
      return cached;
    })
    .catch((error) => {
      console.warn("[playerHeld] $BASE held lookup failed; keeping last value.", error);
      return cached;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
