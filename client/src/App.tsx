import { type CharacterAppearance } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { initSoundEffects, playSfx } from "./audio/soundEffects";
import { startBackgroundMusic, stopBackgroundMusic } from "./audio/backgroundMusic";
import { startWeatherAmbience, stopWeatherAmbience } from "./audio/weatherAmbience";
import { bindUiTypingFocusGuard, resetMobileInput } from "./game/inputControl";
import { waitForGameSceneReady } from "./game/gameSceneReady";
import { PhaserGame } from "./game/PhaserGame";
import { networkManager } from "./game/network";
import { clearStoredAccessToken, getValidWalletSession } from "./wallet/tokenGate";
import { isAnyPanelOpen, useGameStore } from "./store/gameStore";
import { ChatPanel } from "./ui/ChatPanel";
import { CraftPanel } from "./ui/CraftPanel";
import { EmoteBar } from "./ui/EmoteBar";
import { HousingPanel } from "./ui/HousingPanel";
import { HousingMarketPanel } from "./ui/HousingMarketPanel";
import { PlayerShopPanel } from "./ui/PlayerShopPanel";
import { DeathOverlay } from "./ui/DeathOverlay";
import { TopBar } from "./ui/TopBar";
import { LoginOverlay } from "./ui/LoginOverlay";
import { InventoryHotkey } from "./ui/InventoryHotkey";
import { InventoryPanel } from "./ui/InventoryPanel";
import { SoftShopPanel } from "./ui/SoftShopPanel";
import { BlackjackPanel } from "./ui/BlackjackPanel";
import { WorldMapPanel } from "./ui/WorldMapPanel";
import { MailPanel } from "./ui/MailPanel";
import { AdsPanel } from "./ui/AdsPanel";
import { WorldsPanel } from "./ui/WorldsPanel";
import { WorldEditBar } from "./ui/WorldEditBar";
import { BuildShopPanel } from "./ui/BuildShopPanel";
import { AdBanner } from "./ui/AdBanner";
import { QuestPanel } from "./ui/QuestPanel";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { mentionsLocalPlayer } from "./ui/markdown";
import { initHandDrawnAvatars } from "./character/handDrawnAvatar";
import { resolveZoneConfig } from "./game/playerZoneConfig";
import { ArcadeModal } from "./ui/ArcadeModal";
import { BlackZoneModal } from "./ui/BlackZoneModal";
import { CropMarketPanel } from "./ui/CropMarketPanel";
import { DailyPanel } from "./ui/DailyPanel";
import { JobsPanel } from "./ui/JobsPanel";
import { CompanyPanel } from "./ui/CompanyPanel";
import { AdminPanel } from "./ui/AdminPanel";
import { CatchCelebration } from "./ui/CatchCelebration";
import { FishingMinigame } from "./ui/FishingMinigame";
import { DuelControls } from "./ui/DuelControls";
import { PvpFlagButton } from "./ui/PvpFlagButton";
import { PvpOpponentFrame } from "./ui/PvpOpponentFrame";
import { PlayerProfilePanel } from "./ui/PlayerProfilePanel";
import { VipLodgeModal } from "./ui/VipLodgeModal";
import { ShopPanel } from "./ui/ShopPanel";
import { SiegeBanner } from "./ui/SiegeBanner";
import { SkillBar } from "./ui/SkillBar";
import { TouchControls } from "./ui/TouchControls";
import { WhoPanel } from "./ui/WhoPanel";
import { ZoneBanner } from "./ui/ZoneBanner";
import { LeaderboardPanel } from "./ui/LeaderboardPanel";
import { GuildPanel } from "./ui/GuildPanel";
import { PartyPanel } from "./ui/PartyPanel";
import { InvitationsModal } from "./ui/InvitationsModal";

