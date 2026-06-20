import {
  buildTokenShopCatalog,
  METRICBASE_TOKEN_MINT,
  TOKEN_DECIMALS,
  type TokenShopInfo,
} from "@metricbase/shared";
import { isTokenGateEnabled } from "../auth/tokenGate.js";
import { getWalletTokenBalance } from "../solana/tokenBalance.js";
import { getTreasuryWallet } from "../solana/verifyTokenTransfer.js";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

export async function buildTokenShopInfo(wallet: string | null): Promise<TokenShopInfo> {
  const treasuryWallet = getTreasuryWallet();
  const enabled = isTokenGateEnabled() && Boolean(treasuryWallet);

  let walletBalance: number | null = null;
  if (wallet && enabled) {
    try {
      walletBalance = await getWalletTokenBalance(wallet);
    } catch {
      walletBalance = null;
    }
  }

  return {
    enabled,
    mint: process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT,
    treasuryWallet,
    walletBalance,
    rpcUrl: getRpcUrl(),
    decimals: Number(process.env.TOKEN_DECIMALS ?? TOKEN_DECIMALS),
    products: buildTokenShopCatalog(),
  };
}