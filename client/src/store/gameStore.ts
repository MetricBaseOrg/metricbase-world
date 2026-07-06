import {
  ChatMessagePayload,
  ProfilePayload,
  QuestStatePayload,
  type CharacterAppearance,
  type EquipmentStatePayload,
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
  honor: number;
  guildCoin: number;
  gems: number;
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
  zoneId: string;
  /** Currently left-click-targeted player (for duel challenges), or null. */
  selectedPlayer: string | null;
  chatMessages: ChatMessagePayload[];
  questState: QuestStatePayload;
  inventory: InventoryStatePayload;
  equipment: EquipmentStatePayload | null;
  inventoryOpen: boolean;
  craftOpen: boolean;
  honorShopOpen: boolean;
  blackjackOpen: boolean;
  mapOpen: boolean;
  mailOpen: boolean;
  mailUnread: number;
  adsOpen: boolean;
  worldsOpen: boolean;
  buildShopOpen: boolean;
  /** Crop-market prop id ("market-wheat"/"market-carrot") while trading, else null. */
  cropMarketOpen: string | null;
  dailyOpen: boolean;
  /** Player-to-player job board. */
  jobsOpen: boolean;
  /** The mobile chat SHEET (desktop's corner chat panel never sets this). */
  chatOpen: boolean;
  /** The ⚙️ TopBar settings dropdown. */
  settingsOpen: boolean;
  /** Active fishing catch-minigame (null when not fishing). */
  fishing: { resourceId: string; endsAt: number } | null;
  /** Last landed fish (drives the catch celebration overlay). */
  lastCatch: { itemId: string; rarity: string; quantity: number; at: number } | null;
  /** One-shot fishing moments the game scene animates (bite ❗, splashes…). */
  fishingFx: { type: "bite" | "hit" | "catch" | "escape"; at: number } | null;
  /** Current PvP opponent (duel or recent hits) — drives the target frame. */
  pvpOpponent: { name: string; until: number; duel: boolean } | null;
  /** Notification centre (🔔): mentions, mail, invites. Newest first. */
  notifications: { id: string; icon: string; text: string; at: number; read: boolean }[];
  /** True while the player is actively editing a World (hides gameplay HUD). */
  worldEditing: boolean;
  housingOpen: boolean;
  housingPlotId: string | null;
  housingPlots: LandPlotState[];
  playerShopOpen: boolean;
  playerShopPlotId: string | null;
  shop: ShopOpenPayload | null;
  shopOpen: boolean;
  invitationsOpen: boolean;
  spectator: boolean;
  setInvitationsOpen: (open: boolean) => void;
  setSpectator: (spectator: boolean) => void;
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
  setZoneId: (zoneId: string) => void;
  setSelectedPlayer: (name: string | null) => void;
  addChatMessage: (message: ChatMessagePayload) => void;
  clearChat: () => void;
  setQuestState: (questState: QuestStatePayload) => void;
  setInventory: (inventory: InventoryStatePayload) => void;
  setEquipment: (equipment: EquipmentStatePayload | null) => void;
  setInventoryOpen: (open: boolean) => void;
  toggleInventoryOpen: () => void;
  setCraftOpen: (open: boolean) => void;
  toggleCraftOpen: () => void;
  setHonorShopOpen: (open: boolean) => void;
  setBlackjackOpen: (open: boolean) => void;
  setMapOpen: (open: boolean) => void;
  setMailOpen: (open: boolean) => void;
  setMailUnread: (n: number) => void;
  setAdsOpen: (open: boolean) => void;
  setWorldsOpen: (open: boolean) => void;
  setBuildShopOpen: (open: boolean) => void;
  setCropMarketOpen: (market: string | null) => void;
  setDailyOpen: (open: boolean) => void;
  setJobsOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setFishing: (fishing: { resourceId: string; endsAt: number } | null) => void;
  setLastCatch: (c: { itemId: string; rarity: string; quantity: number; at: number } | null) => void;
  setFishingFx: (fx: { type: "bite" | "hit" | "catch" | "escape"; at: number } | null) => void;
  setPvpOpponent: (o: { name: string; until: number; duel: boolean } | null) => void;
  addNotification: (icon: string, text: string) => void;
  markNotificationsRead: () => void;
  setWorldEditing: (editing: boolean) => void;
  openHousing: (plotId: string) => void;
  setHousingOpen: (open: boolean) => void;
  setHousingPlots: (plots: LandPlotState[]) => void;
  openPlayerShop: (plotId: string) => void;
  setPlayerShopOpen: (open: boolean) => void;
  setShop: (shop: ShopOpenPayload | null) => void;
  setShopOpen: (open: boolean) => void;
}

const MAX_CHAT_MESSAGES = 100;

