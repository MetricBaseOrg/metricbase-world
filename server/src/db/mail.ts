import { MAIL_MAX_INBOX, type MailMessage } from "@metricbase/shared";
import { getPool } from "./pool.js";

type MailRow = {
  id: string | number;
  sender: string;
  subject: string;
  body: string;
  gold: number | null;
  claimed: boolean | null;
  read: boolean | null;
  created_at: string | number | Date;
};

function mapRow(row: MailRow): MailMessage {
  const sentAt =
    row.created_at instanceof Date
      ? row.created_at.getTime()
      : typeof row.created_at === "string"
        ? Date.parse(row.created_at)
        : Number(row.created_at);
  return {
    id: Number(row.id),
    sender: row.sender,
    subject: row.subject,
    body: row.body,
    gold: row.gold ?? 0,
    claimed: row.claimed === true,
    read: row.read === true,
    sentAt: Number.isFinite(sentAt) ? sentAt : Date.now(),
  };
}

/** Does a character with this name exist? (used to reject mail to typos). */
export async function characterExists(name: string): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  const result = await db.query(`SELECT 1 FROM characters WHERE name = $1 LIMIT 1`, [name]);
  return (result.rowCount ?? 0) > 0;
}

export async function insertMail(
  sender: string,
  recipient: string,
  subject: string,
  body: string,
  gold: number,
): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO mail (recipient, sender, subject, body, gold) VALUES ($1, $2, $3, $4, $5)`,
    [recipient, sender, subject, body, gold],
  );
}

export async function getInbox(recipient: string): Promise<MailMessage[]> {
  const db = getPool();
  if (!db) return [];
  const result = await db.query<MailRow>(
    `SELECT id, sender, subject, body, gold, claimed, read, created_at
     FROM mail WHERE recipient = $1
     ORDER BY created_at DESC LIMIT $2`,
    [recipient, MAIL_MAX_INBOX],
  );
  return result.rows.map(mapRow);
}

export async function countUnread(recipient: string): Promise<number> {
  const db = getPool();
  if (!db) return 0;
  const result = await db.query<{ n: string }>(
    `SELECT COUNT(*)::int AS n FROM mail WHERE recipient = $1 AND read = false`,
    [recipient],
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function markMailRead(id: number, recipient: string): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(`UPDATE mail SET read = true WHERE id = $1 AND recipient = $2`, [id, recipient]);
}

/**
 * Claim a letter's gold attachment exactly once. Returns the gold amount to
 * grant (0 if nothing to claim / already claimed).
 */
export async function claimMailGold(id: number, recipient: string): Promise<number> {
  const db = getPool();
  if (!db) return 0;
  const result = await db.query<{ gold: number }>(
    `UPDATE mail SET claimed = true, read = true
     WHERE id = $1 AND recipient = $2 AND claimed = false AND gold > 0
     RETURNING gold`,
    [id, recipient],
  );
  return result.rowCount ? Number(result.rows[0].gold) : 0;
}

export async function deleteMail(id: number, recipient: string): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(`DELETE FROM mail WHERE id = $1 AND recipient = $2`, [id, recipient]);
}
