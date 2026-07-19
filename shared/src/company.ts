// Merchant Companies: player-owned ECONOMIC organizations that coexist with
// Guilds (a player may belong to one guild AND one company at the same time).
// Guilds stay social/PvP; companies are businesses — a treasury (gold + an item
// warehouse), ranks/permissions, recruitment, automatic daily salaries and
// dividends, a revenue-share skim on members' earnings, warehouse vendor sales,
// and an inbound contracts board.
//
// ECONOMIC INVARIANT: every company gold flow is a pure transfer between
// balances that already exist — deposits, salaries, dividends, contract payouts,
// the skim. None of them ever mint gold. The registration fee is a burn (a
// sink). Warehouse item moves are player-to-player-neutral: they never call
// recordProduced/recordConsumed. The single mint path is selling warehouse items
// to an NPC vendor, which reuses the existing softened sell faucet unchanged.

import type { InventoryEntry } from "./items.js";

// ---------------------------------------------------------------------------
// Tunables — THE balancing table. All company economy numbers live here so they
// can be tuned in one place. (Prices/economy are owner-tuned.)
// ---------------------------------------------------------------------------

/** Gold cost to found a company — a deliberate sink (2.5× a guild; companies earn income). */
export const COMPANY_CREATE_COST = 2500;

export const COMPANY_NAME_MIN_LENGTH = 3;
export const COMPANY_NAME_MAX_LENGTH = 24;

/** Member cap (smaller than a guild's 30 — companies are focused economic teams). */
export const MAX_COMPANY_MEMBERS = 20;

/** Max revenue-share rate skimmed from a member's gross earnings into the treasury. */
export const COMPANY_MAX_REVENUE_SHARE = 0.1; // parity with GUILD_MAX_TAX_RATE

/** Max fixed salary a member can be paid per server day. */
export const COMPANY_MAX_SALARY = 500;

/** Max fraction of the treasury paid out as dividends per server day. */
export const COMPANY_MAX_DIVIDEND_RATE = 0.25;

/** Item-warehouse capacity, in slots (3× the base 16-slot bag). */
export const COMPANY_WAREHOUSE_SLOTS = 48;

/** Max simultaneously OPEN/ACCEPTED contracts posted to a single company. */
export const COMPANY_MAX_OPEN_CONTRACTS = 5;

export const COMPANY_CONTRACT_MIN_REWARD = 50;
export const COMPANY_CONTRACT_MAX_REWARD = 1_000_000;

export const COMPANY_MOTD_MAX_LENGTH = 200;

/** A member must have been active within this many days to receive dividends. */
export const COMPANY_DIVIDEND_MIN_ACTIVITY_DAYS = 3;

/** Dividends only pay out if the company has at least this many members. */
export const COMPANY_MIN_MEMBERS_FOR_DIVIDENDS = 2;

// ---------------------------------------------------------------------------
// Company types — branding + a "focus stat" only. NO gameplay buffs.
// ---------------------------------------------------------------------------

export const COMPANY_TYPES = [
  "mining",
  "farming",
  "fishing",
  "merchant",
  "blacksmith",
  "logistics",
] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export interface CompanyTypeDef {
  label: string;
  icon: string;
  /** The activity this company brands itself around (shown on stats). */
  focusStat: string;
}

export const COMPANY_TYPE_INFO: Record<CompanyType, CompanyTypeDef> = {
  mining: { label: "Mining Company", icon: "⛏️", focusStat: "Ore mined" },
  farming: { label: "Farming Cooperative", icon: "🌾", focusStat: "Crops harvested" },
  fishing: { label: "Fishing Company", icon: "🎣", focusStat: "Fish landed" },
  merchant: { label: "Merchant Company", icon: "💰", focusStat: "Goods sold" },
  blacksmith: { label: "Blacksmith Company", icon: "⚒️", focusStat: "Items forged" },
  logistics: { label: "Logistics Company", icon: "🚚", focusStat: "Contracts delivered" },
};

/** Preset emblem emoji for a company logo (validated server-side by membership). */
export const COMPANY_EMBLEMS = [
  "🏢", "⛏️", "🌾", "🎣", "💰", "⚒️", "📦", "🚚", "🏪", "⚖️", "🛠️", "🧭",
] as const;

