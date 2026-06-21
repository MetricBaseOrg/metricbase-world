import { Client, Room, ServerError } from "@colyseus/core";
import {
  advanceQuestObjective,
  ATTACK_COOLDOWN_MS,
  ATTACK_RANGE,
  buildSkillStatePayload,
  buildQuestViews,
  CHOP_RANGE,
  computeChopDurationMs,
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
  getConsumableHeal,
  getRecipe,
  ITEMS,
  getShopByNpcId,
  getShopDefinition,
  getZoneConfig,
  removeItemFromInventory,
  STARTING_GOLD,
  JoinOptions,
  normalizeCharacterAppearance,
  normalizeInventory,
  normalizeSkills,
  woodcuttingLevelFromXp,
  computeMineDurationMs,
  computeFishDurationMs,
  FARM_RANGE,
  getFarmCropBySeed,
  DEFAULT_FARM_SEED,
  PLOT_PRICE,
  HOUSE_RANGE,
  structureLabel,
  getEmote,
  EMOTE_COOLDOWN_MS,
  type GatherSkill,
  type FarmPlotState,
  type LandPlotState,
  type StructureType,
  type ZoneResourceNode,
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
  getMobRewardConfig,
  COMBAT_RECENT_MS,
  HP_REGEN_AMOUNT,
  HP_REGEN_INTERVAL_MS,
  RESPAWN_GOLD_COST,
  RESPAWN_WAIT_MS,
  TRAINING_DUMMY_COUNTER_DAMAGE,
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
import { checkWalletTokenGate } from "../solana/tokenBalance.js";
import {
  acceptBidOrder,
  buildMarketState,
  cancelPlayerMarketOrder,
  completeBidPayment,
  fillAskOrder,
  placeMarketOrder,
} from "../market/service.js";
import { dynamicSellPrices, effectiveSellPrice, recordSale } from "../market/sellPressure.js";
import { buildLandPlotStates, claimPlot, getPlotOwner } from "../housing/landRegistry.js";

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
  private playerKnockedOutUntil = new Map<string, number>();
  private playerLastCombatAt = new Map<string, number>();
  private playerLastRegenAt = new Map<string, number>();
  private attackCooldowns = new Map<string, number>();
  private transferring = new Set<string>();
  private questProgress = new Map<string, QuestProgress>();
  private mobHp = new Map<string, number>();
  private mobRespawnAt = new Map<string, number>();
  private resourceRespawnAt = new Map<string, number>();
  private resourceChopper = new Map<string, string>();
  private activeChopSessions = new Map<
    string,
    { resourceId: string; playerName: string; startedAt: number; endsAt: number; durationMs: number }
  >();
  private playerSkills = new Map<string, ReturnType<typeof normalizeSkills>>();
  // Active farm plots (empty plots are absent from the map).
  private farmPlots = new Map<
    string,
    {
      cropId: string;
      seedId: string;
      plantedAt: number;
      readyAt: number;
      planterName: string;
      readyBroadcast: boolean;
    }
  >();
  private inventories = new Map<string, InventoryEntry[]>();
  private playerEmoteAt = new Map<string, number>();
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

    this.onMessage("chop", (client, message: { resourceId?: string }) => {
      void this.handleChop(client, message.resourceId ?? "");
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

    this.onMessage("craft", (client, message: { recipeId?: string }) => {
      void this.handleCraft(client, message.recipeId ?? "");
    });

    this.onMessage("farmInteract", (client, message: { plotId?: string }) => {
      void this.handleFarmInteract(client, message.plotId ?? "");
    });

    this.onMessage("housingBuy", (client, message: { plotId?: string; structure?: string }) => {
      void this.handleHousingBuy(
        client,
        message.plotId ?? "",
        message.structure === "shop" ? "shop" : "house",
      );
    });

    this.onMessage("emote", (client, message: { emoteId?: string }) => {
      this.handleEmote(client, message.emoteId ?? "");
    });

    this.onMessage("requestRespawn", (client, message: { payGold?: boolean }) => {
      void this.handleRequestRespawn(client, Boolean(message.payGold));
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

    const gate = await checkWalletTokenGate(payload.wallet);
    if (!gate.allowed) {
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

    const maxHp = getPlayerMaxHp(player.level);
    const spawn = tileToWorld(this.zoneConfig.spawnTile.x, this.zoneConfig.spawnTile.y);
    const savedHp = saved?.hp ?? maxHp;
    const knockedUntil = saved?.knockedOutUntil ?? null;
    const freeRespawnReady = savedHp <= 0 && (!knockedUntil || Date.now() >= knockedUntil);

    if (freeRespawnReady) {
      player.x = spawn.x;
      player.y = spawn.y;
      this.playerHp.set(player.name, maxHp);
    } else if (savedHp <= 0 && knockedUntil && Date.now() < knockedUntil) {
      player.x = spawn.x;
      player.y = spawn.y;
      this.playerHp.set(player.name, 0);
      this.playerKnockedOutUntil.set(player.name, knockedUntil);
    } else if (saved && saved.zoneId === this.zoneConfig.id) {
      player.x = saved.x;
      player.y = saved.y;
      this.playerHp.set(player.name, Math.min(savedHp, maxHp));
    } else {
      player.x = spawn.x;
      player.y = spawn.y;
      this.playerHp.set(player.name, Math.min(savedHp, maxHp));
    }

    // Safety net: never drop a player onto a blocked tile. Stale saved
    // coordinates inside a wall (e.g. the map corner) leave the player
    // unable to move in any direction — snap them back to the spawn tile.
    if (!isWalkable(this.zoneConfig.id, player.x, player.y)) {
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
    this.npcInteractAt.set(player.name, saved?.npcInteractAt ?? {});
    this.mobGoldClaimed.set(player.name, saved?.mobGoldClaimed ?? {});
    this.playerSkills.set(player.name, normalizeSkills(saved?.skills));

    this.sendProfile(client, player);
    this.sendQuestState(client, player.name);
    this.sendInventory(client, player.name);
    this.sendMobHealth(client);
    this.sendResourceHealth(client);
    this.sendSkillState(client, player.name);
    client.send("farmState", this.buildFarmState());
    client.send("housingState", this.buildHousingState());

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
      this.playerKnockedOutUntil.delete(player.name);
      this.playerLastCombatAt.delete(player.name);
      this.playerLastRegenAt.delete(player.name);
      this.playerWallets.delete(client.sessionId);
      this.playerSkills.delete(player.name);
    }

    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.chatCooldowns.delete(client.sessionId);
    this.attackCooldowns.delete(client.sessionId);
    this.cancelChopSession(client.sessionId, "left");
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

    for (const resource of this.zoneConfig.resources ?? []) {
      const respawnAt = this.resourceRespawnAt.get(resource.id);
      if (respawnAt && now >= respawnAt) {
        this.resourceRespawnAt.delete(resource.id);
        this.broadcastResourceHealth(resource.id);
      }
    }

    this.processChopSessions(now);
    this.processFarmGrowth(now);

    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player || !this.isKnockedOut(player.name)) continue;

      const until = this.playerKnockedOutUntil.get(player.name);
      if (until && now >= until) {
        void this.respawnPlayer(client, player, false);
      }
    }

    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.isKnockedOut(player.name)) continue;

      const maxHp = getPlayerMaxHp(player.level);
      const currentHp = this.playerHp.get(player.name) ?? maxHp;
      if (currentHp >= maxHp) continue;

      const lastCombat = this.playerLastCombatAt.get(player.name) ?? 0;
      if (now - lastCombat < COMBAT_RECENT_MS) continue;

      const lastRegen = this.playerLastRegenAt.get(player.name) ?? 0;
      if (now - lastRegen < HP_REGEN_INTERVAL_MS) continue;

      this.playerLastRegenAt.set(player.name, now);
      this.playerHp.set(player.name, Math.min(maxHp, currentHp + HP_REGEN_AMOUNT));
      this.sendProfile(client, player);
    }

    this.state.players.forEach((player, sessionId) => {
      if (this.isKnockedOut(player.name)) return;
      if (this.activeChopSessions.has(sessionId)) return;

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

    const player = this.state.players.get(sessionId);
    if (player && this.isKnockedOut(player.name)) return;

    const portal = this.zoneConfig.portals.find((entry) =>
      this.isNearPortal(worldX, worldY, entry.tileX, entry.tileY),
    );
    if (!portal) return;

    const client = this.clients.find((entry) => entry.sessionId === sessionId);
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
    if (this.isKnockedOut(player.name)) return;

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
    this.playerLastCombatAt.set(player.name, now);
    const equipment = this.playerEquipment.get(player.name);
    const damage = getPlayerAttackDamage(equipment?.weaponId);
    const nextHp = Math.max(0, currentHp - damage);
    this.mobHp.set(npcId, nextHp);

    if (npc.combat) {
      const counterDamage =
        npcId === "wild_slime" ? 5 : npcId === "slime_brute" ? 12 : TRAINING_DUMMY_COUNTER_DAMAGE;
      this.damagePlayer(client, player, counterDamage, `${npc.name} counter-attack`);
    }

    const defeated = nextHp === 0;
    if (defeated) {
      this.mobRespawnAt.set(npcId, now + npc.combat.respawnMs);
      this.grantXp(client, player, npc.combat.rewardXp, `defeated ${npc.name}`);

      const rewards = getMobRewardConfig(npcId);
      if (rewards && rewards.goldReward > 0) {
        if (rewards.goldOnceOnly) {
          const claimed = { ...(this.mobGoldClaimed.get(player.name) ?? {}) };
          if (!claimed[npcId]) {
            this.grantGold(client, player, rewards.goldReward, `defeated ${npc.name}`);
            claimed[npcId] = true;
            this.mobGoldClaimed.set(player.name, claimed);
          }
        } else {
          this.grantGold(client, player, rewards.goldReward, `defeated ${npc.name}`);
        }
      }

      if (rewards?.lootItemId) {
        await this.grantLoot(client, player.name, rewards.lootItemId, rewards.lootQuantity);
      }

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

    if (quest.rewardItemId) {
      await this.grantLoot(client, player.name, quest.rewardItemId, quest.rewardItemQuantity ?? 1);
    }

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Quest",
      body: `${player.name} completed "${quest.title}".`,
      sentAt: Date.now(),
    });

    const ariaQuests = getQuestsOfferedByNpc("hub_guide", progress);
    if (ariaQuests.length > 0) {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Quest",
        body: "Return to Aria in the hub for your next quest.",
        sentAt: Date.now(),
      });
    }

    const rookQuests = getQuestsOfferedByNpc("wilderness_scout", progress);
    if (rookQuests.length > 0) {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Quest",
        body: "Talk to Rook in the Wilderness for patrol work.",
        sentAt: Date.now(),
      });
    }

    const mossQuests = getQuestsOfferedByNpc("grotto_warden", progress);
    if (mossQuests.length > 0) {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Quest",
        body: "Talk to Moss in the Slime Grotto for a dangerous hunt.",
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
      buildShopOpenPayload(
        shop,
        npc.name,
        npc.dialogue,
        gold,
        inventory,
        market,
        dynamicSellPrices(shop.sellPrices),
      ),
    );
  }

  private sendProfile(client: Client, player: InstanceType<typeof PlayerSchema>) {
    const maxHp = getPlayerMaxHp(player.level);
    const equipment = this.playerEquipment.get(player.name);
    const knockedOut = this.isKnockedOut(player.name);
    client.send("profile", {
      level: player.level,
      xp: player.xp,
      gold: this.playerGold.get(player.name) ?? STARTING_GOLD,
      hp: this.playerHp.get(player.name) ?? maxHp,
      maxHp,
      equippedWeaponId: equipment?.weaponId ?? null,
      knockedOut,
      freeRespawnAt: knockedOut ? (this.playerKnockedOutUntil.get(player.name) ?? null) : null,
    });
  }

  private isKnockedOut(playerName: string): boolean {
    const hp = this.playerHp.get(playerName);
    return hp !== undefined && hp <= 0;
  }

  private async respawnPlayer(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    payGold: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.isKnockedOut(player.name)) {
      return { ok: false, error: "You are not knocked out." };
    }

    const now = Date.now();
    const freeRespawnAt = this.playerKnockedOutUntil.get(player.name) ?? 0;

    if (payGold) {
      const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
      if (gold < RESPAWN_GOLD_COST) {
        return { ok: false, error: `You need ${RESPAWN_GOLD_COST} gold to respawn now.` };
      }
      this.playerGold.set(player.name, gold - RESPAWN_GOLD_COST);
    } else if (now < freeRespawnAt) {
      return { ok: false, error: "Free respawn is not ready yet." };
    }

    const maxHp = getPlayerMaxHp(player.level);
    const spawn = tileToWorld(this.zoneConfig.spawnTile.x, this.zoneConfig.spawnTile.y);
    player.x = spawn.x;
    player.y = spawn.y;
    this.playerHp.set(player.name, maxHp);
    this.playerKnockedOutUntil.delete(player.name);
    this.playerLastCombatAt.delete(player.name);
    this.playerLastRegenAt.delete(player.name);
    this.inputs.set(client.sessionId, { dx: 0, dy: 0 });
    this.sendProfile(client, player);

    const message = payGold
      ? `${player.name} paid ${RESPAWN_GOLD_COST} gold to respawn.`
      : `${player.name} respawned after waiting out the knockout.`;

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: message,
      sentAt: Date.now(),
    });

    await this.persistPlayer(player);
    return { ok: true };
  }

  private async handleRequestRespawn(client: Client, payGold: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const result = await this.respawnPlayer(client, player, payGold);
    const maxHp = getPlayerMaxHp(player.level);

    client.send("respawnResult", {
      ok: result.ok,
      error: result.error,
      gold: this.playerGold.get(player.name) ?? STARTING_GOLD,
      hp: this.playerHp.get(player.name) ?? maxHp,
      maxHp,
      knockedOut: this.isKnockedOut(player.name),
      freeRespawnAt: this.isKnockedOut(player.name)
        ? (this.playerKnockedOutUntil.get(player.name) ?? null)
        : null,
    });
  }

  private damagePlayer(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    amount: number,
    reason: string,
  ) {
    if (this.isKnockedOut(player.name)) return;

    const maxHp = getPlayerMaxHp(player.level);
    const current = this.playerHp.get(player.name) ?? maxHp;
    const next = Math.max(0, current - amount);
    this.playerHp.set(player.name, next);
    this.playerLastCombatAt.set(player.name, Date.now());

    if (next === 0) {
      const spawn = tileToWorld(this.zoneConfig.spawnTile.x, this.zoneConfig.spawnTile.y);
      player.x = spawn.x;
      player.y = spawn.y;
      this.playerKnockedOutUntil.set(player.name, Date.now() + RESPAWN_WAIT_MS);
      this.inputs.set(client.sessionId, { dx: 0, dy: 0 });
    }

    const knockedOut = next === 0;
    const freeRespawnAt = knockedOut ? (this.playerKnockedOutUntil.get(player.name) ?? null) : null;
    client.send("playerDamage", { amount, currentHp: next, maxHp, knockedOut, freeRespawnAt });
    this.sendProfile(client, player);

    if (knockedOut) {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "System",
        body: `${player.name} was knocked out (${reason}). Pay ${RESPAWN_GOLD_COST} gold or wait 30 minutes to respawn.`,
        sentAt: Date.now(),
      });
      void this.persistPlayer(player);
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

    const basePrice = shop.sellPrices[itemId];
    if (!basePrice) {
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

    // Pay the current (supply-adjusted) price, then record the sale so the price
    // softens — this caps the gather→sell gold faucet.
    const unitPrice = effectiveSellPrice(itemId, basePrice);
    const payout = unitPrice * removed;
    recordSale(itemId, removed);
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

    const updated = buildShopOpenPayload(
      shop,
      "",
      "",
      gold,
      inventory,
      undefined,
      dynamicSellPrices(shop.sellPrices),
    );
    client.send("shopResult", {
      ok: true,
      gold,
      inventory: buildInventoryPayload(
        inventory,
        this.playerEquipment.get(player.name)?.weaponId ?? null,
      ),
      buyOffers: updated.buyOffers,
      sellOffers: updated.sellOffers,
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
    if (this.isKnockedOut(player.name)) return;

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

    const healAmount = getConsumableHeal(itemId) || POTION_HEAL_AMOUNT;
    const maxHp = getPlayerMaxHp(player.level);
    const currentHp = this.playerHp.get(player.name) ?? maxHp;
    const healed = Math.min(healAmount, maxHp - currentHp);
    const nextHp = Math.min(maxHp, currentHp + healAmount);
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
          ? `${player.name} used ${item.name} (+${healed} HP).`
          : `${player.name} used ${item.name} (already at full HP).`,
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

  private async handleCraft(client: Client, recipeId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const recipe = getRecipe(recipeId);
    if (!recipe) {
      client.send("craftResult", { ok: false, error: "Unknown recipe." });
      return;
    }

    let inventory = this.inventories.get(player.name) ?? [];
    const weaponId = this.playerEquipment.get(player.name)?.weaponId ?? null;
    let gold = this.playerGold.get(player.name) ?? STARTING_GOLD;

    // Verify the player has every ingredient before consuming anything.
    for (const input of recipe.inputs) {
      if (getItemQuantity(inventory, input.itemId) < input.quantity) {
        const def = ITEMS[input.itemId];
        client.send("craftResult", {
          ok: false,
          recipeId,
          gold,
          error: `Need ${input.quantity}x ${def?.name ?? input.itemId}.`,
          inventory: buildInventoryPayload(inventory, weaponId),
        });
        return;
      }
    }

    // Forge fee — a gold sink that keeps the economy from inflating.
    if (gold < recipe.goldCost) {
      client.send("craftResult", {
        ok: false,
        recipeId,
        gold,
        error: `Need ${recipe.goldCost} gold for the forge fee.`,
        inventory: buildInventoryPayload(inventory, weaponId),
      });
      return;
    }

    // Make sure there is room for the output (non-stackables need a free slot).
    const projected = addItemToInventory(inventory, recipe.output.itemId, recipe.output.quantity);
    if (projected.added <= 0) {
      client.send("craftResult", {
        ok: false,
        recipeId,
        error: "Your bag is full.",
        inventory: buildInventoryPayload(inventory, weaponId),
      });
      return;
    }

    for (const input of recipe.inputs) {
      inventory = removeItemFromInventory(inventory, input.itemId, input.quantity).inventory;
    }
    inventory = addItemToInventory(inventory, recipe.output.itemId, recipe.output.quantity).inventory;
    gold -= recipe.goldCost;
    this.playerGold.set(player.name, gold);
    this.inventories.set(player.name, inventory);
    this.sendInventory(client, player.name);
    this.sendProfile(client, player);

    const outputName = ITEMS[recipe.output.itemId]?.name ?? recipe.output.itemId;
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Crafting",
      body: `${player.name} crafted ${recipe.output.quantity}x ${outputName}.`,
      sentAt: Date.now(),
    });

    client.send("craftResult", {
      ok: true,
      recipeId,
      gold,
      inventory: buildInventoryPayload(inventory, weaponId),
    });
    await this.persistPlayer(player);
  }

  private async handleEquipItem(client: Client, itemId: string | null) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.isKnockedOut(player.name)) return;

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

  private async handleChop(client: Client, resourceId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !resourceId) return;

    const resource = (this.zoneConfig.resources ?? []).find((entry) => entry.id === resourceId);
    if (!resource) return;

    const now = Date.now();
    if (this.isKnockedOut(player.name)) return;

    const existingSession = this.activeChopSessions.get(client.sessionId);
    if (existingSession) {
      if (existingSession.resourceId === resourceId) return;
      this.cancelChopSession(client.sessionId, "switched");
    }

    const resourcePosition = tileToWorld(resource.tileX, resource.tileY);
    const distance = Math.hypot(player.x - resourcePosition.x, player.y - resourcePosition.y);
    if (distance > CHOP_RANGE) return;

    if (!this.isResourceAvailable(resourceId)) {
      const chopperSession = this.resourceChopper.get(resourceId);
      const chopper = chopperSession
        ? this.state.players.get(chopperSession)?.name
        : undefined;
      const gatherSkill = this.gatherInfo(resource).skill;
      client.send("chopResult", {
        resourceId,
        available: false,
        depleted: true,
        skillXpGained: 0,
        woodcuttingLevel: this.skillLevelFor(player.name, gatherSkill),
        skill: gatherSkill,
        skillLevel: this.skillLevelFor(player.name, gatherSkill),
        ok: false,
        error: chopper
          ? `${chopper} is already working this ${resource.name}.`
          : `${resource.name} is unavailable.`,
      });
      return;
    }

    const gather = this.gatherInfo(resource);
    const skillLevel = this.skillLevelFor(player.name, gather.skill);
    if (skillLevel < gather.requiredLevel) {
      client.send("chopResult", {
        resourceId,
        available: true,
        depleted: false,
        skillXpGained: 0,
        woodcuttingLevel: skillLevel,
        skill: gather.skill,
        skillLevel,
        ok: false,
        error: `${gather.label} level ${gather.requiredLevel} required.`,
      });
      return;
    }

    const durationMs = gather.durationMs(skillLevel);
    const startedAt = now;
    const endsAt = now + durationMs;

    this.activeChopSessions.set(client.sessionId, {
      resourceId,
      playerName: player.name,
      startedAt,
      endsAt,
      durationMs,
    });
    this.resourceChopper.set(resourceId, client.sessionId);
    this.inputs.set(client.sessionId, { dx: 0, dy: 0 });

    const startPayload = {
      resourceId,
      playerName: player.name,
      startedAt,
      endsAt,
      durationMs,
    };

    this.broadcast("chopStart", startPayload);
    this.broadcastResourceHealth(resourceId);
  }

  private processChopSessions(now: number) {
    for (const [sessionId, session] of [...this.activeChopSessions.entries()]) {
      const player = this.state.players.get(sessionId);
      if (!player) {
        this.cancelChopSession(sessionId, "left");
        continue;
      }

      if (this.isKnockedOut(player.name)) {
        this.cancelChopSession(sessionId, "knocked_out");
        continue;
      }

      const resource = (this.zoneConfig.resources ?? []).find(
        (entry) => entry.id === session.resourceId,
      );
      if (!resource) {
        this.cancelChopSession(sessionId, "invalid");
        continue;
      }

      const resourcePosition = tileToWorld(resource.tileX, resource.tileY);
      const distance = Math.hypot(player.x - resourcePosition.x, player.y - resourcePosition.y);
      if (distance > CHOP_RANGE) {
        this.cancelChopSession(sessionId, "out_of_range");
        continue;
      }

      const input = this.inputs.get(sessionId);
      if (input && (input.dx !== 0 || input.dy !== 0)) {
        this.cancelChopSession(sessionId, "moved");
        continue;
      }

      if (now >= session.endsAt) {
        void this.completeChopSession(sessionId, session, resource, player, now);
      }
    }
  }

  private cancelChopSession(sessionId: string, reason: string) {
    const session = this.activeChopSessions.get(sessionId);
    if (!session) return;

    this.activeChopSessions.delete(sessionId);
    if (this.resourceChopper.get(session.resourceId) === sessionId) {
      this.resourceChopper.delete(session.resourceId);
    }

    this.broadcast("chopCancel", {
      resourceId: session.resourceId,
      playerName: session.playerName,
      reason,
    });
    this.broadcastResourceHealth(session.resourceId);
  }

  private async completeChopSession(
    sessionId: string,
    session: { resourceId: string; playerName: string },
    resource: NonNullable<ZoneConfig["resources"]>[number],
    player: InstanceType<typeof PlayerSchema>,
    now: number,
  ) {
    const gather = this.gatherInfo(resource);

    this.activeChopSessions.delete(sessionId);
    this.resourceChopper.delete(session.resourceId);
    this.resourceRespawnAt.set(session.resourceId, now + gather.respawnMs);

    const client = this.clients.find((entry) => entry.sessionId === sessionId);
    if (client) {
      await this.grantLoot(client, player.name, gather.lootItemId, gather.lootQuantity);
    }

    const skillXpGained = gather.skillXp;
    const { newLevel, leveledUp } = this.grantSkillXp(player.name, gather.skill, skillXpGained);
    if (client) {
      this.sendSkillState(client, player.name);
    }

    if (leveledUp) {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: gather.label,
        body: `${player.name} reached ${gather.label} level ${newLevel}!`,
        sentAt: now,
      });
      await this.persistPlayer(player);
    }

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: gather.label,
      body: `${player.name} ${gather.verb} ${resource.name} (+${skillXpGained} ${gather.label} XP).`,
      sentAt: now,
    });

    this.broadcast("chopResult", {
      resourceId: session.resourceId,
      available: false,
      depleted: true,
      skillXpGained,
      woodcuttingLevel: newLevel,
      skill: gather.skill,
      skillLevel: newLevel,
      playerName: session.playerName,
      ok: true,
    });
    this.broadcastResourceHealth(session.resourceId);

    if (client) {
      await this.persistPlayer(player);
    }
  }

  private isResourceAvailable(resourceId: string): boolean {
    const respawnAt = this.resourceRespawnAt.get(resourceId);
    if (respawnAt && Date.now() < respawnAt) return false;
    return !this.resourceChopper.has(resourceId);
  }

  private buildResourceHealthPayload(resourceId: string) {
    const resource = (this.zoneConfig.resources ?? []).find((entry) => entry.id === resourceId);
    if (!resource) return null;

    const available = this.isResourceAvailable(resourceId);
    const chopperSession = this.resourceChopper.get(resourceId);
    const chopSession = chopperSession ? this.activeChopSessions.get(chopperSession) : undefined;
    const chopper = chopSession?.playerName;

    return {
      resourceId,
      available,
      ...(chopper && chopSession
        ? {
            chopperName: chopper,
            chopStartedAt: chopSession.startedAt,
            chopEndsAt: chopSession.endsAt,
            chopDurationMs: chopSession.durationMs,
          }
        : {}),
    };
  }

  /** Resolve the active gather skill + tuning for a resource node. */
  private gatherInfo(resource: ZoneResourceNode) {
    if (resource.kind === "fish" && resource.fishing) {
      const f = resource.fishing;
      return {
        skill: "fishing" as GatherSkill,
        label: "Fishing",
        verb: "reeled in a catch from",
        requiredLevel: f.requiredLevel ?? 1,
        nodeLevel: f.spotLevel,
        skillXp: f.skillXp,
        respawnMs: f.respawnMs,
        lootItemId: f.lootItemId,
        lootQuantity: f.lootQuantity,
        durationMs: (lvl: number) => computeFishDurationMs(f.spotLevel, lvl),
      };
    }
    if (resource.kind === "rock" && resource.mining) {
      const m = resource.mining;
      return {
        skill: "mining" as GatherSkill,
        label: "Mining",
        verb: "mined",
        requiredLevel: m.requiredLevel ?? 1,
        nodeLevel: m.rockLevel,
        skillXp: m.skillXp,
        respawnMs: m.respawnMs,
        lootItemId: m.lootItemId,
        lootQuantity: m.lootQuantity,
        durationMs: (lvl: number) => computeMineDurationMs(m.rockLevel, lvl),
      };
    }
    const w = resource.woodcutting ?? {
      treeLevel: 1,
      skillXp: 0,
      respawnMs: 30_000,
      lootItemId: "item_wood",
      lootQuantity: 1,
    };
    return {
      skill: "woodcutting" as GatherSkill,
      label: "Woodcutting",
      verb: "felled",
      requiredLevel: w.requiredLevel ?? 1,
      nodeLevel: w.treeLevel,
      skillXp: w.skillXp,
      respawnMs: w.respawnMs,
      lootItemId: w.lootItemId,
      lootQuantity: w.lootQuantity,
      durationMs: (lvl: number) => computeChopDurationMs(w.treeLevel, lvl),
    };
  }

  private skillLevelFor(playerName: string, skill: GatherSkill): number {
    const skills = this.playerSkills.get(playerName) ?? normalizeSkills();
    // All gather skills share the same XP curve.
    return woodcuttingLevelFromXp(skills[skill]);
  }

  private grantWoodcuttingXp(playerName: string, amount: number) {
    return this.grantSkillXp(playerName, "woodcutting", amount);
  }

  private grantSkillXp(playerName: string, skill: GatherSkill, amount: number) {
    const skills = this.playerSkills.get(playerName) ?? normalizeSkills();
    const previousLevel = woodcuttingLevelFromXp(skills[skill]);
    const updated = { ...skills, [skill]: skills[skill] + amount };
    this.playerSkills.set(playerName, updated);
    const newLevel = woodcuttingLevelFromXp(updated[skill]);
    return {
      updated,
      previousLevel,
      newLevel,
      leveledUp: newLevel > previousLevel,
    };
  }

  private buildFarmState(): { plots: FarmPlotState[] } {
    const now = Date.now();
    const plots: FarmPlotState[] = (this.zoneConfig.farmPlots ?? []).map((plot) => {
      const active = this.farmPlots.get(plot.id);
      if (!active) return { plotId: plot.id, stage: "empty" as const };
      return {
        plotId: plot.id,
        stage: now >= active.readyAt ? ("ready" as const) : ("growing" as const),
        cropId: active.cropId,
        plantedAt: active.plantedAt,
        readyAt: active.readyAt,
        planterName: active.planterName,
      };
    });
    return { plots };
  }

  private broadcastFarmState() {
    this.broadcast("farmState", this.buildFarmState());
  }

  private processFarmGrowth(now: number) {
    for (const [, plot] of this.farmPlots) {
      // Broadcast once when a plot first becomes ready so clients flip to the
      // ripe stage without us streaming state every tick.
      if (now >= plot.readyAt && !plot.readyBroadcast) {
        plot.readyBroadcast = true;
        this.broadcastFarmState();
      }
    }
  }

  private async handleFarmInteract(client: Client, plotId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId || this.isKnockedOut(player.name)) return;

    const plot = (this.zoneConfig.farmPlots ?? []).find((entry) => entry.id === plotId);
    if (!plot) return;

    const plotPos = tileToWorld(plot.tileX + 0.5, plot.tileY + 0.5);
    if (Math.hypot(player.x - plotPos.x, player.y - plotPos.y) > FARM_RANGE) {
      client.send("farmResult", { ok: false, plotId, error: "Move closer to the plot." });
      return;
    }

    const weaponId = this.playerEquipment.get(player.name)?.weaponId ?? null;
    const active = this.farmPlots.get(plotId);
    const now = Date.now();

    if (!active) {
      // Plant the default crop if the player has a seed.
      const crop = getFarmCropBySeed(DEFAULT_FARM_SEED);
      if (!crop) return;
      let inventory = this.inventories.get(player.name) ?? [];
      if (getItemQuantity(inventory, crop.seedItemId) < 1) {
        client.send("farmResult", {
          ok: false,
          plotId,
          action: "plant",
          error: `You need a ${ITEMS[crop.seedItemId]?.name ?? "seed"} (buy from Pip).`,
        });
        return;
      }
      inventory = removeItemFromInventory(inventory, crop.seedItemId, 1).inventory;
      this.inventories.set(player.name, inventory);
      this.sendInventory(client, player.name);
      this.farmPlots.set(plotId, {
        cropId: crop.cropItemId,
        seedId: crop.seedItemId,
        plantedAt: now,
        readyAt: now + crop.growMs,
        planterName: player.name,
        readyBroadcast: false,
      });
      this.broadcastFarmState();
      client.send("farmResult", {
        ok: true,
        plotId,
        action: "plant",
        inventory: buildInventoryPayload(inventory, weaponId),
        playerName: player.name,
      });
      return;
    }

    if (now < active.readyAt) {
      client.send("farmResult", { ok: false, plotId, error: "Still growing." });
      return;
    }

    // Harvest.
    const crop = getFarmCropBySeed(active.seedId);
    const yieldQty = crop?.yield ?? 1;
    await this.grantLoot(client, player.name, active.cropId, yieldQty);
    const skillXp = crop?.skillXp ?? 10;
    const { newLevel, leveledUp } = this.grantSkillXp(player.name, "farming", skillXp);
    this.sendSkillState(client, player.name);
    this.farmPlots.delete(plotId);
    this.broadcastFarmState();

    const cropName = ITEMS[active.cropId]?.name ?? active.cropId;
    if (leveledUp) {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Farming",
        body: `${player.name} reached Farming level ${newLevel}!`,
        sentAt: now,
      });
    }
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Farming",
      body: `${player.name} harvested ${yieldQty}x ${cropName} (+${skillXp} Farming XP).`,
      sentAt: now,
    });

    const inventory = this.inventories.get(player.name) ?? [];
    client.send("farmResult", {
      ok: true,
      plotId,
      action: "harvest",
      skillXpGained: skillXp,
      farmingLevel: newLevel,
      inventory: buildInventoryPayload(inventory, weaponId),
      playerName: player.name,
    });
    await this.persistPlayer(player);
  }

  private handleEmote(client: Client, emoteId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !getEmote(emoteId)) return;

    const now = Date.now();
    const last = this.playerEmoteAt.get(client.sessionId) ?? 0;
    if (now - last < EMOTE_COOLDOWN_MS) return;
    this.playerEmoteAt.set(client.sessionId, now);

    this.broadcast("emote", { playerName: player.name, emoteId });
  }

  private buildHousingState(): { plots: LandPlotState[] } {
    const plotIds = (this.zoneConfig.landPlots ?? []).map((plot) => plot.id);
    return { plots: buildLandPlotStates(plotIds) };
  }

  private broadcastHousingState() {
    this.broadcast("housingState", this.buildHousingState());
  }

  private async handleHousingBuy(client: Client, plotId: string, structure: StructureType) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId || this.isKnockedOut(player.name)) return;

    const plot = (this.zoneConfig.landPlots ?? []).find((entry) => entry.id === plotId);
    if (!plot) return;

    if (getPlotOwner(plotId)) {
      client.send("housingResult", { ok: false, plotId, error: "That plot is already owned." });
      return;
    }

    const plotPos = tileToWorld(plot.tileX, plot.tileY);
    if (Math.hypot(player.x - plotPos.x, player.y - plotPos.y) > HOUSE_RANGE) {
      client.send("housingResult", { ok: false, plotId, error: "Move closer to the plot." });
      return;
    }

    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < PLOT_PRICE) {
      client.send("housingResult", {
        ok: false,
        plotId,
        gold,
        error: `You need ${PLOT_PRICE} gold to buy this plot.`,
      });
      return;
    }

    const nextGold = gold - PLOT_PRICE;
    this.playerGold.set(player.name, nextGold);
    const wallet = this.getClientWallet(client) ?? this.playerWallets.get(client.sessionId) ?? null;
    claimPlot(plotId, this.zoneConfig.id, player.name, wallet, structure);
    this.sendProfile(client, player);
    this.broadcastHousingState();

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Housing",
      body: `${player.name} bought a plot and built a ${structureLabel(structure)}!`,
      sentAt: Date.now(),
    });

    client.send("housingResult", {
      ok: true,
      plotId,
      gold: nextGold,
      ownerName: player.name,
    });
    await this.persistPlayer(player);
  }

  private sendSkillState(client: Client, playerName: string) {
    const skills = this.playerSkills.get(playerName) ?? normalizeSkills();
    client.send("skillState", buildSkillStatePayload(skills));
  }

  private sendResourceHealth(client: Client) {
    for (const resource of this.zoneConfig.resources ?? []) {
      const payload = this.buildResourceHealthPayload(resource.id);
      if (payload) {
        client.send("resourceHealth", payload);
      }
    }
  }

  private broadcastResourceHealth(resourceId: string) {
    const payload = this.buildResourceHealthPayload(resourceId);
    if (!payload) return;
    this.broadcast("resourceHealth", payload);
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
      knockedOutUntil: this.isKnockedOut(player.name)
        ? (this.playerKnockedOutUntil.get(player.name) ?? null)
        : null,
      skills: normalizeSkills(this.playerSkills.get(player.name)),
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