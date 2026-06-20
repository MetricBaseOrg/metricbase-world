import { Connection } from "@solana/web3.js";

const RPC_TIMEOUT_MS = 12_000;

const DEFAULT_RPC_FALLBACKS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
];

export function getRpcUrls(): string[] {
  const configured = process.env.SOLANA_RPC_URL?.trim();
  const urls = configured ? [configured, ...DEFAULT_RPC_FALLBACKS] : DEFAULT_RPC_FALLBACKS;
  return [...new Set(urls)];
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out. Try again in a moment.`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function withRpcFallback<T>(
  operation: (connection: Connection) => Promise<T>,
  label: string,
): Promise<T> {
  const urls = getRpcUrls();
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const connection = new Connection(url, "confirmed");
      return await withTimeout(operation(connection), label, RPC_TIMEOUT_MS);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[solana] ${label} failed via ${url}: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error(`${label} failed`);
}