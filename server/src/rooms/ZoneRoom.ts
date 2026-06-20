import { Client, Room } from "@colyseus/core";
import {
  CHAT_COOLDOWN_MS,
  CHAT_MAX_LENGTH,
  ChatMessagePayload,
  getZoneConfig,
  JoinOptions,
  MAX_PLAYERS_PER_ZONE,
  PLAYER_SPEED,
  PlayerSchema,
  TICK_RATE,
  tileToWorld,
  worldToTile,
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
  }

  async onJoin(client: Client, options: JoinOptions) {
    const name = sanitizeName(options?.name);
    const saved = await loadCharacter(name);

    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.name = name;

    player.level = saved?.level ?? 1;

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
      await saveCharacter({
        name: player.name,
        zoneId: this.zoneConfig.id,
        x: player.x,
        y: player.y,
        level: player.level,
      });

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

    await saveCharacter({
      name: player.name,
      zoneId: portal.targetZone,
      x: spawn.x,
      y: spawn.y,
      level: player.level,
    });

    const payload: ZoneTransferPayload = {
      targetZone: portal.targetZone,
      label: portal.label,
    };

    client.send("transfer", payload);
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