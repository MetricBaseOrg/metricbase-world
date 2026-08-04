// Coin sound on every gold gain, wherever it came from.
//
// Gold is credited from a lot of places — vendor sales, gather drops, quest and
// mob rewards, mail attachments, shop earnings, World pass and gather tax, job
// payouts, daily rewards — and they all land in the store through one of three
// setters. Rather than add a playSfx call to each of those paths (and miss the
// next one), this watches the single value they all write and reacts to it
// going UP. Spending gold is already covered by the shop sounds.

import { playCoinSfx } from "./soundEffects";
import { useGameStore } from "../store/gameStore";

/**
 * The gold value we last reacted to. `null` means "no baseline yet" — the next
 * real value is adopted silently rather than treated as income, which is what
 * stops the join handshake from sounding like you just earned your entire net
 * worth.
 */
let baseline: number | null = null;

export function startGoldEarnSfx(): () => void {
  return useGameStore.subscribe((state) => {
    // A dropped connection invalidates the baseline: the reconnect re-sends the
    // profile, and that arrival is a restore, not a payout.
    if (!state.connected) {
      baseline = null;
      return;
    }
    const gold = state.playerGold;
    if (!Number.isFinite(gold)) return;
    if (baseline === null) {
      // The store's pre-profile default is 0, and it arrives before the real
      // balance does — adopting it would make the profile landing register as
      // income. Wait for a real figure instead, then adopt it silently.
      // Consequence, accepted: a player sitting at exactly 0 gold gets no sound
      // on their first earn, because that gain is indistinguishable from the
      // handshake. Every earn after it sounds normally.
      if (gold <= 0) return;
      baseline = gold;
      return;
    }
    if (gold > baseline) playCoinSfx(gold - baseline);
    baseline = gold;
  });
}
