// Standalone Brand Portal API: lets advertisers fund + run ad campaigns with
// nothing but a wallet — no game character, and no player token-gate (brands
// prove wallet ownership by signature; they pay in $BASE via deposits anyway).
// Reuses the existing challenge flow (GET /api/auth/challenge) for the message
// to sign, then POST /api/brand/auth issues the same access tokens the rest of
// the API understands.

import {
  AD_MIN_CPM,
  AD_MIN_DEPOSIT,
  AD_PLAYER_SHARE,
  METRICBASE_TOKEN_MINT,
  TOKEN_DECIMALS,
  validateCampaign,
} from "@metricbase/shared";
import { Router, type Request } from "express";
import { adService } from "../ads/adService.js";
import { createAccessToken, verifyAccessToken } from "../auth/accessToken.js";
import { consumeChallenge } from "../auth/challenges.js";
import { verifyPeerTokenTransfer } from "../solana/verifyPeerTokenTransfer.js";
import { verifyWalletSignature } from "../solana/verifySignature.js";

export const brandsRouter = Router();

function getMint(): string {
  return process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;
}

/** Wallet from the Bearer access token, or null. */
function authedWallet(req: Request): string | null {
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const payload = verifyAccessToken(token);
  return payload?.wallet ?? null;
}

/** Public portal config + live marketplace numbers for the pitch page. */
brandsRouter.get("/brand/info", async (_req, res) => {
  const house = adService.houseWallet();
  res.json({
    enabled: Boolean(house),
    houseWallet: house,
    mint: getMint(),
    decimals: TOKEN_DECIMALS,
    rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
    minDeposit: AD_MIN_DEPOSIT,
    minCpm: AD_MIN_CPM,
    sharePct: Math.round(AD_PLAYER_SHARE * 100),
    stats: await adService.getPublicStats(),
  });
});

/**
 * Brand sign-in: same challenge + signature as the player flow, but WITHOUT
 * the minimum-$BASE holding gate — advertisers only need to own their wallet.
 */
brandsRouter.post("/brand/auth", (req, res) => {
  const wallet = String(req.body?.wallet ?? "").trim();
  const signature = String(req.body?.signature ?? "");
  const message = String(req.body?.message ?? "");
  if (!wallet || wallet.length < 32 || wallet.length > 44 || !signature || !message) {
    return void res.status(400).json({ error: "wallet, signature, and message are required" });
  }
  if (!consumeChallenge(wallet, message)) {
    return void res.status(401).json({ error: "Challenge expired or invalid" });
  }
  if (!verifyWalletSignature(wallet, message, signature)) {
    return void res.status(401).json({ error: "Invalid wallet signature" });
  }
  const { token, expiresAt } = createAccessToken(wallet);
  res.json({ accessToken: token, wallet, expiresAt });
});

/** Balance + campaign list for the signed-in brand. */
brandsRouter.get("/brand/dashboard", async (req, res) => {
  const wallet = authedWallet(req);
  if (!wallet) return void res.status(401).json({ error: "Sign in first." });
  await adService.syncBrand(wallet);
  res.json(adService.getBrandDashboard(wallet));
});

/** Credit a verified $BASE deposit (idempotent by transaction signature). */
brandsRouter.post("/brand/deposit", async (req, res) => {
  const wallet = authedWallet(req);
  if (!wallet) return void res.status(401).json({ error: "Sign in first." });
  const signature = String(req.body?.signature ?? "");
  if (!signature || signature.length < 32) {
    return void res.status(400).json({ error: "Missing deposit transaction." });
  }
  const house = adService.houseWallet();
  if (!house) return void res.status(503).json({ error: "Ad deposits are disabled right now." });

  const v = await verifyPeerTokenTransfer(signature, {
    fromWallet: wallet,
    toWallet: house,
    mint: getMint(),
    minUiAmount: AD_MIN_DEPOSIT,
  });
  if (!v.ok || v.uiAmount === undefined) {
    return void res.status(402).json({ error: v.error ?? "Deposit not found on-chain." });
  }
  const credited = await adService.creditDeposit(wallet, v.uiAmount, signature);
  res.json({ ok: true, credited: credited.credited, balance: credited.balance, dashboard: adService.getBrandDashboard(wallet) });
});

/** Create a campaign (goes to pending review, like the in-game flow). */
brandsRouter.post("/brand/campaign", async (req, res) => {
  const wallet = authedWallet(req);
  if (!wallet) return void res.status(401).json({ error: "Sign in first." });
  const name = String(req.body?.name ?? "");
  const imageUrl = String(req.body?.imageUrl ?? "");
  const headline = String(req.body?.headline ?? "");
  const clickUrl = String(req.body?.clickUrl ?? "");
  const cpm = Number(req.body?.cpm ?? 0);
  const invalid = validateCampaign(name, imageUrl, headline, clickUrl, cpm);
  if (invalid) return void res.status(400).json({ error: invalid });
  await adService.createCampaign(wallet, { name, imageUrl, headline, clickUrl, cpm });
  res.json({ ok: true, dashboard: adService.getBrandDashboard(wallet) });
});

/** Pause / resume one of the brand's own campaigns. */
brandsRouter.post("/brand/campaign/pause", async (req, res) => {
  const wallet = authedWallet(req);
  if (!wallet) return void res.status(401).json({ error: "Sign in first." });
  const result = await adService.pauseCampaign(wallet, String(req.body?.id ?? ""), Boolean(req.body?.paused));
  if (!result.ok) return void res.status(400).json(result);
  res.json({ ok: true, dashboard: adService.getBrandDashboard(wallet) });
});

/** Edit one of the brand's own campaigns (re-enters review if creative changed). */
brandsRouter.post("/brand/campaign/edit", async (req, res) => {
  const wallet = authedWallet(req);
  if (!wallet) return void res.status(401).json({ error: "Sign in first." });
  const name = String(req.body?.name ?? "");
  const imageUrl = String(req.body?.imageUrl ?? "");
  const headline = String(req.body?.headline ?? "");
  const clickUrl = String(req.body?.clickUrl ?? "");
  const cpm = Number(req.body?.cpm ?? 0);
  const invalid = validateCampaign(name, imageUrl, headline, clickUrl, cpm);
  if (invalid) return void res.status(400).json({ error: invalid });
  const result = await adService.editCampaign(wallet, String(req.body?.id ?? ""), { name, imageUrl, headline, clickUrl, cpm });
  if (!result.ok) return void res.status(400).json(result);
  res.json({ ok: true, dashboard: adService.getBrandDashboard(wallet) });
});
