// Ad marketplace service (singleton). Holds campaigns/brand-balances/member
// earnings in memory for the hot per-minute impression path, ranks bids into
// slots, charges brands + credits viewing members, and flushes to the DB on an
// interval. Deposits + claims go through the idempotent DB ledger.

import {
  AD_PLAYER_SHARE,
  AD_SLOTS,
  METRICBASE_TOKEN_MINT,
  getCurrency,
  toBaseUnits,
  toUiAmount,
  type AdCampaign,
  type AdCampaignStatus,
  type AdServedCreative,
  type AdServingPayload,
  type BrandDashboardPayload,
  type AdProgramPayload,
  type AdAdminDashboardPayload,
  type AdSlotStat,
  type AdRankEntry,
} from "@metricbase/shared";
import { randomUUID } from "node:crypto";
import {
  createCampaign as dbCreateCampaign,
  creditAdDepositOnce,
  getBrandBalance,
  joinProgram,
  listAllCampaigns,
  recordAdClaim,
  saveBrandBalance,
  saveCampaignStats,
  saveMember,
  setCampaignStatus,
  sumMemberLifetime,
  takeMemberEarnings,
  type AdCampaignRow,
} from "../db/ads.js";
import { getMember as dbGetMember } from "../db/ads.js";
import { getTreasuryWallet } from "../solana/verifyTokenTransfer.js";
import { getHouseWalletAddress, isWithdrawEnabled, sendPayout } from "../solana/housePayout.js";

interface BrandState {
  balance: number; // base units
  lifetimeSpent: number;
  dirty: boolean;
}
interface MemberState {
  earnings: number; // base units, claimable
  lifetime: number;
  impressions: number;
  dirty: boolean;
}

class AdService {
  private campaigns = new Map<string, AdCampaignRow>();
  private brands = new Map<string, BrandState>();
  private members = new Map<string, MemberState>();
  private dirtyCampaigns = new Set<string>();
  private assignment = new Map<string, string>(); // slotId -> campaignId
  private loaded = false;

  /** $BASE mint used for ad deposits/payouts (env-resolved, like the casino). */
  private mint(): string {
    return process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;
  }

  houseWallet(): string | null {
    return getHouseWalletAddress() ?? getTreasuryWallet();
  }

