// Weather. Like the day/night cycle, this is deterministic and time-driven, so
// every client shows the same conditions with zero networking. The world steps
// through ~4-minute weather periods; a seeded hash of the period index picks the
// condition from a weighted table (clear dominates, so storms feel like events).
// The client eases its visuals toward whatever `getWeather` reports, smoothing
// the hand-off between periods.

export type WeatherType = "clear" | "cloudy" | "rain" | "storm" | "fog";

export const WEATHER_PERIOD_MS = 4 * 60 * 1000;

export interface WeatherState {
  type: WeatherType;
  label: string;
  icon: string;
  /** Rain particle density target, 0..1 (0 = no rain). */
  rain: number;
  /** Weather tint drawn over the world (combines with the day/night overlay). */
  overlayColor: number;
  overlayAlpha: number;
  /** Storms can throw lightning. */
  lightning: boolean;
}

interface WeatherDef {
  type: WeatherType;
  weight: number;
  label: string;
  icon: string;
  rain: number;
  overlayColor: number;
  overlayAlpha: number;
  lightning: boolean;
}

const WEATHER: WeatherDef[] = [
  { type: "clear", weight: 46, label: "Clear", icon: "🌤️", rain: 0, overlayColor: 0xffffff, overlayAlpha: 0, lightning: false },
  { type: "cloudy", weight: 24, label: "Cloudy", icon: "☁️", rain: 0, overlayColor: 0x9aa6b2, overlayAlpha: 0.12, lightning: false },
  { type: "rain", weight: 18, label: "Rain", icon: "🌧️", rain: 0.7, overlayColor: 0x5a6b85, overlayAlpha: 0.2, lightning: false },
  { type: "fog", weight: 7, label: "Fog", icon: "🌫️", rain: 0, overlayColor: 0xc8d2dc, overlayAlpha: 0.3, lightning: false },
  { type: "storm", weight: 5, label: "Storm", icon: "⛈️", rain: 1, overlayColor: 0x2e3a52, overlayAlpha: 0.34, lightning: true },
];

const TOTAL_WEIGHT = WEATHER.reduce((sum, w) => sum + w.weight, 0);

/** Deterministic 0..1 hash of an integer (integer xorshift / fmix). */
function hash01(n: number): number {
  let x = n >>> 0;
  x = (Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0) >>> 0;
  x = (Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 0x100000000;
}

function defForPeriod(period: number): WeatherDef {
  let roll = hash01(period * 2654435761) * TOTAL_WEIGHT;
  for (const def of WEATHER) {
    roll -= def.weight;
    if (roll < 0) return def;
  }
  return WEATHER[0];
}

/** Resolve the current weather from an epoch timestamp. */
export function getWeather(now: number = Date.now()): WeatherState {
  const period = Math.floor(now / WEATHER_PERIOD_MS);
  const def = defForPeriod(period);
  return {
    type: def.type,
    label: def.label,
    icon: def.icon,
    rain: def.rain,
    overlayColor: def.overlayColor,
    overlayAlpha: def.overlayAlpha,
    lightning: def.lightning,
  };
}
