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
  buildShopOpenPayload,
  getItemDefinition,
  getItemQuantity,
  getShopByNpcId,
  getShopDefinition,
  getZoneConfig,
  removeItemFromInventory,
  STARTING_GOLD,
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
  getPlayerAttackDamage,
  getPlayerMaxHp,
  isCollectObjectiveMet,
  normalizeEquipment,
  PLAYER_SPEED,
  POTION_HEAL_AMOUNT,
  TRAINING_DUMMY_COUNTER_DAMAGE,
  TRAINING_DUMMY_GOLD_REWARD,
  TRAINING_DUMMY_NPC_ID,
  PlayerSchema,
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
  loadCharacterByWallet,
  resolveCharacterForJoin,
  saveCharacter,
} from "../db/characters.js";
import { isWalkable } from "../map/collision.js";
import { walletMeetsTokenGate } from "../solana/tokenBalance.js";
import {
  acceptBidOrder,
  buildMarketState,
  cancelPlayerMarketOrder,
  completeBidPayment,
  fillAskOrder,
  placeMarketOrder,
} from "../market/service.js";

interface PendingInput {
  dx: number;
  dy: number;
}

interface ZoneRoomOptions {
  zoneId: string;
}

type JoinAuthData = JoinOptions & { wallet?: string };

export class ZoneRoom extends Room<ZoneStateInstance, ZoneRoomOptions> {
  private inputs = new Map<string, PendingInput>();
  private chatCooldowns = new Map<string, number>();
  private npcInteractAt = new Map<string, Record<string, number>>();
  private mobGoldClaimed = new Map<string, Record<string, boolean>>();
  private attackCooldowns = new Map<string, number>();
  private transferring = new Set<string>();
  private questProgress = new Map<string, QuestProgress>();
  private mobHp = new Map<string, number>();
  private mobRespawnAt = new Map<string, number>();
  private inventories = new Map<string, InventoryEntry[]>();
  private playerGold = new Map<string, number>();
  private playerHp = new Map<string, number>();
  private playerEquipment = new Map<string, ReturnType<typeof normalizeEquipment>>();
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

    this.onMessage("shopBuy", (client, message: { shopId?: string; itemId?: string }) => {
      void this.handleShopBuy(client, message.shopId ?? "", message.itemId ?? "");
    });

    this.onMessage("shopSell", (client, message: { shopId?: string; itemId?: string; quantity?: number }) => {
      void this.handleShopSell(
        client,
        message.shopId ?? "",
        message.itemId ?? "",
        message.quantity ?? 1,
      );
    });

    this.onMessage("marketPlace", (client, message: { side?: string; goldAmount?: number; tokenPrice?: number }) => {
      void this.handleMarketPlace(
        client,
        message.side === "bid" ? "bid" : "ask",
        message.goldAmount ?? 0,
        message.tokenPrice ?? 0,
      );
    });

    this.onMessage("marketCancel", (client, message: { orderId?: string }) => {
      void this.handleMarketCancel(client, message.orderId ?? "");
    });

    this.onMessage("marketFillAsk", (client, message: { orderId?: string; signature?: string }) => {
      void this.handleMarketFillAsk(client, message.orderId ?? "", message.signature ?? "");
    });

    this.onMessage("marketAcceptBid", (client, message: { orderId?: string }) => {
      void this.handleMarketAcceptBid(client, message.orderId ?? "");
    });

    this.onMessage("marketPayBid", (client, message: { orderId?: string; signature?: string }) => {
      void this.handleMarketPayBid(client, message.orderId ?? "", message.signature ?? "");
    });

    this.onMessage("marketRefresh", (client) => {
      void this.handleMarketRefresh(client);
    });

    this.onMessage("linkWallet", (client, message: { accessToken?: string }) => {
      void this.handleLinkWallet(client, message.accessToken ?? "");
    });

    this.onMessage("useItem", (client, message: { itemId?: string }) => {
      void this.handleUseItem(client, message.itemId ?? "");
    });

