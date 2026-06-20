export interface ChatMessagePayload {
  id: string;
  channel: "zone" | "system";
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
  zoneId: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  found: boolean;
  appearance: CharacterAppearance;
}

export interface InteractPayload {
  npcId: string;
}

export interface ProfilePayload {
  level: number;
  xp: number;
}

export type { QuestStatePayload } from "./quests.js";
export type { AttackResultPayload, MobHealthPayload } from "./combat.js";