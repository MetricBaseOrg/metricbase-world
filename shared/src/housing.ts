// Housing: players spend gold to own a land plot and place a structure on it.
// This is both a gameplay goal ("make a living in MetricBase") and the largest
// gold sink in the economy.

export type StructureType = "none" | "house" | "shop";

/** Gold cost to buy a land plot. A deliberately large long-term gold sink. */
export const PLOT_PRICE = 500;

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
  listings?: ShopListing[];
  /** Uncollected gold from sales (only meaningful to the owner). */
  earnings?: number;
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
