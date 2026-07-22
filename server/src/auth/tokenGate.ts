import { METRICBASE_TOKEN_MINT, MIN_TOKEN_UI_AMOUNT } from "@metricbase/shared";

/**
 * Whether WALLET AUTHENTICATION is enforced. This is not the "free to play"
 * switch — see isTokenHoldingRequired() for that.
 *
 * TOKEN_GATE_DISABLED is a LOCAL DEV BYPASS and is deliberately ignored in
 * production. When it is on, /auth/verify hands out an access token for any
 * wallet string WITHOUT checking the signature or the ban list, and ZoneRoom
 * accepts joins with no wallet at all. In production that would mean anyone
 * could mint a session for any wallet — including the treasury wallet, which
 * is the admin account — and every ban would silently stop applying.
 */
export function isTokenGateEnabled(): boolean {
  if (process.env.TOKEN_GATE_DISABLED !== "true") return true;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[tokenGate] TOKEN_GATE_DISABLED=true ignored in production — it bypasses " +
        "signature and ban checks. Set MIN_TOKEN_UI_AMOUNT=0 for free-to-play instead.",
    );
    return true;
  }
  return false;
}

/** Tokens required to enter. 0 (the default) = free to play. */
export function getMinTokenUiAmount(): number {
  const raw = Number(process.env.MIN_TOKEN_UI_AMOUNT ?? MIN_TOKEN_UI_AMOUNT);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Whether a balance check runs at all. When false we skip the RPC lookup
 * entirely rather than comparing against 0 — that keeps the login path off
 * the chain, so a flaky Helius endpoint can't add latency to (or fail) a
 * sign-in that no longer depends on holdings.
 */
export function isTokenHoldingRequired(): boolean {
  return isTokenGateEnabled() && getMinTokenUiAmount() > 0;
}

export function getTokenGateInfo() {
  return {
    mint: process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT,
    minUiAmount: getMinTokenUiAmount(),
    enabled: isTokenGateEnabled(),
  };
}
