// Crafting as a profession — quality tiers + mastery specialization.
// THE tunables table for the system.
//
// Design (v0.155):
// - Six CRAFT FAMILIES. A player SPECIALIZES in at most MAX_CRAFT_SPECS (2):
//   only specialized families earn mastery XP and roll bonuses, so no player
//   can master everything — interdependence and player-to-player trade.
// - GEAR families (smithing/toolcraft/woodwork rods/artifice wearables) roll
//   QUALITY: Fine/Master variants are REAL ITEM IDS (`<base>_fine`,
//   `<base>_master`) registered at module load with boosted stats/durability,
//   so inventory stacking, trading, shops, and equipment code all work
//   unchanged.
// - GOODS families (cooking/smelting) roll BONUS YIELD instead (an extra
//   output unit) — a master chef bakes more bread, not "fine bread".
// - ECONOMY INVARIANTS: NPC vendor value IGNORES quality (getItemBaseValue
//   resolves the base id), and Pip never stocks variants — Fine/Master gear
//   exists only through player crafting and player-to-player trade. Vendoring
//   a Fine axe pays exactly what the Standard one does, so quality can never
//   mint gold.

import { ITEMS, ITEM_ICONS, type ItemDefinition } from "./items.js";
import { CRAFT_RECIPES } from "./crafting.js";
import {
  GEAR_STATS,
  TOOL_GATHER,
  TOOL_GROWTH,
  TOOL_MAX_DURABILITY,
  WEAPON_BONUS_DAMAGE,
  WEAPON_MAX_DURABILITY,
} from "./equipment.js";

// ---- Families --------------------------------------------------------------

export type CraftFamily = "cooking" | "smelting" | "woodwork" | "smithing" | "toolcraft" | "artifice";

export const CRAFT_FAMILY_INFO: Record<CraftFamily, { label: string; icon: string; blurb: string }> = {
  cooking: { label: "Cooking", icon: "🍳", blurb: "Meals & dishes — masters cook bonus portions" },
  smelting: { label: "Smelting", icon: "🔥", blurb: "Bars & oil — masters pour bonus ingots" },
  woodwork: { label: "Woodwork", icon: "🪵", blurb: "Planks & rods — Fine/Master rods, bonus planks" },
  smithing: { label: "Smithing", icon: "⚒️", blurb: "Weapons & armor — roll Fine/Master gear" },
  toolcraft: { label: "Toolcraft", icon: "🪓", blurb: "Axes, picks, hoes & nets — roll Fine/Master tools" },
  artifice: { label: "Artifice", icon: "💍", blurb: "Rings, amulets, capes & mounts" },
};

export const CRAFT_FAMILIES = Object.keys(CRAFT_FAMILY_INFO) as CraftFamily[];

/** Explicit family overrides where the item kind alone is ambiguous. */
const FAMILY_OVERRIDES: Record<string, CraftFamily> = {
  item_plank: "woodwork",
  item_hardwood_plank: "woodwork",
  item_copper_bar: "smelting",
  item_iron_bar: "smelting",
  item_steel_bar: "smelting",
  item_lamp_oil: "smelting",
  item_fishing_rod: "woodwork",
  item_pro_rod: "woodwork",
  item_gilded_rod: "woodwork",
  item_abyssal_rod: "woodwork",
  item_gem_ring: "artifice",
  item_pearl_amulet: "artifice",
  item_lucky_lure: "artifice",
  item_angler_ring: "artifice",
  item_grower_ring: "artifice",
  item_traveler_cape: "artifice",
};

/** The craft family a recipe output belongs to. */
export function craftFamilyOf(outputItemId: string): CraftFamily {
  const override = FAMILY_OVERRIDES[outputItemId];
  if (override) return override;
  const kind = ITEMS[outputItemId]?.kind;
  if (kind === "consumable") return "cooking";
  if (kind === "weapon" || kind === "armor") return "smithing";
  if (kind === "tool") return "toolcraft";
  if (kind === "mount" || kind === "pet") return "artifice";
  return "smelting"; // remaining materials
}

// ---- Specialization + mastery ----------------------------------------------