    this.onMessage("equipItem", (client, message: { itemId?: string | null }) => {
      void this.handleEquipItem(client, message.itemId ?? null);
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

  async onJoin(client: Client, options: JoinOptions, auth?: JoinAuthData) {
    const wallet = this.resolveJoinWallet(options, auth);
    let name = sanitizeName(options?.name);

    if (wallet) {
      const bonded = await loadCharacterByWallet(wallet);
      if (bonded) {
        name = bonded.name;
      }
    }

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
      this.playerWallets.set(client.sessionId, wallet);
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
    this.playerGold.set(player.name, saved?.gold ?? STARTING_GOLD);
    this.playerEquipment.set(
      player.name,
      normalizeEquipment(saved?.equipment),
    );
    const maxHp = getPlayerMaxHp(player.level);
    this.playerHp.set(player.name, Math.min(saved?.hp ?? maxHp, maxHp));
    this.npcInteractAt.set(player.name, saved?.npcInteractAt ?? {});
    this.mobGoldClaimed.set(player.name, saved?.mobGoldClaimed ?? {});

    this.sendProfile(client, player);
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
      this.playerGold.delete(player.name);
      this.playerHp.delete(player.name);
      this.playerEquipment.delete(player.name);
      this.npcInteractAt.delete(player.name);
      this.mobGoldClaimed.delete(player.name);
      this.playerWallets.delete(client.sessionId);
    }

    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.chatCooldowns.delete(client.sessionId);
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

    const now = Date.now();
    const interactAt = { ...(this.npcInteractAt.get(player.name) ?? {}) };
    const lastInteract = interactAt[npcId] ?? 0;
    const canEarnXp = now - lastInteract >= NPC_INTERACT_COOLDOWN_MS;

    client.send("npcDialogue", { npcName: npc.name, dialogue: npc.dialogue });
    void this.openShopForNpc(client, player, npc);

    if (canEarnXp) {
      interactAt[npcId] = now;
      this.npcInteractAt.set(player.name, interactAt);
      this.grantXp(client, player, XP_NPC_INTERACT, `spoke with ${npc.name}`);
    }

    await this.checkTalkObjectives(client, player.name, npcId);
    await this.checkCollectObjectives(client, player.name);
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

    const playerHp = this.playerHp.get(player.name) ?? getPlayerMaxHp(player.level);
    if (playerHp <= 0) return;

    this.attackCooldowns.set(client.sessionId, now);
    const equipment = this.playerEquipment.get(player.name);
    const damage = getPlayerAttackDamage(equipment?.weaponId);
    const nextHp = Math.max(0, currentHp - damage);
    this.mobHp.set(npcId, nextHp);

    if (npc.combat) {
      const counterDamage = npcId === "wild_slime" ? 5 : TRAINING_DUMMY_COUNTER_DAMAGE;
      this.damagePlayer(client, player, counterDamage, `${npc.name} counter-attack`);
    }

    const defeated = nextHp === 0;
    if (defeated) {
      this.mobRespawnAt.set(npcId, now + npc.combat.respawnMs);
      this.grantXp(client, player, npc.combat.rewardXp, `defeated ${npc.name}`);

      if (npcId === TRAINING_DUMMY_NPC_ID) {
        const claimed = { ...(this.mobGoldClaimed.get(player.name) ?? {}) };
        if (!claimed[npcId]) {
          this.grantGold(client, player, TRAINING_DUMMY_GOLD_REWARD, `defeated ${npc.name}`);
          claimed[npcId] = true;
          this.mobGoldClaimed.set(player.name, claimed);
        }
      } else {
        this.grantGold(client, player, 5, `defeated ${npc.name}`);
      }

      await this.grantLoot(client, player.name, "item_training_scrap", 1);
      await this.checkDefeatObjectives(client, player.name, npcId);
      await this.persistPlayer(player);
    }

    this.broadcast("attackResult", {
      npcId,
      damage,
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
    if (quest.rewardGold) {
      this.grantGold(client, player, quest.rewardGold, `completed ${quest.title}`);
    }

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Quest",
      body: `${player.name} completed "${quest.title}".`,
      sentAt: Date.now(),
    });

    const nextQuests = getQuestsOfferedByNpc("hub_guide", progress);
    if (nextQuests.length > 0) {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Quest",
        body: "Return to Aria in the hub for your next quest.",
        sentAt: Date.now(),
      });
    }

