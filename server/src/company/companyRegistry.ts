import crypto from "node:crypto";
import {
  COMPANY_DIVIDEND_MIN_ACTIVITY_DAYS,
  COMPANY_MAX_DIVIDEND_RATE,
  COMPANY_MAX_OPEN_CONTRACTS,
  COMPANY_MAX_REVENUE_SHARE,
  COMPANY_MAX_SALARY,
  COMPANY_MIN_MEMBERS_FOR_DIVIDENDS,
  COMPANY_WAREHOUSE_SLOTS,
  MAX_COMPANY_MEMBERS,
  addItemToInventory,
  companyCan,
  companyRankOf,
  computeCompanyReputation,
  emptyCompanyStats,
  getItemBaseValue,
  isSupplyItem,
  isValidCompanyColor,
  isValidCompanyEmblem,
  isValidCompanyName,
  isValidCompanyType,
  removeItemFromInventory,
  sanitizeCompanyMotd,
  validateCompanyContract,
  type CompanyContractKind,
  type CompanyContractView,
  type CompanyDetail,
  type CompanyRank,
  type CompanyStatePayload,
  type CompanySummary,
  type CompanyType,
  type CompanyContribution,
} from "@metricbase/shared";
import {
  deleteCompany,
  deleteCompanyContract,
  insertCompanyPayoutLog,
  loadCompanies,
  loadCompanyContracts,
  loadCompanyPayoutDayCounts,
  saveCompany,
  saveCompanyContract,
  type StoredCompany,
  type StoredCompanyContract,
} from "../db/companies.js";
import { sendToPlayer, sendToPlayers } from "../social/presence.js";

// Process-global registry of companies + their inbound contracts, shared across
// all zone rooms and persisted to the DB so they survive restarts. Mirrors the
// guild registry: mutate memory, then fire-and-forget the write-through.
const companies = new Map<string, StoredCompany>();
const memberIndex = new Map<string, string>(); // playerName -> companyId
const contracts = new Map<string, StoredCompanyContract>();
// companyId -> number of distinct days it has paid out (reputation only).
const payoutDayCounts = new Map<string, number>();

function utcDay(at = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}

function reindex() {
  memberIndex.clear();
  for (const company of companies.values()) {
    for (const name of company.members) memberIndex.set(name, company.id);
  }
}

