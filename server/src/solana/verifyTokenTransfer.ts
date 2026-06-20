import { Connection, PublicKey } from "@solana/web3.js";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
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
}

export async function verifyMetricbaseTokenTransfer(
  signature: string,
  expected: TokenTransferExpectation,
): Promise<TokenTransferVerification> {
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
    return { ok: false, error: "Transaction not found yet. Wait a moment and try again." };
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