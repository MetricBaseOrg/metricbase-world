// Player-to-player mail: a subject + body with an optional gold attachment,
// stored server-side. A small send fee keeps spam down.

export const MAIL_MAX_SUBJECT = 60;
export const MAIL_MAX_BODY = 500;
export const MAIL_MAX_INBOX = 50;
/** Flat gold fee to send a letter (on top of any attached gold). */
export const MAIL_SEND_COST = 10;
/** Most gold you can attach to one letter. */
export const MAIL_MAX_GOLD = 1_000_000;

export interface MailMessage {
  id: number;
  sender: string;
  /** Present on sent-box rows so the outbox can show who the letter went to. */
  recipient?: string;
  subject: string;
  body: string;
  gold: number;
  claimed: boolean;
  read: boolean;
  sentAt: number;
}

export interface MailStatePayload {
  messages: MailMessage[];
  /** Letters this player sent (outbox), newest first. */
  sent?: MailMessage[];
  unread: number;
}

export interface MailResultPayload {
  ok: boolean;
  error?: string;
  state?: MailStatePayload;
}

/** Validate compose fields; returns an error string or null when valid. */
export function validateMail(
  to: string,
  subject: string,
  body: string,
  gold: number,
): string | null {
  if (!to.trim()) return "Enter a recipient.";
  if (!subject.trim()) return "Enter a subject.";
  if (subject.length > MAIL_MAX_SUBJECT) return "Subject is too long.";
  if (body.length > MAIL_MAX_BODY) return "Message is too long.";
  if (!Number.isFinite(gold) || gold < 0) return "Invalid gold amount.";
  if (gold > MAIL_MAX_GOLD) return `You can attach at most ${MAIL_MAX_GOLD.toLocaleString()} gold.`;
  return null;
}
