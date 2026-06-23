// Payment currencies accepted on the peer-to-peer gold market. Each order names
// the currency the gold is priced in; settlement transfers that currency's mint
// (or native SOL) directly between the two players' wallets.

import { METRICBASE_TOKEN_MINT } from "./tokenGate.js";
import { TOKEN_DECIMALS } from "./tokenShop.js";

export interface PaymentCurrency {
  id: string;
  /** Display label/symbol (e.g. "USDC"). */
  label: string;
  /** SPL mint address, or null for native SOL. */
  mint: string | null;
  /** Fallback decimals (the client confirms SPL decimals on-chain). */
  decimals: number;
  /** True for native SOL (transferred via the System program, not an SPL mint). */
  native: boolean;
}

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const IDRX_MINT = "idrxZcP8xiKkYk6XGD4uz1dxEYCWSgKDHqgjsBbwDur";

export const PAYMENT_CURRENCIES: PaymentCurrency[] = [
  { id: "base", label: "$BASE", mint: METRICBASE_TOKEN_MINT, decimals: TOKEN_DECIMALS, native: false },
  { id: "usdc", label: "USDC", mint: USDC_MINT, decimals: 6, native: false },
  { id: "idrx", label: "IDRX", mint: IDRX_MINT, decimals: 2, native: false },
  { id: "sol", label: "SOL", mint: null, decimals: 9, native: true },
];

export const DEFAULT_CURRENCY_ID = "base";

export function getCurrency(id: string | null | undefined): PaymentCurrency {
  return PAYMENT_CURRENCIES.find((c) => c.id === id) ?? PAYMENT_CURRENCIES[0];
}

export function isKnownCurrency(id: string | null | undefined): boolean {
  return PAYMENT_CURRENCIES.some((c) => c.id === id);
}
