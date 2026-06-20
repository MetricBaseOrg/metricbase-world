import crypto from "node:crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000;

interface AccessPayload {
  wallet: string;
  exp: number;
}

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "metricbase-dev-secret-change-me";
}

export function createAccessToken(wallet: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload: AccessPayload = { wallet, exp: expiresAt };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return { token: `${body}.${signature}`, expiresAt };
}

export function verifyAccessToken(token: string): AccessPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AccessPayload;
    if (!payload.wallet || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}