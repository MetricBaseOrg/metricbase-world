import crypto from "node:crypto";
import { getPool } from "./pool.js";
import { getGrantedCodesCount } from "@metricbase/shared";

export function isInvitationSystemActive(): boolean {
  if (process.env.FORCE_INVITATION_SYSTEM === "true") {
    return true;
  }
  // Implement 3 days from June 26: June 29, 2026 (local time UTC+8)
  return Date.now() >= new Date("2026-06-29T00:00:00+08:00").getTime();
}

export interface InvitationRecord {
  code: string;
  inviteeWallet: string | null;
  inviteeName: string | null;
  usedAt: Date | null;
  createdAt: Date;
}

export async function getInvitationsForWallet(wallet: string): Promise<InvitationRecord[]> {
  const db = getPool();
  if (!db) return [];

  const result = await db.query<{
    code: string;
    invitee_wallet: string | null;
    invitee_name: string | null;
    used_at: Date | null;
    created_at: Date;
  }>(
    `SELECT i.code, i.invitee_wallet, i.used_at, i.created_at, c.name AS invitee_name
     FROM invitations i
     LEFT JOIN characters c ON c.wallet_address = i.invitee_wallet
     WHERE i.inviter_wallet = $1
     ORDER BY i.created_at DESC`,
    [wallet],
  );

  return result.rows.map((row) => ({
    code: row.code,
    inviteeWallet: row.invitee_wallet,
    inviteeName: row.invitee_name,
    usedAt: row.used_at,
    createdAt: row.created_at,
  }));
}

export async function getInvitedCount(wallet: string): Promise<number> {
  const db = getPool();
  if (!db) return 0;

  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM invitations WHERE inviter_wallet = $1 AND invitee_wallet IS NOT NULL`,
    [wallet],
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function getGeneratedCount(wallet: string): Promise<number> {
  const db = getPool();
  if (!db) return 0;

  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM invitations WHERE inviter_wallet = $1`,
    [wallet],
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function createInvitation(wallet: string): Promise<string> {
  const db = getPool();
  if (!db) throw new Error("Database disabled");

  const invitedCount = await getInvitedCount(wallet);
  const maxCodes = getGrantedCodesCount(invitedCount);
  const generatedCount = await getGeneratedCount(wallet);

  if (generatedCount >= maxCodes) {
    throw new Error("No invitation codes remaining to generate. Invite more players to get more codes!");
  }

  // Generate code INV-XXXX-XXXX
  const randPart1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const randPart2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const code = `INV-${randPart1}-${randPart2}`;

  await db.query(
    `INSERT INTO invitations (code, inviter_wallet) VALUES ($1, $2)`,
    [code, wallet],
  );

  return code;
}

export async function validateAndUseInviteCode(code: string, inviteeWallet: string): Promise<void> {
  if (!isInvitationSystemActive()) {
    return; // Invitation system not active yet
  }

  const db = getPool();
  if (!db) return;

  const trimmedCode = code.trim();
  if (!trimmedCode) {
    throw new Error("Invitation code is required.");
  }

  const result = await db.query<{
    inviter_wallet: string;
    invitee_wallet: string | null;
  }>(
    `SELECT inviter_wallet, invitee_wallet FROM invitations WHERE code = $1`,
    [trimmedCode],
  );

  if (result.rowCount === 0) {
    throw new Error("Invalid invitation code.");
  }

  const invitation = result.rows[0];
  if (invitation.invitee_wallet) {
     throw new Error("This invitation code has already been used.");
  }

  if (invitation.inviter_wallet === inviteeWallet) {
    throw new Error("You cannot use your own invitation code.");
  }

  await db.query(
    `UPDATE invitations SET invitee_wallet = $1, used_at = NOW() WHERE code = $2`,
    [inviteeWallet, trimmedCode],
  );
}

export interface InvitationsLeaderboardEntry {
  playerName: string | null;
  walletAddress: string;
  inviteCount: number;
}

export async function getInvitationsLeaderboard(): Promise<InvitationsLeaderboardEntry[]> {
  const db = getPool();
  if (!db) return [];

  try {
    const result = await db.query<{
      player_name: string | null;
      inviter_wallet: string;
      invite_count: string;
    }>(
      `SELECT c.name AS player_name, i.inviter_wallet, COUNT(i.invitee_wallet) AS invite_count
       FROM invitations i
       LEFT JOIN characters c ON c.wallet_address = i.inviter_wallet
       WHERE i.invitee_wallet IS NOT NULL
       GROUP BY c.name, i.inviter_wallet
       ORDER BY invite_count DESC, c.name ASC
       LIMIT 50`
    );

    return result.rows.map((row) => ({
      playerName: row.player_name,
      walletAddress: row.inviter_wallet,
      inviteCount: Number(row.invite_count),
    }));
  } catch (error) {
    console.warn("[invitations-leaderboard] query failed:", error);
    return [];
  }
}