export function App() {
  const [joined, setJoined] = useState(false);
  const {
    setPlayerName,
    setCharacterAppearance,
    setWalletAddress,
    setConnected,
    setPlayerCount,
    setZoneName,
    addChatMessage,
    clearChat,
    setQuestState,
    setInventory,
    setInventoryOpen,
    setShop,
    setShopOpen,
    setPlayerGold,
    setSkillState,
    invitationsOpen,
    setInvitationsOpen,
    worldEditing,
  } = useGameStore();
  const panelOpen = useGameStore(isAnyPanelOpen);

  const previousLevelRef = useRef(1);
  const previousWoodcuttingLevelRef = useRef(1);
  const previousMiningLevelRef = useRef(1);
  const previousFishingLevelRef = useRef(1);
  const previousFarmingLevelRef = useRef(1);
  const previousCompletedQuestsRef = useRef(0);

  useEffect(() => bindUiTypingFocusGuard(), []);
  useEffect(() => initSoundEffects(), []);
  // Fetch the hand-drawn character manifest early so avatars/portraits know
  // whether PNG frames exist (procedural renderer covers the gap either way).
  useEffect(() => initHandDrawnAvatars(), []);

  useEffect(() => {
    const unsubscribeConnection = networkManager.onConnectionChange((connected, count) => {
      setConnected(connected);
      setPlayerCount(count);
    });

    const unsubscribePlayers = networkManager.onPlayersChange(() => {
      setPlayerCount(networkManager.playerCount);
    });

    const unsubscribeChat = networkManager.onChatMessage((message) => {
      addChatMessage(message);
      // @mention of me → bell notification + chime (not for my own messages).
      const me = useGameStore.getState().playerName;
      if (
        message.channel !== "system" &&
        me &&
        message.senderName !== me &&
        mentionsLocalPlayer(message.body)
      ) {
        useGameStore.getState().addNotification("💬", `${message.senderName} mentioned you in chat`);
        playSfx("notify");
      }
    });

    const unsubscribeZone = networkManager.onZoneChange((zoneId, zoneName) => {
      setZoneName(zoneName);
      useGameStore.getState().setZoneId(zoneId);
      // Resolve the real tier (player zones carry it on their cached config;
      // static zones from ZONE_CONFIGS). Config push updates it again below.
      useGameStore.getState().setZoneDangerTier(resolveZoneConfig(zoneId).dangerTier ?? "safe");
    });

    const applyProfilePatch = useGameStore.getState().applyProfilePatch;

    const unsubscribeProfile = networkManager.onProfile((profile) => {
      if ((profile.level ?? 0) > previousLevelRef.current) {
        playSfx("level_up");
      }
      if (profile.level !== undefined) {
        previousLevelRef.current = profile.level;
      }
      const wasKnockedOut = useGameStore.getState().knockedOut;
      if (profile.knockedOut && !wasKnockedOut) {
        playSfx("knockout");
      }
      applyProfilePatch(profile);
    });

    const unsubscribePlayerDamage = networkManager.onPlayerDamage((payload) => {
      applyProfilePatch({
        level: useGameStore.getState().playerLevel,
        xp: useGameStore.getState().playerXp,
        hp: payload.currentHp,
        maxHp: payload.maxHp,
        knockedOut: payload.knockedOut,
        freeRespawnAt: payload.freeRespawnAt,
      });
    });

    const unsubscribeQuestState = networkManager.onQuestState((state) => {
      if (state.completed.length > previousCompletedQuestsRef.current) {
        playSfx("quest_complete");
      }
      previousCompletedQuestsRef.current = state.completed.length;
      setQuestState(state);
    });

    const unsubscribeTransfer = networkManager.onTransfer((payload) => {
      playSfx("portal");
      addChatMessage({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Portal",
        body: `Traveling through ${payload.label}...`,
        sentAt: Date.now(),
      });
    });

    const unsubscribeInventory = networkManager.onInventoryState((state) => {
      setInventory(state);
    });

    const unsubscribeEquipment = networkManager.onEquipmentState((state) => {
      useGameStore.getState().setEquipment(state);
    });

    const unsubscribeShopOpen = networkManager.onShopOpen((payload) => {
      playSfx("ui_open");
      setShop(payload);
      setShopOpen(true);
    });

    const unsubscribeBlackjack = networkManager.onOpenBlackjack(() => {
      playSfx("ui_open");
      useGameStore.getState().setBlackjackOpen(true);
    });

    let lastMailUnread: number | null = null;
    const unsubscribeMail = networkManager.onMailState((mailState) => {
      useGameStore.getState().setMailUnread(mailState.unread);
      // Bell: unread mail on login, and every new arrival after that.
      if (lastMailUnread === null) {
        if (mailState.unread > 0) {
          useGameStore.getState().addNotification("📬", `${mailState.unread} unread mail in your inbox`);
        }
      } else if (mailState.unread > lastMailUnread) {
        useGameStore.getState().addNotification("📬", "New mail arrived");
        playSfx("notify");
      }
      lastMailUnread = mailState.unread;
    });
    networkManager.requestMailState();

    const unsubscribeSkillState = networkManager.onSkillState((state) => {
      const mining = state.mining ?? { level: 1, xp: 0 };
      const fishing = state.fishing ?? { level: 1, xp: 0 };
      const farming = state.farming ?? { level: 1, xp: 0 };
      if (
        state.woodcutting.level > previousWoodcuttingLevelRef.current ||
        mining.level > previousMiningLevelRef.current ||
        fishing.level > previousFishingLevelRef.current ||
        farming.level > previousFarmingLevelRef.current
      ) {
        playSfx("skill_level_up");
      }
      previousWoodcuttingLevelRef.current = state.woodcutting.level;
      previousMiningLevelRef.current = mining.level;
      previousFishingLevelRef.current = fishing.level;
      previousFarmingLevelRef.current = farming.level;
      setSkillState(
        state.woodcutting.level,
        state.woodcutting.xp,
        mining.level,
        mining.xp,
        fishing.level,
        fishing.xp,
        farming.level,
        farming.xp,
      );
    });

    const unsubscribeNpcDialogue = networkManager.onNpcDialogue((npcName, dialogue) => {
      addChatMessage({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "npc",
        senderName: npcName,
        body: dialogue,
        sentAt: Date.now(),
      });
    });

    const unsubscribeHousingState = networkManager.onHousingState((state) => {
      useGameStore.getState().setHousingPlots(state.plots);
    });

    return () => {
      unsubscribeHousingState();
      unsubscribeConnection();
      unsubscribePlayers();
      unsubscribeChat();
      unsubscribeZone();
      unsubscribeProfile();
      unsubscribePlayerDamage();
      unsubscribeQuestState();
      unsubscribeTransfer();
      unsubscribeInventory();
      unsubscribeEquipment();
      unsubscribeShopOpen();
      unsubscribeBlackjack();
      unsubscribeMail();
      unsubscribeNpcDialogue();
      unsubscribeSkillState();
      void networkManager.disconnect();
    };
  }, [
    addChatMessage,
    clearChat,
    setConnected,
    setInventory,
    setPlayerGold,
    setPlayerCount,
    setShop,
    setShopOpen,
    setQuestState,
    setZoneName,
    setSkillState,
  ]);

  const handleJoin = async (
    name: string,
    accessToken: string | null | undefined,
    appearance: CharacterAppearance,
    inviteCode?: string,
    spectate?: boolean,
  ) => {
    useGameStore.getState().setSpectator(spectate || false);
    setPlayerName(name);
    setCharacterAppearance(appearance);

    let token = accessToken ?? null;
    if (!token) {
      const session = await getValidWalletSession();
      if (session) {
        token = session.accessToken;
        setWalletAddress(session.wallet);
      }
    } else {
      const session = await getValidWalletSession();
      if (session) {
        setWalletAddress(session.wallet);
      }
    }

    if (token) {
      networkManager.setAccessToken(token);
    }

    setJoined(true);
    startBackgroundMusic();
    startWeatherAmbience();

    try {
      await waitForGameSceneReady();
      await networkManager.connect(name, token, appearance, inviteCode, spectate);
      setZoneName(networkManager.zoneName);
      // Adopt the server's authoritative name: joins can be renamed (wallet
      // bonded to a different character; spectators get a Guest#### handle).
      // Retry once — the first state patch can land just after connect().
      const adoptName = () => {
        const authoritative = networkManager.getLocalPlayerFromState()?.name;
        if (authoritative && authoritative !== useGameStore.getState().playerName) {
          setPlayerName(authoritative);
        }
      };
      adoptName();
      window.setTimeout(adoptName, 1500);
      // Learn whether this wallet is an admin (server-verified); the reply
      // sets store.isAdmin via AdminPanel's listener and unlocks the 🛡️ menu.
      if (!spectate) networkManager.requestAdminBanList();
    } catch (error) {
      setJoined(false);
      stopBackgroundMusic();
      stopWeatherAmbience();
      throw error;
    }
  };

  const handleLeave = async () => {
    stopBackgroundMusic();
    stopWeatherAmbience();
    resetMobileInput();
    previousLevelRef.current = 1;
    previousWoodcuttingLevelRef.current = 1;
    previousCompletedQuestsRef.current = 0;
    await networkManager.disconnect();
    clearChat();
    clearStoredAccessToken();
    setWalletAddress(null);
    setCharacterAppearance(null);
    setQuestState({ active: [], completed: [] });
    setInventory({ items: [], capacity: 16 });
    setInventoryOpen(false);
    setShop(null);
    setShopOpen(false);
    setPlayerGold(0);
    const store = useGameStore.getState();
    store.setCraftOpen(false);
    store.setHousingOpen(false);
    store.setHousingPlots([]);
    store.setPlayerShopOpen(false);
    store.setPlayerVitals(40, 40);
    store.setProfile(store.playerLevel, store.playerXp, 0, 40, 40, null, false, null);
    store.setSkillState(1, 0, 1, 0, 1, 0, 1, 0);
    previousMiningLevelRef.current = 1;
    previousFishingLevelRef.current = 1;
    previousFarmingLevelRef.current = 1;
    setJoined(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {joined && <PhaserGame />}
      {joined && <TopBar onLeave={() => void handleLeave()} />}
      {joined && <QuestPanel />}
      {joined && <InventoryPanel />}
      {joined && <CraftPanel />}
      {joined && <SoftShopPanel />}
      {joined && <BlackjackPanel />}
      {joined && <WorldMapPanel />}
      {joined && <MailPanel />}
      {joined && <AdsPanel />}
      {joined && <AdBanner />}
      {joined && <WorldsPanel />}
      {joined && <BuildShopPanel />}
      {joined && <WorldEditBar />}
      {joined && <HousingPanel />}
      {joined && <HousingMarketPanel />}
      {joined && <PlayerShopPanel />}
      {joined && <InventoryHotkey />}
      {joined && (
        <ErrorBoundary label="Shop">
          <ShopPanel />
        </ErrorBoundary>
      )}
      {joined && <ChatPanel />}
      {joined && !worldEditing && (
        <div className="chibi-social-rail">
          <GuildPanel />
          <PartyPanel />
          <LeaderboardPanel />
          <WhoPanel />
        </div>
      )}
      {joined && <ZoneBanner />}
      {joined && <ArcadeModal />}
      {joined && <BlackZoneModal />}
      {joined && <VipLodgeModal />}
      {joined && <CropMarketPanel />}
      {joined && <DailyPanel />}
      {joined && <JobsPanel />}
      {joined && <CompanyPanel />}
      {joined && <AdminPanel />}
      {joined && <FishingMinigame />}
      {joined && <CatchCelebration />}
      {joined && !worldEditing && !panelOpen && <PvpFlagButton />}
      {joined && !worldEditing && !panelOpen && <DuelControls />}
      {joined && <PvpOpponentFrame />}
      {joined && <PlayerProfilePanel />}
      {joined && <SiegeBanner />}
      {joined && !worldEditing && <SkillBar />}
      {joined && !worldEditing && !panelOpen && <EmoteBar />}
      {joined && <TouchControls />}
      {joined && <DeathOverlay />}
      {joined && invitationsOpen && <InvitationsModal onClose={() => setInvitationsOpen(false)} />}
      {!joined && <LoginOverlay onJoin={handleJoin} />}
    </div>
  );
}