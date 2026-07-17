// Economic event engine — process-global scheduler + live yield modifiers.
// Tunables + defs in @metricbase/shared econEvents.ts. Events modify YIELDS
// and ledgers only; they never grant gold, so there is no faucet to cap.
// In-memory: a restart clears active events (they're short-lived pulses).

import {
  ECON_EVENTS,
  ECON_EVENT_CHANCE,
  ECON_EVENT_INTERVAL_MS,
  TOWNS,
  type ActiveEconEvent,
  type EconEventDef,
} from "@metricbase/shared";
import crypto from "node:crypto";
import { bumpMetric } from "./metrics.js";

const active: ActiveEconEvent[] = [];

function prune(now = Date.now()): void {
  for (let i = active.length - 1; i >= 0; i--) {
    if (active[i].endsAt <= now) active.splice(i, 1);
  }
}

function defOf(defId: string): EconEventDef | undefined {
  return ECON_EVENTS.find((d) => d.id === defId);
}

function fire(def: EconEventDef, now = Date.now()): ActiveEconEvent {
  const town = def.zoneScoped ? TOWNS[Math.floor(Math.random() * TOWNS.length)] : null;
  const event: ActiveEconEvent = {
    id: crypto.randomUUID(),
    defId: def.id,
    label: def.label,
    icon: def.icon,
    zoneId: town?.zoneId ?? null,
    zoneLabel: town?.label ?? null,
    startedAt: now,
    endsAt: now + def.durationMs,
  };
  active.push(event);
  bumpMetric(`event.fired.${def.id}`, 1);
  return event;
}

/** Announcement line with the zone substituted in. */
export function eventAnnouncement(event: ActiveEconEvent): string {
  const def = defOf(event.defId);
  return (def?.blurb ?? event.label).replace("{zone}", event.zoneLabel ?? "");
}

/** Boot the scheduler. `onEvent` is called for each newly fired event. */
export function initEconEvents(onEvent?: (event: ActiveEconEvent) => void): void {
  setInterval(() => {
    prune();
    // One pulse at a time keeps events legible (and stacking un-exploitable).
    if (active.length > 0) return;
    if (Math.random() >= ECON_EVENT_CHANCE) return;
    const totalWeight = ECON_EVENTS.reduce((s, d) => s + d.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const def of ECON_EVENTS) {
      roll -= def.weight;
      if (roll <= 0) {
        const event = fire(def);
        if (onEvent) onEvent(event);
        break;
      }
    }
  }, Math.min(ECON_EVENT_INTERVAL_MS, 30 * 60 * 1000));
}

export function getActiveEconEvents(now = Date.now()): ActiveEconEvent[] {
  prune(now);
  return [...active];
}

// ---- Live modifiers (1 / 0 when nothing is active) -------------------------

export function cropYieldMultNow(): number {
  prune();
  let mult = 1;
  for (const e of active) mult *= defOf(e.defId)?.cropYieldMult ?? 1;
  return mult;
}

export function cropGrowthMultNow(): number {
  prune();
  let mult = 1;
  for (const e of active) mult *= defOf(e.defId)?.cropGrowthMult ?? 1;
  return mult;
}

/** Additive bonus-ore chance for mining in the given zone. */
export function oreBonusChanceNow(zoneId: string): number {
  prune();
  let bonus = 0;
  for (const e of active) {
    const def = defOf(e.defId);
    if (def?.oreBonusChance && (!e.zoneId || e.zoneId === zoneId)) bonus += def.oreBonusChance;
  }
  return bonus;
}

/** Additive bonus-catch chance for fishing in the given zone. */
export function fishBonusChanceNow(zoneId: string): number {
  prune();
  let bonus = 0;
  for (const e of active) {
    const def = defOf(e.defId);
    if (def?.fishBonusChance && (!e.zoneId || e.zoneId === zoneId)) bonus += def.fishBonusChance;
  }
  return bonus;
}

/** Dev/E2E hook: force-fire an event (optionally pinned to a zone). */
export function forceEconEvent(defId: string, zoneId: string | null = null): ActiveEconEvent | null {
  const def = defOf(defId);
  if (!def) return null;
  const event = fire(def);
  if (zoneId !== null) {
    event.zoneId = zoneId;
    event.zoneLabel = TOWNS.find((t) => t.zoneId === zoneId)?.label ?? zoneId;
  }
  return event;
}

/** Dev/E2E hook: clear all active events. */
export function clearEconEvents(): void {
  active.length = 0;
}