export const MAX_CRAFT_SPECS = 2;
/** Gold burned to abandon a specialization slot and pick again. */
export const CRAFT_RESPEC_COST = 5000;
/** Mastery XP a player can earn per UTC day (value-weighted, so alt spam of
 * twig recipes can't power-level). */
export const MASTERY_DAILY_XP_CAP = 600;
/** XP per craft = half the input value, clamped — cheap recipes teach little. */
export function masteryXpForCraft(inputCost: number): number {
  return Math.max(1, Math.min(40, Math.round(inputCost / 2)));
}
export const MASTERY_LEVEL_CAP = 60;
export function masteryLevel(xp: number): number {
  return Math.min(MASTERY_LEVEL_CAP, Math.floor(Math.sqrt(Math.max(0, xp) / 40)));
}

// ---- Quality tiers ---------------------------------------------------------

export type CraftQuality = "fine" | "master";
export const QUALITY_LABEL: Record<CraftQuality, string> = { fine: "Fine", master: "Master" };
export const QUALITY_ICON: Record<CraftQuality, string> = { fine: "✨", master: "🌟" };
/** Numeric stats (damage, armor, crit, yield bonus) scale by this. */
export const QUALITY_STAT_MULT: Record<CraftQuality, number> = { fine: 1.15, master: 1.35 };
/** Durability scales by this — Master gear lasts a lot longer. */
export const QUALITY_DURABILITY_MULT: Record<CraftQuality, number> = { fine: 1.25, master: 1.6 };

/** Roll chances at a given mastery level (specialized families only). */
export function fineChance(level: number): number {
  return Math.min(0.35, 0.02 + level * 0.008);
}
export function masterChance(level: number): number {
  return Math.min(0.12, level * 0.0025);
}
/** Cooking/smelting: chance of one bonus output unit instead of quality. */
export function bonusYieldChance(level: number): number {
  return Math.min(0.25, level * 0.005);
}

export function qualityVariantId(baseId: string, quality: CraftQuality): string {
  return `${baseId}_${quality}`;
}
export function qualityOf(itemId: string): CraftQuality | null {
  if (itemId.endsWith("_fine")) return "fine";
  if (itemId.endsWith("_master")) return "master";
  return null;
}
/** Strip a quality suffix; identity for normal ids. */
export function baseItemIdOf(itemId: string): string {
  const q = qualityOf(itemId);
  if (q === "fine") return itemId.slice(0, -5);
  if (q === "master") return itemId.slice(0, -7);
  return itemId;
}

/** Families whose crafts roll quality variants (gear); others roll bonus yield. */
export function familyRollsQuality(family: CraftFamily): boolean {
  return family === "smithing" || family === "toolcraft" || family === "woodwork" || family === "artifice";
}

/** An output is quality-eligible if its family rolls quality AND it's gear
 * (weapon/armor/tool) — materials like planks fall back to bonus yield. */
export function isQualityEligible(outputItemId: string): boolean {
  if (!familyRollsQuality(craftFamilyOf(outputItemId))) return false;
  const kind = ITEMS[outputItemId]?.kind;
  return kind === "weapon" || kind === "armor" || kind === "tool";
}

// ---- Variant registration (runs once at module load) -----------------------

const scale = (v: number | undefined, mult: number): number | undefined =>
  v === undefined ? undefined : Math.round(v * mult * 100) / 100;

