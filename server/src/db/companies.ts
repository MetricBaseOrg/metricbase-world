import {
  DEFAULT_COMPANY_COLOR,
  DEFAULT_COMPANY_EMBLEM,
  emptyCompanyStats,
  type CompanyContractKind,
  type CompanyContractStatus,
  type CompanyStats,
  type CompanyType,
} from "@metricbase/shared";
import type { InventoryEntry } from "@metricbase/shared";
import { getPool } from "./pool.js";

export interface StoredCompany {
  id: string;
  name: string;
  ownerName: string;
  ownerWallet: string | null;
  emblem: string;
  color: number;
  companyType: CompanyType;
  motd: string;
  treasury: number;
  revenueShare: number;
  dividendRate: number;
  /** All member names (owner included). */
  members: string[];
  /** Manager-rank names (subset of members). */
  managers: string[];
  /** Trainee-rank names (subset of members). */
  trainees: string[];
  /** Pending join-request applicant names. */
  joinRequests: string[];
  /** Item warehouse contents. */
  warehouse: InventoryEntry[];
  /** Per-member daily salary (gold). */
  salaries: Record<string, number>;
  stats: CompanyStats;
  /** UTC day (yyyy-mm-dd) of the last completed payout, or null. */
  lastPayoutDay: string | null;
  /** Cumulative revenue snapshot at the last weekly dividend close. */
  weekAnchorRevenue: number;
  /** Cumulative operating expenses (salaries + member dividends) at last close. */
  weekAnchorOpex: number;
  /** Week key of the last share-dividend payout, or null. */
  lastDividendWeek: string | null;
  /** Epoch ms of creation (for age/reputation). */
  createdAt: number;
}

export interface StoredCompanyContract {
  id: string;
  companyId: string;
  posterName: string;
  posterWallet: string | null;
  /** Poster's own company (B2B): escrow debits/refunds here and delivered goods
   *  land in its warehouse. NULL for legacy contracts settled to personal gold. */
  posterCompanyId: string | null;
  kind: CompanyContractKind;
  itemId: string | null;
  qty: number;
  progress: number;
  rewardGold: number;
  status: CompanyContractStatus;
  itemsToCollect: number;
  createdAt: number;
}

function normalizeNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && entry) seen.add(entry);
  }
  return [...seen];
}

function normalizeInventoryJson(value: unknown): InventoryEntry[] {
  if (!Array.isArray(value)) return [];
  const out: InventoryEntry[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as InventoryEntry).itemId === "string" &&
      Number.isFinite((entry as InventoryEntry).quantity)
    ) {
      const e = entry as InventoryEntry;
      if (e.quantity > 0) out.push({ itemId: e.itemId, quantity: Math.floor(e.quantity) });
    }
  }
  return out;
}

function normalizeSalaries(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [name, gold] of Object.entries(value as Record<string, unknown>)) {
    if (typeof gold === "number" && Number.isFinite(gold) && gold > 0) {
      out[name] = Math.floor(gold);
    }
  }
  return out;
}

function normalizeStats(value: unknown): CompanyStats {
  const base = emptyCompanyStats();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<CompanyStats>;
  if (raw.revenue && typeof raw.revenue === "object") {
    base.revenue.skim = Math.max(0, Math.floor(raw.revenue.skim ?? 0));
    base.revenue.vendor = Math.max(0, Math.floor(raw.revenue.vendor ?? 0));
    base.revenue.contracts = Math.max(0, Math.floor(raw.revenue.contracts ?? 0));
    base.revenue.deposits = Math.max(0, Math.floor(raw.revenue.deposits ?? 0));
    base.revenue.shares = Math.max(0, Math.floor(raw.revenue.shares ?? 0));
  }
  if (raw.paidOut && typeof raw.paidOut === "object") {
    base.paidOut.salaries = Math.max(0, Math.floor(raw.paidOut.salaries ?? 0));
    base.paidOut.dividends = Math.max(0, Math.floor(raw.paidOut.dividends ?? 0));
    base.paidOut.shareDividends = Math.max(0, Math.floor(raw.paidOut.shareDividends ?? 0));
  }
  base.contractsCompleted = Math.max(0, Math.floor(raw.contractsCompleted ?? 0));
  if (raw.contrib && typeof raw.contrib === "object") {
    for (const [name, c] of Object.entries(raw.contrib)) {
      if (!c || typeof c !== "object") continue;
      base.contrib[name] = {
        gold: Math.max(0, Math.floor(c.gold ?? 0)),
        itemsValue: Math.max(0, Math.floor(c.itemsValue ?? 0)),
        skim: Math.max(0, Math.floor(c.skim ?? 0)),
        lastActiveDay: typeof c.lastActiveDay === "string" ? c.lastActiveDay : null,
      };
    }
  }
  return base;
}

