const RPC_TIMEOUT_MS = 20_000;

const DEFAULT_RPC_FALLBACKS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

export function getRpcUrls(): string[] {
  const configured = process.env.SOLANA_RPC_URL?.trim();
  if (configured) {
    return [configured];
  }
  return [...new Set(DEFAULT_RPC_FALLBACKS)];
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