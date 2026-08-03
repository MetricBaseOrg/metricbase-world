import { PublicKey } from "@solana/web3.js";
import { NFT_TIER_TRAIT, highestTier, tierFromAttribute } from "@metricbase/shared";

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
  /** Highest tier key held, or null when not a holder. */
  tierKey: string | null;
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
  content?: { metadata?: { attributes?: { trait_type?: string; value?: string }[] } };
}
interface DasAssetList {
  items?: DasAsset[];
  total?: number;
}

/** Read the tier attribute off one asset's metadata (empty when unrevealed). */
function tierValueOf(asset: DasAsset): string {
  const attrs = asset.content?.metadata?.attributes ?? [];
  const hit = attrs.find((a) => (a.trait_type ?? "").toLowerCase() === NFT_TIER_TRAIT.toLowerCase());
  return hit?.value ?? "";
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
 * Collection NFTs a wallet holds, with the highest TIER among them, uncached.
 * Returns { count: 0, tierKey: null } on any failure — a holder we can't verify
 * right now is treated as a non-holder for perks (fail-closed cosmetics, never
 * fail-open power, and there is no power here anyway). Paginates defensively but
 * a normal wallet holds a handful, so one page is the common case.
 *
 * Tier comes from each asset's on-chain Tier attribute; an unrevealed / missing
 * value falls back to the base tier (see tierFromAttribute), so pre-reveal
 * holders still count and get a crown.
 */
async function fetchHolding(wallet: string): Promise<{ count: number; tierKey: string | null }> {
  const rpcUrl = getDasRpcUrl();
  const collection = getCollectionAddress();
  if (!rpcUrl || !collection) return { count: 0, tierKey: null };

  let owner: string;
  try {
    owner = new PublicKey(wallet).toBase58();
  } catch {
    return { count: 0, tierKey: null };
  }

  let held = 0;
  const tierKeys: string[] = [];
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
      if (!inCollection) continue;
      held++;
      tierKeys.push(tierFromAttribute(tierValueOf(asset)).key);
    }
    if (items.length < 1000) break; // last page
  }
  return { count: held, tierKey: held > 0 ? (highestTier(tierKeys)?.key ?? null) : null };
}

/** Cached holding (count + highest tier). Refreshes past HOLDER_TTL_MS; on an
 *  RPC error the last known value is kept. */
async function heldHolding(wallet: string): Promise<{ count: number; tierKey: string | null }> {
  if (!isNftConfigured()) return { count: 0, tierKey: null };
  const now = Date.now();
  const cached = holderCache.get(wallet);
  if (cached && now - cached.at < HOLDER_TTL_MS) return { count: cached.count, tierKey: cached.tierKey };
  try {
    const holding = await fetchHolding(wallet);
    holderCache.set(wallet, { ...holding, at: now });
    return holding;
  } catch (error) {
    console.warn(`[nft] holder lookup failed for ${wallet}: ${(error as Error).message}`);
    return cached ? { count: cached.count, tierKey: cached.tierKey } : { count: 0, tierKey: null };
  }
}

/** Cached count of collection NFTs held by a wallet. */
export async function heldNftCount(wallet: string): Promise<number> {
  return (await heldHolding(wallet)).count;
}

/** Highest tier key a wallet holds, or null when it holds none. */
export async function holderTierKey(wallet: string | null | undefined): Promise<string | null> {
  if (!wallet) return null;
  return (await heldHolding(wallet)).tierKey;
}

export async function isHolder(wallet: string | null | undefined): Promise<boolean> {
  if (!wallet) return false;
  return (await heldHolding(wallet)).count > 0;
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
