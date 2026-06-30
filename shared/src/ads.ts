// In-game ad marketplace (kickbacks-style): brands bid a CPM ($BASE per 1,000
// view-minutes) for ad slots; the highest bids take the highest-impression
// slots. A viewing player accrues one impression per minute, and registered
// players earn a 50% share of the impressions THEY generate, claimable in $BASE.
//
// Money is handled in each currency's smallest units server-side; the payloads
// here speak in whole $BASE UI units. Ads are priced + paid in $BASE.

export type AdSurface = "billboard" | "banner";

export interface AdSlot {
  id: string;
  label: string;
  surface: AdSurface;
  /** For billboards: the zone the slot lives in (impressions come from players there). */
  zoneId?: string;
  /** Relative impression volume — drives auction ranking (higher = premium). */
  weight: number;
  /** Billboard slots: in-world tile positions where the sign stands (2 per zone). */
  tiles?: { x: number; y: number }[];
}

/**
 * Ad inventory, richest-first. The top CPM bid takes the first slot, the next
 * bid the second, etc. Add zone billboards here to grow inventory.
 */
export const AD_SLOTS: AdSlot[] = [
  { id: "hub_billboard", label: "Hub Billboard", surface: "billboard", zoneId: "zone_hub", weight: 100, tiles: [{ x: 2, y: 3 }, { x: 21, y: 2 }] },
  { id: "global_banner", label: "Global Banner", surface: "banner", weight: 90 },
  { id: "wilderness_billboard", label: "Wilderness Billboard", surface: "billboard", zoneId: "zone_wilderness", weight: 60, tiles: [{ x: 2, y: 6 }, { x: 8, y: 2 }] },
  { id: "grotto_billboard", label: "Slime Grotto Billboard", surface: "billboard", zoneId: "zone_grotto", weight: 40, tiles: [{ x: 2, y: 9 }, { x: 10, y: 2 }] },
  { id: "black_billboard", label: "Obsidian Reach Billboard", surface: "billboard", zoneId: "zone_black", weight: 25, tiles: [{ x: 2, y: 4 }, { x: 9, y: 2 }] },
];

/** The billboard slot id for a zone (null if that zone has no billboard). */
export function billboardSlotForZone(zoneId: string): string | null {
  return AD_SLOTS.find((s) => s.surface === "billboard" && s.zoneId === zoneId)?.id ?? null;
}

export function getAdSlot(id: string): AdSlot | undefined {
  return AD_SLOTS.find((s) => s.id === id);
}

export type AdCampaignStatus = "pending" | "approved" | "rejected" | "paused";

export interface AdCampaign {
  id: string;
  brandWallet: string;
  name: string;
  imageUrl: string;
  headline: string;
  clickUrl: string;
  /** Bid: $BASE per 1,000 view-minutes (one impression = a player viewing for a minute). */
  cpm: number;
  status: AdCampaignStatus;
  impressions: number;
  /** Total $BASE spent so far (UI units). */
  spent: number;
  createdAt: number;
  /** Admin note on rejection. */
  reviewNote?: string;
}

/** The creative currently shown in a slot (sent to every client). */
export interface AdServedCreative {
  slotId: string;
  campaignId: string;
  imageUrl: string;
  headline: string;
  clickUrl: string;
}

export interface AdServingPayload {
  creatives: AdServedCreative[];
}

/** A brand's dashboard view. */
export interface BrandDashboardPayload {
  /** Brand's remaining ad balance ($BASE UI units). */
  balance: number;
  campaigns: AdCampaign[];
  houseWallet: string | null;
  rpcUrl: string | null;
  /** Resolved $BASE mint to deposit. */
  mint: string | null;
}

/** A player's ad-program view. */
export interface AdProgramPayload {
  member: boolean;
  /** Claimable earnings ($BASE UI units). */
  earnings: number;
  /** Lifetime earned ($BASE UI units). */
  lifetime: number;
  /** Impressions this player has generated. */
  impressions: number;
  withdrawEnabled: boolean;
  /** Friends this player has successfully invited (gates joining). */
  invitedCount: number;
}

export interface AdActionResult {
  ok: boolean;
  error?: string;
  signature?: string;
}

/** One slot's current occupant for the admin dashboard. */
export interface AdSlotStat {
  slotId: string;
  label: string;
  weight: number;
  campaignId: string | null;
  campaignName: string;
  /** Serving campaign's CPM ($BASE), 0 if empty. */
  cpm: number;
  impressions: number;
}

/** A campaign's position in the live bid-rank leaderboard. */
export interface AdRankEntry {
  rank: number;
  campaignId: string;
  name: string;
  brandWallet: string;
  cpm: number;
  /** Brand's remaining ad balance ($BASE). */
  balance: number;
  impressions: number;
  spent: number;
  status: AdCampaignStatus;
  /** The slot this campaign currently occupies, or null. */
  slotLabel: string | null;
}

export interface AdAdminDashboardPayload {
  /** Totals in $BASE (UI units). */
  totalRevenue: number;
  playerPaid: number;
  platformCut: number;
  totalImpressions: number;
  activeCampaigns: number;
  pendingCount: number;
  slots: AdSlotStat[];
  rank: AdRankEntry[];
}

// ---- Tuning ----

/** Players earn this share of each impression they generate. */
export const AD_PLAYER_SHARE = 0.5;
/** A viewing player generates one impression per minute per slot they see. */
export const AD_IMPRESSION_INTERVAL_MS = 60_000;
/** Minimum CPM bid ($BASE per 1,000 view-minutes). */
export const AD_MIN_CPM = 1;
/** Minimum brand deposit ($BASE). */
export const AD_MIN_DEPOSIT = 100;
/** Minimum earnings before a player can claim ($BASE). */
export const AD_MIN_CLAIM = 10_000;
/** Friends a player must have invited before they can apply to the program. */
export const AD_REQUIRED_INVITES = 5;
/** Ads are priced + paid in $BASE. */
export const AD_CURRENCY_ID = "base";

export const AD_MAX_HEADLINE = 60;
export const AD_MAX_NAME = 40;

/** Validate brand-supplied campaign fields; returns an error string or null. */
export function validateCampaign(
  name: string,
  imageUrl: string,
  headline: string,
  clickUrl: string,
  cpm: number,
): string | null {
  if (!name.trim()) return "Enter a campaign name.";
  if (name.length > AD_MAX_NAME) return "Campaign name is too long.";
  if (headline.length > AD_MAX_HEADLINE) return "Headline is too long.";
  if (!/^https:\/\/\S+\.\S+/.test(imageUrl)) return "Image URL must be a valid https link.";
  if (!/^https:\/\/\S+\.\S+/.test(clickUrl)) return "Click URL must be a valid https link.";
  if (!Number.isFinite(cpm) || cpm < AD_MIN_CPM) return `CPM bid must be at least ${AD_MIN_CPM} $BASE.`;
  return null;
}
