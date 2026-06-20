import { Client, Room } from "@colyseus/core";
import {
  CHAT_COOLDOWN_MS,
  CHAT_MAX_LENGTH,
  ChatMessagePayload,
  getZoneConfig,
  JoinOptions,
  levelFromXp,
  MAX_PLAYERS_PER_ZONE,
  NPC_INTERACT_COOLDOWN_MS,
  NPC_INTERACT_RANGE,
  PLAYER_SPEED,
  PlayerSchema,
  TICK_RATE,
  tileToWorld,
  worldToTile,
  XP_NPC_INTERACT,
  XP_PORTAL_TRAVEL,
  ZoneState,
  ZoneTransferPayload,
  type ZoneConfig,
  type ZoneStateInstance,
} from "@metricbase/shared";
import { loadCharacter, saveCharacter } from "../db/characters.js";
import { isWalkable } from "../map/collision.js";

interface PendingInput {
  dx: number;
  dy: number;
}

interface ZoneRoomOptions {
  zoneId: string;
}

export class ZoneRoom extends Room<ZoneStateInstance, ZoneRoomOptions> {
  private inputs = new Map<string, PendingInput>();
  private chatCooldowns = new Map<string, number>();
  private npcCooldowns = new Map<string, number>();
  private transferring = new Set<string>();
  private zoneConfig!: ZoneConfig;

  onCreate(options: ZoneRoomOptions) {
    this.zoneConfig = getZoneConfig(options.zoneId);
    this.maxClients = MAX_PLAYERS_PER_ZONE;
    this.setState(new ZoneState());

    this.setSimulationInterval((deltaTime) => this.tick(deltaTime), 1000 / TICK_RATE);

    this.onMessage("input", (client, message: PendingInput) => {
      this.inputs.set(client.sessionId, {
        dx: clamp(message.dx, -1, 1),
        dy: clamp(message.dy, -1, 1),
      });
    });

    this.onMessage("chat", (client, message: { body?: string }) => {
      void this.handleChat(client, message.body ?? "");
    });

    this.onMessage("interact", (client, message: { npcId?: string }) => {
      void this.handleInteract(client, message.npcId ?? "");
    });
  }

  async onJoin(client: Client, options: JoinOptions) {
    const name = sanitizeName(options?.name);
    const saved = await loadCharacter(name);

    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.name = name;
    player.xp = saved?.xp ?? 0;
    player.level = saved?.level ?? levelFromXp(player.xp);

    if (saved && saved.zoneId === this.zoneConfig.id) {
      player.x = saved.x;
      player.y = saved.y;
    } else {
      const spawn = tileToWorld(this.zoneConfig.spawnTile.x, this.zoneConfig.spawnTile.y);
      player.x = spawn.x;
      player.y = spawn.y;
    }

    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, { dx: 0, dy: 0 });

