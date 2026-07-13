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
    title: "v0.136 — Level Cap Raised to 99",
    body: "The grind goes on: combat level and every gathering skill (Woodcutting, Mining, Fishing, Farming) now climb all the way to 99. Existing XP counts — you may level up the moment you log in.",
  },
  {
    title: "v0.134 — Farming Tools & Gear",
    body: "Forge copper, iron and steel hoes: tend crop patches up to 50% faster and planted crops mature up to 35% sooner. Weave a Farmer's Sun Hat or craft a Grower's Ring for bonus crops and Farming XP.",
  },
  {
    title: "v0.129–0.131 — Farming Loop in Worlds",
    body: "Crop patches in player Worlds now yield seeds (the Crop Field gives a random one) and train your Farming skill — gather a seed, plant it, grow it, harvest it.",
  },
  {
    title: "v0.128 — Richest Players on /stats",
    body: "The public stats page now ranks the wealthiest players by full net worth with day-over-day change. The board resets every 90-day season.",
  },
  {
    title: "v0.127 — Net-Worth Leaderboard",
    body: "The in-game Richest board now counts everything you own — gold, items, build assets, your Worlds, houses and shops — not just gold on hand.",
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
