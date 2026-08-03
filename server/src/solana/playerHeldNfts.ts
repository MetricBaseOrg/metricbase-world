import { PublicKey } from "@solana/web3.js";

// Holder detection for the MetricBase NFT collection (Phase 1 membership drop).
//
// Mirrors playerHeldBase.ts in spirit — a cached, background-refreshed read of
// on-chain ownership — but uses the Metaplex DAS API (getAssetsByOwner), which
// only DAS-capable providers answer. Helius (the configured SOLANA_RPC_URL) is
// one; the public fallbacks are not, so DAS calls go ONLY to the configured
// endpoint and never down the fallback chain.
//
// INERT BY DEFAULT: with no NFT_COLLECTION_ADDRESS set, isNftConfigured() is
// false and every function here returns "not a holder" without touching the
// network. Nothing about the game changes until the collection is configured.

const DAS_TIMEOUT_MS = 12_000;
/** How long a per-wallet holder result is trusted before a re-check. */
const HOLDER_TTL_MS = 30 * 60 * 1000;

interface HolderEntry {
  count: number;
  at: number;
}
const holderCache = new Map<string, HolderEntry>();

export function getCollectionAddress(): string | null {
  const raw = process.env.NFT_COLLECTION_ADDRESS?.trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    console.warn("[nft] NFT_COLLECTION_ADDRESS is not a valid pubkey; NFT layer stays disabled.");
    return null;
  }
}

/** The one DAS-capable endpoint (the configured RPC). null = feature disabled. */
function getDasRpcUrl(): string | null {
  const url = process.env.SOLANA_RPC_URL?.trim();
  if (!url) return null;
  // A public Solana RPC won't answer DAS methods; only proceed for providers we
  // know serve them. Helius is the configured one; extend this list if the RPC
  // provider ever changes.
  if (/helius|das|hellomoon|shyft|quicknode|triton/i.test(url)) return url;
  return null;
}

/** True when both a collection and a DAS endpoint are configured. */
export function isNftConfigured(): boolean {
  return getCollectionAddress() !== null && getDasRpcUrl() !== null;
}

interface DasAsset {
  grouping?: { group_key: string; group_value: string }[];
}
interface DasAssetList {
  items?: DasAsset[];
  total?: number;
}

async function dasCall<T>(rpcUrl: string, method: string, params: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DAS_TIMEOUT_MS);
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      // DAS uses NAMED params (an object), unlike the array-param RPC helper.
      body: JSON.stringify({ jsonrpc: "2.0", id: "mb-nft", method, params }),
    });
    if (!res.ok) throw new Error(`${method} HTTP ${res.status}`);
    const payload = (await res.json()) as { result?: T; error?: { message: string } };
    if (payload.error) throw new Error(payload.error.message);
    if (payload.result === undefined) throw new Error(`${method} returned no result`);
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * How many NFTs from the configured collection a wallet holds, uncached.
 * Returns 0 on any failure — a holder we can't verify right now is treated as a
 * non-holder for perks (fail-closed cosmetics, never fail-open power, and there
 * is no power here anyway). Paginates defensively but a normal wallet holds a
 * handful, so one page is the common case.
 */
async function fetchHeldCount(wallet: string): Promise<number> {
  const rpcUrl = getDasRpcUrl();
  const collection = getCollectionAddress();
  if (!rpcUrl || !collection) return 0;

  let owner: string;
  try {
    owner = new PublicKey(wallet).toBase58();
  } catch {
    return 0;
  }

  let held = 0;
  for (let page = 1; page <= 10; page++) {
    const list = await dasCall<DasAssetList>(rpcUrl, "getAssetsByOwner", {
      ownerAddress: owner,
      page,
      limit: 1000,
    });
    const items = list.items ?? [];
    for (const asset of items) {
      const inCollection = (asset.grouping ?? []).some(
        (g) => g.group_key === "collection" && g.group_value === collection,
      );
      if (inCollection) held++;
    }
    if (items.length < 1000) break; // last page
  }
  return held;
}

/**
 * Cached count of collection NFTs held by a wallet. Refreshes past HOLDER_TTL_MS.
 * On an RPC error the last known value is kept (or 0 if never fetched).
 */
export async function heldNftCount(wallet: string): Promise<number> {
  if (!isNftConfigured()) return 0;
  const now = Date.now();
  const cached = holderCache.get(wallet);
  if (cached && now - cached.at < HOLDER_TTL_MS) return cached.count;
  try {
    const count = await fetchHeldCount(wallet);
    holderCache.set(wallet, { count, at: now });
    return count;
  } catch (error) {
    console.warn(`[nft] holder lookup failed for ${wallet}: ${(error as Error).message}`);
    return cached?.count ?? 0;
  }
}

export async function isHolder(wallet: string | null | undefined): Promise<boolean> {
  if (!wallet) return false;
  return (await heldNftCount(wallet)) > 0;
}

/** Drop a wallet's cached result so the next check re-reads the chain. */
export function invalidateHolder(wallet: string): void {
  holderCache.delete(wallet);
}

/**
 * Count of DISTINCT bonded wallets currently holding at least one NFT, for the
 * /stats card. Reads only wallets already cached above plus the supplied list;
 * callers pass the bonded-wallet set. Never hits the network beyond the per-
 * wallet cache, so it's cheap to call.
 */
export async function holderCountAmong(wallets: string[]): Promise<number> {
  if (!isNftConfigured()) return 0;
  let holders = 0;
  for (const wallet of wallets) {
    if (await isHolder(wallet)) holders++;
  }
  return holders;
}
