import { Client, Room } from "colyseus.js";
import {
  AttackResultPayload,
  CharacterLookupResponse,
  ChatMessagePayload,
  getZoneConfig,
  JoinOptions,
  InventoryStatePayload,
  MobHealthPayload,
  normalizeCharacterAppearance,
  ProfilePayload,
  QuestStatePayload,
  ZONE_HUB,
  ZoneState,
  ZoneTransferPayload,
  type CharacterAppearance,
  type Player,
} from "@metricbase/shared";
import { getHttpServerUrl, getWebSocketUrl } from "./serverUrl";

export interface RemotePlayer {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  appearance: CharacterAppearance;
}

type ConnectionListener = (connected: boolean, playerCount: number) => void;
type PlayersListener = (players: RemotePlayer[], localSessionId: string | null) => void;
type ChatListener = (message: ChatMessagePayload) => void;
type ZoneListener = (zoneId: string, zoneName: string) => void;
type TransferListener = (payload: ZoneTransferPayload) => void;
type ProfileListener = (profile: ProfilePayload) => void;
type NpcDialogueListener = (npcName: string, dialogue: string) => void;
type QuestStateListener = (state: QuestStatePayload) => void;
type MobHealthListener = (payload: MobHealthPayload) => void;
type AttackResultListener = (payload: AttackResultPayload) => void;
type InventoryListener = (state: InventoryStatePayload) => void;

export class NetworkManager {
  private client: Client | null = null;
  private room: Room | null = null;
  private playerName = "Traveler";
  private accessToken: string | null = null;
  private appearance: CharacterAppearance | null = null;
  private currentZoneId = ZONE_HUB;
  private connectionListeners = new Set<ConnectionListener>();
  private playersListeners = new Set<PlayersListener>();
  private chatListeners = new Set<ChatListener>();
  private zoneListeners = new Set<ZoneListener>();
  private transferListeners = new Set<TransferListener>();
  private profileListeners = new Set<ProfileListener>();
  private npcDialogueListeners = new Set<NpcDialogueListener>();
  private questStateListeners = new Set<QuestStateListener>();
  private mobHealthListeners = new Set<MobHealthListener>();
  private attackResultListeners = new Set<AttackResultListener>();
  private inventoryListeners = new Set<InventoryListener>();
  private latestQuestState: QuestStatePayload = { active: [], completed: [] };
  private latestInventory: InventoryStatePayload = { items: [], capacity: 16 };
  private isTransferring = false;
  private mobHealth = new Map<string, MobHealthPayload>();

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
    if (this.accessToken) {
      const response = await fetch(`${getHttpServerUrl()}/api/character/me`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (response.ok) {
        const bonded = (await response.json()) as CharacterLookupResponse;
        if (bonded.found) {
          return bonded;
        }
      }
    }

    const response = await fetch(
      `${getHttpServerUrl()}/api/character?name=${encodeURIComponent(name)}`,
    );

    if (!response.ok) {
      throw new Error("Failed to look up character");
    }

    return response.json() as Promise<CharacterLookupResponse>;
  }

  async connect(
    playerName: string,
    accessToken?: string | null,
    appearance?: CharacterAppearance | null,
  ): Promise<void> {
    this.playerName = playerName;
    this.accessToken = accessToken ?? null;
    this.appearance = appearance ? normalizeCharacterAppearance(appearance) : null;

    let zoneId = ZONE_HUB;
    try {
      const saved = await this.lookupCharacter(playerName);
      zoneId = saved.zoneId;
      for (const listener of this.profileListeners) {
        listener({ level: saved.level, xp: saved.xp });
      }
    } catch {
      for (const listener of this.profileListeners) {
        listener({ level: 1, xp: 0 });
      }
    }

    this.currentZoneId = zoneId;
    await this.joinZone(zoneId);
  }

  async transferToZone(targetZone: string): Promise<void> {
    if (!this.client) return;
    this.isTransferring = true;
    try {
      await this.leaveCurrentRoom();
      this.currentZoneId = targetZone;
      await this.joinZone(targetZone);
    } finally {
      this.isTransferring = false;
    }
  }

  sendInput(dx: number, dy: number) {
    this.room?.send("input", { dx, dy });
  }

  sendChat(body: string) {
    this.room?.send("chat", { body });
  }

  sendInteract(npcId: string) {
    this.room?.send("interact", { npcId });
  }

  sendAttack(npcId: string) {
    this.room?.send("attack", { npcId });
  }

  getMobHealth(npcId: string): MobHealthPayload | undefined {
    return this.mobHealth.get(npcId);
  }

  async disconnect() {
    await this.leaveCurrentRoom();
    this.client = null;
    this.accessToken = null;
    this.appearance = null;
    this.latestQuestState = { active: [], completed: [] };
    this.latestInventory = { items: [], capacity: 16 };
    this.mobHealth.clear();
    this.emitConnection(false, 0);
    this.emitPlayers();
  }

