import {
  createBurnCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { pickWalletConnector } from "./discovery";

/**
 * Burn `uiAmount` of a token from the connected wallet (used to unlock the
 * Black Zone by burning $BASE). Returns the confirmed transaction signature for
 * the server to verify on-chain.
 */
export async function burnMetricbaseToken(options: {
  ownerWallet: string;
  mint: string;
  uiAmount: number;
  decimals: number;
  rpcUrl: string;
}): Promise<string> {
  const wallet = pickWalletConnector();
  if (!wallet) {
    throw new Error("Connect your wallet to burn tokens.");
  }

  const owner = new PublicKey(options.ownerWallet);
  const mint = new PublicKey(options.mint);
  const connection = new Connection(options.rpcUrl, "confirmed");

  // $BASE is a Token-2022 mint — detect the owning program so the ATA + burn
  // instruction target the right one.
  let tokenProgramId = TOKEN_PROGRAM_ID;
  try {
    const mintAccount = await connection.getAccountInfo(mint);
    if (mintAccount?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      tokenProgramId = TOKEN_2022_PROGRAM_ID;
    }
  } catch {
    // Fall back to the standard token program.
  }

  const ownerAta = await getAssociatedTokenAddress(mint, owner, false, tokenProgramId);

  let decimals = options.decimals;
  try {
    decimals = (await getMint(connection, mint, undefined, tokenProgramId)).decimals;
  } catch {
    // Fall back to the configured decimals.
  }
  const rawAmount = BigInt(Math.round(options.uiAmount * 10 ** decimals));

  const transaction = new Transaction();
  transaction.add(
    createBurnCheckedInstruction(ownerAta, mint, owner, rawAmount, decimals, [], tokenProgramId),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = owner;

  const signature = await wallet.signAndSendTransaction(transaction, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}
