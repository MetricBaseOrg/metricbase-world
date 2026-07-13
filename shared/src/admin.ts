// Admin moderation: ban/unban payloads exchanged over the room connection.
// Admin = the treasury wallet (+ ADMIN_WALLETS env), verified server-side on
// every message — the client flag only controls whether the UI is shown.

export interface AdminBanRecord {
  wallet: string;
  name: string | null;
  reason: string;
  bannedAt: number;
}

export interface AdminBanListPayload {
  ok: boolean;
  /** Whether the requesting player is an admin (drives UI visibility). */
  isAdmin: boolean;
  bans: AdminBanRecord[];
}

export interface AdminActionResultPayload {
  ok: boolean;
  error?: string;
  message?: string;
}
