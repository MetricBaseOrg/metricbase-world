import { useEffect, useState } from "react";
import { PhaserGame } from "./game/PhaserGame";
import { networkManager } from "./game/network";
import { useGameStore } from "./store/gameStore";
import { ChatPanel } from "./ui/ChatPanel";
import { HUD } from "./ui/HUD";
import { LoginOverlay } from "./ui/LoginOverlay";

export function App() {
  const [joined, setJoined] = useState(false);
  const {
    setPlayerName,
    setPlayerLevel,
    setConnected,
    setPlayerCount,
    setZoneName,
    addChatMessage,
    clearChat,
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

    const unsubscribeProfile = networkManager.onProfile((level) => {
      setPlayerLevel(level);
    });

    return () => {
      unsubscribeConnection();
      unsubscribePlayers();
      unsubscribeChat();
      unsubscribeZone();
      unsubscribeProfile();
      networkManager.disconnect();
    };
  }, [addChatMessage, clearChat, setConnected, setPlayerCount, setPlayerLevel, setZoneName]);

  const handleJoin = async (name: string) => {
    setPlayerName(name);
    await networkManager.connect(name);
    setZoneName(networkManager.zoneName);
    setJoined(true);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {joined && <PhaserGame />}
      {joined && <HUD />}
      {joined && <ChatPanel />}
      {!joined && <LoginOverlay onJoin={handleJoin} />}
    </div>
  );
}