    client.send("profile", { level: player.level, xp: player.xp });

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: `${player.name} entered ${this.zoneConfig.displayName}.`,
      sentAt: Date.now(),
    });
  }

  async onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const isTransferring = this.transferring.has(client.sessionId);

    if (player && !isTransferring) {
      await this.persistPlayer(player);
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "System",
        body: `${player.name} left ${this.zoneConfig.displayName}.`,
        sentAt: Date.now(),
      });
    }

    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.chatCooldowns.delete(client.sessionId);
    this.npcCooldowns.delete(client.sessionId);
    this.transferring.delete(client.sessionId);
  }

  private tick(deltaTime: number) {
    const dt = deltaTime / 1000;

    this.state.players.forEach((player, sessionId) => {
      const input = this.inputs.get(sessionId);
      if (!input) return;

      const length = Math.hypot(input.dx, input.dy);
      if (length === 0) return;

      const nx = input.dx / length;
      const ny = input.dy / length;
      const speed = PLAYER_SPEED * dt;

      const nextX = player.x + nx * speed;
      const nextY = player.y + ny * speed;

      if (isWalkable(this.zoneConfig.id, nextX, player.y)) {
        player.x = nextX;
      }
      if (isWalkable(this.zoneConfig.id, player.x, nextY)) {
        player.y = nextY;
      }

      this.checkPortals(sessionId, player.x, player.y);
    });
  }

  private checkPortals(sessionId: string, worldX: number, worldY: number) {
    if (this.transferring.has(sessionId)) return;

    const { tileX, tileY } = worldToTile(worldX, worldY);
    const portal = this.zoneConfig.portals.find(
      (entry) => entry.tileX === tileX && entry.tileY === tileY,
    );

    if (!portal) return;

    const client = this.clients.find((entry) => entry.sessionId === sessionId);
    const player = this.state.players.get(sessionId);
    if (!client || !player) return;

    this.transferring.add(sessionId);
    void this.transferPlayer(client, player, portal);
  }

  private async transferPlayer(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    portal: ZoneConfig["portals"][number],
  ) {
    const targetConfig = getZoneConfig(portal.targetZone);
    const spawn = tileToWorld(targetConfig.spawnTile.x, targetConfig.spawnTile.y);

    this.grantXp(client, player, XP_PORTAL_TRAVEL, `traveled through ${portal.label}`);

    await saveCharacter({
      name: player.name,
      zoneId: portal.targetZone,
      x: spawn.x,
      y: spawn.y,
      level: player.level,
      xp: player.xp,
    });

    const payload: ZoneTransferPayload = {
      targetZone: portal.targetZone,
      label: portal.label,
    };

    client.send("transfer", payload);
  }

  private async handleInteract(client: Client, npcId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !npcId) return;

    const npc = this.zoneConfig.npcs.find((entry) => entry.id === npcId);
    if (!npc) return;

    const npcPosition = tileToWorld(npc.tileX, npc.tileY);
    const distance = Math.hypot(player.x - npcPosition.x, player.y - npcPosition.y);
    if (distance > NPC_INTERACT_RANGE) return;

    const cooldownKey = `${client.sessionId}:${npcId}`;
    const lastInteract = this.npcCooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastInteract < NPC_INTERACT_COOLDOWN_MS) {
      client.send("npcDialogue", { npcName: npc.name, dialogue: npc.dialogue });
      return;
    }

    this.npcCooldowns.set(cooldownKey, Date.now());
    client.send("npcDialogue", { npcName: npc.name, dialogue: npc.dialogue });
    this.grantXp(client, player, XP_NPC_INTERACT, `spoke with ${npc.name}`);
    await this.persistPlayer(player);
  }

  private grantXp(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    amount: number,
    reason: string,
  ) {
    const previousLevel = player.level;
    player.xp += amount;
    player.level = levelFromXp(player.xp);

    client.send("profile", { level: player.level, xp: player.xp });

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: `${player.name} gained ${amount} XP (${reason}).`,
      sentAt: Date.now(),
    });

    if (player.level > previousLevel) {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "System",
        body: `${player.name} reached level ${player.level}!`,
        sentAt: Date.now(),
      });
    }
  }

  private async persistPlayer(player: InstanceType<typeof PlayerSchema>) {
    await saveCharacter({
      name: player.name,
      zoneId: this.zoneConfig.id,
      x: player.x,
      y: player.y,
      level: player.level,
      xp: player.xp,
    });
  }

  private async handleChat(client: Client, rawBody: string) {
    const now = Date.now();
    const lastSent = this.chatCooldowns.get(client.sessionId) ?? 0;
    if (now - lastSent < CHAT_COOLDOWN_MS) {
      return;
    }

    const body = rawBody.trim().slice(0, CHAT_MAX_LENGTH);
    if (!body) return;

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    this.chatCooldowns.set(client.sessionId, now);
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "zone",
      senderId: client.sessionId,
      senderName: player.name,
      body,
      sentAt: now,
    });
  }

  private broadcastChat(message: ChatMessagePayload) {
    this.broadcast("chat", message);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeName(name?: string): string {
  const trimmed = (name ?? "Traveler").trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : "Traveler";
}