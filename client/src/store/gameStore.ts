import {
  ChatMessagePayload,
  ProfilePayload,
  QuestStatePayload,
  type CharacterAppearance,
  type InventoryStatePayload,
  type LandPlotState,
  type ShopOpenPayload,
} from "@metricbase/shared";
import { create } from "zustand";

interface GameStore {
  playerName: string;
  characterAppearance: CharacterAppearance | null;
  playerLevel: number;
  playerXp: number;
  woodcuttingLevel: number;
  woodcuttingXp: number;
  miningLevel: number;
  miningXp: number;
  fishingLevel: number;
  fishingXp: number;
  farmingLevel: number;
  farmingXp: number;
  playerGold: number;
  playerHp: number;
  playerMaxHp: number;
  playerStamina: number;
  playerMaxStamina: number;
  knockedOut: boolean;
  freeRespawnAt: number | null;
  equippedWeaponId: string | null;
  equippedToolId: string | null;
  lampOn: boolean;
  walletAddress: string | null;
  connected: boolean;
  playerCount: number;
  zoneName: string;
  chatMessages: ChatMessagePayload[];
  questState: QuestStatePayload;
  inventory: InventoryStatePayload;
  inventoryOpen: boolean;
  craftOpen: boolean;
  housingOpen: boolean;
  housingPlotId: string | null;
  housingPlots: LandPlotState[];
  playerShopOpen: boolean;
  playerShopPlotId: string | null;
  shop: ShopOpenPayload | null;
  shopOpen: boolean;
  setPlayerName: (name: string) => void;
  setCharacterAppearance: (appearance: CharacterAppearance | null) => void;
  setPlayerLevel: (level: number) => void;
  setPlayerXp: (xp: number) => void;
  setSkillState: (
    woodcuttingLevel: number,
    woodcuttingXp: number,
    miningLevel?: number,
    miningXp?: number,
    fishingLevel?: number,
    fishingXp?: number,
    farmingLevel?: number,
    farmingXp?: number,
  ) => void;
  setProfile: (
    level: number,
    xp: number,
    gold?: number,
    hp?: number,
    maxHp?: number,
    equippedWeaponId?: string | null,
    knockedOut?: boolean,
    freeRespawnAt?: number | null,
  ) => void;
  applyProfilePatch: (profile: Partial<ProfilePayload>) => void;
  setPlayerGold: (gold: number) => void;
  setPlayerVitals: (hp: number, maxHp: number) => void;
  setLampOn: (on: boolean) => void;
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
  setCraftOpen: (open: boolean) => void;
  toggleCraftOpen: () => void;
  openHousing: (plotId: string) => void;
  setHousingOpen: (open: boolean) => void;
  setHousingPlots: (plots: LandPlotState[]) => void;
  openPlayerShop: (plotId: string) => void;
  setPlayerShopOpen: (open: boolean) => void;
  setShop: (shop: ShopOpenPayload | null) => void;
  setShopOpen: (open: boolean) => void;
}

const MAX_CHAT_MESSAGES = 100;

