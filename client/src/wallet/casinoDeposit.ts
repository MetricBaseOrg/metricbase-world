import { getCurrency } from "@metricbase/shared";
import { sendSolPayment } from "./solPayment";
import { sendMetricbaseTokenPayment } from "./tokenPayment";

const FALLBACK_RPC = "https://api.mainnet-beta.solana.com";

/**
 * Deposit `uiAmount` of a currency to the casino house wallet and return the
 * transaction signature (which the server then verifies + credits).
 */
export async function depositToCasino(options: {
  currencyId: string;
  uiAmount: number;
  payerWallet: string;
  houseWallet: string;
  rpcUrl: string | null;
}): Promise<string> {
  const currency = getCurrency(options.currencyId);
  const rpcUrl = options.rpcUrl ?? FALLBACK_RPC;

  if (currency.native) {
    return sendSolPayment({
      payerWallet: options.payerWallet,
      recipientWallet: options.houseWallet,
      uiAmount: options.uiAmount,
      rpcUrl,
    });
  }
  if (!currency.mint) throw new Error("This currency can't be deposited.");
  return sendMetricbaseTokenPayment({
    payerWallet: options.payerWallet,
    recipientWallet: options.houseWallet,
    mint: currency.mint,
    uiAmount: options.uiAmount,
    decimals: currency.decimals,
    rpcUrl,
  });
}
