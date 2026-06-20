import {
  type AuthVerifyRequest,
  type AuthVerifyResponse,
  MIN_TOKEN_UI_AMOUNT,
} from "@metricbase/shared";
import { Router } from "express";
import { createAccessToken, verifyAccessToken } from "../auth/accessToken.js";
import { consumeChallenge, createChallenge } from "../auth/challenges.js";
import { getTokenGateInfo, isTokenGateEnabled } from "../auth/tokenGate.js";
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

  try {
    const balance = await getWalletTokenBalance(wallet);
    const minUiAmount = Number(process.env.MIN_TOKEN_UI_AMOUNT ?? MIN_TOKEN_UI_AMOUNT);
    if (balance < minUiAmount) {
      res.status(403).json({
        error: "Insufficient token balance",
        mint: getTokenGateInfo().mint,
        balance,
        required: minUiAmount,
      });
      return;
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