  onConnectionChange(listener: ConnectionListener) {
    this.connectionListeners.add(listener);
    if (this.room) {
      listener(true, this.room.state.players?.size ?? 0);
    }
    return () => this.connectionListeners.delete(listener);
  }

  onPlayersChange(listener: PlayersListener) {
    this.playersListeners.add(listener);
    if (this.room) {
      listener(this.getPlayers(), this.sessionId);
    }
    return () => this.playersListeners.delete(listener);
  }

  onChatMessage(listener: ChatListener) {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  onZoneChange(listener: ZoneListener) {
    this.zoneListeners.add(listener);
    if (this.room) {
      listener(this.currentZoneId, this.zoneName);
    }
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

  onNpcDialogue(listener: NpcDialogueListener) {
    this.npcDialogueListeners.add(listener);
    return () => this.npcDialogueListeners.delete(listener);
  }

  onQuestState(listener: QuestStateListener) {
    this.questStateListeners.add(listener);
    listener(this.latestQuestState);
    return () => this.questStateListeners.delete(listener);
  }

  onMobHealth(listener: MobHealthListener) {
    this.mobHealthListeners.add(listener);
    for (const payload of this.mobHealth.values()) {
      listener(payload);
    }
    return () => this.mobHealthListeners.delete(listener);
  }

  onAttackResult(listener: AttackResultListener) {
    this.attackResultListeners.add(listener);
    return () => this.attackResultListeners.delete(listener);
  }

  onInventoryState(listener: InventoryListener) {
    this.inventoryListeners.add(listener);
    listener(this.latestInventory);
    return () => this.inventoryListeners.delete(listener);
  }

  private async joinZone(zoneId: string) {
    if (!this.client) {
      this.client = new Client(getWebSocketUrl());
    }

    const config = getZoneConfig(zoneId);
    const options: JoinOptions = {
      name: this.playerName,
      zoneId,
      ...(this.accessToken ? { accessToken: this.accessToken } : {}),
      ...(this.appearance ? { appearance: this.appearance } : {}),
    };
    try {
      this.room = await this.client.joinOrCreate(config.roomName, options, ZoneState);
    } catch (error) {
      throw new Error(formatJoinError(error));
    }
    this.currentZoneId = zoneId;
    this.mobHealth.clear();

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
      void this.transferToZone(payload.targetZone).catch((error) => {
        console.error("Zone transfer failed:", error);
      });
    });
    this.room.onMessage("profile", (profile: ProfilePayload) => {
      for (const listener of this.profileListeners) {
        listener(profile);
      }
    });
    this.room.onMessage("npcDialogue", (payload: { npcName: string; dialogue: string }) => {
      for (const listener of this.npcDialogueListeners) {
        listener(payload.npcName, payload.dialogue);
      }
    });
    this.room.onMessage("questState", (payload: QuestStatePayload) => {
      this.latestQuestState = payload;
      for (const listener of this.questStateListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("mobHealth", (payload: MobHealthPayload) => {
      this.mobHealth.set(payload.npcId, payload);
      for (const listener of this.mobHealthListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("inventory", (payload: InventoryStatePayload) => {
      this.latestInventory = payload;
      for (const listener of this.inventoryListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("attackResult", (payload: AttackResultPayload) => {
      this.mobHealth.set(payload.npcId, {
        npcId: payload.npcId,
        currentHp: payload.currentHp,
        maxHp: payload.maxHp,
      });
      for (const listener of this.attackResultListeners) {
        listener(payload);
      }
      for (const listener of this.mobHealthListeners) {
        listener({
          npcId: payload.npcId,
          currentHp: payload.currentHp,
          maxHp: payload.maxHp,
        });
      }
    });
    this.room.onLeave(() => {
      this.room = null;
      if (!this.isTransferring) {
        this.emitConnection(false, 0);
      }
      this.emitPlayers();
    });

    this.emitZone(zoneId);
    this.emitConnection(true, this.room.state.players?.size ?? 0);
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
      listener({ level: local.level, xp: local.xp ?? 0 });
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
    this.room.state.players.forEach((player: Player) => {
      players.push({
        sessionId: player.sessionId,
        name: player.name,
        x: player.x,
        y: player.y,
        level: player.level,
        xp: player.xp ?? 0,
        appearance: normalizeCharacterAppearance({
          bodyColor: player.bodyColor,
          hairColor: player.hairColor,
          outfitColor: player.outfitColor,
          hairStyle: player.hairStyle as CharacterAppearance["hairStyle"],
          outfitStyle: player.outfitStyle as CharacterAppearance["outfitStyle"],
        }),
      });
    });

    return players;
  }
}

function formatJoinError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      if (/403|forbidden|token|wallet/i.test(message)) {
        return message;
      }
      if (/insufficient/i.test(message)) {
        return message;
      }
      return `Could not enter the zone: ${message}`;
    }
  }

  return "Could not connect to the game server. Check your wallet session and try again.";
}

export const networkManager = new NetworkManager();