export async function loadCompanies(): Promise<StoredCompany[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      id: string;
      name: string;
      owner_name: string;
      owner_wallet: string | null;
      emblem: string | null;
      color: number | null;
      company_type: string | null;
      motd: string | null;
      treasury: number | null;
      revenue_share: number | null;
      dividend_rate: number | null;
      members: unknown;
      managers: unknown;
      trainees: unknown;
      join_requests: unknown;
      warehouse: unknown;
      salaries: unknown;
      stats: unknown;
      last_payout_day: string | null;
      week_anchor_revenue: string | number | null;
      week_anchor_opex: string | number | null;
      last_dividend_week: string | null;
      created_at: Date | null;
    }>(
      `SELECT id, name, owner_name, owner_wallet, emblem, color, company_type, motd,
              treasury, revenue_share, dividend_rate, members, managers, trainees,
              join_requests, warehouse, salaries, stats, last_payout_day,
              week_anchor_revenue, week_anchor_opex, last_dividend_week, created_at
       FROM companies`,
    );
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      ownerName: row.owner_name,
      ownerWallet: row.owner_wallet ?? null,
      emblem: typeof row.emblem === "string" && row.emblem ? row.emblem : DEFAULT_COMPANY_EMBLEM,
      color: typeof row.color === "number" ? row.color : DEFAULT_COMPANY_COLOR,
      companyType: (row.company_type as CompanyType) ?? "merchant",
      motd: row.motd ?? "",
      treasury: Math.max(0, Math.floor(row.treasury ?? 0)),
      revenueShare: typeof row.revenue_share === "number" && row.revenue_share >= 0 ? row.revenue_share : 0,
      dividendRate: typeof row.dividend_rate === "number" && row.dividend_rate >= 0 ? row.dividend_rate : 0,
      members: normalizeNameList(row.members),
      managers: normalizeNameList(row.managers),
      trainees: normalizeNameList(row.trainees),
      joinRequests: normalizeNameList(row.join_requests),
      warehouse: normalizeInventoryJson(row.warehouse),
      salaries: normalizeSalaries(row.salaries),
      stats: normalizeStats(row.stats),
      lastPayoutDay: row.last_payout_day ?? null,
      weekAnchorRevenue: Math.max(0, Math.floor(Number(row.week_anchor_revenue ?? 0))),
      weekAnchorOpex: Math.max(0, Math.floor(Number(row.week_anchor_opex ?? 0))),
      lastDividendWeek: row.last_dividend_week ?? null,
      createdAt: row.created_at ? row.created_at.getTime() : Date.now(),
    }));
  } catch (error) {
    console.warn("[companies] load failed:", error);
    return [];
  }
}

