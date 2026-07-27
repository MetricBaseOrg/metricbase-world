/**
 * A fetch that can't hand the browser's own words to a player.
 *
 * `fetch()` rejects with `TypeError: Failed to fetch` for EVERY transport
 * failure — offline, DNS, TLS, a dropped mobile connection, a server not
 * answering. That string used to travel straight through this helper into UI
 * that renders `err.message`, so an Android/TWA cold start with the network
 * not yet up showed the player the literal text "Failed to fetch": names no
 * cause, suggests no action, and looks like the game is broken.
 *
 * Transport failures now arrive as a `NetworkError` carrying a sentence a
 * player can act on, with `kind` for callers that must branch — notably: a
 * network failure must never be mistaken for a rejected session.
 */

export type NetworkErrorKind = "offline" | "timeout" | "unreachable";

export class NetworkError extends Error {
  readonly kind: NetworkErrorKind;

  constructor(message: string, kind: NetworkErrorKind) {
    super(message);
    this.name = "NetworkError";
    this.kind = kind;
  }
}

/** True when the CONNECTION failed, as opposed to the server answering badly. */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new NetworkError(
        "The game server took too long to answer. Check your connection and try again.",
        "timeout",
      );
    }
    // navigator.onLine is only trustworthy when FALSE — `true` merely means a
    // network interface exists. Used to sharpen the message, never to decide
    // whether to attempt the request.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new NetworkError("You're offline. Reconnect and try again.", "offline");
    }
    if (error instanceof TypeError) {
      throw new NetworkError(
        "Couldn't reach the game server. Check your connection and try again.",
        "unreachable",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}