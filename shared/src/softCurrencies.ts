// Soft (in-game) currencies beyond gold: earned through play, shown in the HUD
// and the Character panel. These are NOT the on-chain payment currencies in
// currencies.ts — they never touch a wallet.

export type SoftCurrencyId = "honor" | "guildCoin" | "gems";

export interface SoftCurrency {
  id: SoftCurrencyId;
  label: string;
  icon: string;
  color: string;
  /** One-line "how you earn it" hint for tooltips. */
  hint: string;
}

export const SOFT_CURRENCIES: SoftCurrency[] = [
  { id: "honor", label: "Honor", icon: "🎖️", color: "#e0567a", hint: "Earned from PvP victories." },
  { id: "guildCoin", label: "Guild Coin", icon: "🔰", color: "#5aa7e0", hint: "Earned from PvP wins while in a guild." },
  { id: "gems", label: "Gems", icon: "💎", color: "#41d6bf", hint: "A rare drop from powerful foes." },
];

export interface SoftBalances {
  honor: number;
  guildCoin: number;
  gems: number;
}

export const EMPTY_SOFT_BALANCES: SoftBalances = { honor: 0, guildCoin: 0, gems: 0 };

/** Honor awarded to the victor of a PvP kill. */
export const HONOR_PER_KILL = 15;
/** Guild Coin awarded to the victor of a PvP kill when they're in a guild. */
export const GUILD_COIN_PER_KILL = 10;
/** Gems dropped per qualifying elite kill (when the roll succeeds). */
export const GEMS_PER_ELITE = 1;
/** Chance an elite foe drops a gem. */
export const GEM_DROP_CHANCE = 0.05;
/** A mob counts as "elite" (gem-eligible) at/above this reward XP. */
export const GEM_ELITE_MIN_XP = 40;

export function clampBalance(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}
