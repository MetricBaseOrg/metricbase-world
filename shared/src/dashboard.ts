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
    title: "v0.141 — Stock Exchange (Phase 1)",
    body: "Company owners can list on the Stock Exchange, and anyone can buy and sell shares on a live bonding-curve market. Prices move with demand, a slice of every trade funds the company treasury, and your holdings show up in the new 📈 Exchange panel. Dividends and financial statements come next.",
  },
  {
    title: "v0.140 — Merchant Companies",
    body: "Found a player-owned business: a shared treasury and item warehouse, ranks and salaries, automatic daily dividends, a revenue-share on members' earnings, warehouse vendor sales, and an inbound contracts board. Belong to a guild AND a company at once — open Companies from the ⚙️ menu.",
  },
  {
    title: "v0.139 — DAO Guild Delegation",
    body: "Guild members can now delegate their DAO voting power to their guild — when the leader votes, every delegator's $BASE is cast alongside. Small holders, big voice.",
  },
  {
    title: "v0.137 — MetricBase DAO",
    body: "Govern the world at /dao: $BASE holders create polls (10M+) and vote (1M+) with power weighted by their holdings. Off-chain and gasless — just sign in with your wallet.",
  },
  {
    title: "v0.136 — Level Cap Raised to 99",
    body: "The grind goes on: combat level and every gathering skill (Woodcutting, Mining, Fishing, Farming) now climb all the way to 99. Existing XP counts — you may level up the moment you log in.",
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
