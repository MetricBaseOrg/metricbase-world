import { Router } from "express";
import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth.js";
import {
  beginXAuth,
  consumeXState,
  exchangeCodeForXUser,
  isXLinkConfigured,
} from "../auth/xAuth.js";
import { getXStatus, linkXToWallet, unlinkX } from "../db/xLink.js";

export const xLinkRouter = Router();

/**
 * Poll target for the connect flow. The client opens X sign-in in whatever
 * browser the shell allows and keeps THIS view open, polling here until the
 * link lands — so the flow never depends on the OAuth redirect returning to the
 * exact same webview (which Android's App Links make unreliable).
 */
xLinkRouter.get("/x/status", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  res.json(await getXStatus(wallet));
});

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
 * state back to the wallet (carried in `state`, so this needs no session of its
 * own), exchange the code, and link server-side. Because the link is now
 * recorded, the game/dashboard that started the flow picks it up by POLLING
 * `/x/status` — this page's only job is to tell the player they're done and let
 * them return. We never depend on this redirect re-entering the original view.
 */
xLinkRouter.get("/x/link/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  const denied = String(req.query.error ?? "");

  const page = (ok: boolean, message: string) =>
    res.status(200).type("html").send(resultPage(ok, message));

  if (denied) return page(false, "X connection was cancelled. You can close this and try again.");
  if (!code || !state) return page(false, "Missing authorization details from X.");

  const pending = consumeXState(state);
  if (!pending) return page(false, "This link expired. Head back to the game and tap Connect again.");

  const xUser = await exchangeCodeForXUser(code, pending.codeVerifier);
  if (!xUser) return page(false, "Couldn't verify your X account. Please try again.");

  const result = await linkXToWallet(pending.wallet, xUser.id, xUser.username);
  if (!result.ok) return page(false, result.reason);

  const note =
    result.awarded > 0
      ? `@${result.xUsername} connected — +${result.awarded} season points!`
      : `@${result.xUsername} connected.`;
  return page(true, note);
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

/**
 * The page X's redirect lands on. The link is already done server-side, so this
 * only confirms the result and offers a way back — it tries to close itself (if
 * opened as a tab/Custom Tab it can) and otherwise shows a "Back to the game"
 * button. The original view updates on its own via /x/status polling.
 */
function resultPage(ok: boolean, message: string): string {
  const safe = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Connect X — MetricBase World</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{margin:0;display:grid;place-items:center;min-height:100vh;background:#12101c;color:#eae6ff;
       font-family:system-ui,sans-serif;text-align:center;padding:24px}
  .card{max-width:340px}
  .mark{font-size:2.6rem;margin-bottom:10px}
  p{opacity:.9;line-height:1.5;margin:0 0 18px}
  a{display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;font-weight:700;
    padding:12px 24px;border-radius:12px}
</style></head>
<body>
  <div class="card">
    <div class="mark">${ok ? "✅" : "⚠️"}</div>
    <p>${safe}</p>
    <a href="/play">Back to the game</a>
  </div>
  <script>
    // If we were opened as a tab/Custom Tab the shell can close, do so — the
    // game behind us already knows the result from polling.
    setTimeout(function(){ try { window.close(); } catch (e) {} }, 1500);
  </script>
</body></html>`;
}
