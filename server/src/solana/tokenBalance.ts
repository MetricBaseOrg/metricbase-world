import { METRICBASE_TOKEN_MINT, MIN_TOKEN_UI_AMOUNT } from "@metricbase/shared";
import { Connection, PublicKey } from "@solana/web3.js";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

function getTokenMint(): string {
  return process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT;
}

export async function getWalletTokenBalance(wallet: string): Promise<number> {
  const connection = new Connection(getRpcUrl(), "confirmed");
  const owner = new PublicKey(wallet);
  const mint = new PublicKey(getTokenMint());

  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });

  return accounts.value.reduce((total, entry) => {
    const amount = entry.account.data.parsed.info.tokenAmount.uiAmount;
    return total + (typeof amount === "number" ? amount : 0);
  }, 0);
}

export async function walletMeetsTokenGate(wallet: string): Promise<boolean> {
  const minUiAmount = Number(process.env.MIN_TOKEN_UI_AMOUNT ?? MIN_TOKEN_UI_AMOUNT);
  const balance = await getWalletTokenBalance(wallet);
  return balance >= minUiAmount;
}