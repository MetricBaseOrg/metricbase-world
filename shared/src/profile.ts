import type { CharacterAppearance } from "./character.js";

/**
 * Public player profile — served on demand when someone clicks a name tag
 * (chat, mail, who list, PvP frame). Only information that's already visible
 * elsewhere in the game: no gold, no inventory, no location tracking.
 */
export interface PlayerProfilePayload {
  ok: boolean;
  error?: string;
  name?: string;
  online?: boolean;
  level?: number;
  guildName?: string;
  guildTag?: string;
  appearance?: CharacterAppearance;
  skills?: {
    woodcutting: number;
    mining: number;
    fishing: number;
    farming: number;
  };
  pvpRating?: number;
  pvpKills?: number;
  honor?: number;
}
