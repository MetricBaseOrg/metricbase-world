import { Connection } from "@solana/web3.js";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

export interface PeerTokenTransferExpectation {
  fromWallet: string;
  toWallet: string;
  mint: string;
  minUiAmount: number;
}

export interface PeerTokenTransferVerification {
  ok: boolean;
  error?: string;
  fromWallet?: string;
  toWallet?: string;
  uiAmount?: number;
}

export async function verifyPeerTokenTransfer(
  signature: string,
  expected: PeerTokenTransferExpectation,
): Promise<PeerTokenTransferVerification> {
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

  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58();
  if (!feePayer || feePayer !== expected.fromWallet) {
    return { ok: false, error: "Transaction was not signed by the buyer wallet." };
  }

  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];

  let received = 0;
  for (const post of postBalances) {
    if (post.mint !== expected.mint) continue;
    if (post.owner !== expected.toWallet) continue;

    const pre = preBalances.find((entry) => entry.accountIndex === post.accountIndex);
    received += uiAmountOf(post) - (pre ? uiAmountOf(pre) : 0);
  }

  if (received + 1e-9 < expected.minUiAmount) {
    // Dump what the transaction actually moved so deposit failures are debuggable.
    console.warn(
      "[casino] token deposit verify: received too few.",
      JSON.stringify({
        signature,
        expected: { mint: expected.mint, toWallet: expected.toWallet, fromWallet: expected.fromWallet, min: expected.minUiAmount },
        received,
        postBalances: postBalances.map((p) => ({ mint: p.mint, owner: p.owner, ui: p.uiTokenAmount.uiAmount, raw: p.uiTokenAmount.amount })),
      }),
    );
    return {
      ok: false,
      error: `Seller received too few tokens. Expected ${expected.minUiAmount}, got ${received}.`,
    };
  }

  let sent = 0;
  for (const pre of preBalances) {
    if (pre.mint !== expected.mint) continue;
    if (pre.owner !== expected.fromWallet) continue;

    const post = postBalances.find((entry) => entry.accountIndex === pre.accountIndex);
    sent += uiAmountOf(pre) - (post ? uiAmountOf(post) : 0);
  }

  if (sent + 1e-9 < expected.minUiAmount) {
    return { ok: false, error: "Buyer wallet did not send the required tokens." };
  }

  return {
    ok: true,
    fromWallet: expected.fromWallet,
    toWallet: expected.toWallet,
    uiAmount: received,
  };
}

/** UI amount of a token balance, falling back to raw amount when uiAmount is null. */
function uiAmountOf(b: { uiTokenAmount: { uiAmount: number | null; amount: string; decimals: number } }): number {
  const t = b.uiTokenAmount;
  if (t.uiAmount != null) return t.uiAmount;
  const raw = Number(t.amount);
  return Number.isFinite(raw) && t.decimals >= 0 ? raw / 10 ** t.decimals : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}