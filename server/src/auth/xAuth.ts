import crypto from "node:crypto";

/**
 * "Sign in with X" (OAuth 2.0 Authorization Code + PKCE) — the FREE way to prove
 * a player controls an X (Twitter) handle. No paid API tier is needed for the
 * login + reading the authenticated user's own profile (`/2/users/me`).
 *
 * Config (feature is disabled unless all three are set):
 *   X_CLIENT_ID     — the OAuth 2.0 client id from the X developer portal
 *   X_CLIENT_SECRET — set for a *confidential* client (recommended); omit for a
 *                     public client (PKCE-only)
 *   X_REDIRECT_URI  — must EXACTLY match a callback URL registered on the app,
 *                     e.g. https://world.metricbase.org/api/x/link/callback
 */

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";
/** Minimum scopes: read the authed user's profile. `tweet.read` is required
 *  alongside `users.read` by X even though we only read the user object. */
const SCOPES = "users.read tweet.read";

const STATE_TTL_MS = 10 * 60 * 1000;

export function isXLinkConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID && process.env.X_REDIRECT_URI);
}

function clientId(): string {
  return process.env.X_CLIENT_ID ?? "";
}
function clientSecret(): string | undefined {
  return process.env.X_CLIENT_SECRET || undefined;
}
function redirectUri(): string {
  return process.env.X_REDIRECT_URI ?? "";
}

/**
 * A pending authorization: ties the opaque `state` X echoes back to the wallet
 * that started the flow and the PKCE verifier that proves it's the same client.
 *
 * In-memory on purpose (same reasoning as the Telegram link codes): these live
 * minutes, and a server restart invalidating one is the safe failure — the
 * player just clicks Connect again.
 */
interface PendingAuth {
  wallet: string;
  codeVerifier: string;
  expiresAt: number;
}
const pending = new Map<string, PendingAuth>();

function sweepExpired(): void {
  const now = Date.now();
  for (const [state, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(state);
  }
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Begin a link flow for a verified wallet. Returns the X authorize URL to open. */
export function beginXAuth(wallet: string): { url: string } {
  sweepExpired();

  // One live flow per wallet: a new click retires the old state.
  for (const [state, entry] of pending) {
    if (entry.wallet === wallet) pending.delete(state);
  }

  const state = base64url(crypto.randomBytes(24));
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  pending.set(state, { wallet, codeVerifier, expiresAt: Date.now() + STATE_TTL_MS });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return { url: `${AUTHORIZE_URL}?${params.toString()}` };
}

/** Consume a returned state (single-use), yielding the wallet + PKCE verifier. */
export function consumeXState(rawState: string): PendingAuth | null {
  sweepExpired();
  const state = String(rawState ?? "").trim();
  if (!state) return null;
  const entry = pending.get(state);
  if (!entry) return null;
  pending.delete(state);
  return entry.expiresAt > Date.now() ? entry : null;
}

export interface XUser {
  id: string;
  username: string;
}

/**
 * Exchange the authorization code for a token and read the authenticated user.
 * Returns null on any failure (bad code, expired verifier, X hiccup) so callers
 * can show one generic "couldn't verify" message.
 */
export async function exchangeCodeForXUser(code: string, codeVerifier: string): Promise<XUser | null> {
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: codeVerifier,
      client_id: clientId(),
    });
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    const secret = clientSecret();
    if (secret) {
      // Confidential client: HTTP Basic auth with client_id:client_secret.
      headers.Authorization = `Basic ${Buffer.from(`${clientId()}:${secret}`).toString("base64")}`;
    }

    const tokenRes = await fetch(TOKEN_URL, { method: "POST", headers, body });
    if (!tokenRes.ok) {
      console.warn("[x-auth] token exchange failed:", tokenRes.status, await tokenRes.text().catch(() => ""));
      return null;
    }
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return null;

    const meRes = await fetch(ME_URL, { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!meRes.ok) {
      console.warn("[x-auth] /users/me failed:", meRes.status);
      return null;
    }
    const me = (await meRes.json()) as { data?: { id?: string; username?: string } };
    const id = me.data?.id;
    const username = me.data?.username;
    if (!id || !username) return null;
    return { id, username };
  } catch (error) {
    console.warn("[x-auth] exchange error:", error);
    return null;
  }
}