/** Preset logo colours (ints, matching the appearance-colour convention). */
export const COMPANY_COLORS = [
  0x4a90d9, 0xd94a4a, 0x4ad97a, 0xd9a84a, 0x9a4ad9, 0x4ad9c8, 0xd94aa8, 0x8a8a8a,
] as const;

export const DEFAULT_COMPANY_EMBLEM = "🏢";
export const DEFAULT_COMPANY_COLOR = 0x4a90d9;

// ---------------------------------------------------------------------------
// Type perks (v0.156) — company type is an economic identity, not a label.
// THE tunables table. Perks apply to every member of a company of that type.
// GUARDS: the merchant perk reduces ONLY the treasury-routed share of exchange
// fees — never the burn portion, and never the gold-market 4% burn (those are
// the wash-trade deterrents). The logistics fee boost pays from the same
// capped per-town freight budget. Anti-hopping friction = joining a company
// requires approval and one company at a time.
// ---------------------------------------------------------------------------

export interface CompanyTypePerks {
  /** Extra bonus-ore chance on mining gathers (additive to tool yieldBonus). */
  oreYieldBonus?: number;
  /** Multiplier on crop growth time at plant time (lower = faster). */
  cropGrowthMult?: number;
  /** Multiplier on the fishing bait cost per cast. */
  baitCostMult?: number;
  /** Multiplier on craft Fine/Master roll chances. */
  qualityRollMult?: number;
  /** Multiplier on the gear-repair gold fee. */
  repairCostMult?: number;
  /** Multiplier on the treasury-routed portion of a member's exchange fee. */
  exchangeTreasuryFeeMult?: number;
  /** Multiplier on caravan freight fees earned by members. */
  caravanFeeMult?: number;
  /** Multiplier on the caravan accept cooldown. */
  caravanCooldownMult?: number;
  /** One-line perk summary for pickers and panels. */
  blurb: string;
}

export const COMPANY_TYPE_PERKS: Record<CompanyType, CompanyTypePerks> = {
  mining: { oreYieldBonus: 0.1, blurb: "⛏️ +10% bonus ore chance while mining" },
  farming: { cropGrowthMult: 0.9, blurb: "🌾 Crops you plant grow 10% faster" },
  fishing: { baitCostMult: 0.5, blurb: "🎣 Bait costs half on every cast" },
  blacksmith: {
    qualityRollMult: 1.15,
    repairCostMult: 0.8,
    blurb: "⚒️ +15% Fine/Master craft rolls · repairs 20% cheaper",
  },
  merchant: {
    exchangeTreasuryFeeMult: 0.67,
    blurb: "💰 Share-trade fees reduced by a third (burn portion untouched)",
  },
  logistics: {
    caravanFeeMult: 1.25,
    caravanCooldownMult: 0.5,
    blurb: "🚚 Caravan runs pay +25% · half the caravan cooldown",
  },
};

// ---------------------------------------------------------------------------
// Ranks + permissions
// ---------------------------------------------------------------------------

/** Company ranks, descending in authority: owner > manager > employee > trainee. */
export type CompanyRank = "owner" | "manager" | "employee" | "trainee";

export interface CompanyPermissions {
  /** Approve/deny join requests. */
  approveMembers: boolean;
  /** Kick lower-ranked members. */
  kick: boolean;
  /** Promote/demote members between manager/employee/trainee. */
  setRanks: boolean;
  /** Withdraw gold from the treasury. */
  withdrawGold: boolean;
  /** Withdraw items from the warehouse. */
  withdrawItems: boolean;
  /** Sell warehouse items to an NPC vendor (proceeds → treasury). */
  sellWarehouse: boolean;
  /** Accept inbound contracts on the company's behalf. */
  acceptContracts: boolean;
  /** Post outbound contracts to other companies, funded by this treasury. */
  postContracts: boolean;
  /** Edit the company announcement (MOTD). */
  setMotd: boolean;
  /** Set the revenue-share and dividend rates. */
  setRates: boolean;
  /** Set per-member salaries. */
  setSalaries: boolean;
  /** Contribute gold/items. */
  contribute: boolean;
  /** Post in company chat. */
  chat: boolean;
}

