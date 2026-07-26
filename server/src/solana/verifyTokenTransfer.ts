import { Connection, PublicKey } from "@solana/web3.js";
import { getRpcUrls, timeoutFetch } from "./rpc.js";

/** Hostname only, for error text — never leak an RPC key in a query string. */
function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "rpc";
  }
}

export interface TokenTransferExpectation {
  payerWallet: string;
  treasuryWallet: string;
  mint: string;
  minUiAmount: number;
}

export interface TokenTransferVerification {
  ok: boolean;
  error?: string;
  payer?: string;
  uiAmount?: number;
  /** Per-endpoint failure reasons. Surfaced to ADMINS only — it's the
   * difference between guessing at an outage and knowing which provider is
   * refusing us and with what. */
  detail?: string;
}

export async function verifyMetricbaseTokenTransfer(
  signature: string,
  expected: TokenTransferExpectation,
): Promise<TokenTransferVerification> {
  // Try EVERY configured endpoint before giving up. A single flaky or
  // rate-limited provider must not be able to block payment verification —
  // that's a player who paid and can't be credited.
  //
  // This also must not throw: callers run inside message handlers whose only
  // error path is a server-side console.error, so an exception here reaches the
  // player as nothing happening at all. Every outcome becomes { ok: false }.
  let tx: Awaited<ReturnType<Connection["getParsedTransaction"]>> = null;
  let reached = false;
  const failures: string[] = [];
  for (const rpcUrl of getRpcUrls()) {
    try {
      const connection = new Connection(rpcUrl, {
        commitment: "confirmed",
        fetch: timeoutFetch(8000),
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        tx = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        if (tx) break;
        await sleep(1500);
      }
      // The endpoint answered, even if it hasn't indexed this signature yet.
      reached = true;
      if (tx) break;
      failures.push(`${host(rpcUrl)}: not indexed`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${host(rpcUrl)}: ${reason.slice(0, 120)}`);
      console.warn(`[verifyTransfer] lookup failed via ${rpcUrl}:`, error);
    }
  }

  if (!tx) {
    return {
      ok: false,
      error: reached
        ? "Transaction not found yet. Wait a moment and try again."
        : "Couldn't reach Solana to check that transaction. Try again shortly.",
      detail: failures.join(" | "),
    };
  }

  if (tx.meta?.err) {
    return { ok: false, error: "Transaction failed on-chain." };
  }

  const accountKeys = tx.transaction.message.accountKeys;
  const feePayer = accountKeys[0]?.pubkey.toBase58();
  if (!feePayer || feePayer !== expected.payerWallet) {
    return { ok: false, error: "Transaction was not signed by your wallet." };
  }

  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];
  let received = 0;

  for (const post of postBalances) {
    if (post.mint !== expected.mint) continue;
    if (post.owner !== expected.treasuryWallet) continue;

    const pre = preBalances.find((entry) => entry.accountIndex === post.accountIndex);
    const preAmount = pre?.uiTokenAmount.uiAmount ?? 0;
    const postAmount = post.uiTokenAmount.uiAmount ?? 0;
    received += postAmount - preAmount;
  }

  if (received + 1e-9 < expected.minUiAmount) {
    return {
      ok: false,
      error: `Transfer amount too low. Expected ${expected.minUiAmount} tokens, received ${received}.`,
    };
  }

  let sent = 0;
  for (const pre of preBalances) {
    if (pre.mint !== expected.mint) continue;
    if (pre.owner !== expected.payerWallet) continue;

    const post = postBalances.find((entry) => entry.accountIndex === pre.accountIndex);
    const preAmount = pre.uiTokenAmount.uiAmount ?? 0;
    const postAmount = post?.uiTokenAmount.uiAmount ?? 0;
    sent += preAmount - postAmount;
  }

  if (sent + 1e-9 < expected.minUiAmount) {
    return { ok: false, error: "Your wallet did not send the required tokens." };
  }

  return { ok: true, payer: feePayer, uiAmount: received };
}

export function getTreasuryWallet(): string | null {
  const treasury = process.env.TOKEN_TREASURY_WALLET?.trim();
  if (!treasury || treasury.length < 32 || treasury.length > 44) {
    return null;
  }

  try {
    return new PublicKey(treasury).toBase58();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}