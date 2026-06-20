import { useEffect, useState } from "react";
import { PhaserGame } from "./game/PhaserGame";
import { networkManager } from "./game/network";
import { useGameStore } from "./store/gameStore";
import { ChatPanel } from "./ui/ChatPanel";
import { HUD } from "./ui/HUD";
import { LoginOverlay } from "./ui/LoginOverlay";
import { QuestPanel } from "./ui/QuestPanel";

export function App() {
  const [joined, setJoined] = useState(false);
  const {
    setPlayerName,
    setProfile,
    setConnected,
    setPlayerCount,
    setZoneName,
    addChatMessage,
    clearChat,
    setQuestState,
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
      clearChat();
    });

    const unsubscribeProfile = networkManager.onProfile((profile) => {
      setProfile(profile.level, profile.xp);
    });

    const unsubscribeQuestState = networkManager.onQuestState((state) => {
      setQuestState(state);
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
      unsubscribeNpcDialogue();
      void networkManager.disconnect();
    };
  }, [addChatMessage, clearChat, setConnected, setPlayerCount, setProfile, setQuestState, setZoneName]);

  const handleJoin = async (name: string) => {
    setPlayerName(name);
    setJoined(true);
    try {
      await networkManager.connect(name);
      setZoneName(networkManager.zoneName);
    } catch (error) {
      setJoined(false);
      throw error;
    }
  };

  const handleLeave = async () => {
    await networkManager.disconnect();
    clearChat();
    setQuestState({ active: [], completed: [] });
    setJoined(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {joined && <PhaserGame />}
      {joined && <HUD onLeave={() => void handleLeave()} />}
      {joined && <QuestPanel />}
      {joined && <ChatPanel />}
      {!joined && <LoginOverlay onJoin={handleJoin} />}
    </div>
  );
}