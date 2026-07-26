const RPC_TIMEOUT_MS = 20_000;

const DEFAULT_RPC_FALLBACKS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
  // Historical lookups (getTransaction) are the first thing free endpoints
  // throttle or refuse, and they refuse datacenter IPs like Railway's hardest —
  // so payment verification needs more than one place to ask. Verified to serve
  // transaction history without a key.
  //
  // NOT included: solana.drpc.org — its free tier answers HTTP 400 "chain is
  // not available on free plan", so it only ever adds a guaranteed failure and
  // a wasted round trip.
  "https://api.mainnet.solana.com",
];

/**
 * A fetch with a hard timeout, for passing into web3.js `Connection`.
 *
 * Without it a hanging endpoint holds the whole fallback chain open until
 * web3.js' own long default expires, which can outlast the caller and surface
 * as "no response" rather than moving on to the next endpoint.
 */
export function timeoutFetch(timeoutMs = 8000): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * RPC endpoints to try, in order: the configured one first, then the public
 * fallbacks.
 *
 * The configured URL used to be the ONLY entry, which made "fallback" a lie
 * whenever SOLANA_RPC_URL was set — one flaky or rate-limited provider took down
 * every on-chain check, including payment verification, with no second chance.
 * The public endpoints are slower and throttled, which is exactly why they
 * belong last rather than nowhere.
 */
export function getRpcUrls(): string[] {
  const configured = process.env.SOLANA_RPC_URL?.trim();
  return [...new Set(configured ? [configured, ...DEFAULT_RPC_FALLBACKS] : DEFAULT_RPC_FALLBACKS)];
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

export async function jsonRpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`${label} failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as JsonRpcResponse<T>;
    if (payload.error) {
      throw new Error(payload.error.message);
    }
    if (payload.result === undefined) {
      throw new Error(`${label} returned no result`);
    }

    return payload.result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out. Try again in a moment.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function withRpcFallback<T>(
  operation: (rpcUrl: string) => Promise<T>,
  label: string,
): Promise<T> {
  const urls = getRpcUrls();
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      return await operation(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[solana] ${label} failed via ${url}: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error(`${label} failed`);
}