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
    title: "v0.154 — Caravan Runs",
    body: "Become a hauler! Accept a sealed cargo satchel at any town board and walk it to another town for a flat freight fee — riskier routes pay more. Die in a PvP zone and your cargo DROPS for anyone to seize and deliver. Employers can also pin supply jobs to a delivery town for player-to-player hauling.",
  },
  {
    title: "v0.153 — Regional Markets",
    body: "Every town now has its own prices AND its own merchant — meet Mara at the Wilderness Camp and Fen in the Slime Grotto. What a town eats gets pricier there; what gets dumped there gets cheaper there only. Check the 🗺️ regional price grid in the 📋 Towns tab and haul your goods where they pay best.",
  },
  {
    title: "v0.152 — Town Order Boards",
    body: "Towns now consume goods and post time-limited bulk orders at a premium over market price! Check the new 📋 Town Orders tab in any shop: the Hub, Wilderness Camp and Grotto Outpost each want different goods — deliver on location before the order expires. First come, first served.",
  },
  {
    title: "v0.151 — A More Real Economy",
    body: "Prices now swing wider with real scarcity and gluts (0.4×–3× of base value), repair fees scale with your gear's tier, and the /stats dashboard gained a Money Supply panel: gold minted vs burned this week and a mint-pressure gauge — watch the economy breathe.",
  },
  {
    title: "v0.148 — Hand-drawn Art Refresh",
    body: "Fresh hand-drawn art across the world and your bags: blacksmith forge/anvil/quench, the arcade & blackjack tables, market stalls and produce, cozy furniture and lanterns, farm plots, billboards and portal gates — plus new item icons for bread, planks, hardwood, steel bars, health potions and more.",
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
