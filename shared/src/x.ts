// X (Twitter) engagement tasks — Phase 2 of the X integration. Players reply to
// or quote (repost-with-comment) a target tweet to earn season points. Verified
// for FREE via X's public oEmbed endpoint: a task issues each player a unique
// code, they include it in their post, and the server checks the pasted tweet
// was authored by their linked handle and contains that code. See [[x-integration]].

/** "reply" = reply to the target tweet; "quote" = repost it with a comment. */
export type XTaskType = "reply" | "quote";

export interface XTaskView {
  id: string;
  type: XTaskType;
  title: string;
  description: string;
  /** URL of the tweet to reply to / quote. */
  targetUrl: string;
  /** Hashtag/handle the post must include (e.g. "#MetricBase"), or "". */
  hashtag: string;
  points: number;
  /** THIS player's unique code to include in the post (empty if not linked). */
  code: string;
  /** Whether this player has already claimed this task. */
  claimed: boolean;
}

export interface XTasksResponse {
  /** False when the player hasn't linked an X account yet. */
  linked: boolean;
  handle: string | null;
  tasks: XTaskView[];
  /** True for the treasury/admin wallet — unlocks the inline task creator. */
  admin: boolean;
}

export interface XClaimResult {
  ok: boolean;
  points?: number;
  error?: string;
}

/** Prefill URL that opens X's composer for a task, code + hashtag filled in. */
export function xTaskIntentUrl(task: XTaskView): string {
  const tweetId = task.targetUrl.match(/status\/(\d+)/)?.[1] ?? "";
  const bits = [task.hashtag, task.code].filter(Boolean).join(" ");
  const text = encodeURIComponent(bits ? `${bits}` : "");
  if (task.type === "reply" && tweetId) {
    return `https://twitter.com/intent/tweet?in_reply_to=${tweetId}&text=${text}`;
  }
  // quote: attach the target tweet as the quoted URL.
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(task.targetUrl)}&text=${text}`;
}
