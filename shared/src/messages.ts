export interface ChatMessagePayload {
  id: string;
  channel: "zone" | "system" | "guild" | "party";
  senderId: string;
  senderName: string;
  body: string;
  sentAt: number;
}

export interface ZoneTransferPayload {
  targetZone: string;
  label: string;
}

import type { CharacterAppearance } from "./character.js";

export interface JoinOptions {
  name: string;
  zoneId?: string;
  accessToken?: string;
  appearance?: CharacterAppearance;
}

export interface CharacterLookupResponse {
  name: string;
  walletAddress: string | null;
  zoneId: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  found: boolean;
  bonded: boolean;
  appearance: CharacterAppearance;
}

export interface InteractPayload {
  npcId: string;
}

export interface ProfilePayload {
  level: number;
  xp: number;
  gold?: number;
  hp?: number;
  maxHp?: number;
  stamina?: number;
  maxStamina?: number;
  equippedWeaponId?: string | null;
  equippedToolId?: string | null;
  knockedOut?: boolean;
  freeRespawnAt?: number | null;
}

export interface RespawnResultPayload {
  ok: boolean;
  error?: string;
  gold?: number;
  hp?: number;
  maxHp?: number;
  knockedOut?: boolean;
  freeRespawnAt?: number | null;
}

export type { QuestStatePayload } from "./quests.js";
export type { AttackResultPayload, MobHealthPayload, PlayerDamagePayload } from "./combat.js";
export type { InventoryResultPayload, InventoryStatePayload } from "./items.js";
export type { ShopOpenPayload, ShopResultPayload } from "./shop.js";
export type { SkillStatePayload } from "./skills.js";
export type {
  ChopCancelPayload,
  ChopResultPayload,
  ChopStartPayload,
  ResourceHealthPayload,
} from "./resources.js";