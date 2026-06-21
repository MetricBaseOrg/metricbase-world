// Emotes: lightweight social expression. A player triggers an emote and a
// bubble pops above their avatar for everyone in the zone to see.

export interface EmoteDef {
  id: string;
  emoji: string;
  label: string;
}

export const EMOTES: EmoteDef[] = [
  { id: "wave", emoji: "👋", label: "Wave" },
  { id: "love", emoji: "❤️", label: "Love" },
  { id: "laugh", emoji: "😂", label: "Laugh" },
  { id: "yes", emoji: "👍", label: "Nice" },
  { id: "party", emoji: "🎉", label: "Party" },
  { id: "wow", emoji: "✨", label: "Wow" },
  { id: "sad", emoji: "😢", label: "Sad" },
  { id: "trade", emoji: "🪙", label: "Trade?" },
];

export const EMOTE_DURATION_MS = 2200;
export const EMOTE_COOLDOWN_MS = 600;

export interface EmotePayload {
  playerName: string;
  emoteId: string;
}

export function getEmote(id: string): EmoteDef | undefined {
  return EMOTES.find((emote) => emote.id === id);
}