export async function saveCompany(company: StoredCompany): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO companies (id, name, owner_name, owner_wallet, emblem, color, company_type,
                              motd, treasury, revenue_share, dividend_rate, members, managers,
                              trainees, join_requests, warehouse, salaries, stats, last_payout_day,
                              week_anchor_revenue, week_anchor_opex, last_dividend_week)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, owner_name = EXCLUDED.owner_name, owner_wallet = EXCLUDED.owner_wallet,
         emblem = EXCLUDED.emblem, color = EXCLUDED.color, company_type = EXCLUDED.company_type,
         motd = EXCLUDED.motd, treasury = EXCLUDED.treasury, revenue_share = EXCLUDED.revenue_share,
         dividend_rate = EXCLUDED.dividend_rate, members = EXCLUDED.members, managers = EXCLUDED.managers,
         trainees = EXCLUDED.trainees, join_requests = EXCLUDED.join_requests,
         warehouse = EXCLUDED.warehouse, salaries = EXCLUDED.salaries, stats = EXCLUDED.stats,
         last_payout_day = EXCLUDED.last_payout_day, week_anchor_revenue = EXCLUDED.week_anchor_revenue,
         week_anchor_opex = EXCLUDED.week_anchor_opex, last_dividend_week = EXCLUDED.last_dividend_week`,
      [
        company.id,
        company.name,
        company.ownerName,
        company.ownerWallet,
        company.emblem,
        company.color,
        company.companyType,
        company.motd,
        company.treasury,
        company.revenueShare,
        company.dividendRate,
        JSON.stringify(company.members),
        JSON.stringify(company.managers),
        JSON.stringify(company.trainees),
        JSON.stringify(company.joinRequests),
        JSON.stringify(company.warehouse),
        JSON.stringify(company.salaries),
        JSON.stringify(company.stats),
        company.lastPayoutDay,
        company.weekAnchorRevenue,
        company.weekAnchorOpex,
        company.lastDividendWeek,
      ],
    );
  } catch (error) {
    console.warn("[companies] save failed:", error);
  }
}

export async function deleteCompany(id: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM companies WHERE id = $1", [id]);
    await pool.query("DELETE FROM company_contracts WHERE company_id = $1", [id]);
  } catch (error) {
    console.warn("[companies] delete failed:", error);
  }
}

export async function loadCompanyContracts(): Promise<StoredCompanyContract[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{
      id: string;
      company_id: string;
      poster_name: string;
      poster_wallet: string | null;
      poster_company_id: string | null;
      kind: string;
      item_id: string | null;
      qty: number;
      progress: number;
      reward_gold: number;
      status: string;
      items_to_collect: number;
      created_at: Date | null;
    }>(
      `SELECT id, company_id, poster_name, poster_wallet, poster_company_id, kind, item_id, qty, progress,
              reward_gold, status, items_to_collect, created_at
       FROM company_contracts WHERE status IN ('open','accepted','completed')`,
    );
    return res.rows.map((row) => ({
      id: row.id,
      companyId: row.company_id,
      posterName: row.poster_name,
      posterWallet: row.poster_wallet ?? null,
      posterCompanyId: row.poster_company_id ?? null,
      kind: row.kind as CompanyContractKind,
      itemId: row.item_id ?? null,
      qty: Math.max(0, Math.floor(row.qty)),
      progress: Math.max(0, Math.floor(row.progress)),
      rewardGold: Math.max(0, Math.floor(row.reward_gold)),
      status: row.status as CompanyContractStatus,
      itemsToCollect: Math.max(0, Math.floor(row.items_to_collect)),
      createdAt: row.created_at ? row.created_at.getTime() : Date.now(),
    }));
  } catch (error) {
    console.warn("[companies] load contracts failed:", error);
    return [];
  }
}

export async function saveCompanyContract(contract: StoredCompanyContract): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO company_contracts (id, company_id, poster_name, poster_wallet, poster_company_id, kind, item_id,
                                      qty, progress, reward_gold, status, items_to_collect)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         progress = EXCLUDED.progress, status = EXCLUDED.status,
         items_to_collect = EXCLUDED.items_to_collect`,
      [
        contract.id,
        contract.companyId,
        contract.posterName,
        contract.posterWallet,
        contract.posterCompanyId,
        contract.kind,
        contract.itemId,
        contract.qty,
        contract.progress,
        contract.rewardGold,
        contract.status,
        contract.itemsToCollect,
      ],
    );
  } catch (error) {
    console.warn("[companies] save contract failed:", error);
  }
}

export async function deleteCompanyContract(id: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query("DELETE FROM company_contracts WHERE id = $1", [id]);
  } catch (error) {
    console.warn("[companies] delete contract failed:", error);
  }
}

export async function insertCompanyPayoutLog(
  companyId: string,
  day: string,
  salariesPaid: number,
  dividendsPaid: number,
  detail: Record<string, number>,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO company_payouts (company_id, day, salaries_paid, dividends_paid, detail)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (company_id, day) DO NOTHING`,
      [companyId, day, salariesPaid, dividendsPaid, JSON.stringify(detail)],
    );
  } catch (error) {
    console.warn("[companies] payout log failed:", error);
  }
}

/** Distinct payout days per company (for reputation), loaded once at boot. */
export async function loadCompanyPayoutDayCounts(): Promise<Record<string, number>> {
  const pool = getPool();
  if (!pool) return {};
  try {
    const res = await pool.query<{ company_id: string; n: string }>(
      "SELECT company_id, COUNT(*)::text AS n FROM company_payouts GROUP BY company_id",
    );
    const out: Record<string, number> = {};
    for (const row of res.rows) out[row.company_id] = Number(row.n);
    return out;
  } catch {
    return {};
  }
}
