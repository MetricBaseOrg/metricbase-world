// Ad marketplace service (singleton). Holds campaigns/brand-balances/member
// earnings in memory for the hot per-minute impression path, ranks bids into
// slots, charges brands + credits viewing members, and flushes to the DB on an
// interval. Deposits + claims go through the idempotent DB ledger.

import {
  AD_MIN_CLAIM,
  AD_PLAYER_SHARE,
  AD_WORLD_OWNER_SHARE,
  AD_REQUIRED_INVITES,
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
  type AdAuctionEntry,
  type AdAuctionPayload,
  type AdSlotStat,
  type AdRankEntry,
  type AdTransparencyPayload,
  type AdSeriesPoint,
  type AdActionResult,
} from "@metricbase/shared";
import { randomUUID } from "node:crypto";
import {
  createCampaign as dbCreateCampaign,
  creditAdDepositOnce,
  getBrandBalance,
  getBrandState,
  joinProgram,
  listAllCampaigns,
  recordAdClaim,
  saveBrandBalance,
  saveCampaignStats,
  saveMember,
  setCampaignStatus,
  updateCampaign,
  sumMemberEarnings,
  sumMemberLifetime,
  takeMemberEarnings,
  countMembers,
  snapshotDaily,
  snapshotMemberDaily,
  getDailySeries,
  getMemberDailySeries,
  getMemberClaims,
  type AdCampaignRow,
} from "../db/ads.js";
import { getMember as dbGetMember } from "../db/ads.js";
import { getTreasuryWallet } from "../solana/verifyTokenTransfer.js";
import { getHouseBalanceUi, getHouseWalletAddress, isWithdrawEnabled, sendPayout } from "../solana/housePayout.js";

/** Public ad-marketplace summary for /stats. Money fields are $BASE UI amounts. */
export interface AdPublicStats {
  totalRevenue: number;
  playerPaid: number;
  platformCut: number;
  unclaimed: number;
  brandDeposits: number;
  totalImpressions: number;
  activeCampaigns: number;
  pendingCampaigns: number;
  totalCampaigns: number;
  brands: number;
  members: number;
  sharePct: number;
  daily: { revenue: AdSeriesPoint[]; playerPaid: AdSeriesPoint[]; impressions: AdSeriesPoint[] };
}

interface BrandState {
  balance: number; // base units
  lifetimeSpent: number;
  dirty: boolean;
}
interface MemberState {
  earnings: number; // base units, claimable
  lifetime: number;
  impressions: number;
  /** Of `lifetime`, the part earned as a World owner rather than as a viewer. */
  worldLifetime: number;
  worldImpressions: number;
  /**
   * Actually joined the viewer program (invite-gated). A World owner gets a
   * ledger row the first time their World earns, WITHOUT joining — otherwise
   * owning a World would be a side door around the invite requirement for
   * viewer earnings. They can still claim what they've earned.
   */
  joined: boolean;
  dirty: boolean;
}

