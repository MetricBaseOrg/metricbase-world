import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { pickWalletConnector } from "./discovery";

export async function sendMetricbaseTokenPayment(options: {
  payerWallet: string;
  recipientWallet: string;
  mint: string;
  uiAmount: number;
  decimals: number;
  rpcUrl: string;
}): Promise<string> {
  const wallet = pickWalletConnector();
  if (!wallet) {
    throw new Error("Connect your wallet to pay with tokens.");
  }

  const payer = new PublicKey(options.payerWallet);
  const recipient = new PublicKey(options.recipientWallet);
  const mint = new PublicKey(options.mint);
  const connection = new Connection(options.rpcUrl, "confirmed");

  const payerAta = await getAssociatedTokenAddress(mint, payer);
  const recipientAta = await getAssociatedTokenAddress(mint, recipient);

  // Use the mint's ACTUAL on-chain decimals as the source of truth. Trusting a
  // configured/cached decimals value caused transfers to be scaled by the wrong
  // power of ten (e.g. sending 100,000,000,000 instead of 100,000 tokens).
  let decimals = options.decimals;
  try {
    decimals = (await getMint(connection, mint)).decimals;
  } catch {
    // Fall back to the configured decimals if the mint lookup fails.
  }
  const rawAmount = BigInt(Math.round(options.uiAmount * 10 ** decimals));

  const transaction = new Transaction();
  // getAccountInfo returns null when the account truly doesn't exist and only
  // throws on RPC/network errors. On an RPC error we assume the account exists,
  // so we never add a redundant create-ATA instruction that fails on-chain with
  // "account already in use".
  let recipientAccountExists = true;
  try {
    recipientAccountExists = (await connection.getAccountInfo(recipientAta)) !== null;
  } catch {
    recipientAccountExists = true;
  }

  if (!recipientAccountExists) {
    transaction.add(
      createAssociatedTokenAccountInstruction(payer, recipientAta, recipient, mint),
    );
  }

  // Checked transfer carries the mint + decimals so the wallet shows the real
  // token amount (e.g. "100,000 BASE") instead of the raw base-unit count, and
  // the chain rejects any decimals mismatch.
  transaction.add(
    createTransferCheckedInstruction(payerAta, mint, recipientAta, payer, rawAmount, decimals),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;

  const signature = await wallet.signAndSendTransaction(transaction, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}