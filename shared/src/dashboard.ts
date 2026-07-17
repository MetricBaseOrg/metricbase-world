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
    title: "v0.157 — World Events & Living Economy",
    body: "The economy breathes now! Random events shake the world — 🦠 Crop Blights halve harvests, ⛏️ Vein Discoveries and 🐟 Fish Runs shower one region with bonus yields. Rain speeds crops and fishing. And fees (repairs, bait, respecs) adapt ±20% to the gold supply — watch it all live on /stats.",
  },
  {
    title: "v0.156 — Company Perks",
    body: "Your company type now works for you! Mining crews roll bonus ore, farming co-ops grow crops faster, fishing companies pay half bait, blacksmiths roll better quality and repair cheaper, merchants trade shares at reduced fees, and logistics crews earn +25% freight with half the caravan cooldown.",
  },
  {
    title: "v0.155 — Crafting Professions",
    body: "Master your craft! Pick up to 2 of 6 craft families (🎓 Mastery tab at the forge). Specialists roll ✨ Fine and 🌟 Master gear — stronger, longer-lasting, and NEVER sold by Pip. Chefs and smelters cook bonus portions instead. Want top-tier gear outside your specialty? Trade with another player.",
  },
  {
    title: "v0.154 — Caravan Runs",
    body: "Become a hauler! Accept a sealed cargo satchel at any town board and walk it to another town for a flat freight fee — riskier routes pay more. Die in a PvP zone and your cargo DROPS for anyone to seize and deliver. Employers can also pin supply jobs to a delivery town for player-to-player hauling.",
  },
  {
    title: "v0.153 — Regional Markets",
    body: "Every town now has its own prices AND its own merchant — meet Mara at the Wilderness Camp and Fen in the Slime Grotto. What a town eats gets pricier there; what gets dumped there gets cheaper there only. Check the 🗺️ regional price grid in the 📋 Towns tab and haul your goods where they pay best.",
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
