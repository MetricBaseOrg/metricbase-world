import { type CharacterAppearance } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { initSoundEffects, playSfx } from "./audio/soundEffects";
import { bindUiTypingFocusGuard, resetMobileInput } from "./game/inputControl";
import { PhaserGame } from "./game/PhaserGame";
import { networkManager } from "./game/network";
import { clearStoredAccessToken, getValidWalletSession } from "./wallet/tokenGate";
import { useGameStore } from "./store/gameStore";
import { ChatPanel } from "./ui/ChatPanel";
import { HUD } from "./ui/HUD";
import { LoginOverlay } from "./ui/LoginOverlay";
import { InventoryHotkey } from "./ui/InventoryHotkey";
import { InventoryPanel } from "./ui/InventoryPanel";
import { QuestPanel } from "./ui/QuestPanel";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { ShopPanel } from "./ui/ShopPanel";
import { TouchControls } from "./ui/TouchControls";

export function App() {
  const [joined, setJoined] = useState(false);
  const {
    setPlayerName,
    setCharacterAppearance,
    setProfile,
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
  } = useGameStore();

  const previousLevelRef = useRef(1);
  const previousCompletedQuestsRef = useRef(0);

  useEffect(() => bindUiTypingFocusGuard(), []);
  useEffect(() => initSoundEffects(), []);

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
    });

    const unsubscribeZone = networkManager.onZoneChange((_zoneId, zoneName) => {
      setZoneName(zoneName);
    });

    const unsubscribeProfile = networkManager.onProfile((profile) => {
      if (profile.level > previousLevelRef.current) {
        playSfx("level_up");
      }
      previousLevelRef.current = profile.level;
      setProfile(
        profile.level,
        profile.xp,
        profile.gold,
        profile.hp,
        profile.maxHp,
        profile.equippedWeaponId,
      );
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

    const unsubscribeShopOpen = networkManager.onShopOpen((payload) => {
      playSfx("ui_open");
      setShop(payload);
      setShopOpen(true);
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

    return () => {
      unsubscribeConnection();
      unsubscribePlayers();
      unsubscribeChat();
      unsubscribeZone();
      unsubscribeProfile();
      unsubscribeQuestState();
      unsubscribeTransfer();
      unsubscribeInventory();
      unsubscribeShopOpen();
      unsubscribeNpcDialogue();
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
    setProfile,
    setQuestState,
    setZoneName,
  ]);

  const handleJoin = async (
    name: string,
    accessToken: string | null | undefined,
    appearance: CharacterAppearance,
  ) => {
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
    try {
      await networkManager.connect(name, token, appearance);
      setZoneName(networkManager.zoneName);
    } catch (error) {
      setJoined(false);
      throw error;
    }
  };

  const handleLeave = async () => {
    resetMobileInput();
    previousLevelRef.current = 1;
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
    store.setPlayerVitals(40, 40);
    store.setProfile(store.playerLevel, store.playerXp, 0, 40, 40, null);
    setJoined(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {joined && <PhaserGame />}
      {joined && <HUD onLeave={() => void handleLeave()} />}
      {joined && <QuestPanel />}
      {joined && <InventoryPanel />}
      {joined && <InventoryHotkey />}
      {joined && (
        <ErrorBoundary label="Shop">
          <ShopPanel />
        </ErrorBoundary>
      )}
      {joined && <ChatPanel />}
      {joined && <TouchControls />}
      {!joined && <LoginOverlay onJoin={handleJoin} />}
    </div>
  );
}