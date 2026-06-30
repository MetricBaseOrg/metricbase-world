// Data access for the ad marketplace. All money is in $BASE smallest units.
// The hot path (per-impression charging) runs in memory in adService and is
// flushed here periodically; these helpers also cover deposits, claims,
// campaign CRUD, and moderation.

import type { AdCampaignStatus } from "@metricbase/shared";
import { getPool } from "./pool.js";

export interface AdCampaignRow {
  id: string;
  brandWallet: string;
  name: string;
  imageUrl: string;
  headline: string;
  clickUrl: string;
  cpm: number; // base units per 1000 impressions
  status: AdCampaignStatus;
  impressions: number;
  spent: number; // base units
  reviewNote: string | null;
  createdAt: number;
}

interface CampaignDbRow {
  id: string;
  brand_wallet: string;
  name: string;
  image_url: string;
  headline: string;
  click_url: string;
  cpm: string | number;
  status: AdCampaignStatus;
  impressions: string | number;
  spent: string | number;
  review_note: string | null;
  created_at: string | number | Date;
}

function mapCampaign(row: CampaignDbRow): AdCampaignRow {
  const created =
    row.created_at instanceof Date ? row.created_at.getTime() : Number(new Date(row.created_at).getTime());
  return {
    id: row.id,
    brandWallet: row.brand_wallet,
    name: row.name,
    imageUrl: row.image_url,
    headline: row.headline,
    clickUrl: row.click_url,
    cpm: Number(row.cpm),
    status: row.status,
    impressions: Number(row.impressions),
    spent: Number(row.spent),
    reviewNote: row.review_note,
    createdAt: Number.isFinite(created) ? created : Date.now(),
  };
}

// ---- Brand balances ----

export async function getBrandBalance(wallet: string): Promise<number> {
  const db = getPool();
  if (!db) return 0;
  const r = await db.query<{ balance: string }>(`SELECT balance FROM ad_brands WHERE wallet_address = $1`, [wallet]);
  return r.rowCount ? Number(r.rows[0].balance) : 0;
}

/** Credit a verified brand deposit exactly once (idempotent on signature). */
export async function creditAdDepositOnce(
  wallet: string,
  amount: number,
  signature: string,
): Promise<{ credited: boolean; balance: number }> {
  const db = getPool();
  if (!db) return { credited: false, balance: 0 };
  const inserted = await db.query(
    `INSERT INTO ad_ledger (signature, wallet_address, kind, amount) VALUES ($1, $2, 'deposit', $3)
     ON CONFLICT (signature) DO NOTHING`,
    [signature, wallet, amount],
  );
  if (inserted.rowCount === 0) return { credited: false, balance: await getBrandBalance(wallet) };
  const r = await db.query<{ balance: string }>(
    `INSERT INTO ad_brands (wallet_address, balance) VALUES ($1, $2)
     ON CONFLICT (wallet_address) DO UPDATE SET balance = ad_brands.balance + EXCLUDED.balance, updated_at = NOW()
     RETURNING balance`,
    [wallet, amount],
  );
  return { credited: true, balance: Number(r.rows[0].balance) };
}

