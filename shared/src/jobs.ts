// Player-to-player jobs: an employer posts a contract with a gold reward
// (escrowed at posting); a worker accepts it, completes the objective, and is
// paid automatically on server-verified completion. Works in every zone and
// player World.

import { ITEMS } from "./items.js";

export type JobKind = "supply" | "gather" | "harvest" | "mobs";

export interface JobKindDef {
  kind: JobKind;
  label: string;
  emoji: string;
  /** Verb line shown to workers, e.g. "Deliver 10× Wood". */
  describe: (qty: number, itemName?: string) => string;
  minQty: number;
  maxQty: number;
  needsItem: boolean;
}

export const JOB_KINDS: Record<JobKind, JobKindDef> = {
  supply: {
    kind: "supply",
    label: "Deliver items",
    emoji: "📦",
    describe: (q, item) => `Deliver ${q}× ${item ?? "items"}`,
    minQty: 1,
    maxQty: 99,
    needsItem: true,
  },
  gather: {
    kind: "gather",
    label: "Gather resources",
    emoji: "🧺",
    describe: (q) => `Gather ${q} resources (any node)`,
    minQty: 1,
    maxQty: 500,
    needsItem: false,
  },
  harvest: {
    kind: "harvest",
    label: "Harvest crops",
    emoji: "🌾",
    describe: (q) => `Harvest ${q} crops`,
    minQty: 1,
    maxQty: 200,
    needsItem: false,
  },
  mobs: {
    kind: "mobs",
    label: "Defeat mobs",
    emoji: "⚔️",
    describe: (q) => `Defeat ${q} mobs`,
    minQty: 1,
    maxQty: 200,
    needsItem: false,
  },
};

export const JOB_MIN_REWARD = 10;
export const JOB_MAX_REWARD = 1_000_000;
/** Max simultaneously OPEN/TAKEN jobs per employer. */
export const MAX_JOBS_PER_EMPLOYER = 5;

export type JobStatus = "open" | "taken" | "done" | "cancelled";

export interface JobView {
  id: string;
  employerName: string;
  kind: JobKind;
  itemId: string | null;
  qty: number;
  /** Activity progress (supply jobs complete atomically on delivery). */
  progress: number;
  rewardGold: number;
  status: JobStatus;
  workerName: string | null;
  /** Zone the job was posted from (flavour/filtering). */
  zoneId: string | null;
  /** For done supply jobs: items awaiting employer pickup. */
  itemsToCollect: number;
  createdAt: number;
}

export interface JobsStatePayload {
  /** Open jobs anyone can take (not the viewer's own). */
  board: JobView[];
  /** The viewer's active job as a worker, if any. */
  myJob: JobView | null;
  /** Jobs the viewer posted (any status except cancelled). */
  posted: JobView[];
}

export interface JobResultPayload {
  ok: boolean;
  message?: string;
  error?: string;
}

/** Items an employer may request in a supply contract: stackable materials. */
export function isSupplyItem(itemId: string): boolean {
  const def = ITEMS[itemId];
  return Boolean(def && def.stackable && (def.kind === "material" || def.kind === "consumable"));
}

/** Validate a job posting; returns an error string or null. */
export function validateJobPost(kind: string, itemId: string | null, qty: number, rewardGold: number): string | null {
  const def = JOB_KINDS[kind as JobKind];
  if (!def) return "Unknown job type.";
  if (!Number.isFinite(qty) || qty < def.minQty || qty > def.maxQty) {
    return `Quantity must be ${def.minQty}–${def.maxQty}.`;
  }
  if (def.needsItem) {
    if (!itemId || !isSupplyItem(itemId)) return "Pick a valid item to request.";
  }
  if (!Number.isFinite(rewardGold) || rewardGold < JOB_MIN_REWARD || rewardGold > JOB_MAX_REWARD) {
    return `Reward must be ${JOB_MIN_REWARD.toLocaleString()}–${JOB_MAX_REWARD.toLocaleString()} gold.`;
  }
  return null;
}
