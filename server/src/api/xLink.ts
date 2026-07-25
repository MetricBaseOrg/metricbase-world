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
 * Step 2: X redirects the popup here with `code` + `state`. We resolve the
 * state back to the wallet, exchange the code for the user's X identity, link
 * it, and return a tiny HTML page that reports the result to the opener window
 * and closes itself. All outcomes render a page (never a bare JSON error) —
 * this is a user-facing browser navigation, not an API call.
 */
xLinkRouter.get("/x/link/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  const denied = String(req.query.error ?? "");

  const fail = (message: string) => res.status(200).type("html").send(resultPage(false, message));

  if (denied) return fail("X connection was cancelled.");
  if (!code || !state) return fail("Missing authorization details from X.");

  const pending = consumeXState(state);
  if (!pending) return fail("This link expired. Head back and click Connect again.");

  const xUser = await exchangeCodeForXUser(code, pending.codeVerifier);
  if (!xUser) return fail("Couldn't verify your X account. Please try again.");

  const result = await linkXToWallet(pending.wallet, xUser.id, xUser.username);
  if (!result.ok) return fail(result.reason);

  const note =
    result.awarded > 0
      ? `Connected @${result.xUsername} — +${result.awarded} season points!`
      : `Connected @${result.xUsername}.`;
  res.status(200).type("html").send(resultPage(true, note, result.xUsername));
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
 * The popup's final page: message the opener so the dashboard can refresh, then
 * close. Falls back to a readable message if it wasn't opened as a popup.
 */
function resultPage(ok: boolean, message: string, username?: string): string {
  const payload = JSON.stringify({ source: "mb-x-link", ok, username: username ?? null });
  const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Connect X — MetricBase World</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{margin:0;display:grid;place-items:center;min-height:100vh;background:#12101c;color:#eae6ff;
       font-family:system-ui,sans-serif;text-align:center;padding:24px}
  .card{max-width:340px}
  .mark{font-size:2.4rem;margin-bottom:8px}
  p{opacity:.85;line-height:1.5}
</style></head>
<body>
  <div class="card">
    <div class="mark">${ok ? "✅" : "⚠️"}</div>
    <p>${safeMessage}</p>
    <p style="opacity:.55;font-size:.85rem">You can close this window.</p>
  </div>
  <script>
    try { if (window.opener) window.opener.postMessage(${payload}, "*"); } catch (e) {}
    setTimeout(function(){ try { window.close(); } catch (e) {} }, 1200);
  </script>
</body></html>`;
}
