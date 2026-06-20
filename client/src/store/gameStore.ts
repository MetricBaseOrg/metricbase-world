import {
  ChatMessagePayload,
  QuestStatePayload,
  type CharacterAppearance,
  type InventoryStatePayload,
} from "@metricbase/shared";
import { create } from "zustand";

interface GameStore {
  playerName: string;
  characterAppearance: CharacterAppearance | null;
  playerLevel: number;
  playerXp: number;
  walletAddress: string | null;
  connected: boolean;
  playerCount: number;
  zoneName: string;
  chatMessages: ChatMessagePayload[];
  questState: QuestStatePayload;
  inventory: InventoryStatePayload;
  inventoryOpen: boolean;
  setPlayerName: (name: string) => void;
  setCharacterAppearance: (appearance: CharacterAppearance | null) => void;
  setPlayerLevel: (level: number) => void;
  setPlayerXp: (xp: number) => void;
  setProfile: (level: number, xp: number) => void;
  setWalletAddress: (wallet: string | null) => void;
  setConnected: (connected: boolean) => void;
  setPlayerCount: (count: number) => void;
  setZoneName: (zoneName: string) => void;
  addChatMessage: (message: ChatMessagePayload) => void;
  clearChat: () => void;
  setQuestState: (questState: QuestStatePayload) => void;
  setInventory: (inventory: InventoryStatePayload) => void;
  setInventoryOpen: (open: boolean) => void;
  toggleInventoryOpen: () => void;
}

const MAX_CHAT_MESSAGES = 100;

export const useGameStore = create<GameStore>((set) => ({
  playerName: "Traveler",
  characterAppearance: null,
  playerLevel: 1,
  playerXp: 0,
  walletAddress: null,
  connected: false,
  playerCount: 0,
  zoneName: "MetricBase Hub",
  chatMessages: [],
  questState: { active: [], completed: [] },
  inventory: { items: [], capacity: 16 },
  inventoryOpen: false,
  setPlayerName: (name) => set({ playerName: name }),
  setCharacterAppearance: (characterAppearance) => set({ characterAppearance }),
  setPlayerLevel: (level) => set({ playerLevel: level }),
  setPlayerXp: (xp) => set({ playerXp: xp }),
  setProfile: (level, xp) => set({ playerLevel: level, playerXp: xp }),
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setConnected: (connected) => set({ connected }),
  setPlayerCount: (count) => set({ playerCount: count }),
  setZoneName: (zoneName) => set({ zoneName }),
  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message].slice(-MAX_CHAT_MESSAGES),
    })),
  clearChat: () => set({ chatMessages: [] }),
  setQuestState: (questState) => set({ questState }),
  setInventory: (inventory) => set({ inventory }),
  setInventoryOpen: (inventoryOpen) => set({ inventoryOpen }),
  toggleInventoryOpen: () => set((state) => ({ inventoryOpen: !state.inventoryOpen })),
}));