/** Persist an in-memory brand balance + lifetime spend (write-through from adService). */
export async function saveBrandBalance(wallet: string, balance: number, lifetimeSpent: number): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO ad_brands (wallet_address, balance, lifetime_spent) VALUES ($1, $2, $3)
     ON CONFLICT (wallet_address) DO UPDATE SET balance = EXCLUDED.balance, lifetime_spent = EXCLUDED.lifetime_spent, updated_at = NOW()`,
    [wallet, Math.max(0, Math.floor(balance)), Math.max(0, Math.floor(lifetimeSpent))],
  );
}

// ---- Campaigns ----

export async function createCampaign(c: Omit<AdCampaignRow, "impressions" | "spent" | "createdAt" | "reviewNote" | "status">): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO ad_campaigns (id, brand_wallet, name, image_url, headline, click_url, cpm, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [c.id, c.brandWallet, c.name, c.imageUrl, c.headline, c.clickUrl, Math.floor(c.cpm)],
  );
}

export async function listAllCampaigns(): Promise<AdCampaignRow[]> {
  const db = getPool();
  if (!db) return [];
  const r = await db.query<CampaignDbRow>(`SELECT * FROM ad_campaigns ORDER BY created_at DESC`);
  return r.rows.map(mapCampaign);
}

export async function listBrandCampaigns(wallet: string): Promise<AdCampaignRow[]> {
  const db = getPool();
  if (!db) return [];
  const r = await db.query<CampaignDbRow>(
    `SELECT * FROM ad_campaigns WHERE brand_wallet = $1 ORDER BY created_at DESC`,
    [wallet],
  );
  return r.rows.map(mapCampaign);
}

export async function listPendingCampaigns(): Promise<AdCampaignRow[]> {
  const db = getPool();
  if (!db) return [];
  const r = await db.query<CampaignDbRow>(
    `SELECT * FROM ad_campaigns WHERE status = 'pending' ORDER BY created_at ASC`,
  );
  return r.rows.map(mapCampaign);
}

export async function setCampaignStatus(id: string, status: AdCampaignStatus, note?: string): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(`UPDATE ad_campaigns SET status = $2, review_note = $3 WHERE id = $1`, [id, status, note ?? null]);
}

/** Write-through campaign counters from adService. */
export async function saveCampaignStats(id: string, impressions: number, spent: number): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(`UPDATE ad_campaigns SET impressions = $2, spent = $3 WHERE id = $1`, [
    id,
    Math.floor(impressions),
    Math.floor(spent),
  ]);
}

// ---- Members (players in the revenue-share program) ----

export interface AdMemberRow {
  wallet: string;
  earnings: number;
  lifetime: number;
  impressions: number;
}

export async function getMember(wallet: string): Promise<AdMemberRow | null> {
  const db = getPool();
  if (!db) return null;
  const r = await db.query<{ earnings: string; lifetime: string; impressions: string }>(
    `SELECT earnings, lifetime, impressions FROM ad_members WHERE wallet_address = $1`,
    [wallet],
  );
  if (!r.rowCount) return null;
  return {
    wallet,
    earnings: Number(r.rows[0].earnings),
    lifetime: Number(r.rows[0].lifetime),
    impressions: Number(r.rows[0].impressions),
  };
}

export async function joinProgram(wallet: string): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO ad_members (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO NOTHING`,
    [wallet],
  );
}

/** Write-through member earnings/impressions from adService. */
export async function saveMember(wallet: string, earnings: number, lifetime: number, impressions: number): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO ad_members (wallet_address, earnings, lifetime, impressions) VALUES ($1, $2, $3, $4)
     ON CONFLICT (wallet_address) DO UPDATE SET earnings = EXCLUDED.earnings, lifetime = EXCLUDED.lifetime, impressions = EXCLUDED.impressions`,
    [wallet, Math.floor(earnings), Math.floor(lifetime), Math.floor(impressions)],
  );
}

/** Atomically zero a member's claimable earnings and return the amount claimed. */
export async function takeMemberEarnings(wallet: string): Promise<number> {
  const db = getPool();
  if (!db) return 0;
  const r = await db.query<{ earnings: string }>(
    `UPDATE ad_members SET earnings = 0 WHERE wallet_address = $1 AND earnings > 0 RETURNING earnings`,
    [wallet],
  );
  return r.rowCount ? Number(r.rows[0].earnings) : 0;
}

export async function recordAdClaim(wallet: string, amount: number, signature: string): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO ad_ledger (signature, wallet_address, kind, amount) VALUES ($1, $2, 'claim', $3)
     ON CONFLICT (signature) DO NOTHING`,
    [signature, wallet, amount],
  );
}
