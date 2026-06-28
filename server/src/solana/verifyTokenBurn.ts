import { Connection } from "@solana/web3.js";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

export interface TokenBurnExpectation {
  ownerWallet: string;
  mint: string;
  minUiAmount: number;
}

export interface TokenBurnVerification {
  ok: boolean;
  error?: string;
  burned?: number;
}

/**
 * Verify that `signature` is a successful transaction signed by `ownerWallet`
 * that reduced the owner's balance of `mint` by at least `minUiAmount` with no
 * offsetting increase to any other owner — i.e. the tokens were burned.
 */
export async function verifyTokenBurn(
  signature: string,
  expected: TokenBurnExpectation,
): Promise<TokenBurnVerification> {
  const connection = new Connection(getRpcUrl(), "confirmed");

  let tx;
  for (let attempt = 0; attempt < 6; attempt++) {
    tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (tx) break;
    await sleep(1500);
  }

  if (!tx) {
    return { ok: false, error: "Burn transaction not found yet. Wait a moment and try again." };
  }
  if (tx.meta?.err) {
    return { ok: false, error: "Burn transaction failed on-chain." };
  }

  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58();
  if (!feePayer || feePayer !== expected.ownerWallet) {
    return { ok: false, error: "Burn was not signed by your wallet." };
  }

  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];

  // How much the owner's balance for this mint dropped.
  let ownerDrop = 0;
  for (const pre of preBalances) {
    if (pre.mint !== expected.mint || pre.owner !== expected.ownerWallet) continue;
    const post = postBalances.find((entry) => entry.accountIndex === pre.accountIndex);
    ownerDrop += (pre.uiTokenAmount.uiAmount ?? 0) - (post?.uiTokenAmount.uiAmount ?? 0);
  }

  // Any increase to other owners of this mint means it was a transfer, not a burn.
  let othersGained = 0;
  for (const post of postBalances) {
    if (post.mint !== expected.mint || post.owner === expected.ownerWallet) continue;
    const pre = preBalances.find((entry) => entry.accountIndex === post.accountIndex);
    const delta = (post.uiTokenAmount.uiAmount ?? 0) - (pre?.uiTokenAmount.uiAmount ?? 0);
    if (delta > 0) othersGained += delta;
  }

  if (ownerDrop + 1e-9 < expected.minUiAmount) {
    return {
      ok: false,
      error: `Burn too small. Expected ${expected.minUiAmount}, burned ${Math.max(0, ownerDrop)}.`,
    };
  }
  if (othersGained > 1e-6) {
    return { ok: false, error: "That was a transfer, not a burn." };
  }

  return { ok: true, burned: ownerDrop };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
