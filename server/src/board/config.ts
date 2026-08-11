// District Deeds — process configuration and the money kill switch.

import { randomUUID } from "node:crypto";

import {
  BOARD_DISCONNECT_GRACE_MS,
  BOARD_POLL_TIMEOUT_MS,
  BOARD_RESTART_GRACE_MS,
  type BoardCurrencyId,
} from "@metricbase/shared";

import { getHouseWalletAddress, isWithdrawEnabled } from "../solana/housePayout.js";

/**
 * Rotates on every server boot. A table loaded with a different boot_id was
 * interrupted by a restart, and everyone at it gets a fresh grace window
 * instead of a forfeit clock. This is the whole mechanism that keeps a deploy
 * from costing someone their stake.
 */
export const BOOT_ID = randomUUID();
export const BOOT_AT = Date.now();

/**
 * Whether money tables may be created or joined right now.
 *
 * Read PER REQUEST, never memoised at module load — the point of a kill switch
 * is that it can change without a code change.
 *
 * Inert by default, the same shape as NFT_COLLECTION_ADDRESS: without a house
 * signer there is no way to pay a prize out, so offering a money table would be
 * taking deposits we cannot return.
 */
export function boardMoneyEnabled(): boolean {
  return (
    process.env.BOARD_MONEY_ENABLED === "1" &&
    isWithdrawEnabled() &&
    getHouseWalletAddress() !== null
  );
}

/**
 * SOL is gated separately. `verifyPeerSolTransfer` and `sendPayout`'s native
 * branch are written but have never run in production, so this exists to let
 * SOL tables be turned off without touching $BASE.
 */
export function boardSolEnabled(): boolean {
  return boardMoneyEnabled() && process.env.BOARD_SOL_ENABLED !== "0";
}

/** Currencies open for new tables right now. */
export function activeBoardCurrencies(): BoardCurrencyId[] {
  if (!boardMoneyEnabled()) return ["gold"];
  return boardSolEnabled() ? ["gold", "base", "sol"] : ["gold", "base"];
}

/**
 * Where a money buy-in is sent.
 *
 * Deliberately the HOUSE wallet, not TOKEN_TREASURY_WALLET: prizes are paid by
 * HOUSE_WALLET_SECRET's keypair, so a stake that landed anywhere else would be
 * money the payer cannot reach.
 */
export function boardHouseWallet(): string | null {
  return getHouseWalletAddress();
}

/** Gold needs no wallet and no signer, so it is always available. */
export function isBoardCurrencyActive(currencyId: string): boolean {
  return activeBoardCurrencies().includes(currencyId as BoardCurrencyId);
}

/**
 * Grace windows, shrunk to seconds for tests.
 *
 * Honoured ONLY when NODE_ENV is development or test — the same shape as
 * TOKEN_GATE_DISABLED, and for the same reason: a flag that shortens the window
 * before someone forfeits a real stake must be impossible to set in production
 * by accident. NODE_ENV is not set on Railway, so this is inert there.
 *
 * It exists because the alternative is not testing the forfeit path at all: a
 * five-minute wall clock is not something a verification script can sit through.
 */
export function boardTimings(): {
  disconnectGraceMs: number;
  restartGraceMs: number;
  pollTimeoutMs: number;
  aiThinkMinMs: number;
  aiThinkMaxMs: number;
} {
  const testable = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  if (testable && process.env.BOARD_TEST_FAST_CLOCKS === "1") {
    // The AI pause is here too: at ~2s a turn it is most of the wall clock in a
    // full-length game, which makes an end-to-end run unusably slow.
    return {
      disconnectGraceMs: 4_000,
      restartGraceMs: 6_000,
      pollTimeoutMs: 2_000,
      aiThinkMinMs: 0,
      aiThinkMaxMs: 0,
    };
  }
  return {
    disconnectGraceMs: BOARD_DISCONNECT_GRACE_MS,
    restartGraceMs: BOARD_RESTART_GRACE_MS,
    pollTimeoutMs: BOARD_POLL_TIMEOUT_MS,
    aiThinkMinMs: 1_500,
    aiThinkMaxMs: 3_000,
  };
}