  isAdmin(wallet: string | null): boolean {
    if (!wallet) return false;
    const extra = (process.env.ADMIN_WALLETS ?? "")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
    return wallet === this.houseWallet() || extra.includes(wallet);
  }

  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const rows = await listAllCampaigns();
      for (const row of rows) {
        this.campaigns.set(row.id, row);
        if (!this.brands.has(row.brandWallet)) {
          this.brands.set(row.brandWallet, {
            balance: await getBrandBalance(row.brandWallet),
            lifetimeSpent: 0,
            dirty: false,
          });
        }
      }
      this.recompute();
    } catch (error) {
      console.error("[ads] init failed:", error);
    }
    // Periodic flush of in-memory counters to the DB.
    setInterval(() => void this.flush(), 30_000);
  }

  private brand(wallet: string): BrandState {
    let b = this.brands.get(wallet);
    if (!b) {
      b = { balance: 0, lifetimeSpent: 0, dirty: false };
      this.brands.set(wallet, b);
    }
    return b;
  }

  /** Rank approved, funded campaigns by CPM into the slots (highest weight first). */
  recompute(): void {
    const slots = [...AD_SLOTS].sort((a, b) => b.weight - a.weight);
    const eligible = [...this.campaigns.values()]
      .filter((c) => c.status === "approved" && (this.brands.get(c.brandWallet)?.balance ?? 0) >= c.cpm / 1000)
      .sort((a, b) => b.cpm - a.cpm);
    this.assignment.clear();
    slots.forEach((slot, i) => {
      const campaign = eligible[i];
      if (campaign) this.assignment.set(slot.id, campaign.id);
    });
  }

  getServing(): AdServingPayload {
    const creatives: AdServedCreative[] = [];
    for (const [slotId, campaignId] of this.assignment) {
      const c = this.campaigns.get(campaignId);
      if (!c) continue;
      creatives.push({ slotId, campaignId: c.id, imageUrl: c.imageUrl, headline: c.headline, clickUrl: c.clickUrl });
    }
    return { creatives };
  }

  /** A viewing member generated one impression on a slot — charge brand, credit member. */
  recordImpression(slotId: string, viewerWallet: string | null): void {
    const campaignId = this.assignment.get(slotId);
    if (!campaignId) return;
    const c = this.campaigns.get(campaignId);
    if (!c) return;
    const brand = this.brand(c.brandWallet);
    const cost = Math.floor(c.cpm / 1000);
    if (cost <= 0 || brand.balance < cost) {
      // Brand ran dry — drop it from rotation until topped up.
      this.recompute();
      return;
    }
    brand.balance -= cost;
    brand.lifetimeSpent += cost;
    brand.dirty = true;
    c.impressions += 1;
    c.spent += cost;
    this.dirtyCampaigns.add(c.id);

    if (viewerWallet && this.members.has(viewerWallet)) {
      const m = this.members.get(viewerWallet)!;
      const share = Math.floor(cost * AD_PLAYER_SHARE);
      m.earnings += share;
      m.lifetime += share;
      m.impressions += 1;
      m.dirty = true;
    }
    if (brand.balance < cost) this.recompute();
  }

  async flush(): Promise<void> {
    for (const [wallet, b] of this.brands) {
      if (!b.dirty) continue;
      b.dirty = false;
      await saveBrandBalance(wallet, b.balance, b.lifetimeSpent);
    }
    for (const id of this.dirtyCampaigns) {
      const c = this.campaigns.get(id);
      if (c) await saveCampaignStats(c.id, c.impressions, c.spent);
    }
    this.dirtyCampaigns.clear();
    for (const [wallet, m] of this.members) {
      if (!m.dirty) continue;
      m.dirty = false;
      await saveMember(wallet, m.earnings, m.lifetime, m.impressions);
    }
  }

  // ---- Brand ops ----

  private toCampaignUi(c: AdCampaignRow): AdCampaign {
    return {
      id: c.id,
      brandWallet: c.brandWallet,
      name: c.name,
      imageUrl: c.imageUrl,
      headline: c.headline,
      clickUrl: c.clickUrl,
      cpm: toUiAmount(c.cpm, "base"),
      status: c.status,
      impressions: c.impressions,
      spent: toUiAmount(c.spent, "base"),
      createdAt: c.createdAt,
      reviewNote: c.reviewNote ?? undefined,
    };
  }

  getBrandDashboard(wallet: string): BrandDashboardPayload {
    const balance = this.brands.get(wallet)?.balance ?? 0;
    const campaigns = [...this.campaigns.values()]
      .filter((c) => c.brandWallet === wallet)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((c) => this.toCampaignUi(c));
    return {
      balance: toUiAmount(balance, "base"),
      campaigns,
      houseWallet: this.houseWallet(),
      rpcUrl: process.env.SOLANA_RPC_URL ?? null,
      mint: this.mint(),
    };
  }

  async creditDeposit(wallet: string, uiAmount: number, signature: string): Promise<boolean> {
    const amount = toBaseUnits(uiAmount, "base");
    const res = await creditAdDepositOnce(wallet, amount, signature);
    if (res.credited) this.brand(wallet).balance = res.balance;
    return res.credited;
  }

  async createCampaign(
    wallet: string,
    fields: { name: string; imageUrl: string; headline: string; clickUrl: string; cpm: number },
  ): Promise<void> {
    const row: AdCampaignRow = {
      id: randomUUID().slice(0, 36),
      brandWallet: wallet,
      name: fields.name.trim().slice(0, 64),
      imageUrl: fields.imageUrl.trim(),
      headline: fields.headline.trim().slice(0, 120),
      clickUrl: fields.clickUrl.trim(),
      cpm: toBaseUnits(fields.cpm, "base"),
      status: "pending",
      impressions: 0,
      spent: 0,
      reviewNote: null,
      createdAt: Date.now(),
    };
    await dbCreateCampaign(row);
    this.campaigns.set(row.id, row);
  }

  // ---- Admin ops ----

  /** Platform-wide ad monitoring snapshot: totals, slot occupancy, bid ranks. */
  async getAdminDashboard(): Promise<AdAdminDashboardPayload> {
    let totalRevenue = 0;
    let totalImpressions = 0;
    let activeCampaigns = 0;
    let pendingCount = 0;
    for (const c of this.campaigns.values()) {
      totalRevenue += c.spent;
      totalImpressions += c.impressions;
      if (c.status === "approved") activeCampaigns += 1;
      if (c.status === "pending") pendingCount += 1;
    }
    // Flush so in-memory accruals are reflected, then read the true player total.
    await this.flush();
    const playerPaidUnits = await sumMemberLifetime();

    const slotLabelFor = (campaignId: string): string | null => {
      for (const [slotId, cid] of this.assignment) {
        if (cid === campaignId) return AD_SLOTS.find((s) => s.id === slotId)?.label ?? slotId;
      }
      return null;
    };

    const slots: AdSlotStat[] = [...AD_SLOTS]
      .sort((a, b) => b.weight - a.weight)
      .map((slot) => {
        const cid = this.assignment.get(slot.id);
        const c = cid ? this.campaigns.get(cid) : undefined;
        return {
          slotId: slot.id,
          label: slot.label,
          weight: slot.weight,
          campaignId: c?.id ?? null,
          campaignName: c?.name ?? "—",
          cpm: c ? toUiAmount(c.cpm, "base") : 0,
          impressions: c?.impressions ?? 0,
        };
      });

    const rank: AdRankEntry[] = [...this.campaigns.values()]
      .filter((c) => c.status === "approved")
      .sort((a, b) => b.cpm - a.cpm)
      .map((c, i) => ({
        rank: i + 1,
        campaignId: c.id,
        name: c.name,
        brandWallet: c.brandWallet,
        cpm: toUiAmount(c.cpm, "base"),
        balance: toUiAmount(this.brands.get(c.brandWallet)?.balance ?? 0, "base"),
        impressions: c.impressions,
        spent: toUiAmount(c.spent, "base"),
        status: c.status,
        slotLabel: slotLabelFor(c.id),
      }));

    return {
      totalRevenue: toUiAmount(totalRevenue, "base"),
      playerPaid: toUiAmount(playerPaidUnits, "base"),
      platformCut: toUiAmount(Math.max(0, totalRevenue - playerPaidUnits), "base"),
      totalImpressions,
      activeCampaigns,
      pendingCount,
      slots,
      rank,
    };
  }

  listPending(): AdCampaign[] {
    return [...this.campaigns.values()]
      .filter((c) => c.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => this.toCampaignUi(c));
  }

  async review(id: string, status: AdCampaignStatus, note?: string): Promise<void> {
    const c = this.campaigns.get(id);
    if (!c) return;
    c.status = status;
    c.reviewNote = note ?? null;
    await setCampaignStatus(id, status, note);
    this.recompute();
  }

  // ---- Member (player) ops ----

  async join(wallet: string): Promise<void> {
    if (this.members.has(wallet)) return;
    await joinProgram(wallet);
    const existing = await dbGetMember(wallet);
    this.members.set(wallet, {
      earnings: existing?.earnings ?? 0,
      lifetime: existing?.lifetime ?? 0,
      impressions: existing?.impressions ?? 0,
      dirty: false,
    });
  }

  async ensureMemberLoaded(wallet: string): Promise<void> {
    if (this.members.has(wallet)) return;
    const existing = await dbGetMember(wallet);
    if (existing) {
      this.members.set(wallet, {
        earnings: existing.earnings,
        lifetime: existing.lifetime,
        impressions: existing.impressions,
        dirty: false,
      });
    }
  }

  getProgram(wallet: string, invitedCount = 0): AdProgramPayload {
    const m = this.members.get(wallet);
    return {
      member: !!m,
      earnings: toUiAmount(m?.earnings ?? 0, "base"),
      lifetime: toUiAmount(m?.lifetime ?? 0, "base"),
      impressions: m?.impressions ?? 0,
      withdrawEnabled: isWithdrawEnabled(),
      invitedCount,
    };
  }

  isMember(wallet: string): boolean {
    return this.members.has(wallet);
  }

  /** Pay out a member's accrued earnings to their wallet. */
  async claim(wallet: string): Promise<{ ok: boolean; error?: string; signature?: string }> {
    if (!isWithdrawEnabled()) return { ok: false, error: "Payouts aren't available yet." };
    // Flush this member first so the DB has their latest accrued earnings.
    const m = this.members.get(wallet);
    if (m && m.dirty) {
      m.dirty = false;
      await saveMember(wallet, m.earnings, m.lifetime, m.impressions);
    }
    const amount = await takeMemberEarnings(wallet); // atomic zero-and-return
    if (amount <= 0) return { ok: false, error: "Nothing to claim yet." };
    if (m) m.earnings = 0;

    const payout = await sendPayout(wallet, "base", amount, this.mint());
    if (!payout.ok) {
      // Refund the claim back to the member on payout failure.
      const cur = await dbGetMember(wallet);
      await saveMember(wallet, (cur?.earnings ?? 0) + amount, cur?.lifetime ?? 0, cur?.impressions ?? 0);
      if (m) m.earnings = (cur?.earnings ?? 0) + amount;
      return { ok: false, error: payout.error ?? "Payout failed." };
    }
    await recordAdClaim(wallet, amount, payout.signature ?? `adclaim-${Date.now()}`);
    return { ok: true, signature: payout.signature };
  }

  minDepositMet(uiAmount: number): boolean {
    return uiAmount > 0;
  }

  currencyLabel(): string {
    return getCurrency("base").label;
  }
}

export const adService = new AdService();
