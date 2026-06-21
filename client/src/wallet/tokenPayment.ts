import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
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
  let recipientAccountExists = true;
  try {
    await getAccount(connection, recipientAta);
  } catch {
    recipientAccountExists = false;
  }

  if (!recipientAccountExists) {
    transaction.add(
      createAssociatedTokenAccountInstruction(payer, recipientAta, recipient, mint),
    );
  }

  transaction.add(createTransferInstruction(payerAta, recipientAta, payer, rawAmount));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;

  const signature = await wallet.signAndSendTransaction(transaction, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}