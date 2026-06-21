import { METRICBASE_TOKEN_MINT, MIN_TOKEN_UI_AMOUNT } from "@metricbase/shared";
import { PublicKey } from "@solana/web3.js";
import { jsonRpcCall, withRpcFallback } from "./rpc.js";

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

function getTokenMint(): string {
  return process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT;
}

function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgramId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function isMissingTokenAccount(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("could not find account") ||
    message.includes("account does not exist") ||
    message.includes("invalid param") ||
    message.includes("not found")
  );
}

async function readAtaBalance(
  rpcUrl: string,
  tokenAccount: PublicKey,
): Promise<number | null> {
  try {
    const result = await jsonRpcCall<{
      value: { uiAmount: number | null };
    }>(rpcUrl, "getTokenAccountBalance", [tokenAccount.toBase58()], "Token balance lookup");

    return result.value.uiAmount ?? 0;
  } catch (error) {
    if (isMissingTokenAccount(error)) {
      return null;
    }
    throw error;
  }
}

export async function getWalletTokenBalance(wallet: string): Promise<number> {
  const owner = new PublicKey(wallet);
  const mint = new PublicKey(getTokenMint());

  return withRpcFallback(async (rpcUrl) => {
    for (const programId of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
      const tokenAccount = getAssociatedTokenAddress(mint, owner, programId);
      const balance = await readAtaBalance(rpcUrl, tokenAccount);
      if (balance !== null) {
        return balance;
      }
    }

    return 0;
  }, "Token balance lookup");
}

export async function walletMeetsTokenGate(wallet: string): Promise<boolean> {
  const minUiAmount = Number(process.env.MIN_TOKEN_UI_AMOUNT ?? MIN_TOKEN_UI_AMOUNT);
  const balance = await getWalletTokenBalance(wallet);
  return balance >= minUiAmount;
}

export interface TokenGateResult {
  allowed: boolean;
  reason: string;
}

// Wallets that recently cleared the gate, so transient RPC failures and
// frequent re-joins (zone transfers) don't repeatedly hit the chain or, worse,
// lock a valid holder out when an RPC call hiccups.
const gatePassCache = new Map<string, number>();
const GATE_PASS_TTL_MS = 10 * 60 * 1000;
const GATE_FAILOPEN_TTL_MS = 60 * 1000;

/**
 * Decide whether a wallet may enter. A *confirmed* balance below the threshold
 * is rejected; an RPC error (couldn't determine the balance) fails OPEN, since
 * the caller already proved holdings to obtain their signed session token and
 * locking everyone out on a flaky RPC is far worse than the rare stale check.
 */
export async function checkWalletTokenGate(wallet: string): Promise<TokenGateResult> {
  const cachedUntil = gatePassCache.get(wallet);
  if (cachedUntil && cachedUntil > Date.now()) {
    return { allowed: true, reason: "cached" };
  }

  const minUiAmount = Number(process.env.MIN_TOKEN_UI_AMOUNT ?? MIN_TOKEN_UI_AMOUNT);

  try {
    const balance = await getWalletTokenBalance(wallet);
    if (balance >= minUiAmount) {
      gatePassCache.set(wallet, Date.now() + GATE_PASS_TTL_MS);
      return { allowed: true, reason: `balance ${balance}` };
    }
    return { allowed: false, reason: `balance ${balance} < ${minUiAmount}` };
  } catch (error) {
    console.warn(
      `[tokenGate] balance lookup failed for ${wallet}; allowing entry on valid session.`,
      error,
    );
    gatePassCache.set(wallet, Date.now() + GATE_FAILOPEN_TTL_MS);
    return { allowed: true, reason: "rpc-error-fail-open" };
  }
}