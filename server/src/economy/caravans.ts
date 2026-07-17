// Caravan freight runs — process-global registry. Tunables + wire types in
// @metricbase/shared caravan.ts. The cargo is pure server state keyed by pid
// (wallet), so it can't be vendored, traded, or duplicated.
//
// FAUCET DISCIPLINE: delivery fees mint gold, so they draw from the SAME
// per-town daily budget as town orders (townBudgetRemaining/chargeTownBudget)
// plus a per-player freight cap, and are metered as gold.faucet.caravan.
// $BASE never appears anywhere in this system — see shared/caravan.ts.

import {
  CARAVAN_COOLDOWN_MS,
  CARAVAN_PLAYER_DAILY_GOLD_CAP,
  CARAVAN_ROUTES,
  CARAVAN_RUN_TTL_MS,
  TOWNS,
  type CaravanRunState,
} from "@metricbase/shared";
import crypto from "node:crypto";
import { bumpMetric } from "./metrics.js";
import { chargeTownBudget, townBudgetRemaining } from "./townDemand.js";

const townLabel = (zoneId: string) => TOWNS.find((t) => t.zoneId === zoneId)?.label ?? zoneId;

// pid -> active run. A run always belongs to exactly one hauler.
const activeRuns = new Map<string, CaravanRunState>();
// Dropped cargo (hauler died in a PvP zone) waiting in a loot bag, by run id.
const droppedRuns = new Map<string, CaravanRunState>();
const lastCompletedAt = new Map<string, number>();

let counterDay = new Date().toISOString().slice(0, 10);
const playerFreightToday = new Map<string, number>();

function rollDay(): void {
  const day = new Date().toISOString().slice(0, 10);
  if (day === counterDay) return;
  counterDay = day;
  playerFreightToday.clear();
}

function pruneExpired(pid: string): void {
  const run = activeRuns.get(pid);
  if (run && run.expiresAt <= Date.now()) {
    activeRuns.delete(pid);
    bumpMetric("caravan.spoiled", 1);
  }
}

export function playerFreightRemaining(pid: string): number {
  rollDay();
  return Math.max(0, CARAVAN_PLAYER_DAILY_GOLD_CAP - (playerFreightToday.get(pid) ?? 0));
}

export function caravanCooldownMs(pid: string): number {
  return Math.max(0, (lastCompletedAt.get(pid) ?? 0) + CARAVAN_COOLDOWN_MS - Date.now());
}

export function activeRunOf(pid: string): CaravanRunState | null {
  pruneExpired(pid);
  return activeRuns.get(pid) ?? null;
}

/** Routes departing the given town (empty for non-town zones). */
export function offersFrom(zoneId: string): CaravanRunState[] {
  return CARAVAN_ROUTES.filter((r) => r.fromZone === zoneId).map((r) => ({
    id: `${r.fromZone}>${r.toZone}`,
    fromZone: r.fromZone,
    fromLabel: townLabel(r.fromZone),
    toZone: r.toZone,
    toLabel: townLabel(r.toZone),
    feeGold: r.feeGold,
    expiresAt: 0,
  }));
}

export function acceptRun(pid: string, atZone: string, toZone: string): { ok: boolean; error?: string; run?: CaravanRunState } {
  pruneExpired(pid);
  if (activeRuns.has(pid)) return { ok: false, error: "You're already hauling cargo — deliver it first." };
  const cd = caravanCooldownMs(pid);
  if (cd > 0) return { ok: false, error: `The caravan master is loading up — try again in ${Math.ceil(cd / 1000)}s.` };
  const route = CARAVAN_ROUTES.find((r) => r.fromZone === atZone && r.toZone === toZone);
  if (!route) return { ok: false, error: "No caravan departs from here on that route." };
  if (playerFreightRemaining(pid) <= 0) return { ok: false, error: "You've hit your daily freight earnings cap." };
  const run: CaravanRunState = {
    id: crypto.randomUUID(),
    fromZone: route.fromZone,
    fromLabel: townLabel(route.fromZone),
    toZone: route.toZone,
    toLabel: townLabel(route.toZone),
    feeGold: route.feeGold,
    expiresAt: Date.now() + CARAVAN_RUN_TTL_MS,
  };
  activeRuns.set(pid, run);
  bumpMetric("caravan.accepted", 1);
  return { ok: true, run };
}

/** Deliver at the destination town's board. Returns the capped fee to grant
 * (caller mints via grantGold); 0-fee deliveries still complete the run. */
export function deliverRun(pid: string, atZone: string): { ok: boolean; error?: string; goldPaid?: number } {
  pruneExpired(pid);
  const run = activeRuns.get(pid);
  if (!run) return { ok: false, error: "You aren't carrying any cargo." };
  if (run.toZone !== atZone) return { ok: false, error: `This cargo is bound for ${run.toLabel}.` };
  const fee = Math.min(run.feeGold, playerFreightRemaining(pid), townBudgetRemaining(run.toZone));
  activeRuns.delete(pid);
  lastCompletedAt.set(pid, Date.now());
  if (fee > 0) {
    chargeTownBudget(run.toZone, fee);
    playerFreightToday.set(pid, (playerFreightToday.get(pid) ?? 0) + fee);
    bumpMetric("gold.faucet.caravan", fee);
  }
  bumpMetric("caravan.completed", 1);
  return { ok: true, goldPaid: fee };
}

/** The hauler died in a PvP zone: the cargo drops. Returns the run id to pin
 * onto the loot bag, or null if they weren't hauling. */
export function dropRunOnDeath(pid: string): string | null {
  pruneExpired(pid);
  const run = activeRuns.get(pid);
  if (!run) return null;
  activeRuns.delete(pid);
  droppedRuns.set(run.id, run);
  bumpMetric("caravan.lost", 1);
  return run.id;
}

/** Whoever grabs the bag inherits the run (if they can carry it). */
export function claimDroppedRun(runId: string, pid: string): CaravanRunState | null {
  const run = droppedRuns.get(runId);
  if (!run || run.expiresAt <= Date.now()) {
    droppedRuns.delete(runId);
    return null;
  }
  pruneExpired(pid);
  if (activeRuns.has(pid)) return null; // already hauling — cargo stays lost
  droppedRuns.delete(runId);
  activeRuns.set(pid, run);
  bumpMetric("caravan.intercepted", 1);
  return run;
}
