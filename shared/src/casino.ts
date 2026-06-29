// Community Lodge casino — Classic Blackjack played against the house, betting
// real on-chain currencies via a custodial per-currency balance. The card RNG,
// dealing, and settlement all run server-side; these are the shared contracts
// plus pure helpers safe to use on both sides (hand value, formatting).

import { PAYMENT_CURRENCIES, getCurrency, type PaymentCurrency } from "./currencies.js";

export type CasinoCurrencyId = "sol" | "usdc" | "idrx" | "base";

/** A casino table is one of the payment currencies. */
export const CASINO_CURRENCIES: PaymentCurrency[] = PAYMENT_CURRENCIES;

export function getCasinoCurrency(id: string | null | undefined): PaymentCurrency {
  return getCurrency(id);
}

/**
 * Per-currency table tuning, in whole UI units. Bets and balances move in the
 * currency's smallest units server-side, but the UI talks in these amounts.
 */
export interface CasinoTableConfig {
  currencyId: CasinoCurrencyId;
  /** Smallest accepted deposit (UI units). */
  minDeposit: number;
  /** Minimum and maximum bet (UI units). */
  minBet: number;
  maxBet: number;
  /** Step the bet snaps to (UI units). */
  betStep: number;
}

export const CASINO_TABLES: Record<CasinoCurrencyId, CasinoTableConfig> = {
  sol: { currencyId: "sol", minDeposit: 0.02, minBet: 0.01, maxBet: 1, betStep: 0.01 },
  usdc: { currencyId: "usdc", minDeposit: 1, minBet: 0.5, maxBet: 100, betStep: 0.5 },
  idrx: { currencyId: "idrx", minDeposit: 10000, minBet: 5000, maxBet: 1_000_000, betStep: 5000 },
  base: { currencyId: "base", minDeposit: 1000, minBet: 500, maxBet: 200_000, betStep: 500 },
};

export function getCasinoTable(id: string): CasinoTableConfig | null {
  return CASINO_TABLES[id as CasinoCurrencyId] ?? null;
}

/**
 * Currency tables currently open for play. Temporarily BASE-only; add ids back
 * here (e.g. "sol", "usdc", "idrx") to reopen those tables.
 */
export const CASINO_ACTIVE_CURRENCY_IDS: CasinoCurrencyId[] = ["base"];

export function isCasinoCurrencyActive(id: string): boolean {
  return CASINO_ACTIVE_CURRENCY_IDS.includes(id as CasinoCurrencyId);
}

// ---- units <-> base-units conversion (no floats in money math) ----

/** Convert a UI amount to the currency's smallest integer units. */
export function toBaseUnits(uiAmount: number, currencyId: string): number {
  const decimals = getCurrency(currencyId).decimals;
  return Math.round(uiAmount * 10 ** decimals);
}

/** Convert smallest integer units back to a UI amount. */
export function toUiAmount(baseUnits: number, currencyId: string): number {
  const decimals = getCurrency(currencyId).decimals;
  return baseUnits / 10 ** decimals;
}

/** Pretty currency amount with sensible precision per currency. */
export function formatCasinoAmount(uiAmount: number, currencyId: string): string {
  const cur = getCurrency(currencyId);
  const maxFractionDigits = cur.id === "idrx" ? 0 : cur.id === "base" ? 0 : cur.id === "sol" ? 4 : 2;
  return uiAmount.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

// ---- Blackjack cards & hands ----

export type Suit = "S" | "H" | "D" | "C";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
}

/** Best (non-busting if possible) total for a hand, counting aces as 11 then 1. */
export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (card.rank === "K" || card.rank === "Q" || card.rank === "J" || card.rank === "10") {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

/** True when a hand counts an ace as 11 (a "soft" total). */
export function isSoft(cards: Card[]): boolean {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (card.rank === "K" || card.rank === "Q" || card.rank === "J" || card.rank === "10") {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }
  return softAces > 0;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export type BlackjackPhase = "player" | "dealer" | "done";
export type BlackjackOutcome = "win" | "lose" | "push" | "blackjack";

/** Snapshot of the active hand sent to the client. */
export interface BlackjackState {
  currencyId: CasinoCurrencyId;
  /** Current wager in UI units (doubles after a double-down). */
  bet: number;
  playerCards: Card[];
  dealerCards: Card[];
  /** Dealer's hole card stays hidden until the dealer plays. */
  dealerHidden: boolean;
  phase: BlackjackPhase;
  canDouble: boolean;
  outcome?: BlackjackOutcome;
  /** Net change to balance from this hand (UI units), present when phase==="done". */
  net?: number;
}

/** Per-currency custodial balances (UI units) shown in the cashier. */
export type CasinoBalances = Partial<Record<CasinoCurrencyId, number>>;

export interface CasinoStatePayload {
  balances: CasinoBalances;
  /** Treasury address players deposit to (null when the casino is disabled). */
  houseWallet: string | null;
  /** Reliable RPC endpoint for the client to send the deposit through. */
  rpcUrl: string | null;
  /** Server-resolved deposit mint per non-native currency (BASE comes from env). */
  mints: Record<string, string | null>;
  /** Whether real withdrawals are currently possible (house signer configured). */
  withdrawEnabled: boolean;
  hand: BlackjackState | null;
}

export interface CasinoActionResult {
  ok: boolean;
  error?: string;
  state?: CasinoStatePayload;
  /** Outgoing payout signature when a withdrawal succeeds. */
  signature?: string;
}

/** Blackjack pays 3:2. */
export const BLACKJACK_PAYOUT = 1.5;
/**
 * Most a single hand can return to the player (a doubled-down win returns 4×
 * the base bet). Used to guard that the house can always cover a hand.
 */
export const MAX_HAND_RETURN_MULT = 4;
/** Dealer stands on all 17s (including soft 17). */
export const DEALER_STANDS_ON = 17;