export async function initCompanyRegistry(): Promise<void> {
  companies.clear();
  contracts.clear();
  payoutDayCounts.clear();
  for (const company of await loadCompanies()) companies.set(company.id, company);
  for (const contract of await loadCompanyContracts()) contracts.set(contract.id, contract);
  const counts = await loadCompanyPayoutDayCounts();
  for (const [id, n] of Object.entries(counts)) payoutDayCounts.set(id, n);
  reindex();
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getCompanyForMember(name: string): StoredCompany | undefined {
  const id = memberIndex.get(name);
  return id ? companies.get(id) : undefined;
}

export function getCompanyById(id: string | null): StoredCompany | undefined {
  return id ? companies.get(id) : undefined;
}

/** Member names of the company a player belongs to (for state broadcasts). */
export function companyMemberNames(name: string): string[] {
  return getCompanyForMember(name)?.members ?? [];
}

export function companyRankFor(name: string): CompanyRank | null {
  const company = getCompanyForMember(name);
  if (!company) return null;
  return companyRankOf(name, company.ownerName, company.managers, company.trainees);
}

export interface CompanyActionResult {
  ok: boolean;
  error?: string;
}

function contribFor(company: StoredCompany, name: string): CompanyContribution {
  let c = company.stats.contrib[name];
  if (!c) {
    c = { gold: 0, itemsValue: 0, skim: 0, lastActiveDay: null };
    company.stats.contrib[name] = c;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Creation + membership
// ---------------------------------------------------------------------------

export function createCompany(
  name: string,
  emblem: string,
  color: number,
  companyType: CompanyType,
  ownerName: string,
  ownerWallet: string | null,
): CompanyActionResult & { company?: StoredCompany } {
  if (memberIndex.has(ownerName)) return { ok: false, error: "You're already in a company." };
  if (!isValidCompanyName(name)) return { ok: false, error: "Invalid company name." };
  if (!isValidCompanyEmblem(emblem)) return { ok: false, error: "Pick a valid emblem." };
  if (!isValidCompanyColor(color)) return { ok: false, error: "Pick a valid colour." };
  if (!isValidCompanyType(companyType)) return { ok: false, error: "Pick a valid company type." };

  const lowerName = name.toLowerCase();
  for (const company of companies.values()) {
    if (company.name.toLowerCase() === lowerName) return { ok: false, error: "Name already taken." };
  }

  const record: StoredCompany = {
    id: crypto.randomUUID(),
    name,
    ownerName,
    ownerWallet,
    emblem,
    color,
    companyType,
    motd: "",
    treasury: 0,
    revenueShare: 0,
    dividendRate: 0,
    members: [ownerName],
    managers: [],
    trainees: [],
    joinRequests: [],
    warehouse: [],
    salaries: {},
    stats: emptyCompanyStats(),
    lastPayoutDay: null,
    createdAt: Date.now(),
  };
  companies.set(record.id, record);
  memberIndex.set(ownerName, record.id);
  void saveCompany(record);
  return { ok: true, company: record };
}

export function pendingRequestCompanyId(name: string): string | null {
  for (const company of companies.values()) {
    if (company.joinRequests.includes(name)) return company.id;
  }
  return null;
}

export function requestJoinCompany(
  name: string,
  companyId: string,
): CompanyActionResult & { company?: StoredCompany } {
  if (memberIndex.has(name)) return { ok: false, error: "You're already in a company." };
  const company = companies.get(companyId);
  if (!company) return { ok: false, error: "That company no longer exists." };
  if (company.members.length >= MAX_COMPANY_MEMBERS) return { ok: false, error: "That company is full." };
  if (pendingRequestCompanyId(name)) return { ok: false, error: "You already have a pending request." };
  company.joinRequests.push(name);
  void saveCompany(company);
  return { ok: true, company };
}

export function cancelJoinRequest(name: string): StoredCompany | null {
  const id = pendingRequestCompanyId(name);
  if (!id) return null;
  const company = companies.get(id);
  if (!company) return null;
  company.joinRequests = company.joinRequests.filter((n) => n !== name);
  void saveCompany(company);
  return company;
}

export function approveJoinRequest(
  actor: string,
  applicant: string,
): CompanyActionResult & { company?: StoredCompany } {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (!companyCan(companyRankOf(actor, company.ownerName, company.managers, company.trainees), "approveMembers")) {
    return { ok: false, error: "You don't have permission to approve members." };
  }
  if (!company.joinRequests.includes(applicant)) return { ok: false, error: "No such request." };
  if (memberIndex.has(applicant)) {
    company.joinRequests = company.joinRequests.filter((n) => n !== applicant);
    void saveCompany(company);
    return { ok: false, error: "They already joined a company." };
  }
  if (company.members.length >= MAX_COMPANY_MEMBERS) return { ok: false, error: "Your company is full." };

  company.joinRequests = company.joinRequests.filter((n) => n !== applicant);
  company.members.push(applicant);
  company.trainees.push(applicant); // new hires start as trainees
  memberIndex.set(applicant, company.id);
  void saveCompany(company);
  return { ok: true, company };
}

export function denyJoinRequest(
  actor: string,
  applicant: string,
): CompanyActionResult & { company?: StoredCompany } {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (!companyCan(companyRankOf(actor, company.ownerName, company.managers, company.trainees), "approveMembers")) {
    return { ok: false, error: "You don't have permission." };
  }
  company.joinRequests = company.joinRequests.filter((n) => n !== applicant);
  void saveCompany(company);
  return { ok: true, company };
}

export interface CompanyRefund {
  name: string;
  amount: number;
}

/** Remove a member. On the owner leaving, leadership passes to the first
 * manager (else the first remaining member). When the company empties it is
 * deleted and every open/accepted contract's escrow is refunded to its poster
 * (returned to the caller to credit). */
export function leaveCompany(
  name: string,
): CompanyActionResult & { disbanded?: boolean; refunds?: CompanyRefund[] } {
  const company = getCompanyForMember(name);
  if (!company) return { ok: false, error: "You're not in a company." };

  company.members = company.members.filter((m) => m !== name);
  company.managers = company.managers.filter((m) => m !== name);
  company.trainees = company.trainees.filter((m) => m !== name);
  delete company.salaries[name];
  memberIndex.delete(name);

  if (company.members.length === 0) {
    const refunds = disbandCompany(company);
    return { ok: true, disbanded: true, refunds };
  }

  if (company.ownerName === name) {
    company.ownerName = company.managers[0] ?? company.members[0];
    company.managers = company.managers.filter((m) => m !== company.ownerName);
    company.trainees = company.trainees.filter((m) => m !== company.ownerName);
  }
  void saveCompany(company);
  return { ok: true };
}

function disbandCompany(company: StoredCompany): CompanyRefund[] {
  const refunds: CompanyRefund[] = [];
  for (const contract of contracts.values()) {
    if (contract.companyId !== company.id) continue;
    if (contract.status === "open" || contract.status === "accepted") {
      refunds.push({ name: contract.posterName, amount: contract.rewardGold });
    }
    contracts.delete(contract.id);
    void deleteCompanyContract(contract.id);
  }
  companies.delete(company.id);
  payoutDayCounts.delete(company.id);
  void deleteCompany(company.id);
  return refunds;
}

export function kickCompanyMember(actor: string, target: string): CompanyActionResult {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  const actorRank = companyRankOf(actor, company.ownerName, company.managers, company.trainees);
  if (!companyCan(actorRank, "kick")) return { ok: false, error: "You don't have permission to kick." };
  if (target === actor) return { ok: false, error: "Use Leave to exit your own company." };
  if (!company.members.includes(target)) return { ok: false, error: "They're not in your company." };
  if (target === company.ownerName) return { ok: false, error: "You can't kick the owner." };
  const targetRank = companyRankOf(target, company.ownerName, company.managers, company.trainees);
  // Managers can only kick employees/trainees — not other managers.
  if (actorRank === "manager" && targetRank === "manager") {
    return { ok: false, error: "Only the owner can remove a manager." };
  }
  company.members = company.members.filter((m) => m !== target);
  company.managers = company.managers.filter((m) => m !== target);
  company.trainees = company.trainees.filter((m) => m !== target);
  delete company.salaries[target];
  memberIndex.delete(target);
  void saveCompany(company);
  return { ok: true };
}

/** Set a member's rank. The owner may set any of manager/employee/trainee; a
 * manager may only shuffle members between trainee and employee. */
export function setCompanyRank(actor: string, target: string, rank: CompanyRank): CompanyActionResult {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  const actorRank = companyRankOf(actor, company.ownerName, company.managers, company.trainees);
  if (!companyCan(actorRank, "setRanks")) return { ok: false, error: "You don't have permission." };
  if (rank === "owner") return { ok: false, error: "Transfer ownership isn't supported." };
  if (!company.members.includes(target)) return { ok: false, error: "They're not in your company." };
  if (target === company.ownerName) return { ok: false, error: "The owner's rank is fixed." };
  if (actorRank === "manager" && rank === "manager") {
    return { ok: false, error: "Only the owner can appoint managers." };
  }
  const targetRank = companyRankOf(target, company.ownerName, company.managers, company.trainees);
  if (actorRank === "manager" && targetRank === "manager") {
    return { ok: false, error: "Only the owner can change a manager's rank." };
  }
  company.managers = company.managers.filter((m) => m !== target);
  company.trainees = company.trainees.filter((m) => m !== target);
  if (rank === "manager") company.managers.push(target);
  else if (rank === "trainee") company.trainees.push(target);
  // employee = in members but neither list
  void saveCompany(company);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function setCompanyMotd(actor: string, rawMotd: string): CompanyActionResult {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (!companyCan(companyRankOf(actor, company.ownerName, company.managers, company.trainees), "setMotd")) {
    return { ok: false, error: "You don't have permission." };
  }
  company.motd = sanitizeCompanyMotd(rawMotd);
  void saveCompany(company);
  return { ok: true };
}

export function setCompanyRates(actor: string, revenueShare: number, dividendRate: number): CompanyActionResult {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (company.ownerName !== actor) return { ok: false, error: "Only the owner can set rates." };
  if (!Number.isFinite(revenueShare) || revenueShare < 0 || revenueShare > COMPANY_MAX_REVENUE_SHARE) {
    return { ok: false, error: `Revenue share must be 0–${Math.round(COMPANY_MAX_REVENUE_SHARE * 100)}%.` };
  }
  if (!Number.isFinite(dividendRate) || dividendRate < 0 || dividendRate > COMPANY_MAX_DIVIDEND_RATE) {
    return { ok: false, error: `Dividend rate must be 0–${Math.round(COMPANY_MAX_DIVIDEND_RATE * 100)}%.` };
  }
  company.revenueShare = revenueShare;
  company.dividendRate = dividendRate;
  void saveCompany(company);
  return { ok: true };
}

export function setCompanySalary(actor: string, target: string, goldPerDay: number): CompanyActionResult {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (company.ownerName !== actor) return { ok: false, error: "Only the owner can set salaries." };
  if (!company.members.includes(target)) return { ok: false, error: "They're not in your company." };
  const gold = Math.floor(goldPerDay);
  if (!Number.isFinite(gold) || gold < 0 || gold > COMPANY_MAX_SALARY) {
    return { ok: false, error: `Salary must be 0–${COMPANY_MAX_SALARY} gold/day.` };
  }
  if (gold === 0) delete company.salaries[target];
  else company.salaries[target] = gold;
  void saveCompany(company);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Treasury (gold)
// ---------------------------------------------------------------------------

/** Member deposits gold into the treasury (caller has already debited the
 * player's gold). A pure transfer — never mints. */
export function depositCompanyGold(name: string, amount: number): CompanyActionResult {
  const company = getCompanyForMember(name);
  if (!company) return { ok: false, error: "You're not in a company." };
  const gold = Math.floor(amount);
  if (!Number.isFinite(gold) || gold <= 0) return { ok: false, error: "Enter a positive amount." };
  company.treasury += gold;
  company.stats.revenue.deposits += gold;
  contribFor(company, name).gold += gold;
  void saveCompany(company);
  return { ok: true };
}

/** Owner withdraws gold from the treasury. Returns the amount for the caller to
 * credit to the player's gold. */
export function withdrawCompanyGold(
  actor: string,
  amount: number,
): CompanyActionResult & { amount?: number } {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (!companyCan(companyRankOf(actor, company.ownerName, company.managers, company.trainees), "withdrawGold")) {
    return { ok: false, error: "Only the owner can withdraw gold." };
  }
  const want = Math.floor(amount);
  if (!Number.isFinite(want) || want <= 0) return { ok: false, error: "Enter a positive amount." };
  if (company.treasury < want) return { ok: false, error: "The treasury doesn't have that much." };
  company.treasury -= want;
  void saveCompany(company);
  return { ok: true, amount: want };
}

/** Skim a slice of a member's gross earnings into their company treasury (the
 * revenue-share). Returns the amount skimmed. Mirrors applyGuildTax — a pure
 * transfer, never mints. */
export function applyCompanyCut(name: string, grossGold: number): number {
  const company = getCompanyForMember(name);
  if (!company || company.revenueShare <= 0 || grossGold <= 0) return 0;
  const cut = Math.floor(grossGold * company.revenueShare);
  if (cut <= 0) return 0;
  company.treasury += cut;
  company.stats.revenue.skim += cut;
  contribFor(company, name).skim += cut;
  void saveCompany(company);
  return cut;
}

/** Credit non-member revenue (vendor sales, contract payouts) to a treasury. */
export function creditCompanyTreasury(id: string, amount: number, source: "vendor" | "contracts"): void {
  const company = companies.get(id);
  if (!company || amount <= 0) return;
  const gold = Math.floor(amount);
  company.treasury += gold;
  company.stats.revenue[source] += gold;
  void saveCompany(company);
}

/** Stamp a member's most-recent activity day (dividend eligibility). */
export function tickCompanyActivity(name: string): void {
  const company = getCompanyForMember(name);
  if (!company) return;
  const c = contribFor(company, name);
  const today = utcDay();
  if (c.lastActiveDay !== today) {
    c.lastActiveDay = today;
    void saveCompany(company);
  }
}

// ---------------------------------------------------------------------------
// Warehouse (items)
// ---------------------------------------------------------------------------

/** Member contributes items (caller confirms the player owns them and removes
 * exactly `added` afterwards). Returns how many actually fit. */
export function contributeWarehouse(
  name: string,
  itemId: string,
  qty: number,
): CompanyActionResult & { added?: number } {
  const company = getCompanyForMember(name);
  if (!company) return { ok: false, error: "You're not in a company." };
  const want = Math.floor(qty);
  if (!Number.isFinite(want) || want <= 0) return { ok: false, error: "Nothing to contribute." };
  const { inventory, added } = addItemToInventory(company.warehouse, itemId, want, COMPANY_WAREHOUSE_SLOTS);
  if (added <= 0) return { ok: false, error: "The warehouse is full." };
  company.warehouse = inventory;
  contribFor(company, name).itemsValue += getItemBaseValue(itemId) * added;
  void saveCompany(company);
  return { ok: true, added };
}

/** Internal: add items back to a warehouse with no permission/stat effects
 * (used to return the remainder of a partial withdrawal or vendor sale). */
export function stockWarehouse(id: string, itemId: string, qty: number): number {
  const company = companies.get(id);
  if (!company || qty <= 0) return 0;
  const { inventory, added } = addItemToInventory(company.warehouse, itemId, qty, COMPANY_WAREHOUSE_SLOTS);
  company.warehouse = inventory;
  if (added > 0) void saveCompany(company);
  return added;
}

/** Remove items from the warehouse. `perm` gates the action (withdrawItems for a
 * member withdrawal, sellWarehouse for a vendor sale). Returns how many came
 * out plus the company id, for the caller to route. */
export function takeFromWarehouse(
  actor: string,
  itemId: string,
  qty: number,
  perm: "withdrawItems" | "sellWarehouse",
): CompanyActionResult & { removed?: number; companyId?: string } {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (!companyCan(companyRankOf(actor, company.ownerName, company.managers, company.trainees), perm)) {
    return { ok: false, error: "You don't have permission." };
  }
  const want = Math.floor(qty);
  if (!Number.isFinite(want) || want <= 0) return { ok: false, error: "Nothing selected." };
  const { inventory, removed } = removeItemFromInventory(company.warehouse, itemId, want);
  if (removed <= 0) return { ok: false, error: "The warehouse doesn't have that." };
  company.warehouse = inventory;
  void saveCompany(company);
  return { ok: true, removed, companyId: company.id };
}

// ---------------------------------------------------------------------------
// Contracts (inbound, posted BY outsiders)
// ---------------------------------------------------------------------------

function companyContracts(companyId: string): StoredCompanyContract[] {
  return [...contracts.values()].filter((c) => c.companyId === companyId);
}

/** Post a contract to a company (escrow already debited by the caller). Rejects
 * posting to a company you belong to (self-dealing guard). Returns the contract. */
export function postCompanyContract(
  poster: string,
  posterWallet: string | null,
  companyId: string,
  kind: CompanyContractKind,
  itemId: string | null,
  qty: number,
  rewardGold: number,
): CompanyActionResult & { contract?: StoredCompanyContract } {
  const company = companies.get(companyId);
  if (!company) return { ok: false, error: "That company no longer exists." };
  if (getCompanyForMember(poster)?.id === companyId) {
    return { ok: false, error: "You can't post a contract to your own company." };
  }
  const err = validateCompanyContract(kind, itemId, qty, rewardGold, isSupplyItem);
  if (err) return { ok: false, error: err };
  const open = companyContracts(companyId).filter((c) => c.status === "open" || c.status === "accepted");
  if (open.length >= COMPANY_MAX_OPEN_CONTRACTS) {
    return { ok: false, error: "That company already has the maximum open contracts." };
  }
  const contract: StoredCompanyContract = {
    id: crypto.randomUUID(),
    companyId,
    posterName: poster,
    posterWallet,
    kind,
    itemId: kind === "supply" ? itemId : null,
    qty: Math.floor(qty),
    progress: 0,
    rewardGold: Math.floor(rewardGold),
    status: "open",
    itemsToCollect: 0,
    createdAt: Date.now(),
  };
  contracts.set(contract.id, contract);
  void saveCompanyContract(contract);
  return { ok: true, contract };
}

/** Poster cancels an open/accepted contract. Returns the escrow to refund. */
export function cancelCompanyContract(
  poster: string,
  id: string,
): CompanyActionResult & { refund?: number } {
  const contract = contracts.get(id);
  if (!contract) return { ok: false, error: "That contract is gone." };
  if (contract.posterName !== poster) return { ok: false, error: "That's not your contract." };
  if (contract.status !== "open" && contract.status !== "accepted") {
    return { ok: false, error: "That contract can't be cancelled." };
  }
  const refund = contract.rewardGold;
  contracts.delete(id);
  void deleteCompanyContract(id);
  return { ok: true, refund };
}

/** A company member with the acceptContracts permission accepts a contract. */
export function acceptCompanyContract(actor: string, id: string): CompanyActionResult {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (!companyCan(companyRankOf(actor, company.ownerName, company.managers, company.trainees), "acceptContracts")) {
    return { ok: false, error: "You don't have permission to accept contracts." };
  }
  const contract = contracts.get(id);
  if (!contract || contract.companyId !== company.id) return { ok: false, error: "No such contract." };
  if (contract.status !== "open") return { ok: false, error: "That contract isn't open." };
  contract.status = "accepted";
  void saveCompanyContract(contract);
  return { ok: true };
}

/** Deliver items toward an accepted supply contract, pulled from the warehouse.
 * When the quota is met the contract completes and its escrow moves to the
 * treasury. Returns whether it completed + the reward booked. */
export function deliverCompanyContract(
  actor: string,
  id: string,
  qty: number,
): CompanyActionResult & { completed?: boolean; reward?: number } {
  const company = getCompanyForMember(actor);
  if (!company) return { ok: false, error: "You're not in a company." };
  if (!companyCan(companyRankOf(actor, company.ownerName, company.managers, company.trainees), "acceptContracts")) {
    return { ok: false, error: "You don't have permission." };
  }
  const contract = contracts.get(id);
  if (!contract || contract.companyId !== company.id) return { ok: false, error: "No such contract." };
  if (contract.status !== "accepted") return { ok: false, error: "Accept the contract first." };
  if (contract.kind !== "supply" || !contract.itemId) {
    return { ok: false, error: "That contract is fulfilled by activity, not delivery." };
  }
  const need = contract.qty - contract.progress;
  const want = Math.min(Math.floor(qty), need);
  if (want <= 0) return { ok: false, error: "Nothing left to deliver." };
  const { inventory, removed } = removeItemFromInventory(company.warehouse, contract.itemId, want);
  if (removed <= 0) return { ok: false, error: "The warehouse doesn't have those items." };
  company.warehouse = inventory;
  contract.progress += removed;
  const completed = contract.progress >= contract.qty;
  if (completed) return { ...completeContract(company, contract), ok: true, completed: true };
  void saveCompany(company);
  void saveCompanyContract(contract);
  return { ok: true, completed: false };
}

/** Advance an ACCEPTED activity contract (gather/harvest/mobs) when a company
 * member performs the matching activity. */
export function bumpCompanyContractProgress(name: string, kind: CompanyContractKind, n: number): void {
  const company = getCompanyForMember(name);
  if (!company || n <= 0) return;
  let changed = false;
  for (const contract of contracts.values()) {
    if (contract.companyId !== company.id) continue;
    if (contract.status !== "accepted" || contract.kind !== kind) continue;
    contract.progress = Math.min(contract.qty, contract.progress + n);
    if (contract.progress >= contract.qty) {
      completeContract(company, contract);
    } else {
      void saveCompanyContract(contract);
    }
    changed = true;
    break; // one contract per activity tick
  }
  if (changed) {
    // Push refreshed state to members so contract progress bars move live.
    broadcastCompanyState(company.members);
  }
}

function completeContract(
  company: StoredCompany,
  contract: StoredCompanyContract,
): { reward: number } {
  contract.status = "completed";
  // Supply contracts: the goods delivered from the warehouse are now the
  // poster's to collect (they paid for them). Activity contracts deliver no
  // items — the poster commissioned labour.
  contract.itemsToCollect = contract.kind === "supply" ? contract.qty : 0;
  // Escrowed reward becomes company revenue — a transfer, no mint.
  company.treasury += contract.rewardGold;
  company.stats.revenue.contracts += contract.rewardGold;
  company.stats.contractsCompleted += 1;
  void saveCompany(company);
  void saveCompanyContract(contract);
  // Refresh the poster (an outsider) so they see the completion + any goods to collect.
  sendToPlayer(contract.posterName, "companyState", buildCompanyStatePayload(contract.posterName));
  return { reward: contract.rewardGold };
}

/** Peek at what a poster can collect from a completed supply contract (the
 * items the company delivered). The caller adds them to the poster's inventory,
 * then calls reduceContractCollect with how many actually fit. */
export function peekContractCollect(
  poster: string,
  id: string,
): CompanyActionResult & { itemId?: string; qty?: number } {
  const contract = contracts.get(id);
  if (!contract) return { ok: false, error: "That contract is gone." };
  if (contract.posterName !== poster) return { ok: false, error: "That's not your contract." };
  if (contract.status !== "completed" || contract.itemsToCollect <= 0 || !contract.itemId) {
    return { ok: false, error: "Nothing to collect." };
  }
  return { ok: true, itemId: contract.itemId, qty: contract.itemsToCollect };
}

/** Deduct collected goods from a completed contract; delete it once emptied. */
export function reduceContractCollect(id: string, collected: number): void {
  const contract = contracts.get(id);
  if (!contract || collected <= 0) return;
  contract.itemsToCollect = Math.max(0, contract.itemsToCollect - collected);
  if (contract.itemsToCollect <= 0) {
    contracts.delete(id);
    void deleteCompanyContract(id);
  } else {
    void saveCompanyContract(contract);
  }
}

/** Poster dismisses a finished contract that has nothing left to collect. */
export function dismissCompanyContract(poster: string, id: string): CompanyActionResult {
  const contract = contracts.get(id);
  if (!contract) return { ok: false, error: "That contract is gone." };
  if (contract.posterName !== poster) return { ok: false, error: "That's not your contract." };
  if (contract.status !== "completed" || contract.itemsToCollect > 0) {
    return { ok: false, error: "That contract isn't finished." };
  }
  contracts.delete(id);
  void deleteCompanyContract(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Payload building
// ---------------------------------------------------------------------------

function contractView(c: StoredCompanyContract): CompanyContractView {
  return {
    id: c.id,
    companyId: c.companyId,
    posterName: c.posterName,
    kind: c.kind,
    itemId: c.itemId,
    qty: c.qty,
    progress: c.progress,
    rewardGold: c.rewardGold,
    status: c.status,
    itemsToCollect: c.itemsToCollect,
    createdAt: c.createdAt,
  };
}

function reputationOf(company: StoredCompany): number {
  const ageDays = Math.max(0, (Date.now() - company.createdAt) / 86_400_000);
  const rev =
    company.stats.revenue.skim +
    company.stats.revenue.vendor +
    company.stats.revenue.contracts +
    company.stats.revenue.deposits;
  return computeCompanyReputation({
    ageDays,
    members: company.members.length,
    contractsCompleted: company.stats.contractsCompleted,
    lifetimeRevenue: rev,
    payoutDays: payoutDayCounts.get(company.id) ?? 0,
  });
}

function toSummary(company: StoredCompany): CompanySummary {
  return {
    id: company.id,
    name: company.name,
    emblem: company.emblem,
    color: company.color,
    companyType: company.companyType,
    ownerName: company.ownerName,
    memberCount: company.members.length,
    reputation: reputationOf(company),
  };
}

export function buildCompanyStatePayload(playerName: string): CompanyStatePayload {
  const mine = getCompanyForMember(playerName);
  let myCompany: CompanyDetail | null = null;
  if (mine) {
    myCompany = {
      ...toSummary(mine),
      members: [...mine.members],
      managers: [...mine.managers],
      trainees: [...mine.trainees],
      joinRequests: [...mine.joinRequests],
      treasury: mine.treasury,
      revenueShare: mine.revenueShare,
      dividendRate: mine.dividendRate,
      motd: mine.motd,
      warehouse: mine.warehouse.map((e) => ({ ...e })),
      salaries: { ...mine.salaries },
      stats: JSON.parse(JSON.stringify(mine.stats)),
      contracts: companyContracts(mine.id).map(contractView),
      myRank: companyRankOf(playerName, mine.ownerName, mine.managers, mine.trainees),
      lastPayoutDay: mine.lastPayoutDay,
      createdAt: mine.createdAt,
    };
  }
  const list = [...companies.values()]
    .map(toSummary)
    .sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name));
  // Open contracts anyone can browse (excluding the viewer's own postings).
  const openContracts = [...contracts.values()]
    .filter((c) => c.status === "open" && c.posterName !== playerName)
    .map(contractView);
  // Every contract the viewer posted, so they can track progress + collect goods.
  const myPostedContracts = [...contracts.values()]
    .filter((c) => c.posterName === playerName)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(contractView);
  return {
    myCompany,
    companies: list,
    myRequestCompanyId: pendingRequestCompanyId(playerName),
    openContracts,
    myPostedContracts,
  };
}

/** Push fresh company state to each named member (per-recipient — myRank etc.
 * differ). Delivered cross-zone via presence. */
export function broadcastCompanyState(names: string[]): void {
  for (const name of names) {
    sendToPlayer(name, "companyState", buildCompanyStatePayload(name));
  }
}

// ---------------------------------------------------------------------------
// Daily payouts (salaries + dividends)
// ---------------------------------------------------------------------------

/** Run the daily salary + dividend payout for every company that hasn't been
 * paid yet today (UTC). `credit(name, amount)` pays a player by name (online →
 * gold, offline → pending_gold). Idempotent: `lastPayoutDay` is stamped BEFORE
 * paying and the company_payouts table PK is a second backstop. */
export function runCompanyDailyPayouts(credit: (name: string, amount: number) => void): void {
  const today = utcDay();
  for (const company of companies.values()) {
    if (company.lastPayoutDay === today) continue;
    company.lastPayoutDay = today;
    void saveCompany(company);

    const detail: Record<string, number> = {};
    let salariesPaid = 0;
    let dividendsPaid = 0;

    // Salaries — fixed per-member, paid in roster order while the treasury covers them.
    for (const member of company.members) {
      const salary = Math.min(company.salaries[member] ?? 0, COMPANY_MAX_SALARY);
      if (salary <= 0 || company.treasury < salary) continue;
      company.treasury -= salary;
      salariesPaid += salary;
      detail[member] = (detail[member] ?? 0) + salary;
      credit(member, salary);
    }

    // Dividends — a share of the remaining treasury, split equally among members
    // who were active recently enough (alt-idle guard).
    if (
      company.dividendRate > 0 &&
      company.members.length >= COMPANY_MIN_MEMBERS_FOR_DIVIDENDS
    ) {
      const eligible = company.members.filter((m) => isDividendEligible(company, m, today));
      const pool = Math.floor(company.treasury * company.dividendRate);
      if (eligible.length > 0 && pool > 0) {
        const share = Math.floor(pool / eligible.length);
        if (share > 0) {
          for (const member of eligible) {
            company.treasury -= share;
            dividendsPaid += share;
            detail[member] = (detail[member] ?? 0) + share;
            credit(member, share);
          }
        }
      }
    }

    if (salariesPaid > 0 || dividendsPaid > 0) {
      company.stats.paidOut.salaries += salariesPaid;
      company.stats.paidOut.dividends += dividendsPaid;
      void saveCompany(company);
      payoutDayCounts.set(company.id, (payoutDayCounts.get(company.id) ?? 0) + 1);
      void insertCompanyPayoutLog(company.id, today, salariesPaid, dividendsPaid, detail);
      // Notify members: a company-channel line each, then a fresh state push.
      for (const [member, amount] of Object.entries(detail)) {
        sendToPlayer(member, "chat", {
          id: crypto.randomUUID(),
          channel: "company",
          senderId: "system",
          senderName: company.name,
          body: `💰 Payday: you received ${amount.toLocaleString()} gold from ${company.name}.`,
          sentAt: Date.now(),
        });
      }
      sendToPlayers(company.members, "chat", {
        id: crypto.randomUUID(),
        channel: "company",
        senderId: "system",
        senderName: company.name,
        body: `${company.name} paid out ${salariesPaid.toLocaleString()} in salaries and ${dividendsPaid.toLocaleString()} in dividends today.`,
        sentAt: Date.now(),
      });
      broadcastCompanyState(company.members);
    }
  }
}

function isDividendEligible(company: StoredCompany, member: string, today: string): boolean {
  const last = company.stats.contrib[member]?.lastActiveDay;
  if (!last) return false;
  const lastMs = Date.parse(`${last}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(lastMs) || !Number.isFinite(todayMs)) return false;
  const days = (todayMs - lastMs) / 86_400_000;
  return days <= COMPANY_DIVIDEND_MIN_ACTIVITY_DAYS;
}
