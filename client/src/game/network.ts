import { Client, Room } from "colyseus.js";
import {
  CharacterLookupResponse,
  ChatMessagePayload,
  getZoneConfig,
  JoinOptions,
  ZONE_HUB,
  ZoneTransferPayload,
} from "@metricbase/shared";
import { getHttpServerUrl, getWebSocketUrl } from "./serverUrl";

export interface RemotePlayer {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  level: number;
}

type ConnectionListener = (connected: boolean, playerCount: number) => void;
type PlayersListener = (players: RemotePlayer[], localSessionId: string | null) => void;
type ChatListener = (message: ChatMessagePayload) => void;
type ZoneListener = (zoneId: string, zoneName: string) => void;
type TransferListener = (payload: ZoneTransferPayload) => void;
type ProfileListener = (level: number) => void;

export class NetworkManager {
  private client: Client | null = null;
  private room: Room | null = null;
  private playerName = "Traveler";
  private currentZoneId = ZONE_HUB;
  private connectionListeners = new Set<ConnectionListener>();
  private playersListeners = new Set<PlayersListener>();
  private chatListeners = new Set<ChatListener>();
  private zoneListeners = new Set<ZoneListener>();
  private transferListeners = new Set<TransferListener>();
  private profileListeners = new Set<ProfileListener>();

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get playerCount(): number {
    return this.room?.state.players.size ?? 0;
  }

  get zoneId(): string {
    return this.currentZoneId;
  }

  get zoneName(): string {
    return getZoneConfig(this.currentZoneId).displayName;
  }

  async lookupCharacter(name: string): Promise<CharacterLookupResponse> {
    const response = await fetch(
      `${getHttpServerUrl()}/api/character?name=${encodeURIComponent(name)}`,
    );

    if (!response.ok) {
      throw new Error("Failed to look up character");
    }

    return response.json() as Promise<CharacterLookupResponse>;
  }

  async connect(playerName: string): Promise<void> {
    this.playerName = playerName;

    let zoneId = ZONE_HUB;
    try {
      const saved = await this.lookupCharacter(playerName);
      zoneId = saved.zoneId;
      for (const listener of this.profileListeners) {
        listener(saved.level);
      }
    } catch {
      for (const listener of this.profileListeners) {
        listener(1);
      }
    }

    this.currentZoneId = zoneId;
    await this.joinZone(zoneId);
  }

  async transferToZone(targetZone: string): Promise<void> {
    if (!this.client) return;
    await this.leaveCurrentRoom();
    this.currentZoneId = targetZone;
    await this.joinZone(targetZone);
  }

  sendInput(dx: number, dy: number) {
    this.room?.send("input", { dx, dy });
  }

  sendChat(body: string) {
    this.room?.send("chat", { body });
  }

  disconnect() {
    void this.leaveCurrentRoom();
    this.client = null;
    this.emitConnection(false, 0);
    this.emitPlayers();
  }

  onConnectionChange(listener: ConnectionListener) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onPlayersChange(listener: PlayersListener) {
    this.playersListeners.add(listener);
    return () => this.playersListeners.delete(listener);
  }

  onChatMessage(listener: ChatListener) {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  onZoneChange(listener: ZoneListener) {
    this.zoneListeners.add(listener);
    return () => this.zoneListeners.delete(listener);
  }

  onTransfer(listener: TransferListener) {
    this.transferListeners.add(listener);
    return () => this.transferListeners.delete(listener);
  }

  onProfile(listener: ProfileListener) {
    this.profileListeners.add(listener);
    return () => this.profileListeners.delete(listener);
  }

  private async joinZone(zoneId: string) {
    if (!this.client) {
      this.client = new Client(getWebSocketUrl());
    }

    const config = getZoneConfig(zoneId);
    const options: JoinOptions = { name: this.playerName, zoneId };
    this.room = await this.client.joinOrCreate(config.roomName, options);
    this.currentZoneId = zoneId;

    this.room.onStateChange(() => this.emitPlayers());
    this.room.onMessage("chat", (message: ChatMessagePayload) => {
      for (const listener of this.chatListeners) {
        listener(message);
      }
    });
    this.room.onMessage("transfer", (payload: ZoneTransferPayload) => {
      for (const listener of this.transferListeners) {
        listener(payload);
      }
      void this.transferToZone(payload.targetZone);
    });
    this.room.onLeave(() => {
      this.room = null;
      this.emitConnection(false, 0);
      this.emitPlayers();
    });

    this.emitZone(zoneId);
    this.emitConnection(true, this.room.state.players.size);
    this.emitPlayers();
    this.emitLocalProfile();
  }

  private async leaveCurrentRoom() {
    if (!this.room) return;
    await this.room.leave();
    this.room = null;
  }

  private emitLocalProfile() {
    const local = this.getPlayers().find((player) => player.sessionId === this.sessionId);
    if (!local) return;
    for (const listener of this.profileListeners) {
      listener(local.level);
    }
  }

  private emitConnection(connected: boolean, playerCount: number) {
    for (const listener of this.connectionListeners) {
      listener(connected, playerCount);
    }
  }

  private emitPlayers() {
    const players = this.getPlayers();
    for (const listener of this.playersListeners) {
      listener(players, this.sessionId);
    }
    this.emitLocalProfile();
  }

  private emitZone(zoneId: string) {
    const zoneName = getZoneConfig(zoneId).displayName;
    for (const listener of this.zoneListeners) {
      listener(zoneId, zoneName);
    }
  }

  private getPlayers(): RemotePlayer[] {
    if (!this.room) return [];

    const players: RemotePlayer[] = [];
    this.room.state.players.forEach((player: RemotePlayer) => {
      players.push({
        sessionId: player.sessionId,
        name: player.name,
        x: player.x,
        y: player.y,
        level: player.level,
      });
    });

    return players;
  }
}

export const networkManager = new NetworkManager();