// Server-authoritative Classic Blackjack engine. The shoe, dealing, and dealer
// play all live here with crypto-strength RNG; the client only renders state and
// sends action intents. One active hand per player at a time.

import { randomInt } from "node:crypto";
import {
  DEALER_STANDS_ON,
  handValue,
  isBlackjack,
  type Card,
  type CasinoCurrencyId,
  type BlackjackOutcome,
  type Rank,
  type Suit,
} from "@metricbase/shared";

const SUITS: Suit[] = ["S", "H", "D", "C"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** A live blackjack hand held in server memory while it's being played. */
export interface ActiveHand {
  currencyId: CasinoCurrencyId;
  /** Original bet in base units (the value escrowed at deal time). */
  betUnits: number;
  /** Total escrowed so far in base units (grows on double-down). */
  escrowUnits: number;
  shoe: Card[];
  player: Card[];
  dealer: Card[];
  phase: "player" | "done";
  doubled: boolean;
}

function freshShoe(): Card[] {
  // A single 52-card deck, Fisher–Yates shuffled with crypto RNG.
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function draw(hand: ActiveHand): Card {
  const card = hand.shoe.pop();
  if (!card) throw new Error("shoe exhausted");
  return card;
}

export function startHand(currencyId: CasinoCurrencyId, betUnits: number): ActiveHand {
  const hand: ActiveHand = {
    currencyId,
    betUnits,
    escrowUnits: betUnits,
    shoe: freshShoe(),
    player: [],
    dealer: [],
    phase: "player",
    doubled: false,
  };
  hand.player.push(draw(hand));
  hand.dealer.push(draw(hand));
  hand.player.push(draw(hand));
  hand.dealer.push(draw(hand));
  // Naturals end the hand immediately (resolved by the caller via settle()).
  if (isBlackjack(hand.player) || isBlackjack(hand.dealer)) hand.phase = "done";
  return hand;
}

export function playerHit(hand: ActiveHand): void {
  if (hand.phase !== "player") return;
  hand.player.push(draw(hand));
  if (handValue(hand.player) >= 21) hand.phase = "done";
}

/** Mark a double-down: caller must have escrowed the extra bet first. */
export function playerDouble(hand: ActiveHand): void {
  if (hand.phase !== "player" || hand.player.length !== 2) return;
  hand.doubled = true;
  hand.escrowUnits += hand.betUnits;
  hand.player.push(draw(hand));
  hand.phase = "done";
}

export function dealerPlay(hand: ActiveHand): void {
  // Dealer only draws if the player hasn't busted.
  if (handValue(hand.player) > 21) return;
  while (handValue(hand.dealer) < DEALER_STANDS_ON) {
    hand.dealer.push(draw(hand));
  }
}

export interface Settlement {
  outcome: BlackjackOutcome;
  /** Base units returned to the player's balance (0 on a loss). */
  returnUnits: number;
  /** Net change vs. the total escrowed, base units (can be negative). */
  netUnits: number;
}

/**
 * Finish a hand: play out the dealer (unless the player has a natural or busted)
 * then settle. Mutates the dealer's cards.
 */
export function resolveHand(hand: ActiveHand): Settlement {
  hand.phase = "done";
  if (!isBlackjack(hand.player) && handValue(hand.player) <= 21) {
    dealerPlay(hand);
  }
  return settle(hand);
}

/** Resolve a finished hand into the amount to credit back to the balance. */
export function settle(hand: ActiveHand): Settlement {
  const playerBJ = isBlackjack(hand.player);
  const dealerBJ = isBlackjack(hand.dealer);
  const pv = handValue(hand.player);
  const dv = handValue(hand.dealer);
  const bet = hand.betUnits;
  const escrow = hand.escrowUnits;

  let outcome: BlackjackOutcome;
  let returnUnits: number;

  if (playerBJ && dealerBJ) {
    outcome = "push";
    returnUnits = bet;
  } else if (playerBJ) {
    // Blackjack pays 3:2 — bet back plus 1.5x.
    outcome = "blackjack";
    returnUnits = bet + Math.floor(bet * 3 / 2);
  } else if (dealerBJ) {
    outcome = "lose";
    returnUnits = 0;
  } else if (pv > 21) {
    outcome = "lose";
    returnUnits = 0;
  } else if (dv > 21 || pv > dv) {
    outcome = "win";
    returnUnits = escrow * 2;
  } else if (pv < dv) {
    outcome = "lose";
    returnUnits = 0;
  } else {
    outcome = "push";
    returnUnits = escrow;
  }

  return { outcome, returnUnits, netUnits: returnUnits - escrow };
}
