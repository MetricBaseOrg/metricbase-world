// Player-to-player jobs registry: process-global job state shared by every
// room. The employer's gold reward is escrowed at posting time (the caller
// deducts it before postJob and refunds on cancel); this module owns job
// lifecycle + persistence, while ZoneRoom moves gold and inventory items.

import {
  JOB_KINDS,
  MAX_JOBS_PER_EMPLOYER,
  validateJobPost,
  type JobKind,
  type JobView,
  type JobsStatePayload,
} from "@metricbase/shared";
import { deleteJobRow, loadJobs, saveJob } from "../db/jobs.js";

const jobs = new Map<string, JobView>();

export async function initJobs(): Promise<void> {
  for (const j of await loadJobs()) jobs.set(j.id, j);
}

function newId(): string {
  return `job_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Board + the viewer's own worker/employer slices. */
export function getJobsState(viewer: string): JobsStatePayload {
  const all = [...jobs.values()];
  return {
    board: all.filter((j) => j.status === "open" && j.employerName !== viewer).sort((a, b) => b.createdAt - a.createdAt),
    myJob: all.find((j) => j.status === "taken" && j.workerName === viewer) ?? null,
    posted: all.filter((j) => j.employerName === viewer).sort((a, b) => b.createdAt - a.createdAt),
  };
}

export function getJob(id: string): JobView | undefined {
  return jobs.get(id);
}

export function countOpenJobs(): number {
  return [...jobs.values()].filter((j) => j.status === "open" || j.status === "taken").length;
}

/** Create a job. Caller must have ALREADY escrowed rewardGold from the employer. */
export function postJob(
  employer: string,
  kind: string,
  itemId: string | null,
  qty: number,
  rewardGold: number,
  zoneId: string | null,
  deliverZoneId: string | null = null,
): { ok: boolean; error?: string; job?: JobView } {
  qty = Math.floor(qty);
  rewardGold = Math.floor(rewardGold);
  const error = validateJobPost(kind, itemId, qty, rewardGold);
  if (error) return { ok: false, error };
  const mine = [...jobs.values()].filter(
    (j) => j.employerName === employer && (j.status === "open" || j.status === "taken"),
  );
  if (mine.length >= MAX_JOBS_PER_EMPLOYER) {
    return { ok: false, error: `You can have at most ${MAX_JOBS_PER_EMPLOYER} active jobs.` };
  }
  const def = JOB_KINDS[kind as JobKind];
  const job: JobView = {
    id: newId(),
    employerName: employer,
    kind: def.kind,
    itemId: def.needsItem ? itemId : null,
    qty,
    progress: 0,
    rewardGold,
    status: "open",
    workerName: null,
    zoneId,
    deliverZoneId: def.needsItem ? deliverZoneId : null,
    itemsToCollect: 0,
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  void saveJob(job);
  return { ok: true, job };
}

/** Cancel an open job. Returns the escrowed gold to refund the employer. */
export function cancelJob(employer: string, id: string): { ok: boolean; error?: string; refund: number } {
  const job = jobs.get(id);
  if (!job || job.employerName !== employer) return { ok: false, error: "Job not found.", refund: 0 };
  if (job.status !== "open") return { ok: false, error: "Only open jobs can be cancelled.", refund: 0 };
  // A previous worker may have partially delivered before abandoning — those
  // items belong to the employer; deleting the job would destroy them.
  if (job.itemsToCollect > 0) {
    return { ok: false, error: "Collect the delivered items first, then cancel.", refund: 0 };
  }
  jobs.delete(id);
  void deleteJobRow(id);
  return { ok: true, refund: job.rewardGold };
}

export function acceptJob(worker: string, id: string): { ok: boolean; error?: string; job?: JobView } {
  const job = jobs.get(id);
  if (!job || job.status !== "open") return { ok: false, error: "That job is gone." };
  if (job.employerName === worker) return { ok: false, error: "You can't take your own job." };
  if ([...jobs.values()].some((j) => j.status === "taken" && j.workerName === worker)) {
    return { ok: false, error: "Finish your current job first." };
  }
  job.status = "taken";
  job.workerName = worker;
  void saveJob(job);
  return { ok: true, job };
}

/** Worker walks away; the job reopens (activity progress resets). */
export function abandonJob(worker: string, id: string): { ok: boolean; error?: string } {
  const job = jobs.get(id);
  if (!job || job.status !== "taken" || job.workerName !== worker) {
    return { ok: false, error: "You're not on that job." };
  }
  job.status = "open";
  job.workerName = null;
  // Supply progress stays — those items were already handed over. Activity
  // progress resets so the next worker starts fresh.
  if (job.kind !== "supply") job.progress = 0;
  void saveJob(job);
  return { ok: true };
}

/**
 * Apply delivered supply items (already removed from the worker's bag).
 * Returns whether the delivery completed the job.
 */
export function applyDelivery(id: string, delivered: number): { completed: boolean; job: JobView } | null {
  const job = jobs.get(id);
  if (!job || job.status !== "taken" || job.kind !== "supply" || delivered <= 0) return null;
  job.progress = Math.min(job.qty, job.progress + delivered);
  job.itemsToCollect += delivered;
  const completed = job.progress >= job.qty;
  if (completed) job.status = "done";
  void saveJob(job);
  return { completed, job };
}

/**
 * Tick activity progress for a worker's taken job of this kind (gather /
 * harvest / mobs). Returns the job if this tick completed it, else null.
 */
export function bumpJobProgress(worker: string, kind: JobKind, n: number): JobView | null {
  if (n <= 0) return null;
  for (const job of jobs.values()) {
    if (job.status !== "taken" || job.workerName !== worker || job.kind !== kind) continue;
    job.progress = Math.min(job.qty, job.progress + n);
    const completed = job.progress >= job.qty;
    if (completed) job.status = "done";
    void saveJob(job);
    return completed ? job : null;
  }
  return null;
}

/**
 * Employer picks up delivered supply items. `accepted` is how many actually
 * fit in their bag; the job row is removed once everything is collected.
 */
export function collectDelivered(employer: string, id: string, accepted: number): void {
  const job = jobs.get(id);
  if (!job || job.employerName !== employer) return;
  job.itemsToCollect = Math.max(0, job.itemsToCollect - accepted);
  if (job.status === "done" && job.itemsToCollect <= 0) {
    jobs.delete(id);
    void deleteJobRow(id);
  } else {
    void saveJob(job);
  }
}

/** Remove a finished activity job from the employer's list (no pickup needed). */
export function dismissJob(employer: string, id: string): void {
  const job = jobs.get(id);
  if (!job || job.employerName !== employer || job.status !== "done" || job.itemsToCollect > 0) return;
  jobs.delete(id);
  void deleteJobRow(id);
}