class AdService {
  private campaigns = new Map<string, AdCampaignRow>();
  private brands = new Map<string, BrandState>();
  private members = new Map<string, MemberState>();
  // In-flight DB reads for member state, so concurrent loads can't each create
  // a row and clobber one another. See loadMemberState.
  private memberLoads = new Map<string, Promise<MemberState>>();
  private dirtyCampaigns = new Set<string>();
  private assignment = new Map<string, string>(); // slotId -> campaignId
  private loaded = false;
  // Treasury solvency: never accrue more player earnings than the house can pay.
  private liabilities = 0; // base units of unclaimed member earnings
  private houseBalanceUnits = 0; // cached house wallet balance (base units)

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
          const state = await getBrandState(row.brandWallet);
          this.brands.set(row.brandWallet, {
            balance: state.balance,
            lifetimeSpent: state.lifetimeSpent,
            dirty: false,
          });
        }
      }
      this.liabilities = await sumMemberEarnings();
      await this.refreshHouseBalance();
      this.recompute();
    } catch (error) {
      console.error("[ads] init failed:", error);
    }
    // Periodic flush of in-memory counters to the DB + house-balance refresh.
    setInterval(() => void this.flush(), 30_000);
    setInterval(() => void this.refreshHouseBalance(), 60_000);
    // Daily transparency snapshot (platform totals) every 6h.
    setInterval(() => void this.snapshotPlatform(), 6 * 60 * 60_000);
    void this.snapshotPlatform();
  }

  /** Cumulative platform totals (base units / counts). */
  private platformTotals(): { revenue: number; impressions: number; active: number; pending: number } {
    let revenue = 0;
    let impressions = 0;
    let active = 0;
    let pending = 0;
    for (const c of this.campaigns.values()) {
      revenue += c.spent;
      impressions += c.impressions;
      if (c.status === "approved") active += 1;
      if (c.status === "pending") pending += 1;
    }
    return { revenue, impressions, active, pending };
  }

  /** Upsert today's platform snapshot for the transparency charts. */
  private async snapshotPlatform(): Promise<void> {
    if (!this.loaded) return;
    const t = this.platformTotals();
    const paid = await sumMemberLifetime();
    const members = await countMembers();
    await snapshotDaily(t.revenue, paid, t.impressions, members);
  }

  /** Refresh the cached house balance (base units) used by the solvency guard. */
  private async refreshHouseBalance(): Promise<void> {
    const house = this.houseWallet();
    if (!house) {
      this.houseBalanceUnits = 0;
      return;
    }
    try {
      const ui = await getHouseBalanceUi(house, "base", this.mint());
      if (ui != null) this.houseBalanceUnits = toBaseUnits(ui, "base");
    } catch (error) {
      console.error("[ads] house balance refresh failed:", error);
    }
  }

  private brand(wallet: string): BrandState {
    let b = this.brands.get(wallet);
    if (!b) {
      b = { balance: 0, lifetimeSpent: 0, dirty: false };
      this.brands.set(wallet, b);
    }
    return b;
  }

  private costPerImpression(c: AdCampaignRow): number {
    return Math.floor(c.cpm / 1000);
  }

  private isFunded(c: AdCampaignRow): boolean {
    return (this.brands.get(c.brandWallet)?.balance ?? 0) >= this.costPerImpression(c);
  }

  /**
   * Rank approved campaigns into slots by CPM. Funded bids win slots first; any
   * leftover slots are filled by **admin (house) campaigns that are unfunded** —
   * these serve free as house promos. Non-admin campaigns must be funded to
   * appear, so brands can't advertise for free.
   */
  recompute(): void {
    const slots = [...AD_SLOTS].sort((a, b) => b.weight - a.weight);
    const approved = [...this.campaigns.values()].filter((c) => c.status === "approved");
    const funded = approved.filter((c) => this.isFunded(c)).sort((a, b) => b.cpm - a.cpm);
    const housePromos = approved
      .filter((c) => !this.isFunded(c) && this.isAdmin(c.brandWallet))
      .sort((a, b) => b.cpm - a.cpm);
    const ordered = [...funded, ...housePromos];
    this.assignment.clear();
    slots.forEach((slot, i) => {
      if (ordered[i]) this.assignment.set(slot.id, ordered[i].id);
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

  /** The campaign in the highest-weight occupied slot — the fallback ad shown on empty slots/banner. */
  private topCampaignId(): string | null {
    for (const slot of [...AD_SLOTS].sort((a, b) => b.weight - a.weight)) {
      const cid = this.assignment.get(slot.id);
      if (cid) return cid;
    }
    return null;
  }

  /** Which campaign a slot shows: its own assignment, or the top-ranked ad as fallback. */
  slotCampaign(slotId: string): string | null {
    return this.assignment.get(slotId) ?? this.topCampaignId();
  }

  /**
   * Count + bill one impression for a campaign, crediting the viewing member's
   * share. Callers dedupe per viewer per tick so a campaign is billed at most
   * once per player per minute regardless of how many surfaces show it
   * (frequency cap). The player's share is only accrued while the house wallet
   * can cover total liabilities (solvency guard).
   *
   * `worldOwnerWallet` marks an impression generated inside an opted-in player
   * World: its owner takes AD_WORLD_OWNER_SHARE on top of the viewer's share,
   * so World inventory pays out in full and the platform keeps nothing.
   */
  recordCampaignImpression(
    campaignId: string,
    viewerWallet: string | null,
    worldOwnerWallet: string | null = null,
  ): { ownerCredit: Promise<number> } {
    const none = { ownerCredit: Promise.resolve(0) };
    const c = this.campaigns.get(campaignId);
    if (!c) return none;
    // The ad was shown, so the impression counts either way.
    c.impressions += 1;
    this.dirtyCampaigns.add(c.id);

    const brand = this.brand(c.brandWallet);
    const cost = Math.floor(c.cpm / 1000);
    // Unfunded (free) house promo — no charge and no player payout.
    if (cost <= 0 || brand.balance < cost) return none;

    brand.balance -= cost;
    brand.lifetimeSpent += cost;
    brand.dirty = true;
    c.spent += cost;

    // An owner viewing their own World would otherwise collect both halves, so
    // pay them the owner share only — the bigger of the two, and the one they
    // earn by providing the inventory rather than by standing in front of it.
    const ownerIsViewer = !!worldOwnerWallet && worldOwnerWallet === viewerWallet;

    if (viewerWallet && !ownerIsViewer && this.isMember(viewerWallet)) {
      const share = Math.floor(cost * AD_PLAYER_SHARE);
      const m = this.members.get(viewerWallet)!;
      if (this.accrue(m, share)) m.impressions += 1;
    }

    // A World owner earns from inventory they own, so they are credited whether
    // or not they ever joined the viewer program (which is gated on invites).
    // This half is deferred: their stored balance has to be read before
    // anything can be added to it.
    const ownerCredit = worldOwnerWallet
      ? this.creditWorldOwner(worldOwnerWallet, Math.floor(cost * AD_WORLD_OWNER_SHARE))
      : Promise.resolve(0);

    // If this drained the brand, re-rank so a funded bid can take the slot.
    if (brand.balance < cost) this.recompute();
    return { ownerCredit };
  }

  /**
   * Load a wallet's member state into memory exactly once, reading the DB row
   * first and creating a zeroed one only when there genuinely isn't one.
   *
   * NEVER construct MemberState without going through here. `saveMember` writes
   * ABSOLUTE values, so a fresh zeroed row for a wallet that already has stored
   * earnings would have the next flush overwrite that balance with the zero —
   * silently wiping a player's claimable $BASE. Concurrent callers share one
   * in-flight read for the same reason: two parallel loads would each create a
   * state and the second would discard the first's accrual.
   */
  private async loadMemberState(wallet: string): Promise<MemberState> {
    const loaded = this.members.get(wallet);
    if (loaded) return loaded;
    let inFlight = this.memberLoads.get(wallet);
    if (!inFlight) {
      inFlight = (async () => {
        const row = await dbGetMember(wallet);
        // Re-check: another caller may have populated it during the await.
        const raced = this.members.get(wallet);
        if (raced) return raced;
        const state: MemberState = {
          earnings: row?.earnings ?? 0,
          lifetime: row?.lifetime ?? 0,
          impressions: row?.impressions ?? 0,
          worldLifetime: row?.worldLifetime ?? 0,
          worldImpressions: row?.worldImpressions ?? 0,
          joined: row?.joined ?? false,
          dirty: false,
        };
        this.members.set(wallet, state);
        return state;
      })();
      this.memberLoads.set(wallet, inFlight);
      void inFlight.finally(() => this.memberLoads.delete(wallet));
    }
    return inFlight;
  }

  /**
   * Credit a World owner's half. Async because it must read any stored balance
   * before it can add to it. Resolves the amount credited in $BASE UI units (0
   * when the solvency guard skipped it).
   */
  private async creditWorldOwner(wallet: string, share: number): Promise<number> {
    let owner: MemberState;
    try {
      owner = await this.loadMemberState(wallet);
    } catch (error) {
      // Drop this impression's owner share rather than risk crediting a state
      // we couldn't verify against the DB. Never rethrow: the caller is a
      // fire-and-forget tick, and an unhandled rejection would take the
      // process down over one minute of one World's ad revenue.
      console.error("[ads] world owner credit skipped — member load failed:", error);
      return 0;
    }
    if (!this.accrue(owner, share)) return 0;
    owner.impressions += 1;
    owner.worldLifetime += share;
    owner.worldImpressions += 1;
    return toUiAmount(share, "base");
  }

  /**
   * Accrue a share against the solvency guard: only credit what the house
   * wallet can actually pay out. Returns false when the share was skipped, so
   * the caller doesn't count an impression it didn't pay for.
   */
  private accrue(m: MemberState, share: number): boolean {
    if (share <= 0 || this.liabilities + share > this.houseBalanceUnits) return false;
    m.earnings += share;
    m.lifetime += share;
    m.dirty = true;
    this.liabilities += share;
    return true;
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
      await saveMember(wallet, m.earnings, m.lifetime, m.impressions, m.worldLifetime, m.worldImpressions, m.joined);
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

  async creditDeposit(wallet: string, uiAmount: number, signature: string): Promise<{ credited: boolean; balance: number }> {
    const amount = toBaseUnits(uiAmount, "base");
    const res = await creditAdDepositOnce(wallet, amount, signature);
    // Always sync the in-memory balance to the DB truth (res.balance is the
    // current DB balance whether we just credited or it was already there).
    this.brand(wallet).balance = res.balance;
    this.recompute();
    return res;
  }

  /** Pull a brand's balance from the DB into memory (DB is the source of truth). */
  async syncBrand(wallet: string): Promise<void> {
    if (!wallet) return;
    this.brand(wallet).balance = await getBrandBalance(wallet);
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

  /** Pause (stop serving) or resume a brand's own approved campaign. */
  async pauseCampaign(wallet: string, id: string, paused: boolean): Promise<AdActionResult> {
    const c = this.campaigns.get(id);
    if (!c) return { ok: false, error: "Campaign not found." };
    if (c.brandWallet !== wallet && !this.isAdmin(wallet)) return { ok: false, error: "That isn't your campaign." };
    if (paused) {
      if (c.status !== "approved") return { ok: false, error: "Only an active campaign can be paused." };
      c.status = "paused";
    } else {
      if (c.status !== "paused") return { ok: false, error: "That campaign isn't paused." };
      c.status = "approved";
    }
    await setCampaignStatus(id, c.status);
    this.recompute();
    return { ok: true };
  }

  /**
   * Edit a brand's own campaign. Changing the bid (CPM) keeps the current status;
   * changing the creative (name/image/headline/link) sends it back to review.
   */
  async editCampaign(
    wallet: string,
    id: string,
    fields: { name: string; imageUrl: string; headline: string; clickUrl: string; cpm: number },
  ): Promise<AdActionResult> {
    const c = this.campaigns.get(id);
    if (!c) return { ok: false, error: "Campaign not found." };
    if (c.brandWallet !== wallet && !this.isAdmin(wallet)) return { ok: false, error: "That isn't your campaign." };

    const name = fields.name.trim().slice(0, 64);
    const imageUrl = fields.imageUrl.trim();
    const headline = fields.headline.trim().slice(0, 120);
    const clickUrl = fields.clickUrl.trim();
    const cpm = toBaseUnits(fields.cpm, "base");

    const creativeChanged = name !== c.name || imageUrl !== c.imageUrl || headline !== c.headline || clickUrl !== c.clickUrl;
    // Creative edits re-enter review; a bid-only change keeps the current status.
    const status: AdCampaignStatus = creativeChanged ? "pending" : c.status;

    c.name = name;
    c.imageUrl = imageUrl;
    c.headline = headline;
    c.clickUrl = clickUrl;
    c.cpm = cpm;
    c.status = status;
    c.reviewNote = null;
    await updateCampaign(id, { name, imageUrl, headline, clickUrl, cpm }, status);
    this.recompute();
    return { ok: true };
  }

  // ---- Admin ops ----

  /** PUBLIC live-auction board for /brands: ranked approved campaigns with the
   * slot each rank holds. Mirrors recompute()'s ordering exactly (funded bids
   * by CPM, then unfunded house promos); unfunded brand campaigns are listed
   * rank-less so a drained brand can see they've dropped out. No balances. */
  getAuctionBoard(): AdAuctionPayload {
    const slots = [...AD_SLOTS].sort((a, b) => b.weight - a.weight);
    const approved = [...this.campaigns.values()].filter((c) => c.status === "approved");
    const funded = approved.filter((c) => this.isFunded(c)).sort((a, b) => b.cpm - a.cpm);
    const housePromos = approved
      .filter((c) => !this.isFunded(c) && this.isAdmin(c.brandWallet))
      .sort((a, b) => b.cpm - a.cpm);
    const sidelined = approved
      .filter((c) => !this.isFunded(c) && !this.isAdmin(c.brandWallet))
      .sort((a, b) => b.cpm - a.cpm);
    const ordered = [...funded, ...housePromos];
    const entries: AdAuctionEntry[] = ordered.map((c, i) => ({
      rank: i + 1,
      campaignId: c.id,
      name: c.name,
      cpm: toUiAmount(c.cpm, "base"),
      slotLabel: slots[i]?.label ?? null,
      funded: this.isFunded(c),
      housePromo: !this.isFunded(c) && this.isAdmin(c.brandWallet),
    }));
    for (const c of sidelined) {
      entries.push({
        rank: null,
        campaignId: c.id,
        name: c.name,
        cpm: toUiAmount(c.cpm, "base"),
        slotLabel: null,
        funded: false,
        housePromo: false,
      });
    }
    return {
      entries,
      slots: slots.map((s) => ({ label: s.label, weight: s.weight })),
      topCpm: funded[0] ? toUiAmount(funded[0].cpm, "base") : 0,
    };
  }

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
    await this.refreshHouseBalance();
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
      houseBalance: toUiAmount(this.houseBalanceUnits, "base"),
      liabilities: toUiAmount(this.liabilities, "base"),
      solvent: this.liabilities <= this.houseBalanceUnits,
      slots,
      rank,
    };
  }

  /**
   * Public, wallet-agnostic ad-marketplace summary for the /stats dashboard.
   * Read-only and cheap (no flush/snapshot): in-memory campaign totals plus DB
   * sums for lifetime player payouts and program members, with 14-day delta
   * series for charts. All money fields are $BASE UI amounts.
   */
  async getPublicStats(): Promise<AdPublicStats> {
    const t = this.platformTotals();
    const playerPaidUnits = await sumMemberLifetime();
    const unclaimedUnits = await sumMemberEarnings();
    const members = await countMembers();

    let brandDepositUnits = 0;
    for (const b of this.brands.values()) brandDepositUnits += b.balance;

    const platDaily = await getDailySeries(14);
    const revenue: AdSeriesPoint[] = [];
    const playerPaid: AdSeriesPoint[] = [];
    const impressions: AdSeriesPoint[] = [];
    for (let i = 1; i < platDaily.length; i++) {
      const day = platDaily[i].day;
      revenue.push({ day, value: toUiAmount(Math.max(0, platDaily[i].revenue - platDaily[i - 1].revenue), "base") });
      playerPaid.push({ day, value: toUiAmount(Math.max(0, platDaily[i].playerPaid - platDaily[i - 1].playerPaid), "base") });
      impressions.push({ day, value: Math.max(0, platDaily[i].impressions - platDaily[i - 1].impressions) });
    }

    return {
      totalRevenue: toUiAmount(t.revenue, "base"),
      playerPaid: toUiAmount(playerPaidUnits, "base"),
      platformCut: toUiAmount(Math.max(0, t.revenue - playerPaidUnits), "base"),
      unclaimed: toUiAmount(unclaimedUnits, "base"),
      brandDeposits: toUiAmount(brandDepositUnits, "base"),
      totalImpressions: t.impressions,
      activeCampaigns: t.active,
      pendingCampaigns: t.pending,
      totalCampaigns: this.campaigns.size,
      brands: this.brands.size,
      members,
      sharePct: Math.round(AD_PLAYER_SHARE * 100),
      daily: { revenue, playerPaid, impressions },
    };
  }

  /** Player-facing transparency snapshot: personal earnings + full platform disclosure + charts. */
  async getTransparency(wallet: string, invitedCount: number): Promise<AdTransparencyPayload> {
    await this.flush();
    await this.refreshHouseBalance();
    const t = this.platformTotals();
    const playerPaidUnits = await sumMemberLifetime();
    const memberCount = await countMembers();

    // Capture today's cumulative values so the charts progress day over day.
    await this.snapshotPlatform();
    const m = wallet ? this.members.get(wallet) : undefined;
    if (wallet && m) await snapshotMemberDaily(wallet, m.lifetime, m.impressions);

    const DAYS = 14;
    const platDaily = await getDailySeries(DAYS);
    const memberDaily = wallet ? await getMemberDailySeries(wallet, DAYS) : [];
    const claimsRaw = wallet ? await getMemberClaims(wallet, 20) : [];

    const moneyDeltas = <T>(rows: T[], pick: (r: T) => number, dayOf: (r: T) => string): AdSeriesPoint[] => {
      const out: AdSeriesPoint[] = [];
      for (let i = 1; i < rows.length; i++) {
        out.push({ day: dayOf(rows[i]), value: toUiAmount(Math.max(0, pick(rows[i]) - pick(rows[i - 1])), "base") });
      }
      return out;
    };
    const countDeltas = <T>(rows: T[], pick: (r: T) => number, dayOf: (r: T) => string): AdSeriesPoint[] => {
      const out: AdSeriesPoint[] = [];
      for (let i = 1; i < rows.length; i++) {
        out.push({ day: dayOf(rows[i]), value: Math.max(0, pick(rows[i]) - pick(rows[i - 1])) });
      }
      return out;
    };

    return {
      member: !!m,
      sharePct: Math.round(AD_PLAYER_SHARE * 100),
      withdrawEnabled: isWithdrawEnabled(),
      invitedCount,
      requiredInvites: AD_REQUIRED_INVITES,
      minClaim: AD_MIN_CLAIM,
      earnings: toUiAmount(m?.earnings ?? 0, "base"),
      lifetime: toUiAmount(m?.lifetime ?? 0, "base"),
      impressions: m?.impressions ?? 0,
      personalEarned: moneyDeltas(memberDaily, (r) => r.lifetime, (r) => r.day),
      personalImpressions: countDeltas(memberDaily, (r) => r.impressions, (r) => r.day),
      claims: claimsRaw.map((c) => ({ amount: toUiAmount(c.amount, "base"), signature: c.signature, at: c.at })),
      totalRevenue: toUiAmount(t.revenue, "base"),
      playerPaid: toUiAmount(playerPaidUnits, "base"),
      platformCut: toUiAmount(Math.max(0, t.revenue - playerPaidUnits), "base"),
      totalImpressions: t.impressions,
      memberCount,
      activeCampaigns: t.active,
      houseBalance: toUiAmount(this.houseBalanceUnits, "base"),
      liabilities: toUiAmount(this.liabilities, "base"),
      solvent: this.liabilities <= this.houseBalanceUnits,
      platformRevenue: moneyDeltas(platDaily, (r) => r.revenue, (r) => r.day),
      platformPaid: moneyDeltas(platDaily, (r) => r.playerPaid, (r) => r.day),
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
    // Loads any stored balance first — a World owner may already hold a ledger
    // row from owner earnings, and joining must not disturb it.
    const state = await this.loadMemberState(wallet);
    if (state.joined) return;
    await joinProgram(wallet);
    state.joined = true;
    state.dirty = true;
  }

  async ensureMemberLoaded(wallet: string): Promise<void> {
    await this.loadMemberState(wallet);
  }

  getProgram(wallet: string, invitedCount = 0): AdProgramPayload {
    const m = this.members.get(wallet);
    return {
      member: !!m?.joined,
      earnings: toUiAmount(m?.earnings ?? 0, "base"),
      lifetime: toUiAmount(m?.lifetime ?? 0, "base"),
      impressions: m?.impressions ?? 0,
      withdrawEnabled: isWithdrawEnabled(),
      invitedCount,
      worldOwnerLifetime: toUiAmount(m?.worldLifetime ?? 0, "base"),
      worldImpressions: m?.worldImpressions ?? 0,
    };
  }

  isMember(wallet: string): boolean {
    return this.members.get(wallet)?.joined === true;
  }

  /** Pay out a member's accrued earnings to their wallet. */
  async claim(wallet: string): Promise<{ ok: boolean; error?: string; signature?: string }> {
    if (!isWithdrawEnabled()) return { ok: false, error: "Payouts aren't available yet." };
    // Flush this member first so the DB has their latest accrued earnings.
    const m = this.members.get(wallet);
    if (m && m.dirty) {
      m.dirty = false;
      await saveMember(wallet, m.earnings, m.lifetime, m.impressions, m.worldLifetime, m.worldImpressions, m.joined);
    }
    // Enforce the minimum claim before zeroing the balance.
    const current = m ? m.earnings : (await dbGetMember(wallet))?.earnings ?? 0;
    const minUnits = toBaseUnits(AD_MIN_CLAIM, "base");
    if (current < minUnits) {
      return { ok: false, error: `Minimum claim is ${AD_MIN_CLAIM.toLocaleString()} $BASE.` };
    }
    const amount = await takeMemberEarnings(wallet); // atomic zero-and-return
    if (amount <= 0) return { ok: false, error: "Nothing to claim yet." };
    if (m) m.earnings = 0;
    this.liabilities = Math.max(0, this.liabilities - amount);

    const payout = await sendPayout(wallet, "base", amount, this.mint());
    if (!payout.ok) {
      // Refund the claim back to the member on payout failure.
      const cur = await dbGetMember(wallet);
      await saveMember(
        wallet,
        (cur?.earnings ?? 0) + amount,
        cur?.lifetime ?? 0,
        cur?.impressions ?? 0,
        cur?.worldLifetime ?? 0,
        cur?.worldImpressions ?? 0,
        cur?.joined ?? true,
      );
      if (m) m.earnings = (cur?.earnings ?? 0) + amount;
      this.liabilities += amount;
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