export const useGameStore = create<GameStore>((set) => ({
  playerName: "Traveler",
  characterAppearance: null,
  playerLevel: 1,
  playerXp: 0,
  woodcuttingLevel: 1,
  woodcuttingXp: 0,
  miningLevel: 1,
  miningXp: 0,
  fishingLevel: 1,
  fishingXp: 0,
  farmingLevel: 1,
  farmingXp: 0,
  playerGold: 0,
  playerHp: 40,
  playerMaxHp: 40,
  playerStamina: 100,
  playerMaxStamina: 100,
  knockedOut: false,
  freeRespawnAt: null,
  equippedWeaponId: null,
  equippedToolId: null,
  lampOn: false,
  walletAddress: null,
  connected: false,
  playerCount: 0,
  zoneName: "MetricBase Hub",
  chatMessages: [],
  questState: { active: [], completed: [] },
  inventory: { items: [], capacity: 16 },
  inventoryOpen: false,
  craftOpen: false,
  housingOpen: false,
  housingPlotId: null,
  housingPlots: [],
  playerShopOpen: false,
  playerShopPlotId: null,
  shop: null,
  shopOpen: false,
  setPlayerName: (name) => set({ playerName: name }),
  setCharacterAppearance: (characterAppearance) => set({ characterAppearance }),
  setPlayerLevel: (level) => set({ playerLevel: level }),
  setPlayerXp: (xp) => set({ playerXp: xp }),
  setSkillState: (
    woodcuttingLevel,
    woodcuttingXp,
    miningLevel,
    miningXp,
    fishingLevel,
    fishingXp,
    farmingLevel,
    farmingXp,
  ) =>
    set((state) => ({
      woodcuttingLevel,
      woodcuttingXp,
      miningLevel: miningLevel ?? state.miningLevel,
      miningXp: miningXp ?? state.miningXp,
      fishingLevel: fishingLevel ?? state.fishingLevel,
      fishingXp: fishingXp ?? state.fishingXp,
      farmingLevel: farmingLevel ?? state.farmingLevel,
      farmingXp: farmingXp ?? state.farmingXp,
    })),
  setProfile: (level, xp, gold, hp, maxHp, equippedWeaponId, knockedOut, freeRespawnAt) =>
    set((state) => ({
      playerLevel: level,
      playerXp: xp,
      playerGold: gold ?? state.playerGold,
      playerHp: hp ?? state.playerHp,
      playerMaxHp: maxHp ?? state.playerMaxHp,
      knockedOut: knockedOut !== undefined ? knockedOut : state.knockedOut,
      freeRespawnAt: freeRespawnAt !== undefined ? freeRespawnAt : state.freeRespawnAt,
      equippedWeaponId:
        equippedWeaponId !== undefined ? equippedWeaponId : state.equippedWeaponId,
    })),
  applyProfilePatch: (profile) =>
    set((state) => ({
      playerLevel: profile.level ?? state.playerLevel,
      playerXp: profile.xp ?? state.playerXp,
      playerGold: profile.gold ?? state.playerGold,
      playerHp: profile.hp ?? state.playerHp,
      playerMaxHp: profile.maxHp ?? state.playerMaxHp,
      playerStamina: profile.stamina ?? state.playerStamina,
      playerMaxStamina: profile.maxStamina ?? state.playerMaxStamina,
      knockedOut:
        profile.knockedOut !== undefined ? profile.knockedOut : state.knockedOut,
      freeRespawnAt:
        profile.freeRespawnAt !== undefined ? profile.freeRespawnAt : state.freeRespawnAt,
      equippedWeaponId:
        profile.equippedWeaponId !== undefined ? profile.equippedWeaponId : state.equippedWeaponId,
      equippedToolId:
        profile.equippedToolId !== undefined ? profile.equippedToolId : state.equippedToolId,
    })),
  setPlayerGold: (playerGold) => set({ playerGold }),
  setPlayerVitals: (playerHp, playerMaxHp) => set({ playerHp, playerMaxHp }),
  setLampOn: (lampOn) => set({ lampOn }),
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
  setInventoryOpen: (inventoryOpen) => set({ inventoryOpen, craftOpen: false }),
  toggleInventoryOpen: () =>
    set((state) => ({ inventoryOpen: !state.inventoryOpen, craftOpen: false })),
  setCraftOpen: (craftOpen) => set({ craftOpen, inventoryOpen: false }),
  toggleCraftOpen: () => set((state) => ({ craftOpen: !state.craftOpen, inventoryOpen: false })),
  openHousing: (housingPlotId) =>
    set({ housingPlotId, housingOpen: true, inventoryOpen: false, craftOpen: false }),
  setHousingOpen: (housingOpen) => set({ housingOpen }),
  setHousingPlots: (housingPlots) => set({ housingPlots }),
  openPlayerShop: (playerShopPlotId) =>
    set({
      playerShopPlotId,
      playerShopOpen: true,
      housingOpen: false,
      inventoryOpen: false,
      craftOpen: false,
    }),
  setPlayerShopOpen: (playerShopOpen) => set({ playerShopOpen }),
  setShop: (shop) => set({ shop }),
  setShopOpen: (shopOpen) => set({ shopOpen }),
}));