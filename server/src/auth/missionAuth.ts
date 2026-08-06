// Mission Center authentication — email + password, deliberately separate from
// the game's wallet identity (see db/schema.sql). Password hashing is scrypt
// from node:crypto: strong, memory-hard, and already in the runtime, so this
// adds no dependency to a server that ships with eleven.
//
// The bootstrap account is seeded from MISSION_BOOTSTRAP_PASSWORD with
// must_change_password set. The default is NEVER committed — this repo has a
// public remote, and a known default in git means whoever tries it first owns
// the console.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import {
  createSession,
  getAdminUser,
  getSession,
  seedAdminUser,
  touchLogin,
  type AdminUser,
} from "../db/missionAdmin.js";

const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;
export const SESSION_COOKIE = "mb_mission";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const BOOTSTRAP_EMAIL = (process.env.MISSION_ADMIN_EMAIL ?? "axdermawan@gmail.com").toLowerCase();

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Node's default maxmem (32MB) is too small for N=16384 with the default
    // r=8/p=1 accounting, so raise it rather than weakening the parameters.
    scrypt(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Encoded as `scrypt$<N>$<saltHex>$<hashHex>` so the cost can be raised later
 *  without invalidating existing hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (!Number.isInteger(n) || n < 1024 || salt.length === 0 || expected.length === 0) return false;
  try {
    const key = await new Promise<Buffer>((resolve, reject) =>
      scrypt(password, salt, expected.length, { N: n, maxmem: 64 * 1024 * 1024 }, (err, k) =>
        err ? reject(err) : resolve(k),
      ),
    );
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/** Password rules for the forced change. Kept modest and explicit — a rule the
 *  operator can't satisfy from memory just becomes a sticky note. */
export function validateNewPassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "That's too long.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return "Mix upper and lower case.";
  if (!/[0-9]/.test(password)) return "Include at least one number.";
  return null;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/** Seed the single admin account on first boot. No-ops once a row exists, so a
 *  later password change can never be undone by a restart. */
export async function seedBootstrapAdmin(): Promise<void> {
  const existing = await getAdminUser(BOOTSTRAP_EMAIL);
  if (existing) return;
  const bootstrap = process.env.MISSION_BOOTSTRAP_PASSWORD?.trim();
  if (!bootstrap) {
    console.log("[mission] No admin account and MISSION_BOOTSTRAP_PASSWORD is unset — /mission stays locked.");
    return;
  }
  await seedAdminUser(BOOTSTRAP_EMAIL, await hashPassword(bootstrap), true);
  console.log(`[mission] Seeded admin ${BOOTSTRAP_EMAIL}. A password change is required at first login.`);
}

// ---------------------------------------------------------------------------
// Login rate limiting — in-memory, per IP and per email.
// ---------------------------------------------------------------------------

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; first: number }>();

export function isRateLimited(...keys: string[]): boolean {
  const now = Date.now();
  for (const key of keys) {
    const entry = attempts.get(key);
    if (entry && now - entry.first < ATTEMPT_WINDOW_MS && entry.count >= MAX_ATTEMPTS) return true;
  }
  return false;
}

export function recordFailedAttempt(...keys: string[]): void {
  const now = Date.now();
  for (const key of keys) {
    const entry = attempts.get(key);
    if (!entry || now - entry.first >= ATTEMPT_WINDOW_MS) attempts.set(key, { count: 1, first: now });
    else entry.count += 1;
  }
  // Opportunistic sweep; the map only ever holds a handful of keys.
  if (attempts.size > 500) {
    for (const [k, v] of attempts) if (now - v.first >= ATTEMPT_WINDOW_MS) attempts.delete(k);
  }
}

export function clearAttempts(...keys: string[]): void {
  for (const key of keys) attempts.delete(key);
}

export function clientIp(req: Request): string {
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
  return fwd || req.socket.remoteAddress || "unknown";
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Parse the raw Cookie header. Avoids a cookie-parser dependency for the one
 *  cookie this server sets. */
export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export async function startSession(req: Request, res: Response, email: string): Promise<string> {
  const id = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await createSession(id, email, expires, clientIp(req), String(req.headers["user-agent"] ?? "").slice(0, 300));
  await touchLogin(email);
  setSessionCookie(res, id);
  return id;
}

export function setSessionCookie(res: Response, id: string): void {
  // Secure is set unless we're plainly on localhost — otherwise the cookie is
  // silently dropped in local HTTP testing and login appears to "do nothing".
  const secure = process.env.MISSION_INSECURE_COOKIE === "true" ? "" : " Secure;";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${id}; Path=/;${secure} HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export interface MissionRequest extends Request {
  missionUser: AdminUser;
}

async function resolveUser(req: Request): Promise<AdminUser | null> {
  const id = readCookie(req, SESSION_COOKIE);
  if (!id) return null;
  const session = await getSession(id);
  if (!session) return null;
  return await getAdminUser(session.email);
}

/** API guard: 401 JSON. Also 403s every route except the change-password one
 *  while the bootstrap password is still in place. */
export function requireMissionAdmin(req: Request, res: Response, next: NextFunction): void {
  void resolveUser(req).then((user) => {
    if (!user) {
      res.status(401).json({ error: "Not signed in." });
      return;
    }
    // /me stays reachable so the console can render the change-password gate
    // with the operator's own email on it; everything else is sealed.
    if (user.mustChangePassword && !req.path.endsWith("/password") && !req.path.endsWith("/me")) {
      res.status(403).json({ error: "password_change_required" });
      return;
    }
    (req as MissionRequest).missionUser = user;
    next();
  }).catch((error) => {
    console.error("[mission] auth check failed:", error);
    res.status(500).json({ error: "Auth check failed." });
  });
}

/** Page guard: redirect to the login screen instead of returning JSON. */
export function requireMissionPage(req: Request, res: Response, next: NextFunction): void {
  void resolveUser(req).then((user) => {
    if (!user) {
      res.redirect("/mission/login");
      return;
    }
    (req as MissionRequest).missionUser = user;
    next();
  }).catch(() => res.redirect("/mission/login"));
}
