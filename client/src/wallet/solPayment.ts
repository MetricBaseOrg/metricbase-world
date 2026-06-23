import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { pickWalletConnector } from "./discovery";

/** Send a native SOL payment to another wallet and return the signature. */
export async function sendSolPayment(options: {
  payerWallet: string;
  recipientWallet: string;
  uiAmount: number;
  rpcUrl: string;
}): Promise<string> {
  const wallet = pickWalletConnector();
  if (!wallet) {
    throw new Error("Connect your wallet to pay with SOL.");
  }

  const payer = new PublicKey(options.payerWallet);
  const recipient = new PublicKey(options.recipientWallet);
  const connection = new Connection(options.rpcUrl, "confirmed");
  const lamports = BigInt(Math.round(options.uiAmount * LAMPORTS_PER_SOL));

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient,
      lamports,
    }),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;

  const signature = await wallet.signAndSendTransaction(transaction, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}