function registerVariant(baseId: string, quality: CraftQuality): void {
  const id = qualityVariantId(baseId, quality);
  const base = ITEMS[baseId];
  if (!base || ITEMS[id]) return;
  const statMult = QUALITY_STAT_MULT[quality];
  const durMult = QUALITY_DURABILITY_MULT[quality];
  const def: ItemDefinition = {
    ...base,
    id,
    name: `${QUALITY_LABEL[quality]} ${base.name}`,
    description: `${QUALITY_ICON[quality]} ${QUALITY_LABEL[quality]}-quality ${base.name.toLowerCase()} — crafted by a specialist. ${base.description ?? ""}`.trim(),
  };
  ITEMS[id] = def;
  ITEM_ICONS[id] = ITEM_ICONS[baseId] ?? "📦";

  const dmg = WEAPON_BONUS_DAMAGE[baseId];
  if (dmg !== undefined) WEAPON_BONUS_DAMAGE[id] = Math.ceil(dmg * statMult);
  const wDur = WEAPON_MAX_DURABILITY[baseId];
  if (wDur !== undefined) WEAPON_MAX_DURABILITY[id] = Math.round(wDur * durMult);
  const tDur = TOOL_MAX_DURABILITY[baseId];
  if (tDur !== undefined) TOOL_MAX_DURABILITY[id] = Math.round(tDur * durMult);
  const gather = TOOL_GATHER[baseId];
  if (gather) {
    TOOL_GATHER[id] = {
      ...gather,
      // Lower is faster: shrink the remaining fraction by the stat multiplier.
      speedMultiplier: Math.max(0.25, Math.round((1 - (1 - gather.speedMultiplier) * statMult) * 100) / 100),
      yieldBonus: scale(gather.yieldBonus, statMult),
      xpBonus: scale(gather.xpBonus, statMult),
      rareBonus: scale(gather.rareBonus, statMult),
    };
  }
  const growth = TOOL_GROWTH[baseId];
  if (growth !== undefined) {
    // Lower is faster crop growth — shrink the discount's remainder.
    TOOL_GROWTH[id] = Math.max(0.4, Math.round((1 - (1 - growth) * statMult) * 100) / 100);
  }
  const gear = GEAR_STATS[baseId];
  if (gear) {
    GEAR_STATS[id] = {
      ...gear,
      armor: gear.armor === undefined ? undefined : Math.ceil(gear.armor * statMult),
      attack: gear.attack === undefined ? undefined : Math.ceil(gear.attack * statMult),
      critChance: scale(gear.critChance, statMult),
      critMult: scale(gear.critMult, statMult),
      maxDurability: Number.isFinite(gear.maxDurability) ? Math.round(gear.maxDurability * durMult) : gear.maxDurability,
    };
  }
}

for (const recipe of CRAFT_RECIPES) {
  const out = recipe.output.itemId;
  if (!isQualityEligible(out)) continue;
  registerVariant(out, "fine");
  registerVariant(out, "master");
}

/** Every registered variant id (for catalog exclusions and tests). */
export function allQualityVariantIds(): string[] {
  return Object.keys(ITEMS).filter((id) => qualityOf(id) !== null);
}

// ---- Player mastery state (wire + persistence shape) -----------------------

export interface CraftMasteryState {
  /** Chosen specializations (≤ MAX_CRAFT_SPECS). */
  specs: CraftFamily[];
  /** Lifetime mastery XP per family. */
  xp: Partial<Record<CraftFamily, number>>;
  /** UTC day the daily counter belongs to + XP earned that day. */
  day: string;
  xpToday: number;
}

export function emptyCraftMastery(): CraftMasteryState {
  return { specs: [], xp: {}, day: "", xpToday: 0 };
}

export function normalizeCraftMastery(raw: unknown): CraftMasteryState {
  const out = emptyCraftMastery();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Partial<CraftMasteryState>;
  if (Array.isArray(r.specs)) {
    out.specs = r.specs.filter((f): f is CraftFamily => CRAFT_FAMILIES.includes(f as CraftFamily)).slice(0, MAX_CRAFT_SPECS);
  }
  if (r.xp && typeof r.xp === "object") {
    for (const f of CRAFT_FAMILIES) {
      const v = (r.xp as Record<string, unknown>)[f];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out.xp[f] = Math.floor(v);
    }
  }
  if (typeof r.day === "string") out.day = r.day;
  if (typeof r.xpToday === "number" && Number.isFinite(r.xpToday)) out.xpToday = Math.max(0, Math.floor(r.xpToday));
  return out;
}

/** Payload for the crafting panel. */
export interface CraftMasteryPayload {
  specs: CraftFamily[];
  levels: Partial<Record<CraftFamily, { level: number; xp: number }>>;
  xpTodayRemaining: number;
  respecCost: number;
  maxSpecs: number;
}
