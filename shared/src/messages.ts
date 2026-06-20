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

export interface JoinOptions {
  name: string;
  zoneId?: string;
}

export interface CharacterLookupResponse {
  name: string;
  zoneId: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  found: boolean;
}

export interface InteractPayload {
  npcId: string;
}

export interface ProfilePayload {
  level: number;
  xp: number;
}