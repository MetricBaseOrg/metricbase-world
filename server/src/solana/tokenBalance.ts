import { METRICBASE_TOKEN_MINT, MIN_TOKEN_UI_AMOUNT } from "@metricbase/shared";
import { Connection, PublicKey } from "@solana/web3.js";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

function getTokenMint(): string {
  return process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT;
}

const RPC_TIMEOUT_MS = 15_000;

async function withRpcTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out. Try again in a moment.`));
    }, RPC_TIMEOUT_MS);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function getWalletTokenBalance(wallet: string): Promise<number> {
  const connection = new Connection(getRpcUrl(), "confirmed");
  const owner = new PublicKey(wallet);
  const mint = new PublicKey(getTokenMint());

  const accounts = await withRpcTimeout(
    connection.getParsedTokenAccountsByOwner(owner, { mint }),
    "Token balance lookup",
  );

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