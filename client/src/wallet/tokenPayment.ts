import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { pickWalletConnector } from "./discovery";

export async function sendMetricbaseTokenPayment(options: {
  payerWallet: string;
  treasuryWallet: string;
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
  const treasury = new PublicKey(options.treasuryWallet);
  const mint = new PublicKey(options.mint);
  const connection = new Connection(options.rpcUrl, "confirmed");

  const payerAta = await getAssociatedTokenAddress(mint, payer);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);
  const rawAmount = BigInt(Math.round(options.uiAmount * 10 ** options.decimals));

  const transaction = new Transaction();
  let treasuryAccountExists = true;
  try {
    await getAccount(connection, treasuryAta);
  } catch {
    treasuryAccountExists = false;
  }

  if (!treasuryAccountExists) {
    transaction.add(
      createAssociatedTokenAccountInstruction(payer, treasuryAta, treasury, mint),
    );
  }

  transaction.add(createTransferInstruction(payerAta, treasuryAta, payer, rawAmount));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;

  const signature = await wallet.signAndSendTransaction(transaction, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}