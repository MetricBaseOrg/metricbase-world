// Day/night cycle. Purely time-driven (and therefore deterministic from the
// wall clock), so every client renders the same time of day without any extra
// networking. It's cosmetic for now — a lighting tint over the world plus a HUD
// clock — but the shared `getWorldTime` is the single source of truth if we ever
// hang gameplay (night mobs, shop hours) off it.

export const DAY_LENGTH_MS = 20 * 60 * 1000; // one full day+night every 20 real minutes

export type DayPhase = "dawn" | "day" | "dusk" | "night";

export interface WorldTime {
  /** 0..1 progress through the full cycle. */
  cycle: number;
  /** In-world hour in [0, 24). */
  hour: number;
  /** "HH:MM" 24-hour in-world clock. */
  clock: string;
  phase: DayPhase;
  label: string;
  icon: string;
  /** Lighting overlay colour drawn over the world (0xRRGGBB). */
  overlayColor: number;
  /** Lighting overlay opacity in [0, 1] (0 = full daylight). */
  overlayAlpha: number;
}

// Overlay keyframes across the in-world day (hour → tint). Values between
// keyframes are interpolated, so the world brightens and darkens smoothly.
interface LightKey {
  h: number;
  color: number;
  alpha: number;
}

const KEYFRAMES: LightKey[] = [
  { h: 0, color: 0x0a1538, alpha: 0.55 }, // deep night
  { h: 5, color: 0x122046, alpha: 0.5 },
  { h: 6, color: 0xff9d6e, alpha: 0.3 }, // dawn glow
  { h: 7, color: 0xffffff, alpha: 0.0 }, // full day
  { h: 17, color: 0xffffff, alpha: 0.0 },
  { h: 18.5, color: 0xff7a3d, alpha: 0.26 }, // dusk
  { h: 20, color: 0x3a2a6b, alpha: 0.42 },
  { h: 21.5, color: 0x0a1538, alpha: 0.55 }, // back to night
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

function sampleOverlay(hour: number): { color: number; alpha: number } {
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const cur = KEYFRAMES[i];
    const next = KEYFRAMES[i + 1];
    if (hour >= cur.h && hour < next.h) {
      const t = (hour - cur.h) / (next.h - cur.h);
      return { color: lerpColor(cur.color, next.color, t), alpha: lerp(cur.alpha, next.alpha, t) };
    }
  }
  // Wrap segment: last keyframe → first keyframe (crossing midnight).
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  const first = KEYFRAMES[0];
  const span = 24 - last.h + first.h;
  const into = hour >= last.h ? hour - last.h : 24 - last.h + hour;
  const t = span > 0 ? into / span : 0;
  return { color: lerpColor(last.color, first.color, t), alpha: lerp(last.alpha, first.alpha, t) };
}

function phaseForHour(hour: number): { phase: DayPhase; label: string; icon: string } {
  if (hour < 5 || hour >= 21) return { phase: "night", label: "Night", icon: "🌙" };
  if (hour < 7) return { phase: "dawn", label: "Dawn", icon: "🌅" };
  if (hour < 18) return { phase: "day", label: "Day", icon: "☀️" };
  return { phase: "dusk", label: "Dusk", icon: "🌇" };
}

/** Resolve the current world time of day from an epoch timestamp. */
export function getWorldTime(now: number = Date.now()): WorldTime {
  const cycle = ((now % DAY_LENGTH_MS) + DAY_LENGTH_MS) % DAY_LENGTH_MS / DAY_LENGTH_MS;
  const hour = cycle * 24;
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const { phase, label, icon } = phaseForHour(hour);
  const { color, alpha } = sampleOverlay(hour);
  return {
    cycle,
    hour,
    clock: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    phase,
    label,
    icon,
    overlayColor: color,
    overlayAlpha: alpha,
  };
}
