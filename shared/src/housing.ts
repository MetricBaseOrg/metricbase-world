// Housing: players spend gold to own a land plot and place a structure on it.
// This is both a gameplay goal ("make a living in MetricBase") and the largest
// gold sink in the economy.

export type StructureType = "none" | "house" | "shop";

/** Gold cost to buy a land plot. A deliberately large long-term gold sink. */
export const PLOT_PRICE = 500;

// Building lights. An owner can switch a built plot's light on; while lit it
// burns the building's energy reserve, which the owner tops up with gold.
export const LIGHT_MAX_ENERGY = 100;
/** Energy drained per real minute while the light is on. 100 ⇒ ~20 min (one day). */
export const LIGHT_DRAIN_PER_MIN = 5;
/** The craftable item that refuels a building light. */
export const LIGHT_OIL_ITEM = "item_lamp_oil";
/** Energy restored per Lamp Oil burned (two oils refill an empty reserve). */
export const LIGHT_REFUEL_AMOUNT = 50;

/**
 * Resolve a plot light's live state, draining its reserve over elapsed time.
 * Returns the effective on/off and the remaining energy (0..LIGHT_MAX_ENERGY);
 * the light reads as off once the reserve is empty.
 */
export function effectiveLight(
  lightOn: boolean | undefined,
  energy: number | undefined,
  energyAt: number | null | undefined,
  now: number,
): { lightOn: boolean; energy: number } {
  let remaining = typeof energy === "number" ? energy : LIGHT_MAX_ENERGY;
  if (lightOn && typeof energyAt === "number") {
    const drained = ((now - energyAt) / 60_000) * LIGHT_DRAIN_PER_MIN;
    remaining = remaining - drained;
  }
  remaining = Math.max(0, Math.min(LIGHT_MAX_ENERGY, remaining));
  return { lightOn: Boolean(lightOn) && remaining > 0, energy: Math.round(remaining) };
}

/** How close a player must stand to interact with a plot (3x3 footprint). */
export const HOUSE_RANGE = 150;

/** A land plot occupies a 3x3 tile footprint centred on (tileX, tileY). */
export interface LandPlotNode {
  id: string;
  tileX: number;
  tileY: number;
}

export interface LandPlotState {
  plotId: string;
  ownerName?: string;
  structure: StructureType;
  /** Chosen roof-paint palette id (see ROOF_COLORS); absent = default colour. */
  roof?: string;
  /** Owner-set building name shown on the in-world sign; absent = default. */
  sign?: string;
  /** Prop id (or null) for each corner slot; see PLOT_DECORATIONS. */
  decor?: (string | null)[];
  listings?: ShopListing[];
  /** Uncollected gold from sales (only meaningful to the owner). */
  earnings?: number;
  /** Whether the building light is on (effective — false once the reserve is empty). */
  lightOn?: boolean;
  /** Remaining light energy reserve, 0..LIGHT_MAX_ENERGY. */
  energy?: number;
}

/** Max characters for an owner-set building sign. */
export const SIGN_MAX_LENGTH = 20;

/**
 * Clean an owner-supplied building name: drop ASCII control characters, collapse
 * runs of whitespace, trim, and cap length. Returns null for an empty result
 * (which clears the sign back to the default label).
 */
export function sanitizeSign(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  out = out.replace(/\s+/g, " ").trim();
  return out ? out.slice(0, SIGN_MAX_LENGTH) : null;
}

/** A roof paint option owners can apply to their house or shop. */
export interface RoofColor {
  id: string;
  name: string;
  /** Main roof fill + the darker shaded slope, used by the building art. */
  roof: number;
  roofDark: number;
}

export const ROOF_COLORS: RoofColor[] = [
  { id: "blue", name: "Sky", roof: 0x4f8cff, roofDark: 0x3a6fd0 },
  { id: "red", name: "Rose", roof: 0xe24b6b, roofDark: 0xb83250 },
  { id: "green", name: "Leaf", roof: 0x49b265, roofDark: 0x368049 },
  { id: "purple", name: "Plum", roof: 0xa66bd6, roofDark: 0x8049b0 },
  { id: "teal", name: "Teal", roof: 0x35b0a8, roofDark: 0x238079 },
  { id: "gold", name: "Amber", roof: 0xe6a800, roofDark: 0xb88300 },
];

export function getRoofColor(id: string | null | undefined): RoofColor | undefined {
  if (!id) return undefined;
  return ROOF_COLORS.find((color) => color.id === id);
}

export function isValidRoofId(id: string | null | undefined): boolean {
  return !!id && ROOF_COLORS.some((color) => color.id === id);
}

/** Number of decoration slots per plot — the four corners of the 3x3 footprint. */
export const PLOT_DECOR_SLOTS = 4;

/** A decorative prop owners can place at a plot corner. */
export interface PlotDecoration {
  id: string;
  name: string;
}

export const PLOT_DECORATIONS: PlotDecoration[] = [
  { id: "lamp", name: "Lamp Post" },
  { id: "flowers", name: "Flower Bed" },
  { id: "bush", name: "Topiary" },
  { id: "barrel", name: "Barrel" },
];

export function isValidDecorId(id: string | null | undefined): boolean {
  return !!id && PLOT_DECORATIONS.some((d) => d.id === id);
}

/**
 * Coerce stored decor data into a fixed-length slot array of valid prop ids (or
 * null for an empty corner). Unknown/extra entries become null.
 */
export function normalizeDecor(raw: unknown): (string | null)[] {
  const out: (string | null)[] = new Array(PLOT_DECOR_SLOTS).fill(null);
  if (Array.isArray(raw)) {
    for (let i = 0; i < PLOT_DECOR_SLOTS; i++) {
      const value = raw[i];
      out[i] = typeof value === "string" && isValidDecorId(value) ? value : null;
    }
  }
  return out;
}

export interface HousingStatePayload {
  plots: LandPlotState[];
}

export interface HousingResultPayload {
  ok: boolean;
  error?: string;
  plotId?: string;
  gold?: number;
  ownerName?: string;
}

export function structureLabel(structure: StructureType): string {
  return structure === "shop" ? "Shop" : structure === "house" ? "House" : "Plot";
}

/** A single item for sale in a player-run shop. */
export interface ShopListing {
  itemId: string;
  quantity: number;
  price: number;
}

/** Max distinct items a player shop can list at once. */
export const MAX_SHOP_LISTINGS = 8;

export interface PlayerShopResultPayload {
  ok: boolean;
  error?: string;
  plotId?: string;
  gold?: number;
}
