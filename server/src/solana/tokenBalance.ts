import { METRICBASE_TOKEN_MINT, MIN_TOKEN_UI_AMOUNT } from "@metricbase/shared";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { withRpcFallback } from "./rpc.js";

function getTokenMint(): string {
  return process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT;
}

function isMissingTokenAccount(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("could not find account") ||
    message.includes("account does not exist") ||
    message.includes("invalid param") ||
    message.includes("not found")
  );
}

export async function getWalletTokenBalance(wallet: string): Promise<number> {
  const owner = new PublicKey(wallet);
  const mint = new PublicKey(getTokenMint());
  const tokenAccount = getAssociatedTokenAddressSync(mint, owner);

  return withRpcFallback(async (connection) => {
    try {
      const result = await connection.getTokenAccountBalance(tokenAccount);
      return result.value.uiAmount ?? 0;
    } catch (error) {
      if (isMissingTokenAccount(error)) {
        return 0;
      }
      throw error;
    }
  }, "Token balance lookup");
}

export async function walletMeetsTokenGate(wallet: string): Promise<boolean> {
  const minUiAmount = Number(process.env.MIN_TOKEN_UI_AMOUNT ?? MIN_TOKEN_UI_AMOUNT);
  const balance = await getWalletTokenBalance(wallet);
  return balance >= minUiAmount;
}