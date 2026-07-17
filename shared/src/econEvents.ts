// Economic events & adaptive policy — THE tunables table (v0.157).
//
// EVENTS perturb yields and ledgers, never grant gold directly: a Blight
// halves harvests (scarcity → prices climb via the S/D engine), a Vein
// Discovery floods one region with bonus ore for a few hours. Fired by a
// server-side scheduler, announced in world chat and listed on /stats — the
// "log in NOW" pulse.
//
// ADAPTIVE SINKS: fees (repair, respec, bait, exchange listing) breathe with
// the 7-day mint-pressure index (minted ÷ burned). When the gold supply
// inflates, sinks firm up; when it deflates, they ease. Faucets are NEVER
// throttled — that would punish new players. Bounds are tight and the gauge
// is public on /stats, so players can always see WHY a fee moved.

export interface EconEventDef {
  id: string;
  label: string;
  icon: string;
  /** Announcement line (zone label substituted for {zone} when zone-scoped). */
  blurb: string;
  durationMs: number;
  /** Relative pick weight when the scheduler fires. */
  weight: number;
  /** Scoped to one random price-region town (vs world-wide). */
  zoneScoped?: boolean;
  /** Multiplier on crop harvest yield (0.5 = blight). */
  cropYieldMult?: number;
  /** Additive bonus-ore chance while mining (0.5 = vein discovery). */
  oreBonusChance?: number;
  /** Additive bonus-catch chance while fishing. */
  fishBonusChance?: number;
  /** Multiplier on crop growth time at plant time (0.7 = growth spurt). */
  cropGrowthMult?: number;
}

export const ECON_EVENTS: EconEventDef[] = [
  {
    id: "blight",
    label: "Crop Blight",
    icon: "🦠",
    blurb: "🦠 A crop blight sweeps the world — harvests are HALVED. Stockpiles will be worth a fortune.",
    durationMs: 24 * 60 * 60 * 1000,
    weight: 1,
    cropYieldMult: 0.5,
  },
  {
    id: "vein_discovery",
    label: "Vein Discovery",
    icon: "⛏️",
    blurb: "⛏️ A rich ore vein was discovered near {zone} — mining there yields BONUS ore for a few hours!",
    durationMs: 6 * 60 * 60 * 1000,
    weight: 2,
    zoneScoped: true,
    oreBonusChance: 0.5,
  },
  {
    id: "fish_run",
    label: "Fish Run",
    icon: "🐟",
    blurb: "🐟 A massive fish run near {zone} — casts there land BONUS catches while it lasts!",
    durationMs: 6 * 60 * 60 * 1000,
    weight: 2,
    zoneScoped: true,
    fishBonusChance: 0.35,
  },
  {
    id: "growth_spurt",
    label: "Growth Spurt",
    icon: "🌱",
    blurb: "🌱 Perfect growing weather — crops planted now grow 30% faster for the next half-day!",
    durationMs: 12 * 60 * 60 * 1000,
    weight: 2,
    cropGrowthMult: 0.7,
  },
];

/** The scheduler considers firing an event this often… */
export const ECON_EVENT_INTERVAL_MS = 4 * 60 * 60 * 1000;
/** …and fires with this chance (when nothing is already active). */
export const ECON_EVENT_CHANCE = 0.45;

/** Rain speeds crops planted while it falls (multiplier at full rain). */
export const RAIN_CROP_GROWTH_MULT = 0.85;

// ---- Adaptive sinks --------------------------------------------------------

export const SINK_ADAPT_EXPONENT = 0.3;
export const SINK_ADAPT_MIN = 0.8;
export const SINK_ADAPT_MAX = 1.2;

/** Fee multiplier for a given 7-day mint-pressure (minted ÷ burned). */
export function sinkMultiplierFor(mintPressure: number): number {
  if (!Number.isFinite(mintPressure) || mintPressure <= 0) return 1;
  const mult = Math.pow(mintPressure, SINK_ADAPT_EXPONENT);
  return Math.min(SINK_ADAPT_MAX, Math.max(SINK_ADAPT_MIN, mult));
}

/** Wire shape of an active event (for /stats + clients). */
export interface ActiveEconEvent {
  id: string;
  defId: string;
  label: string;
  icon: string;
  /** Price-region zoneId when scoped, else null (world-wide). */
  zoneId: string | null;
  zoneLabel: string | null;
  startedAt: number;
  endsAt: number;
}