export const COMPANY_PERMISSIONS: Record<CompanyRank, CompanyPermissions> = {
  owner: {
    approveMembers: true,
    kick: true,
    setRanks: true,
    withdrawGold: true,
    withdrawItems: true,
    sellWarehouse: true,
    acceptContracts: true,
    postContracts: true,
    setMotd: true,
    setRates: true,
    setSalaries: true,
    contribute: true,
    chat: true,
  },
  manager: {
    approveMembers: true,
    kick: true, // lower ranks only — enforced in the registry
    setRanks: true, // trainee<->employee only — enforced in the registry
    withdrawGold: false,
    withdrawItems: true,
    sellWarehouse: true,
    acceptContracts: true,
    postContracts: true,
    setMotd: true,
    setRates: false,
    setSalaries: false,
    contribute: true,
    chat: true,
  },
  employee: {
    approveMembers: false,
    kick: false,
    setRanks: false,
    withdrawGold: false,
    withdrawItems: false,
    sellWarehouse: false,
    acceptContracts: false,
    postContracts: false,
    setMotd: false,
    setRates: false,
    setSalaries: false,
    contribute: true,
    chat: true,
  },
  trainee: {
    approveMembers: false,
    kick: false,
    setRanks: false,
    withdrawGold: false,
    withdrawItems: false,
    sellWarehouse: false,
    acceptContracts: false,
    postContracts: false,
    setMotd: false,
    setRates: false,
    setSalaries: false,
    contribute: true,
    chat: true,
  },
};

/** Resolve a member's rank from the owner + rank rosters. */
export function companyRankOf(
  member: string,
  ownerName: string,
  managers: string[],
  trainees: string[],
): CompanyRank {
  if (member === ownerName) return "owner";
  if (managers.includes(member)) return "manager";
  if (trainees.includes(member)) return "trainee";
  return "employee";
}

export function companyCan(rank: CompanyRank, perm: keyof CompanyPermissions): boolean {
  return COMPANY_PERMISSIONS[rank][perm];
}

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

/** Per-member contribution tallies (display-only; NOT used for reputation). */
export interface CompanyContribution {
  /** Gold deposited into the treasury. */
  gold: number;
  /** Base value of items contributed to the warehouse. */
  itemsValue: number;
  /** Gold skimmed from this member's earnings via revenue-share. */
  skim: number;
  /** UTC day (yyyy-mm-dd) of this member's most recent tracked activity. */
  lastActiveDay: string | null;
}

/** Company revenue by source + payout totals (lifetime). */
export interface CompanyStats {
  revenue: {
    skim: number;
    vendor: number;
    contracts: number;
    deposits: number;
    /** Share-trade fees routed to the treasury by the stock exchange. */
    shares: number;
  };
  paidOut: {
    salaries: number;
    dividends: number;
    /** Gold paid to shareholders via the stock-exchange weekly dividend. */
    shareDividends: number;
    /** Gold spent commissioning outbound contracts to other companies. */
    contracts: number;
  };
  contractsCompleted: number;
  contrib: Record<string, CompanyContribution>;
}

export function emptyCompanyStats(): CompanyStats {
  return {
    revenue: { skim: 0, vendor: 0, contracts: 0, deposits: 0, shares: 0 },
    paidOut: { salaries: 0, dividends: 0, shareDividends: 0, contracts: 0 },
    contractsCompleted: 0,
    contrib: {},
  };
}

export type CompanyContractKind = "supply" | "gather" | "harvest" | "mobs";
export type CompanyContractStatus = "open" | "accepted" | "completed" | "cancelled";

export interface CompanyContractView {
  id: string;
  companyId: string;
  posterName: string;
  kind: CompanyContractKind;
  itemId: string | null;
  qty: number;
  progress: number;
  rewardGold: number;
  status: CompanyContractStatus;
  /** For completed supply contracts: items awaiting withdrawal into the warehouse. */
  itemsToCollect: number;
  createdAt: number;
}

export interface CompanySummary {
  id: string;
  name: string;
  emblem: string;
  color: number;
  companyType: CompanyType;
  ownerName: string;
  memberCount: number;
  reputation: number;
}

export interface CompanyDetail extends CompanySummary {
  members: string[];
  managers: string[];
  trainees: string[];
  joinRequests: string[];
  treasury: number;
  revenueShare: number;
  dividendRate: number;
  motd: string;
  warehouse: InventoryEntry[];
  salaries: Record<string, number>;
  stats: CompanyStats;
  contracts: CompanyContractView[];
  myRank: CompanyRank;
  lastPayoutDay: string | null;
  createdAt: number;
}

