// Mission Center admin accounts, sessions and audit trail. Thin data layer —
// all password handling lives in auth/missionAuth.ts so hashes never leak into
// query-shaped code.

import { getPool } from "./pool.js";

export interface AdminUser {
  email: string;
  passwordHash: string;
  mustChangePassword: boolean;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface MissionSession {
  id: string;
  email: string;
  expiresAt: number;
}

export interface AuditEntry {
  id: number;
  email: string;
  action: string;
  detail: Record<string, unknown>;
  at: number;
}

export async function getAdminUser(email: string): Promise<AdminUser | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    "SELECT email, password_hash, must_change_password, created_at, last_login_at FROM admin_users WHERE email = $1",
    [email.toLowerCase()],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    email: row.email as string,
    passwordHash: row.password_hash as string,
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: new Date(row.created_at as string).getTime(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at as string).getTime() : null,
  };
}

/** Insert the bootstrap row. ON CONFLICT DO NOTHING so a restart can never
 *  reset a password the operator has already changed. */
export async function seedAdminUser(email: string, passwordHash: string, mustChange: boolean): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, must_change_password)
     VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
    [email.toLowerCase(), passwordHash, mustChange],
  );
}

export async function setAdminPassword(email: string, passwordHash: string): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query(
    "UPDATE admin_users SET password_hash = $2, must_change_password = FALSE WHERE email = $1",
    [email.toLowerCase(), passwordHash],
  );
}

export async function touchLogin(email: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("UPDATE admin_users SET last_login_at = NOW() WHERE email = $1", [email.toLowerCase()]);
}

export async function createSession(
  id: string,
  email: string,
  expiresAt: Date,
  ip: string,
  userAgent: string,
): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await pool.query(
    "INSERT INTO mission_sessions (id, email, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)",
    [id, email.toLowerCase(), expiresAt.toISOString(), ip, userAgent],
  );
}

export async function getSession(id: string): Promise<MissionSession | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    "SELECT id, email, expires_at FROM mission_sessions WHERE id = $1 AND expires_at > NOW()",
    [id],
  );
  const row = res.rows[0];
  if (!row) return null;
  return { id: row.id as string, email: row.email as string, expiresAt: new Date(row.expires_at as string).getTime() };
}

export async function deleteSession(id: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("DELETE FROM mission_sessions WHERE id = $1", [id]);
}

/** Used after a password change: every other device is signed out. */
export async function deleteSessionsFor(email: string, exceptId?: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (exceptId) {
    await pool.query("DELETE FROM mission_sessions WHERE email = $1 AND id <> $2", [email.toLowerCase(), exceptId]);
  } else {
    await pool.query("DELETE FROM mission_sessions WHERE email = $1", [email.toLowerCase()]);
  }
}

export async function purgeExpiredSessions(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM mission_sessions WHERE expires_at < NOW()");
  } catch (error) {
    console.warn("[mission] session purge failed:", error);
  }
}

/** Append-only. Never throws into the caller — an audit write failing must not
 *  abort the action it describes, but it must be loud in the logs. */
export async function audit(email: string, action: string, detail: Record<string, unknown> = {}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("INSERT INTO mission_audit (email, action, detail) VALUES ($1, $2, $3)", [
      email.toLowerCase(),
      action,
      JSON.stringify(detail),
    ]);
  } catch (error) {
    console.error("[mission] AUDIT WRITE FAILED", action, error);
  }
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    "SELECT id, email, action, detail, at FROM mission_audit ORDER BY at DESC LIMIT $1",
    [Math.min(Math.max(limit, 1), 500)],
  );
  return res.rows.map((r) => ({
    id: Number(r.id),
    email: r.email as string,
    action: r.action as string,
    detail: (r.detail as Record<string, unknown>) ?? {},
    at: new Date(r.at as string).getTime(),
  }));
}
