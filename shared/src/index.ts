export const GAME_VERSION = "0.3.0";

export const TICK_RATE = 20;

export const PLAYER_SPEED = 120;

export const TILE_WIDTH = 64;

export const TILE_HEIGHT = 32;

export const MAP_WIDTH = 24;

export const MAP_HEIGHT = 24;

export interface PlayerInputMessage {
  dx: number;
  dy: number;
  sequence: number;
}

export function tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: (tileX - tileY) * (TILE_WIDTH / 2),
    y: (tileX + tileY) * (TILE_HEIGHT / 2),
  };
}

export function worldToTile(worldX: number, worldY: number): { tileX: number; tileY: number } {
  const tileX = Math.round((worldX / (TILE_WIDTH / 2) + worldY / (TILE_HEIGHT / 2)) / 2);
  const tileY = Math.round((worldY / (TILE_HEIGHT / 2) - worldX / (TILE_WIDTH / 2)) / 2);
  return { tileX, tileY };
}

export * from "./zones.js";
export * from "./maps.js";
export * from "./messages.js";
export * from "./progression.js";
export * from "./quests.js";
export * from "./combat.js";
export * from "./mobRewards.js";
export * from "./tokenGate.js";
export * from "./character.js";
export * from "./avatar.js";
export * from "./items.js";
export * from "./equipment.js";
export * from "./shop.js";
export * from "./tokenShop.js";
export * from "./market.js";
export * from "./skills.js";
export * from "./resources.js";
export * from "./crafting.js";
export * from "./schema/PlayerSchema.js";
export * from "./schema/ZoneState.js";

// Backward-compatible default zone alias
export { ZONE_HUB as ZONE_ROOM } from "./zones.js";