export interface CompanyStatePayload {
  /** The requesting player's company, or null if they're companyless. */
  myCompany: CompanyDetail | null;
  /** All companies, for the browse/join directory. */
  companies: CompanySummary[];
  /** Company id the player has a pending join request with, or null. */
  myRequestCompanyId: string | null;
  /** Open contracts across all companies (for outsiders browsing what to fulfil). */
  openContracts: CompanyContractView[];
  /** Every contract the viewer has posted (any status), so they can track and
   * collect delivered goods — including from companies they don't belong to. */
  myPostedContracts: CompanyContractView[];
}

export interface CompanyResultPayload {
  ok: boolean;
  error?: string;
  message?: string;
  /** Updated player gold after a charge/transfer, when relevant. */
  gold?: number;
}

// ---------------------------------------------------------------------------
// Validators + reputation
// ---------------------------------------------------------------------------

/** Clean a company name: drop control chars, collapse whitespace, trim, cap. */
export function sanitizeCompanyName(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, COMPANY_NAME_MAX_LENGTH);
}

export function isValidCompanyName(name: string): boolean {
  return name.length >= COMPANY_NAME_MIN_LENGTH && name.length <= COMPANY_NAME_MAX_LENGTH;
}

/** Clean an announcement: strip control chars (keep newlines), trim, cap. */
export function sanitizeCompanyMotd(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code < 0x20 && ch !== "\n") || code === 0x7f) continue;
    out += ch;
  }
  return out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, COMPANY_MOTD_MAX_LENGTH);
}

export function isValidCompanyEmblem(emblem: string): boolean {
  return (COMPANY_EMBLEMS as readonly string[]).includes(emblem);
}

export function isValidCompanyColor(color: number): boolean {
  return (COMPANY_COLORS as readonly number[]).includes(color);
}

export function isValidCompanyType(type: string): type is CompanyType {
  return (COMPANY_TYPES as readonly string[]).includes(type);
}

/** Items a contract may request in a supply order: stackable materials/consumables. */
export function validateCompanyContract(
  kind: string,
  itemId: string | null,
  qty: number,
  rewardGold: number,
  isSupplyItem: (itemId: string) => boolean,
): string | null {
  const kinds: CompanyContractKind[] = ["supply", "gather", "harvest", "mobs"];
  if (!kinds.includes(kind as CompanyContractKind)) return "Unknown contract type.";
  if (!Number.isFinite(qty) || qty < 1 || qty > 999) return "Quantity must be 1–999.";
  if (kind === "supply") {
    if (!itemId || !isSupplyItem(itemId)) return "Pick a valid item to request.";
  }
  if (
    !Number.isFinite(rewardGold) ||
    rewardGold < COMPANY_CONTRACT_MIN_REWARD ||
    rewardGold > COMPANY_CONTRACT_MAX_REWARD
  ) {
    return `Reward must be ${COMPANY_CONTRACT_MIN_REWARD.toLocaleString()}–${COMPANY_CONTRACT_MAX_REWARD.toLocaleString()} gold.`;
  }
  return null;
}

/** Weights for the derived reputation score (display-only). */
export const COMPANY_REPUTATION_WEIGHTS = {
  perMember: 5,
  perContract: 10,
  perThousandRevenue: 1,
  perPayoutDay: 3,
  perAgeDay: 2,
  ageDayCap: 60,
} as const;

export interface CompanyReputationInput {
  ageDays: number;
  members: number;
  contractsCompleted: number;
  /** Lifetime treasury revenue (skim + vendor + contracts + deposits). */
  lifetimeRevenue: number;
  /** Number of distinct days the company has paid out salaries/dividends. */
  payoutDays: number;
}

/**
 * Derived company reputation. Deliberately built from treasury REVENUE (an
 * externally-anchored faucet number) and completed contracts, NOT from
 * contribution tallies — so a company can't wash-trade its warehouse to inflate
 * its standing.
 */
export function computeCompanyReputation(input: CompanyReputationInput): number {
  const w = COMPANY_REPUTATION_WEIGHTS;
  const age = Math.min(input.ageDays, w.ageDayCap);
  return Math.max(
    0,
    Math.floor(
      age * w.perAgeDay +
        input.members * w.perMember +
        input.contractsCompleted * w.perContract +
        (input.lifetimeRevenue / 1000) * w.perThousandRevenue +
        input.payoutDays * w.perPayoutDay,
    ),
  );
}