/**
 * True while any modal/panel overlay is open. HUD chrome (zone pill, combat
 * hotbar, touch pads, emote bar) consults THIS instead of maintaining its own
 * flag list, so new panels can never be covered by stale HUD again.
 */
export function isAnyPanelOpen(s: GameStore): boolean {
  return (
    s.inventoryOpen ||
    s.craftOpen ||
    s.honorShopOpen ||
    s.blackjackOpen ||
    s.mapOpen ||
    s.mailOpen ||
    s.adsOpen ||
    s.worldsOpen ||
    s.buildShopOpen ||
    s.dailyOpen ||
    s.jobsOpen ||
    s.chatOpen ||
    s.settingsOpen ||
    s.housingOpen ||
    s.playerShopOpen ||
    s.shopOpen ||
    s.invitationsOpen ||
    s.cropMarketOpen !== null
  );
}

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
  honor: 0,
  guildCoin: 0,
  gems: 0,
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
  zoneId: "zone_hub",
  selectedPlayer: null,
  chatMessages: [],
  questState: { active: [], completed: [] },
  inventory: { items: [], capacity: 16 },
  equipment: null,
  inventoryOpen: false,
  craftOpen: false,
  honorShopOpen: false,
  blackjackOpen: false,
  mapOpen: false,
  mailOpen: false,
  mailUnread: 0,
  adsOpen: false,
  worldsOpen: false,
  buildShopOpen: false,
  cropMarketOpen: null,
  dailyOpen: false,
  jobsOpen: false,
  chatOpen: false,
  settingsOpen: false,
  fishing: null,
  lastCatch: null,
  fishingFx: null,
  pvpOpponent: null,
  notifications: [],
  worldEditing: false,
  housingOpen: false,
  housingPlotId: null,
  housingPlots: [],
  playerShopOpen: false,
  playerShopPlotId: null,
  shop: null,
  shopOpen: false,
  invitationsOpen: false,
  spectator: false,
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
      honor: profile.honor ?? state.honor,
      guildCoin: profile.guildCoin ?? state.guildCoin,
      gems: profile.gems ?? state.gems,
    })),
  setPlayerGold: (playerGold) => set({ playerGold }),
  setPlayerVitals: (playerHp, playerMaxHp) => set({ playerHp, playerMaxHp }),
  setLampOn: (lampOn) => set({ lampOn }),
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setConnected: (connected) => set({ connected }),
  setPlayerCount: (count) => set({ playerCount: count }),
  setZoneName: (zoneName) => set({ zoneName }),
  setZoneId: (zoneId) => set({ zoneId }),
  setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),
  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message].slice(-MAX_CHAT_MESSAGES),
    })),
  clearChat: () => set({ chatMessages: [] }),
  setQuestState: (questState) => set({ questState }),
  setInventory: (inventory) => set({ inventory }),
  setEquipment: (equipment) => set({ equipment }),
  setInventoryOpen: (inventoryOpen) => set({ inventoryOpen, craftOpen: false }),
  toggleInventoryOpen: () =>
    set((state) => ({ inventoryOpen: !state.inventoryOpen, craftOpen: false })),
  setCraftOpen: (craftOpen) => set({ craftOpen, inventoryOpen: false }),
  toggleCraftOpen: () => set((state) => ({ craftOpen: !state.craftOpen, inventoryOpen: false })),
  setHonorShopOpen: (honorShopOpen) => set({ honorShopOpen }),
  setBlackjackOpen: (blackjackOpen) => set({ blackjackOpen }),
  setMapOpen: (mapOpen) => set({ mapOpen }),
  setMailOpen: (mailOpen) => set({ mailOpen }),
  setMailUnread: (mailUnread) => set({ mailUnread }),
  setAdsOpen: (adsOpen) => set({ adsOpen }),
  setWorldsOpen: (worldsOpen) => set({ worldsOpen }),
  setBuildShopOpen: (buildShopOpen) => set({ buildShopOpen }),
  setCropMarketOpen: (cropMarketOpen) => set({ cropMarketOpen }),
  setDailyOpen: (dailyOpen) => set({ dailyOpen }),
  setJobsOpen: (jobsOpen) => set({ jobsOpen }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setFishing: (fishing) => set({ fishing }),
  setLastCatch: (lastCatch) => set({ lastCatch }),
  setFishingFx: (fishingFx) => set({ fishingFx }),
  setPvpOpponent: (pvpOpponent) => set({ pvpOpponent }),
  addNotification: (icon, text) =>
    set((state) => ({
      notifications: [
        { id: crypto.randomUUID(), icon, text, at: Date.now(), read: false },
        ...state.notifications,
      ].slice(0, 30),
    })),
  markNotificationsRead: () =>
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) })),
  setWorldEditing: (worldEditing) => set({ worldEditing }),
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
  setInvitationsOpen: (invitationsOpen) => set({ invitationsOpen }),
  setSpectator: (spectator) => set({ spectator }),
}));