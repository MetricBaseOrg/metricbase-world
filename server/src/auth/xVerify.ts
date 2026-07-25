import crypto from "node:crypto";

/**
 * Verification for X engagement tasks (Phase 2) — no paid API, no scraper.
 *
 *  1. Each task issues a player a deterministic CODE (HMAC of wallet+task). It's
 *     unguessable and unique per player, so it can't be copy-pasted between
 *     accounts, and we never have to store it.
 *  2. The player includes the code in their reply/quote, then pastes the URL of
 *     THAT tweet back to us.
 *  3. We read the tweet through X's FREE public oEmbed endpoint and check it was
 *     authored by the player's linked handle and contains their code.
 */

/** Secret for the per-player codes. Falls back to the X client secret / a
 *  boot-random value so a code can't be forged without server state. */
function codeSecret(): string {
  return process.env.X_TASK_SECRET || process.env.X_CLIENT_SECRET || process.env.SESSION_SECRET || "mb-x-task";
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** The player-specific code to include in a post for a task. */
export function taskCode(wallet: string, taskId: string): string {
  const h = crypto.createHmac("sha256", codeSecret()).update(`${wallet}:${taskId}`).digest();
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[h[i] % CODE_ALPHABET.length];
  return `MB-${s}`;
}

export interface TweetInfo {
  /** Author handle WITHOUT the @, or null if it couldn't be read. */
  handle: string | null;
  /** Plain-text of the tweet (tags stripped). */
  text: string;
  /** The raw oEmbed html (used to spot a quoted target tweet). */
  html: string;
}

const TWEET_URL_RE = /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^/]+\/status\/\d+/i;

export function isTweetUrl(url: string): boolean {
  return TWEET_URL_RE.test(url.trim());
}

/**
 * Read a tweet via oEmbed. Returns null on any failure (deleted, protected,
 * not yet indexed, bad URL) so callers show one friendly "couldn't read it".
 */
export async function readTweet(url: string): Promise<TweetInfo | null> {
  try {
    const endpoint = `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url.trim())}`;
    const res = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { author_url?: string; html?: string };
    const html = data.html ?? "";
    const handle = data.author_url?.match(/(?:twitter|x)\.com\/([^/?#]+)/i)?.[1] ?? null;
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { handle, text, html };
  } catch {
    return null;
  }
}
