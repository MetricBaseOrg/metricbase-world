// "Living world" gameplay effects: the day/night cycle and weather actually
// change how the world plays. These are pure functions of the shared clocks, so
// the authoritative server and the client agree on the modifiers.

import { getWorldTime } from "./daynight.js";
import { getWeather } from "./weather.js";

/** Most extra gather time when working in pitch dark with no lamp (+50%). */
export const NIGHT_GATHER_SLOWDOWN = 0.5;

/** Overlay opacity at deepest night (matches the day/night keyframes). */
const NIGHT_DARKNESS_ALPHA = 0.55;

/** Bonus-catch chance at the height of a downpour. */
export const RAIN_FISHING_BONUS = 0.4;

/** 0 (broad daylight) .. 1 (deepest night) — how dark it is right now. */
export function darkness(now: number = Date.now()): number {
  return Math.min(1, getWorldTime(now).overlayAlpha / NIGHT_DARKNESS_ALPHA);
}

/** True when it's dark enough that a lamp meaningfully helps you work. */
export function isDarkOutside(now: number = Date.now()): boolean {
  return darkness(now) >= 0.55;
}

/**
 * Gather-duration multiplier for the current conditions. Working in the dark is
 * slow — but lighting a lamp removes the penalty entirely.
 */
export function gatherDurationMultiplier(now: number, lampOn: boolean): number {
  if (lampOn) return 1;
  return 1 + NIGHT_GATHER_SLOWDOWN * darkness(now);
}

/** Extra-catch chance (0..1) for fishing while it's raining. */
export function rainFishingBonus(now: number = Date.now()): number {
  return getWeather(now).rain * RAIN_FISHING_BONUS;
}
