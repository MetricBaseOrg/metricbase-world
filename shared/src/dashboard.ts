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
    title: "v0.146 — Charts, Portfolio & Discovery",
    body: "The Stock Exchange grows up: a price chart and high/low on every company, a Portfolio tab with your total value and profit/loss, and a Discover tab with top gainers, top losers, a market-cap leaderboard and a personal watchlist. Star the companies you're tracking.",
  },
  {
    title: "v0.145 — Limit Orders & Order Book",
    body: "Set your price: place standing buy or sell limit orders and let the matching engine fill them peer-to-peer at the best available price (with price improvement when you cross the spread). Each company's trade page now shows a live order book of bids and asks.",
  },
  {
    title: "v0.144 — Trade Shares for real $BASE",
    body: "List a block of company shares for a fixed $BASE price and let anyone buy it with real crypto — the buyer pays $BASE straight to your wallet on-chain and the shares move to them instantly. Find it under each company on the 📈 Stock Exchange.",
  },
  {
    title: "v0.143 — Dividends, Shareholder Control & Financials",
    body: "Listed companies now pay weekly share dividends from their profit — split among shareholders, with the payout % set by a share-weighted vote. Buy enough shares and you become the CEO with a controlling stake. Each company's trade page shows live financials (revenue, expenses, net profit) and dividend history. Your share portfolio counts toward your net worth.",
  },
  {
    title: "v0.140 — Merchant Companies",
    body: "Found a player-owned business: a shared treasury and item warehouse, ranks and salaries, automatic daily dividends, a revenue-share on members' earnings, warehouse vendor sales, and an inbound contracts board. Belong to a guild AND a company at once — open Companies from the ⚙️ menu.",
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
  /** Epoch ms of the character's last save (last time they played), or null for brand-new. */
  lastSeenAt: number | null;
  unreadMail: number;
  inventory: InventoryEntry[];
  /** Currently equipped pet/mount item ids (subset of the equipment slots). */
  equippedPetId: string | null;
  equippedMountId: string | null;
}
