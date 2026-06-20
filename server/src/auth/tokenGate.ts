import { METRICBASE_TOKEN_MINT, MIN_TOKEN_UI_AMOUNT } from "@metricbase/shared";

export function isTokenGateEnabled(): boolean {
  return process.env.TOKEN_GATE_DISABLED !== "true";
}

export function getTokenGateInfo() {
  return {
    mint: process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT,
    minUiAmount: Number(process.env.MIN_TOKEN_UI_AMOUNT ?? MIN_TOKEN_UI_AMOUNT),
    enabled: isTokenGateEnabled(),
  };
}