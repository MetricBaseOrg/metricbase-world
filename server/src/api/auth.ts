import {
  type AuthVerifyRequest,
  type AuthVerifyResponse,
} from "@metricbase/shared";
import { Router } from "express";
import { createAccessToken, verifyAccessToken } from "../auth/accessToken.js";
import { consumeChallenge, createChallenge } from "../auth/challenges.js";
import {
  getMinTokenUiAmount,
  getTokenGateInfo,
  isTokenGateEnabled,
  isTokenHoldingRequired,
} from "../auth/tokenGate.js";
import {
  isTelegramLoginConfigured,
  telegramIdentity,
  verifyTelegramInitData,
} from "../auth/telegramAuth.js";
import { isWalletBanned } from "../db/bans.js";
import { getWalletTokenBalance } from "../solana/tokenBalance.js";
import { verifyWalletSignature } from "../solana/verifySignature.js";

export const authRouter = Router();

authRouter.get("/token-gate", (_req, res) => {
  res.json(getTokenGateInfo());
});

authRouter.get("/auth/challenge", (req, res) => {
  const wallet = sanitizeWallet(String(req.query.wallet ?? ""));
  if (!wallet) {
    res.status(400).json({ error: "wallet is required" });
    return;
  }

  const challenge = createChallenge(wallet);
  res.json({
    wallet: challenge.wallet,
    message: challenge.message,
    expiresAt: challenge.expiresAt,
  });
});

authRouter.post("/auth/verify", async (req, res) => {
  if (!isTokenGateEnabled()) {
    const wallet = sanitizeWallet(String(req.body?.wallet ?? "dev-bypass"));
    const { token, expiresAt } = createAccessToken(wallet || "dev-bypass");
    res.json({
      accessToken: token,
      wallet: wallet || "dev-bypass",
      tokenBalance: 1,
      expiresAt,
    } satisfies AuthVerifyResponse);
    return;
  }

  const body = req.body as AuthVerifyRequest;
  const wallet = sanitizeWallet(body.wallet ?? "");
  const signature = String(body.signature ?? "");
  const message = String(body.message ?? "");

  if (!wallet || !signature || !message) {
    res.status(400).json({ error: "wallet, signature, and message are required" });
    return;
  }

  if (!consumeChallenge(wallet, message)) {
    res.status(401).json({ error: "Challenge expired or invalid" });
    return;
  }

  if (!verifyWalletSignature(wallet, message, signature)) {
    res.status(401).json({ error: "Invalid wallet signature" });
    return;
  }

  if (await isWalletBanned(wallet)) {
    res.status(403).json({ error: "This account has been banned." });
    return;
  }

  try {
    // Free to play: the wallet is proven (signature + ban check above), which
    // is all we need for identity. Skip the balance RPC entirely.
    let balance = 0;
    if (isTokenHoldingRequired()) {
      balance = await getWalletTokenBalance(wallet);
      const minUiAmount = getMinTokenUiAmount();
      if (balance < minUiAmount) {
        res.status(403).json({
          error: "Insufficient token balance",
          mint: getTokenGateInfo().mint,
          balance,
          required: minUiAmount,
        });
        return;
      }
    }

    const { token, expiresAt } = createAccessToken(wallet);
    res.json({
      accessToken: token,
      wallet,
      tokenBalance: balance,
      expiresAt,
    } satisfies AuthVerifyResponse);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Token verification failed";
    res.status(502).json({ error: messageText });
  }
});

/**
 * Telegram Mini App login — the walletless entry point.
 *
 * Issues the SAME access token as a wallet sign-in, but keyed to a synthetic
 * `tg:<id>` identity. The player can then do everything a wallet player can
 * EXCEPT anything on-chain (season payouts, gold desk, VIP, land) — those
 * require linking a real wallet, since there is no address to pay.
 */
authRouter.post("/auth/telegram", async (req, res) => {
  if (!isTelegramLoginConfigured()) {
    res.status(503).json({ error: "Telegram login is not configured on this server." });
    return;
  }

  const initData = String((req.body as { initData?: unknown })?.initData ?? "");
  const user = verifyTelegramInitData(initData);
  if (!user) {
    // Deliberately vague: don't help a forger distinguish bad HMAC from stale.
    res.status(401).json({ error: "Telegram verification failed. Reopen the app from Telegram." });
    return;
  }

  const identity = telegramIdentity(user.id);

  if (await isWalletBanned(identity)) {
    res.status(403).json({ error: "This account has been banned." });
    return;
  }

  const { token, expiresAt } = createAccessToken(identity);
  res.json({
    accessToken: token,
    wallet: identity,
    tokenBalance: 0,
    expiresAt,
  } satisfies AuthVerifyResponse);
});

authRouter.get("/auth/session", (req, res) => {
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  res.json({ wallet: payload.wallet, expiresAt: payload.exp });
});

function sanitizeWallet(wallet: string): string {
  const trimmed = wallet.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return "";
  return trimmed;
}