import { type CharacterAppearance } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { PhaserGame } from "./game/PhaserGame";
import { networkManager } from "./game/network";
import { clearStoredAccessToken } from "./wallet/tokenGate";
import { useGameStore } from "./store/gameStore";
import { ChatPanel } from "./ui/ChatPanel";
import { HUD } from "./ui/HUD";
import { LoginOverlay } from "./ui/LoginOverlay";
import { InventoryHotkey } from "./ui/InventoryHotkey";
import { InventoryPanel } from "./ui/InventoryPanel";
import { QuestPanel } from "./ui/QuestPanel";
import { ShopPanel } from "./ui/ShopPanel";

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
      setProfile(profile.level, profile.xp, profile.gold);
    });

    const unsubscribeQuestState = networkManager.onQuestState((state) => {
      setQuestState(state);
    });

    const unsubscribeTransfer = networkManager.onTransfer((payload) => {
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
      setShop(payload);
      setShopOpen(true);
      if (payload.gold !== undefined) {
        setPlayerGold(payload.gold);
      }
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
    setJoined(true);
    try {
      await networkManager.connect(name, accessToken, appearance);
      setZoneName(networkManager.zoneName);
    } catch (error) {
      setJoined(false);
      throw error;
    }
  };

  const handleLeave = async () => {
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
    setJoined(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {joined && <PhaserGame />}
      {joined && <HUD onLeave={() => void handleLeave()} />}
      {joined && <QuestPanel />}
      {joined && <InventoryPanel />}
      {joined && <InventoryHotkey />}
      {joined && <ShopPanel />}
      {joined && <ChatPanel />}
      {!joined && <LoginOverlay onJoin={handleJoin} />}
    </div>
  );
}