    await this.persistPlayer(player);
    return progress;
  }

  private async checkDefeatObjectives(client: Client, playerName: string, npcId: string) {
    let progress = this.getQuestProgress(playerName);

    for (const questId of [...progress.active]) {
      const quest = getQuestDefinition(questId);
      const objectiveIndex = progress.objectiveIndex[questId] ?? 0;
      const objective = quest.objectives[objectiveIndex];
      if (!objective || objective.type !== "defeat_npc" || objective.target !== npcId) {
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

  private async checkCollectObjectives(client: Client, playerName: string) {
    let progress = this.getQuestProgress(playerName);
    const inventory = this.inventories.get(playerName) ?? [];

    for (const questId of [...progress.active]) {
      const quest = getQuestDefinition(questId);
      const objectiveIndex = progress.objectiveIndex[questId] ?? 0;
      const objective = quest.objectives[objectiveIndex];
      if (!objective || objective.type !== "collect_item") continue;
      if (!isCollectObjectiveMet(objective, inventory)) continue;

      const result = advanceQuestObjective(progress, questId);
      progress = result.progress;
      this.questProgress.set(playerName, progress);

      if (result.completed) {
        progress = await this.finishQuest(client, playerName, questId, progress);
      }
    }

    this.sendQuestState(client, playerName);
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

    this.sendProfile(client, player);

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: `${player.name} gained ${amount} XP (${reason}).`,
      sentAt: Date.now(),
    });

    if (player.level > previousLevel) {
      const maxHp = getPlayerMaxHp(player.level);
      this.playerHp.set(player.name, maxHp);
      this.sendProfile(client, player);
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

  private async openShopForNpc(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    npc: ZoneConfig["npcs"][number],
  ) {
    const shop = npc.shopId ? getShopByNpcId(npc.id) : null;
    if (!shop) return;

    const inventory = this.inventories.get(player.name) ?? [];
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    const wallet = this.getClientWallet(client) ?? null;
    const market = await buildMarketState(wallet);

    client.send(
      "shopOpen",
      buildShopOpenPayload(shop, npc.name, npc.dialogue, gold, inventory, market),
    );
  }

  private sendProfile(client: Client, player: InstanceType<typeof PlayerSchema>) {
    const maxHp = getPlayerMaxHp(player.level);
    const equipment = this.playerEquipment.get(player.name);
    client.send("profile", {
      level: player.level,
      xp: player.xp,
      gold: this.playerGold.get(player.name) ?? STARTING_GOLD,
      hp: this.playerHp.get(player.name) ?? maxHp,
      maxHp,
      equippedWeaponId: equipment?.weaponId ?? null,
    });
  }

  private damagePlayer(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    amount: number,
    reason: string,
  ) {
    const maxHp = getPlayerMaxHp(player.level);
    const current = this.playerHp.get(player.name) ?? maxHp;
    const next = Math.max(0, current - amount);
    this.playerHp.set(player.name, next);
    this.sendProfile(client, player);

    if (next === 0) {
      const spawn = tileToWorld(this.zoneConfig.spawnTile.x, this.zoneConfig.spawnTile.y);
      player.x = spawn.x;
      player.y = spawn.y;
      this.playerHp.set(player.name, maxHp);
      this.sendProfile(client, player);
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "System",
        body: `${player.name} was knocked out (${reason}) and respawned.`,
        sentAt: Date.now(),
      });
    }
  }

  private grantGold(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    amount: number,
    reason: string,
  ) {
    if (amount <= 0) return;

    const next = (this.playerGold.get(player.name) ?? STARTING_GOLD) + amount;
    this.playerGold.set(player.name, next);
    this.sendProfile(client, player);

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: `${player.name} earned ${amount} gold (${reason}).`,
      sentAt: Date.now(),
    });
  }

  private async handleLinkWallet(client: Client, accessToken: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !accessToken) {
      client.send("walletLinked", { ok: false, error: "Invalid wallet session." });
      return;
    }

    const payload = verifyAccessToken(accessToken);
    if (!payload) {
      client.send("walletLinked", { ok: false, error: "Wallet session expired. Reconnect your wallet." });
      return;
    }

    this.playerWallets.set(client.sessionId, payload.wallet);
    client.send("walletLinked", { ok: true, wallet: payload.wallet });
  }

  private resolveJoinWallet(options: JoinOptions, auth?: JoinAuthData): string | null {
    if (auth?.wallet) return auth.wallet;
    if (!options.accessToken) return null;
    return verifyAccessToken(options.accessToken)?.wallet ?? null;
  }

  private getClientWallet(client: Client): string | undefined {
    return this.playerWallets.get(client.sessionId);
  }

  private async handleMarketRefresh(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const wallet = this.getClientWallet(client) ?? null;
    client.send("marketResult", { ok: true, market: await buildMarketState(wallet) });
  }

  private async handleMarketPlace(
    client: Client,
    side: "bid" | "ask",
    goldAmount: number,
    tokenPrice: number,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const wallet = this.getClientWallet(client);
    if (!wallet) {
      client.send("marketResult", { ok: false, error: "Connect your wallet to use the gold market." });
      return;
    }

    const { result, playerGold } = await placeMarketOrder({
      wallet,
      playerName: player.name,
      playerGold: this.playerGold.get(player.name) ?? STARTING_GOLD,
      side,
      goldAmount,
      tokenPrice,
    });

    this.playerGold.set(player.name, playerGold);
    this.sendProfile(client, player);
    client.send("marketResult", result);
    if (result.ok) {
      await this.persistPlayer(player);
      this.broadcastMarketTrade(player.name, side === "ask" ? "listed gold for sale" : "posted a gold bid");
    }
  }

  private async handleMarketCancel(client: Client, orderId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !orderId) return;

    const wallet = this.getClientWallet(client);
    if (!wallet) return;

    const { result, playerGold } = await cancelPlayerMarketOrder({
      wallet,
      orderId,
      playerGold: this.playerGold.get(player.name) ?? STARTING_GOLD,
    });

    this.playerGold.set(player.name, playerGold);
    this.sendProfile(client, player);
    client.send("marketResult", result);
    if (result.ok) await this.persistPlayer(player);
  }

  private async handleMarketFillAsk(client: Client, orderId: string, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !orderId || !signature) return;

    const wallet = this.getClientWallet(client);
    if (!wallet) {
      client.send("marketResult", { ok: false, error: "Connect your wallet to buy gold." });
      return;
    }

    const { result, buyerGold } = await fillAskOrder({
      buyerWallet: wallet,
      buyerName: player.name,
      buyerGold: this.playerGold.get(player.name) ?? STARTING_GOLD,
      orderId,
      signature,
    });

    this.playerGold.set(player.name, buyerGold);
    this.sendProfile(client, player);
    client.send("marketResult", result);
    if (result.ok) {
      await this.persistPlayer(player);
      this.broadcastMarketTrade(player.name, "bought gold on the open market");
    }
  }

  private async handleMarketAcceptBid(client: Client, orderId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !orderId) return;

    const wallet = this.getClientWallet(client);
    if (!wallet) {
      client.send("marketResult", { ok: false, error: "Connect your wallet to sell gold." });
      return;
    }

    const { result, sellerGold } = await acceptBidOrder({
      sellerWallet: wallet,
      sellerName: player.name,
      sellerGold: this.playerGold.get(player.name) ?? STARTING_GOLD,
      orderId,
    });

    this.playerGold.set(player.name, sellerGold);
    this.sendProfile(client, player);
    client.send("marketResult", result);
    if (result.ok) {
      await this.persistPlayer(player);
      this.broadcastMarketTrade(player.name, "accepted a gold bid — awaiting buyer payment");
    }
  }

  private async handleMarketPayBid(client: Client, orderId: string, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !orderId || !signature) return;

    const wallet = this.getClientWallet(client);
    if (!wallet) {
      client.send("marketResult", { ok: false, error: "Connect your wallet to pay for gold." });
      return;
    }

    const { result, buyerGold } = await completeBidPayment({
      buyerWallet: wallet,
      buyerGold: this.playerGold.get(player.name) ?? STARTING_GOLD,
      orderId,
      signature,
    });

    this.playerGold.set(player.name, buyerGold);
    this.sendProfile(client, player);
    client.send("marketResult", result);
    if (result.ok) {
      await this.persistPlayer(player);
      this.broadcastMarketTrade(player.name, "completed a gold market trade");
    }
  }

  private broadcastMarketTrade(playerName: string, action: string) {
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Gold Market",
      body: `${playerName} ${action}.`,
      sentAt: Date.now(),
    });
  }

  private async handleShopBuy(client: Client, shopId: string, itemId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !shopId || !itemId) return;

    let shop;
    try {
      shop = getShopDefinition(shopId);
    } catch {
      client.send("shopResult", { ok: false, error: "Unknown shop." });
      return;
    }

    const offer = shop.buyOffers.find((entry) => entry.itemId === itemId);
    if (!offer) {
      client.send("shopResult", { ok: false, error: "Item not for sale." });
      return;
    }

    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < offer.price) {
      client.send("shopResult", { ok: false, error: "Not enough gold." });
      return;
    }

    const current = this.inventories.get(player.name) ?? [];
    const { inventory, added } = addItemToInventory(current, itemId, 1);
    if (added <= 0) {
      client.send("shopResult", { ok: false, error: "Inventory full." });
      return;
    }

    this.playerGold.set(player.name, gold - offer.price);
    this.inventories.set(player.name, inventory);
    this.sendProfile(client, player);
    this.sendInventory(client, player.name);

    const item = getItemDefinition(itemId);
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Shop",
      body: `${player.name} bought ${item.name} for ${offer.price} gold.`,
      sentAt: Date.now(),
    });

    client.send("shopResult", {
      ok: true,
      gold: this.playerGold.get(player.name),
      inventory: buildInventoryPayload(
        inventory,
        this.playerEquipment.get(player.name)?.weaponId ?? null,
      ),
    });
    await this.persistPlayer(player);
  }

  private async handleShopSell(
    client: Client,
    shopId: string,
    itemId: string,
    quantity: number,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !shopId || !itemId) return;

    let shop;
    try {
      shop = getShopDefinition(shopId);
    } catch {
      client.send("shopResult", { ok: false, error: "Unknown shop." });
      return;
    }

    const unitPrice = shop.sellPrices[itemId];
    if (!unitPrice) {
      client.send("shopResult", { ok: false, error: "Merchant won't buy that item." });
      return;
    }

    const sellQuantity = Math.max(1, Math.floor(quantity));
    const current = this.inventories.get(player.name) ?? [];
    const { inventory, removed } = removeItemFromInventory(current, itemId, sellQuantity);
    if (removed <= 0) {
      client.send("shopResult", { ok: false, error: "You don't have that item." });
      return;
    }

    const payout = unitPrice * removed;
    const gold = (this.playerGold.get(player.name) ?? STARTING_GOLD) + payout;
    this.playerGold.set(player.name, gold);
    this.inventories.set(player.name, inventory);
    this.sendProfile(client, player);
    this.sendInventory(client, player.name);

    const item = getItemDefinition(itemId);
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Shop",
      body: `${player.name} sold ${removed}x ${item.name} for ${payout} gold.`,
      sentAt: Date.now(),
    });

    client.send("shopResult", {
      ok: true,
      gold,
      inventory: buildInventoryPayload(
        inventory,
        this.playerEquipment.get(player.name)?.weaponId ?? null,
      ),
    });
    await this.checkCollectObjectives(client, player.name);
    await this.persistPlayer(player);
  }

  private sendInventory(client: Client, playerName: string) {
    const inventory = this.inventories.get(playerName) ?? [];
    const equipment = this.playerEquipment.get(playerName);
    client.send("inventory", buildInventoryPayload(inventory, equipment?.weaponId ?? null));
  }

  private async grantLoot(client: Client, playerName: string, itemId: string, quantity: number) {
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

    await this.checkCollectObjectives(client, playerName);
  }

  private sendQuestState(client: Client, playerName: string) {
    const inventory = this.inventories.get(playerName) ?? [];
    client.send("questState", buildQuestViews(this.getQuestProgress(playerName), inventory));
  }

  private async handleUseItem(client: Client, itemId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !itemId) return;

    let item;
    try {
      item = getItemDefinition(itemId);
    } catch {
      client.send("inventoryResult", { ok: false, error: "Unknown item." });
      return;
    }

    if (item.kind !== "consumable") {
      client.send("inventoryResult", { ok: false, error: "That item cannot be used." });
      return;
    }

    const current = this.inventories.get(player.name) ?? [];
    const { inventory, removed } = removeItemFromInventory(current, itemId, 1);
    if (removed <= 0) {
      client.send("inventoryResult", { ok: false, error: "You don't have that item." });
      return;
    }

    const maxHp = getPlayerMaxHp(player.level);
    const healed = Math.min(POTION_HEAL_AMOUNT, maxHp - (this.playerHp.get(player.name) ?? maxHp));
    const nextHp = Math.min(maxHp, (this.playerHp.get(player.name) ?? maxHp) + POTION_HEAL_AMOUNT);
    this.playerHp.set(player.name, nextHp);
    this.inventories.set(player.name, inventory);
    this.sendProfile(client, player);
    this.sendInventory(client, player.name);

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Item",
      body:
        healed > 0
          ? `${player.name} drank a Health Potion (+${healed} HP).`
          : `${player.name} drank a Health Potion (already at full HP).`,
      sentAt: Date.now(),
    });

    client.send("inventoryResult", {
      ok: true,
      inventory: buildInventoryPayload(
        inventory,
        this.playerEquipment.get(player.name)?.weaponId ?? null,
      ),
      hp: nextHp,
      maxHp,
    });
    await this.persistPlayer(player);
  }

  private async handleEquipItem(client: Client, itemId: string | null) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (itemId === null) {
      this.playerEquipment.set(player.name, normalizeEquipment({ weaponId: null }));
      this.sendProfile(client, player);
      this.sendInventory(client, player.name);
      client.send("inventoryResult", {
        ok: true,
        equippedWeaponId: null,
        inventory: buildInventoryPayload(
          this.inventories.get(player.name) ?? [],
          null,
        ),
      });
      await this.persistPlayer(player);
      return;
    }

    let item;
    try {
      item = getItemDefinition(itemId);
    } catch {
      client.send("inventoryResult", { ok: false, error: "Unknown item." });
      return;
    }

    if (item.kind !== "weapon") {
      client.send("inventoryResult", { ok: false, error: "That item cannot be equipped." });
      return;
    }

    const inventory = this.inventories.get(player.name) ?? [];
    if (getItemQuantity(inventory, itemId) <= 0) {
      client.send("inventoryResult", { ok: false, error: "You don't have that item." });
      return;
    }

    this.playerEquipment.set(player.name, normalizeEquipment({ weaponId: itemId }));
    this.sendProfile(client, player);
    this.sendInventory(client, player.name);

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Item",
      body: `${player.name} equipped ${item.name}.`,
      sentAt: Date.now(),
    });

    client.send("inventoryResult", {
      ok: true,
      equippedWeaponId: itemId,
      inventory: buildInventoryPayload(inventory, itemId),
    });
    await this.persistPlayer(player);
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
      walletAddress: this.playerWallets.get(player.sessionId) ?? null,
      zoneId,
      x,
      y,
      level: player.level,
      xp: player.xp,
      gold: this.playerGold.get(player.name) ?? STARTING_GOLD,
      questProgress: this.getQuestProgress(player.name),
      appearance: {
        bodyColor: player.bodyColor,
        hairColor: player.hairColor,
        outfitColor: player.outfitColor,
        hairStyle: player.hairStyle as "short" | "long" | "spiky",
        outfitStyle: player.outfitStyle as "robe" | "armor" | "casual",
      },
      inventory: normalizeInventory(this.inventories.get(player.name)),
      hp: this.playerHp.get(player.name) ?? getPlayerMaxHp(player.level),
      equipment: normalizeEquipment(this.playerEquipment.get(player.name)),
      npcInteractAt: this.npcInteractAt.get(player.name) ?? {},
      mobGoldClaimed: this.mobGoldClaimed.get(player.name) ?? {},
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