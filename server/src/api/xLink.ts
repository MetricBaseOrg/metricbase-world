import { Router } from "express";
import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth.js";
import {
  beginXAuth,
  consumeXState,
  exchangeCodeForXUser,
  isXLinkConfigured,
} from "../auth/xAuth.js";
import { linkXToWallet, unlinkX } from "../db/xLink.js";

export const xLinkRouter = Router();

/**
 * Step 1: a wallet-authenticated player asks to connect X. We mint a PKCE flow
 * bound to their wallet (via the OAuth `state`) and hand back the X authorize
 * URL for the client to open in a popup. The callback carries no auth header of
 * its own, so the wallet is remembered server-side against the state.
 */
xLinkRouter.get("/x/link/start", requireAuth, (req, res) => {
  if (!isXLinkConfigured()) {
    res.status(503).json({ error: "X connect isn't configured on this server yet." });
    return;
  }
  const wallet = (req as AuthenticatedRequest).authWallet;
  const { url } = beginXAuth(wallet);
  res.json({ url });
});

/**
 * Step 2: X redirects the browser here with `code` + `state`. We resolve the
 * state back to the wallet, exchange the code for the user's X identity, link
 * it, and REDIRECT back to /dashboard with the outcome in the query string.
 *
 * A full-page redirect (rather than a popup + postMessage) is what makes this
 * work inside the Android app's web view: there, the login opens in a separate
 * tab with no opener to message or close, so a redirect back to our own origin
 * is the only reliable way to land the player back on the dashboard.
 */
xLinkRouter.get("/x/link/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  const denied = String(req.query.error ?? "");

  const back = (params: Record<string, string>) =>
    res.redirect(302, `/dashboard?${new URLSearchParams(params).toString()}`);
  const fail = (message: string) => back({ xlink: "error", msg: message });

  if (denied) return back({ xlink: "cancelled" });
  if (!code || !state) return fail("Missing authorization details from X.");

  const pending = consumeXState(state);
  if (!pending) return fail("This link expired. Head back and tap Connect again.");

  const xUser = await exchangeCodeForXUser(code, pending.codeVerifier);
  if (!xUser) return fail("Couldn't verify your X account. Please try again.");

  const result = await linkXToWallet(pending.wallet, xUser.id, xUser.username);
  if (!result.ok) return fail(result.reason);

  return back({ xlink: "ok", handle: result.xUsername, pts: String(result.awarded) });
});

/** Detach the X account from this wallet's character. */
xLinkRouter.post("/x/unlink", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const ok = await unlinkX(wallet);
  if (!ok) {
    res.status(404).json({ error: "Nothing to disconnect." });
    return;
  }
  res.json({ ok: true, xLinked: false });
});
