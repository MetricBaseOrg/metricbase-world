import { Client, Room, ServerError } from "@colyseus/core";
import {
  advanceQuestObjective,
  ATTACK_COOLDOWN_MS,
  ATTACK_RANGE,
  buildQuestViews,
  CHAT_COOLDOWN_MS,
  CHAT_MAX_LENGTH,
  ChatMessagePayload,
  completeQuest,
  getQuestDefinition,
  getQuestsOfferedByNpc,
  addItemToInventory,
  buildInventoryPayload,
  getItemDefinition,
  getZoneConfig,
  JoinOptions,
  normalizeCharacterAppearance,
  normalizeInventory,
  MIN_TOKEN_UI_AMOUNT,
  PORTAL_TRIGGER_RANGE,
  levelFromXp,
  type InventoryEntry,
  MAX_PLAYERS_PER_ZONE,
  NPC_INTERACT_COOLDOWN_MS,
  NPC_INTERACT_RANGE,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_SPEED,
  PlayerSchema,
  QUEST_EXPLORE_WILDERNESS,
  startQuest,
  TICK_RATE,
  tileToWorld,
  worldToTile,
  type QuestProgress,
  XP_NPC_INTERACT,
  XP_PORTAL_TRAVEL,
  ZoneState,
  ZoneTransferPayload,
  type ZoneConfig,
  type ZoneStateInstance,
} from "@metricbase/shared";
import { verifyAccessToken } from "../auth/accessToken.js";
import { isTokenGateEnabled } from "../auth/tokenGate.js";
import {
  CharacterBindingError,
  resolveCharacterForJoin,
  saveCharacter,
} from "../db/characters.js";
import { isWalkable } from "../map/collision.js";
import { walletMeetsTokenGate } from "../solana/tokenBalance.js";

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
  private attackCooldowns = new Map<string, number>();
  private transferring = new Set<string>();
  private questProgress = new Map<string, QuestProgress>();
  private mobHp = new Map<string, number>();
  private mobRespawnAt = new Map<string, number>();
  private inventories = new Map<string, InventoryEntry[]>();
  private playerWallets = new Map<string, string>();
  private zoneConfig!: ZoneConfig;

  onCreate(options: ZoneRoomOptions) {
    this.zoneConfig = getZoneConfig(options.zoneId);
    this.maxClients = MAX_PLAYERS_PER_ZONE;
    this.setState(new ZoneState());

    for (const npc of this.zoneConfig.npcs) {
      if (npc.combat) {
        this.mobHp.set(npc.id, npc.combat.maxHp);
      }
    }

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

    this.onMessage("attack", (client, message: { npcId?: string }) => {
      void this.handleAttack(client, message.npcId ?? "");
    });
  }

  async onAuth(_client: Client, options: JoinOptions) {
    const payload = options.accessToken ? verifyAccessToken(options.accessToken) : null;

    if (!isTokenGateEnabled()) {
      return payload ? { ...options, wallet: payload.wallet } : options;
    }

    if (!payload) {
      throw new ServerError(403, "Connect your wallet and verify token holdings to play.");
    }

    const meetsGate = await walletMeetsTokenGate(payload.wallet);
    if (!meetsGate) {
      throw new ServerError(
        403,
        `You need at least ${process.env.MIN_TOKEN_UI_AMOUNT ?? MIN_TOKEN_UI_AMOUNT} MetricBase tokens to enter.`,
      );
    }

    return { ...options, wallet: payload.wallet };
  }

  async onJoin(client: Client, options: JoinOptions & { wallet?: string }) {
    const name = sanitizeName(options?.name);
    const wallet = options.wallet ?? null;

    let saved: Awaited<ReturnType<typeof resolveCharacterForJoin>> = null;
    try {
      saved = await resolveCharacterForJoin(wallet, name);
    } catch (error) {
      if (error instanceof CharacterBindingError) {
        throw new ServerError(403, error.message);
      }
      throw error;
    }

    if (wallet) {
      this.playerWallets.set(name, wallet);
      if (saved && !saved.walletAddress) {
        saved = { ...saved, walletAddress: wallet };
        await saveCharacter(saved);
      }
    }

    const appearance = saved?.appearance ?? normalizeCharacterAppearance(options?.appearance);

    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.name = name;
    player.xp = saved?.xp ?? 0;
    player.level = saved?.level ?? levelFromXp(player.xp);
    player.bodyColor = appearance.bodyColor;
    player.hairColor = appearance.hairColor;
    player.outfitColor = appearance.outfitColor;
    player.hairStyle = appearance.hairStyle;
    player.outfitStyle = appearance.outfitStyle;

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
    this.questProgress.set(player.name, saved?.questProgress ?? { active: [], objectiveIndex: {}, completed: [] });
    this.inventories.set(player.name, normalizeInventory(saved?.inventory));

    client.send("profile", { level: player.level, xp: player.xp });
    this.sendQuestState(client, player.name);
    this.sendInventory(client, player.name);
    this.sendMobHealth(client);

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: `${player.name} entered ${this.zoneConfig.displayName}.`,
      sentAt: Date.now(),
    });

    void this.checkVisitZoneObjectives(client, player.name, this.zoneConfig.id);
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

    if (player) {
      this.questProgress.delete(player.name);
      this.inventories.delete(player.name);
      this.playerWallets.delete(player.name);
    }

    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.chatCooldowns.delete(client.sessionId);
    this.npcCooldowns.delete(client.sessionId);
    this.attackCooldowns.delete(client.sessionId);
    this.transferring.delete(client.sessionId);
  }

  private tick(deltaTime: number) {
    const dt = deltaTime / 1000;
    const now = Date.now();

    for (const npc of this.zoneConfig.npcs) {
      if (!npc.combat) continue;
      const respawnAt = this.mobRespawnAt.get(npc.id);
      if (respawnAt && now >= respawnAt) {
        this.mobHp.set(npc.id, npc.combat.maxHp);
        this.mobRespawnAt.delete(npc.id);
        this.broadcastMobHealth(npc.id);
      }
    }

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

    const portal = this.zoneConfig.portals.find((entry) =>
      this.isNearPortal(worldX, worldY, entry.tileX, entry.tileY),
    );
    if (!portal) return;

    const client = this.clients.find((entry) => entry.sessionId === sessionId);
    const player = this.state.players.get(sessionId);
    if (!client || !player) return;

    this.transferring.add(sessionId);
    void this.transferPlayer(client, player, portal);
  }

  private isNearPortal(worldX: number, worldY: number, tileX: number, tileY: number): boolean {
    const portalPos = tileToWorld(tileX, tileY);
    if (Math.hypot(worldX - portalPos.x, worldY - portalPos.y) <= PORTAL_TRIGGER_RANGE) {
      return true;
    }

    const playerTile = worldToTile(worldX, worldY);
    return (
      Math.abs(playerTile.tileX - tileX) <= 1 && Math.abs(playerTile.tileY - tileY) <= 1
    );
  }

  private async transferPlayer(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    portal: ZoneConfig["portals"][number],
  ) {
    try {
      const targetConfig = getZoneConfig(portal.targetZone);
      const spawn = tileToWorld(targetConfig.spawnTile.x, targetConfig.spawnTile.y);

      this.grantXp(client, player, XP_PORTAL_TRAVEL, `traveled through ${portal.label}`);
      await this.checkVisitZoneObjectives(client, player.name, portal.targetZone);

      await this.persistPlayer(player, portal.targetZone, spawn.x, spawn.y);

      client.send("transfer", {
        targetZone: portal.targetZone,
        label: portal.label,
      } satisfies ZoneTransferPayload);
    } catch (error) {
      this.transferring.delete(client.sessionId);
      console.error("Portal transfer failed:", error);
    }
  }

  private async handleInteract(client: Client, npcId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !npcId) return;

    const npc = this.zoneConfig.npcs.find((entry) => entry.id === npcId);
    if (!npc) return;

    const npcPosition = tileToWorld(npc.tileX, npc.tileY);
    const distance = Math.hypot(player.x - npcPosition.x, player.y - npcPosition.y);
    if (distance > NPC_INTERACT_RANGE) return;

    const progress = this.getQuestProgress(player.name);
    for (const questId of getQuestsOfferedByNpc(npcId, progress)) {
      this.questProgress.set(player.name, startQuest(progress, questId));
      const quest = getQuestDefinition(questId);
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Quest",
        body: `New quest: ${quest.title}`,
        sentAt: Date.now(),
      });
    }

    const cooldownKey = `${client.sessionId}:${npcId}`;
    const lastInteract = this.npcCooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastInteract < NPC_INTERACT_COOLDOWN_MS) {
      client.send("npcDialogue", { npcName: npc.name, dialogue: npc.dialogue });
      return;
    }

    this.npcCooldowns.set(cooldownKey, Date.now());
    client.send("npcDialogue", { npcName: npc.name, dialogue: npc.dialogue });
    this.grantXp(client, player, XP_NPC_INTERACT, `spoke with ${npc.name}`);
    await this.checkTalkObjectives(client, player.name, npcId);
    await this.persistPlayer(player);
  }

  private async handleAttack(client: Client, npcId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !npcId) return;

    const npc = this.zoneConfig.npcs.find((entry) => entry.id === npcId);
    if (!npc?.combat) return;

    const now = Date.now();
    const lastAttack = this.attackCooldowns.get(client.sessionId) ?? 0;
    if (now - lastAttack < ATTACK_COOLDOWN_MS) return;

    const npcPosition = tileToWorld(npc.tileX, npc.tileY);
    const distance = Math.hypot(player.x - npcPosition.x, player.y - npcPosition.y);
    if (distance > ATTACK_RANGE) return;

    const currentHp = this.mobHp.get(npcId);
    if (currentHp === undefined || currentHp <= 0) return;

    this.attackCooldowns.set(client.sessionId, now);
    const nextHp = Math.max(0, currentHp - PLAYER_ATTACK_DAMAGE);
    this.mobHp.set(npcId, nextHp);

    const defeated = nextHp === 0;
    if (defeated) {
      this.mobRespawnAt.set(npcId, now + npc.combat.respawnMs);
      this.grantXp(client, player, npc.combat.rewardXp, `defeated ${npc.name}`);
      this.grantLoot(client, player.name, "item_training_scrap", 1);
      await this.persistPlayer(player);
    }

    this.broadcast("attackResult", {
      npcId,
      damage: PLAYER_ATTACK_DAMAGE,
      currentHp: nextHp,
      maxHp: npc.combat.maxHp,
      defeated,
    });
  }

  private async checkTalkObjectives(client: Client, playerName: string, npcId: string) {
    let progress = this.getQuestProgress(playerName);

    for (const questId of [...progress.active]) {
      const quest = getQuestDefinition(questId);
      const objectiveIndex = progress.objectiveIndex[questId] ?? 0;
      const objective = quest.objectives[objectiveIndex];
      if (!objective || objective.type !== "talk_npc" || objective.target !== npcId) {
        continue;
      }

      const result = advanceQuestObjective(progress, questId);
      progress = result.progress;
      this.questProgress.set(playerName, progress);

      if (result.completed) {
        progress = await this.finishQuest(client, playerName, questId, progress);
      }
    }

    this.sendQuestState(client, playerName);
  }

  private async checkVisitZoneObjectives(client: Client, playerName: string, zoneId: string) {
    let progress = this.getQuestProgress(playerName);

    for (const questId of [...progress.active]) {
      const quest = getQuestDefinition(questId);
      const objectiveIndex = progress.objectiveIndex[questId] ?? 0;
      const objective = quest.objectives[objectiveIndex];
      if (!objective || objective.type !== "visit_zone" || objective.target !== zoneId) {
        continue;
      }

      const result = advanceQuestObjective(progress, questId);
      progress = result.progress;
      this.questProgress.set(playerName, progress);

      if (result.completed) {
        progress = await this.finishQuest(client, playerName, questId, progress);
      }
    }

    this.sendQuestState(client, playerName);
  }

  private async finishQuest(
    client: Client,
    playerName: string,
    questId: string,
    progress: QuestProgress,
  ) {
    const quest = getQuestDefinition(questId);
    const player = this.state.players.get(client.sessionId);
    if (!player) return progress;

    progress = completeQuest(progress, questId);
    this.questProgress.set(playerName, progress);
    this.grantXp(client, player, quest.rewardXp, `completed ${quest.title}`);

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Quest",
      body: `${player.name} completed "${quest.title}".`,
      sentAt: Date.now(),
    });

    if (questId === QUEST_EXPLORE_WILDERNESS) {
      const next = getQuestsOfferedByNpc("hub_guide", progress);
      if (next.length > 0) {
        this.broadcastChat({
          id: crypto.randomUUID(),
          channel: "system",
          senderId: "system",
          senderName: "Quest",
          body: "Return to Aria in the hub for more quests.",
          sentAt: Date.now(),
        });
      }
    }

    await this.persistPlayer(player);
    return progress;
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

  private getQuestProgress(playerName: string): QuestProgress {
    return (
      this.questProgress.get(playerName) ?? { active: [], objectiveIndex: {}, completed: [] }
    );
  }

  private sendInventory(client: Client, playerName: string) {
    const inventory = this.inventories.get(playerName) ?? [];
    client.send("inventory", buildInventoryPayload(inventory));
  }

  private grantLoot(client: Client, playerName: string, itemId: string, quantity: number) {
    const current = this.inventories.get(playerName) ?? [];
    const { inventory, added } = addItemToInventory(current, itemId, quantity);
    if (added <= 0) return;

    this.inventories.set(playerName, inventory);
    this.sendInventory(client, playerName);

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Loot",
      body: `${player.name} received ${added}x ${getItemDefinition(itemId).name}.`,
      sentAt: Date.now(),
    });
  }

  private sendQuestState(client: Client, playerName: string) {
    client.send("questState", buildQuestViews(this.getQuestProgress(playerName)));
  }

  private sendMobHealth(client: Client) {
    for (const npc of this.zoneConfig.npcs) {
      if (!npc.combat) continue;
      const currentHp = this.mobHp.get(npc.id) ?? npc.combat.maxHp;
      client.send("mobHealth", {
        npcId: npc.id,
        currentHp,
        maxHp: npc.combat.maxHp,
      });
    }
  }

  private broadcastMobHealth(npcId: string) {
    const npc = this.zoneConfig.npcs.find((entry) => entry.id === npcId);
    if (!npc?.combat) return;

    const payload = {
      npcId,
      currentHp: this.mobHp.get(npcId) ?? npc.combat.maxHp,
      maxHp: npc.combat.maxHp,
    };

    this.broadcast("mobHealth", payload);
  }

  private async persistPlayer(
    player: InstanceType<typeof PlayerSchema>,
    zoneId = this.zoneConfig.id,
    x = player.x,
    y = player.y,
  ) {
    await saveCharacter({
      name: player.name,
      walletAddress: this.playerWallets.get(player.name) ?? null,
      zoneId,
      x,
      y,
      level: player.level,
      xp: player.xp,
      questProgress: this.getQuestProgress(player.name),
      appearance: {
        bodyColor: player.bodyColor,
        hairColor: player.hairColor,
        outfitColor: player.outfitColor,
        hairStyle: player.hairStyle as "short" | "long" | "spiky",
        outfitStyle: player.outfitStyle as "robe" | "armor" | "casual",
      },
      inventory: normalizeInventory(this.inventories.get(player.name)),
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