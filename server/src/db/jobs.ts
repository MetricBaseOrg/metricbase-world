import type { JobView } from "@metricbase/shared";
import { getPool } from "./pool.js";

type JobRow = {
  id: string;
  employer_name: string;
  kind: string;
  item_id: string | null;
  qty: number;
  progress: number;
  reward_gold: number;
  status: string;
  worker_name: string | null;
  zone_id: string | null;
  deliver_zone_id: string | null;
  items_to_collect: number;
  created_at: string | Date;
};

function mapRow(row: JobRow): JobView {
  const created = row.created_at instanceof Date ? row.created_at.getTime() : Date.parse(String(row.created_at));
  return {
    id: row.id,
    employerName: row.employer_name,
    kind: row.kind as JobView["kind"],
    itemId: row.item_id,
    qty: Number(row.qty),
    progress: Number(row.progress),
    rewardGold: Number(row.reward_gold),
    status: row.status as JobView["status"],
    workerName: row.worker_name,
    zoneId: row.zone_id,
    deliverZoneId: row.deliver_zone_id ?? null,
    itemsToCollect: Number(row.items_to_collect),
    createdAt: Number.isFinite(created) ? created : Date.now(),
  };
}

/** Load every job that still needs action (open, taken, or awaiting pickup). */
export async function loadJobs(): Promise<JobView[]> {
  const db = getPool();
  if (!db) return [];
  try {
    const result = await db.query<JobRow>(
      `SELECT * FROM jobs WHERE status IN ('open','taken','done') ORDER BY created_at ASC`,
    );
    return result.rows.map(mapRow);
  } catch {
    return [];
  }
}

export async function saveJob(job: JobView): Promise<void> {
  const db = getPool();
  if (!db) return;
  try {
    await db.query(
      `INSERT INTO jobs (id, employer_name, kind, item_id, qty, progress, reward_gold, status, worker_name, zone_id, deliver_zone_id, items_to_collect, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,to_timestamp($13/1000.0))
       ON CONFLICT (id) DO UPDATE SET
         progress = EXCLUDED.progress,
         status = EXCLUDED.status,
         worker_name = EXCLUDED.worker_name,
         items_to_collect = EXCLUDED.items_to_collect`,
      [
        job.id,
        job.employerName,
        job.kind,
        job.itemId,
        job.qty,
        job.progress,
        job.rewardGold,
        job.status,
        job.workerName,
        job.zoneId,
        job.deliverZoneId ?? null,
        job.itemsToCollect,
        job.createdAt,
      ],
    );
  } catch (err) {
    console.error("saveJob failed:", err);
  }
}

export async function deleteJobRow(id: string): Promise<void> {
  const db = getPool();
  if (!db) return;
  try {
    await db.query(`DELETE FROM jobs WHERE id = $1`, [id]);
  } catch {
    /* ignore */
  }
}
