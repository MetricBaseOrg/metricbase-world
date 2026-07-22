import type { CharacterAppearance } from "./character.js";
import type { InventoryEntry } from "./items.js";

/** Longest motto a player can save on their dashboard profile. */
export const MOTTO_MAX_LENGTH = 80;

/**
 * "Recent Updates" entries shown on the /dashboard page, newest first.
 * KEEP THIS CURRENT: whenever a player-facing release ships (any GAME_VERSION
 * bump in index.ts), add its highlight here and trim the list to ~5 entries.
 */
export const DASHBOARD_UPDATES: Array<{ title: string; body: string }> = [
  {
    title: "v0.176 — Link Telegram to your wallet account",
    body: "Already play with a wallet? You can now attach your Telegram account to it. Open the Mini App, tap “Already play with a wallet?” for a 6-character code, then enter it on your dashboard under Telegram. After that, tapping Continue with Telegram signs you straight into your existing character — no more hopping out to a wallet browser every session. Your wallet stays your identity; nothing moves or merges.",
  },
  {
    title: "v0.175 — Play with Telegram, get paid to your wallet",
    body: "You can now sign in with Telegram and play straight away — no wallet, no tokens. Season points build up as normal. When you want to collect your $BASE, just paste your Solana address into the Reward wallet box on your dashboard and rewards go there. Wallet players are unaffected, but can also nominate a different payout address if they prefer.",
  },
  {
    title: "v0.173 — Referrals Reward Real Players",
    body: "Now that entry is free, referral Season points are paid when your invitee actually starts playing — once they reach level 5 — instead of the moment they redeem your code. Same 50 points, they just land a little later. This keeps the Season prize pool going to people who bring in real players rather than empty sign-ups.",
  },
  {
    title: "v0.172 — Free to Play",
    body: "The 1,000 $BASE entry requirement is gone. Connect a Solana wallet and you're in — no tokens needed. Your wallet is still your identity: it saves your character, keeps your name bonded, and it's where Season prize-pool rewards get paid. $BASE now buys the optional things — gold at Rudi's desk, VIP passes, land plots and World slots. Tell your friends; entry costs nothing now.",
  },
  {
    title: "v0.171 — MetricBase World on Telegram",
    body: "The world now opens straight inside Telegram — no install, no app store. Share an invite code to any chat with one tap and your friend lands in the game with the code already attached, so you get the Season referral points automatically. Telegram has no built-in Solana wallet, so connecting hands you off to Phantom or Solflare (your invite survives the trip), and you can always spectate first with no wallet at all.",
  },
  {
    title: "v0.162 — Companies Do Business",
    body: "Company contracts are now business-to-business. An owner or manager posts a supply order to another company; the reward is escrowed from YOUR treasury, the hired company fills it from its warehouse, and the delivered goods land in your warehouse — every gold in and out shown on both companies' financial statements. Also: say hi to Rudi at his new Sweet Harvest Market stall in the Hub.",
  },
  {
    title: "v0.161 — Gathering Feels Good",
    body: "Chop, mine, or harvest and the actual item — a bundle of wood, an ore chunk, seeds, a ripe crop — pops out in its hand-drawn art, tumbles to the ground with a thud, then flies into your bag with a sparkle and a chime. Crop fields drop their seeds, farms drop their harvest.",
  },
  {
    title: "v0.159 — Spot the Haulers",
    body: "Caravan haulers now carry a 📦 badge on their nameplate in red and black zones — where cargo drops on death. Escort your company's couriers, or turn bandit and hunt someone else's payday. The cargo is finally visible to everyone in the danger zones.",
  },
  {
    title: "v0.157 — World Events & Living Economy",
    body: "The economy breathes now! Random events shake the world — 🦠 Crop Blights halve harvests, ⛏️ Vein Discoveries and 🐟 Fish Runs shower one region with bonus yields. Rain speeds crops and fishing. And fees (repairs, bait, respecs) adapt ±20% to the gold supply — watch it all live on /stats.",
  },
  {
    title: "v0.156 — Company Perks",
    body: "Your company type now works for you! Mining crews roll bonus ore, farming co-ops grow crops faster, fishing companies pay half bait, blacksmiths roll better quality and repair cheaper, merchants trade shares at reduced fees, and logistics crews earn +25% freight with half the caravan cooldown.",
  },
];

/** GET /api/dashboard/me — everything the player dashboard page renders. */
export interface DashboardResponse {
  /** False when the wallet has no bonded character yet (dashboard shows a "create your hero" prompt). */
  found: boolean;
  name: string;
  appearance: CharacterAppearance;
  level: number;
  xp: number;
  /** Combat level + every gather-skill level summed (the "Total Level" stat). */
  totalLevel: number;
  gold: number;
  gems: number;
  honor: number;
  guildCoin: number;
  motto: string;
  /** True when signed in via Telegram (identity `tg:<id>`), so there's no
   *  wallet of their own to pay season rewards to. */
  isTelegramAccount: boolean;
  /** Address nominated to receive $BASE season rewards. A payout DESTINATION,
   *  never an identity — it authenticates nothing. Null = use their own wallet
   *  (wallet players) or not set yet (Telegram players, who can't be paid). */
  payoutWallet: string | null;
  /** Whether a Telegram login is attached to this wallet account. */
  telegramLinked: boolean;
  /** Epoch ms of the character's last save (last time they played), or null for brand-new. */
  lastSeenAt: number | null;
  unreadMail: number;
  inventory: InventoryEntry[];
  /** Currently equipped pet/mount item ids (subset of the equipment slots). */
  equippedPetId: string | null;
  equippedMountId: string | null;
}
