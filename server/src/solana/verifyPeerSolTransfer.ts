import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

export interface PeerSolTransferExpectation {
  fromWallet: string;
  toWallet: string;
  /** Minimum SOL the recipient must have received. */
  minUiAmount: number;
}

export interface PeerSolTransferVerification {
  ok: boolean;
  error?: string;
  uiAmount?: number;
}

/**
 * Verify a native SOL payment between two wallets by inspecting lamport balance
 * deltas in the confirmed transaction. Unlike SPL transfers there are no token
 * balances — we read the System-program lamport movement straight from meta.
 */
export async function verifyPeerSolTransfer(
  signature: string,
  expected: PeerSolTransferExpectation,
): Promise<PeerSolTransferVerification> {
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

  const keys = tx.transaction.message.accountKeys;
  const feePayer = keys[0]?.pubkey.toBase58();
  if (!feePayer || feePayer !== expected.fromWallet) {
    return { ok: false, error: "Transaction was not signed by the buyer wallet." };
  }

  const recipientIndex = keys.findIndex((k) => k.pubkey.toBase58() === expected.toWallet);
  if (recipientIndex < 0) {
    return { ok: false, error: "Seller wallet was not part of this transaction." };
  }

  const pre = tx.meta?.preBalances ?? [];
  const post = tx.meta?.postBalances ?? [];
  const receivedLamports = (post[recipientIndex] ?? 0) - (pre[recipientIndex] ?? 0);
  const receivedSol = receivedLamports / LAMPORTS_PER_SOL;

  if (receivedSol + 1e-9 < expected.minUiAmount) {
    return {
      ok: false,
      error: `Seller received too little SOL. Expected ${expected.minUiAmount}, got ${receivedSol}.`,
    };
  }

  return { ok: true, uiAmount: receivedSol };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
