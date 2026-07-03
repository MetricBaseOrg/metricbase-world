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
  getCraftDurationMs,
  getDismantleRefund,
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
  LIGHT_OIL_ITEM,
  LIGHT_REFUEL_AMOUNT,
  LIGHT_MAX_ENERGY,
  REST_COOLDOWN_MS,
  HOUSE_RANGE,
  PLOT_DECOR_SLOTS,
  isValidRoofId,
  isValidDecorId,
  sanitizeSign,
  structureLabel,
  GUILD_CREATE_COST,
  sanitizeGuildName,
  sanitizeGuildTag,
  MAX_SHOP_LISTINGS,
  getEmote,
  EMOTE_COOLDOWN_MS,
  type GatherSkill,
  type FarmPlotState,
  type LandPlotState,
  type WorldStatsPayload,
  type StructureType,
  type ZoneResourceNode,
  MIN_TOKEN_UI_AMOUNT,
  PORTAL_TRIGGER_RANGE,
  levelFromXp,
  type InventoryEntry,
  MAX_PLAYERS_PER_ZONE,
  NPC_INTERACT_COOLDOWN_MS,
  NPC_INTERACT_RANGE,
  getPlayerMaxHp,
  isCollectObjectiveMet,
  normalizeEquipment,
  getEquipmentStats,
  getMountSpeed,
  buildEquipmentState,
  getGearStat,
  ENHANCEABLE_SLOTS,
  MAX_ENHANCE_LEVEL,
  enhanceCost,
  enhanceSuccessRate,
  fieldForGearSlot,
  maxDurabilityForSlot,
  armorReduction,
  rollHit,
  WEARABLE_SLOTS,
  type AbilityDef,
  getAbilityById,
  weaponGrantsAbility,
  getZoneDangerTier,
  type DangerTier,
  type LootBagState,
  CRIMINAL_DURATION_MS,
  STARTER_PROTECTION_LEVEL,
  SPAWN_IMMUNITY_MS,
  MIN_BOUNTY,
  CAPTURE_RANGE,
  CAPTURE_TIME_MS,
  TERRITORY_INCOME,
  TERRITORY_INCOME_INTERVAL_MS,
  type TerritoryStatePayload,
  type TerritoryPointState,
  KING_CRYSTAL_MAX_HP,
  SIEGE_PRIZE,
  KING_CRYSTAL_TILE,
  SIEGE_ATTACK_RANGE,
  getSiegeWindow,
  type SiegeStatePayload,
  ZONE_BLACK,
  ZONE_JAIL,
  JAIL_DURATION_MS,
  DUEL_MAX_MS,
  DUEL_CHALLENGE_TTL_MS,
  DUEL_CHALLENGE_RANGE,
  STARTING_PVP_RATING,
  PVP_KILL_RATING,
  PVP_DEATH_RATING,
  getPvpSeason,
  HONOR_PER_KILL,
  GUILD_COIN_PER_KILL,
  GEMS_PER_ELITE,
  GEM_DROP_CHANCE,
  GEM_ELITE_MIN_XP,
  getSoftOffer,
  type SoftCurrencyId,
  getCasinoTable,
  getCasinoCurrency,
  isCasinoCurrencyActive,
  CASINO_CURRENCIES,
  MAX_HAND_RETURN_MULT,
  dailyBonusGold,
  toBaseUnits,
  toUiAmount,
  type CasinoCurrencyId,
  type CasinoStatePayload,
  type BlackjackState,
  MAIL_SEND_COST,
  validateMail,
  AD_SLOTS,
  AD_MIN_DEPOSIT,
  AD_IMPRESSION_INTERVAL_MS,
  AD_REQUIRED_INVITES,
  validateCampaign,
  BLACK_ZONE_BURN_AMOUNT,
  VIP_PASS_GOLD_COST,
  VIP_PASS_BURN_AMOUNT,
  VIP_PASS_GOLD_ONLY_COST,
  VIP_PASS_DAYS,
  METRICBASE_TOKEN_MINT,
  type EquipmentSlot,
  type GearKindSlot,
  getToolSpeedMultiplier,
  getToolYieldBonus,
  rollRareGatherDrop,
  type PlayerEquipment,
  PLAYER_SPEED,
  POTION_HEAL_AMOUNT,
  getMobRewardConfig,
  COMBAT_RECENT_MS,
  HP_REGEN_AMOUNT,
  HP_REGEN_INTERVAL_MS,
  MAX_STAMINA,
  STARTING_STAMINA,
  STAMINA_COST_GATHER,
  STAMINA_COST_ATTACK,
  STAMINA_COST_FARM,
  STAMINA_REGEN_AMOUNT,
  STAMINA_REGEN_INTERVAL_MS,
  clampStamina,
  getConsumableStamina,
  hasStaminaFor,
  gatherDurationMultiplier,
  rainFishingBonus,
  RESPAWN_GOLD_COST,
  RESPAWN_WAIT_MS,
  TRAINING_DUMMY_COUNTER_DAMAGE,
  PlayerSchema,
  partyAssistXp,
  partyGatherShareXp,
  partyKillXp,
  PARTY_ASSIST_RANGE,
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
  getWeather,
  getWorldTime,
  ZONE_INTERIOR,
  ZONE_HUB,
  ZONE_SLOT_COST,
  ZONE_PASS_MS,
  playerZoneToConfig,
  zoneAssetPrice,
  type PlayerZoneBuild,
  type PlayerZoneRecord,
} from "@metricbase/shared";
import { verifyAccessToken } from "../auth/accessToken.js";
import { isTokenGateEnabled } from "../auth/tokenGate.js";
import {
  CharacterBindingError,
  loadCharacterByWallet,
  resolveCharacterForJoin,
  saveCharacter,
} from "../db/characters.js";
import { isInvitationSystemActive, validateAndUseInviteCode, getInvitedCount } from "../db/invitations.js";
import { isWalkable, blockPlotFootprint, clearCollisionCache } from "../map/collision.js";
import { checkWalletTokenGate, getWalletTokenBalance } from "../solana/tokenBalance.js";
import { verifyTokenBurn } from "../solana/verifyTokenBurn.js";
import { getCachedHolderCount } from "../solana/holderCount.js";
import { getLeaderboard } from "../db/leaderboard.js";
import { verifyPeerSolTransfer } from "../solana/verifyPeerSolTransfer.js";
import { verifyPeerTokenTransfer } from "../solana/verifyPeerTokenTransfer.js";
import { getTreasuryWallet } from "../solana/verifyTokenTransfer.js";
import { getHouseWalletAddress, getHouseBalanceUi, isWithdrawEnabled, sendPayout } from "../solana/housePayout.js";
import { adService } from "../ads/adService.js";
import {
  getCasinoBalances,
  adjustCasinoBalance,
  creditDepositOnce,
  recordWithdrawal,
  getDailyStatus,
  claimDaily,
} from "../db/casino.js";
import {
  characterExists,
  insertMail,
  getInbox,
  countUnread,
  markMailRead,
  claimMailGold,
  deleteMail,
} from "../db/mail.js";
import {
  startHand,
  playerHit,
  playerDouble,
  resolveHand,
  type ActiveHand,
  type Settlement,
} from "../casino/blackjack.js";
import {
  acceptBidOrder,
  buildMarketState,
  getMarketDecimals,
  cancelPlayerMarketOrder,
  completeBidPayment,
  fillAskOrder,
  placeMarketOrder,
} from "../market/service.js";
import { dynamicSellPrices, effectiveSellPrice, recordSale } from "../market/sellPressure.js";
import {
  anyPlotLit,
  buildLandPlotStates,
  claimPlot,
  getPlotLight,
  getPlotOwner,
  refuelPlot,
  setPlotDecor,
  setPlotLight,
  setPlotRoof,
  setPlotSign,
  updatePlotShop,
} from "../housing/landRegistry.js";
import {
  getFarmPlot,
  getFarmPlotsForZone,
  harvestFarmPlot,
  markReadyBroadcast,
  plantFarmPlot,
} from "../farming/farmRegistry.js";
import {
  buildGuildStatePayload,
  createGuild,
  getGuildForMember,
  requestJoinGuild,
  approveJoinRequest,
  denyJoinRequest,
  cancelJoinRequest,
  leaveGuild,
  tagForMember,
  promoteMember,
  demoteMember,
  kickMember,
  setGuildTax,
  depositToBank,
  withdrawFromBank,
  applyGuildTax,
  declareWar,
  endWar,
  arePlayersAtWar,
  guildMemberNames,
  guildTagById,
  guildMembersById,
  depositToBankById,
} from "../guild/guildRegistry.js";
import {
  addZoneEarnings,
  addZoneTax,
  canEnterZone,
  collectZoneEarnings,
  createPlayerZone,
  getPlayerZone,
  getPublishedZones,
  getZoneGatherTax,
  getZonesOwnedBy,
  grantZonePass,
  isPlayerZoneId,
  sanitizeBuild,
  setZoneBuild,
  setZoneMeta,
} from "../zones/zoneRegistry.js";
import { creditTreasuryGold } from "../economy/treasury.js";
import { isPurchaseRedeemed, recordTokenPurchase } from "../db/tokenPurchases.js";
import { adjustAsset, getAssetInventory, getAssetQty } from "../zones/assetInventory.js";
import {
  addPendingGold,
  cancelListing,
  completeBuy,
  createListing,
  getAssetListings,
  getListing,
  takePendingGold,
} from "../zones/assetMarket.js";
import { getTerritoryOwner, setTerritoryOwner } from "../territory/territoryRegistry.js";
import { getSovereign, setSovereign } from "../siege/siegeRegistry.js";
import { clearOnline, isOnline, sendToPlayer, sendToPlayers, setOnline } from "../social/presence.js";
import {
  acceptInvite,
  buildPartyStatePayload,
  declineInvite,
  getPartyForMember,
  invitePlayer,
  leaveParty,
  type PartyMutation,
} from "../social/partyRegistry.js";

interface PendingInput {
  dx: number;
  dy: number;
}

interface ZoneRoomOptions {
  zoneId: string;
}

/** The $BASE mint players burn to unlock the Black Zone (env-overridable). */
function getBlackZoneBurnMint(): string {
  return process.env.TOKEN_MINT ?? METRICBASE_TOKEN_MINT;
}

/** The Solana RPC the client should use for burns (server-configured, reliable). */
function getClientRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

type JoinAuthData = JoinOptions & { wallet?: string };

/** Count each placeable asset used in a build (ground paint + scenery + nodes). */
function countBuildAssets(build: PlayerZoneBuild): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const t of build.tiles) add(t.type);
  for (const s of build.scenery) add(s.prop);
  for (const r of build.resources) add(r.prop ?? r.name);
  return counts;
}

export class ZoneRoom extends Room<ZoneStateInstance, ZoneRoomOptions> {
  public static activeRooms = new Set<ZoneRoom>();

  /** Total non-spectator players across all active rooms (for public stats). */
  public static onlinePlayerCount(): number {
    let n = 0;
    for (const room of ZoneRoom.activeRooms) {
      for (const [, p] of room.state.players) if (!p.spectator) n++;
    }
    return n;
  }

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
  private npcPositions = new Map<string, { x: number; y: number }>();
  private npcLastAttackAt = new Map<string, number>();
  private resourceRespawnAt = new Map<string, number>();
  private resourceChopper = new Map<string, string>();
  private activeChopSessions = new Map<
    string,
    { resourceId: string; playerName: string; startedAt: number; endsAt: number; durationMs: number }
  >();
  private playerSkills = new Map<string, ReturnType<typeof normalizeSkills>>();
  private inventories = new Map<string, InventoryEntry[]>();
  private playerEmoteAt = new Map<string, number>();
  private playerGold = new Map<string, number>();
  private playerHp = new Map<string, number>();
  private playerStamina = new Map<string, number>();
  private playerLastStaminaRegenAt = new Map<string, number>();
  private playerLastHungerNoticeAt = new Map<string, number>();
  private playerLastDarkNoticeAt = new Map<string, number>();
  private playerLastRestAt = new Map<string, number>();
  private craftingUntil = new Map<string, number>();
  private lastPlotLightSweepAt = 0;
  private playerEquipment = new Map<string, ReturnType<typeof normalizeEquipment>>();
  private playerWallets = new Map<string, string>();
  /** Spawn-immunity expiry per session (set on join/zone entry). */
  private playerImmuneUntil = new Map<string, number>();
  /** Criminal-flag expiry per player name. */
  private criminalUntil = new Map<string, number>();
  /** Active duels: each participant -> their opponent (both directions stored). */
  private activeDuels = new Map<string, string>();
  /** Duel timeout per participant. */
  private duelEndsAt = new Map<string, number>();
  /** Pending duel challenges: target name -> { from, expires }. */
  private pendingDuels = new Map<string, { from: string; expires: number }>();
  /** PvP season stats per player name (Phase 6). */
  private playerPvpRating = new Map<string, number>();
  private playerPvpKills = new Map<string, number>();
  private playerPvpSeason = new Map<string, number>();
  /** Soft currency balances per player name (HUD-P4). */
  private playerHonor = new Map<string, number>();
  private playerGuildCoin = new Map<string, number>();
  private playerGems = new Map<string, number>();
  /** Active blackjack hands per player name (with the last settlement, if done). */
  private blackjackHands = new Map<string, { hand: ActiveHand; settlement?: Settlement }>();
  /** Open bounties: target name -> pooled gold. */
  private bounties = new Map<string, number>();
  /** Active loot bags in this room, keyed by bag id. */
  private lootBags = new Map<string, LootBagState>();
  private lastLootSweepAt = 0;
  /** Capture progress per control point in this zone (transient). */
  private captureProgress = new Map<string, { guildId: string; progressMs: number }>();
  private contestedPoints = new Set<string>();
  private lastTerritoryIncomeAt = Date.now();
  /** Castle Siege (Black zone only): King Crystal HP + last broadcast window state. */
  private crystalHp = KING_CRYSTAL_MAX_HP;
  private siegeWasActive = false;
  private lastSiegeBroadcastAt = 0;
  /** Wallets with LIFETIME Black-zone access (one-time $BASE burn). DB-backed. */
  private static blackPassWallets = new Set<string>();
  /** VIP Lodge passes (wallet -> expiry) bought with gold + a $BASE burn.
   *  NOTE: in-memory; resets on restart. Move to DB persistence for production. */
  private static vipPassUntil = new Map<string, number>();
  /** Jail sentences (player name -> release time). In-memory; clears on restart. */
  private static jailedUntil = new Map<string, number>();
  /** Tracks which session ID is "active" for each player name. Used to prevent
   *  a stale onLeave from wiping in-memory state belonging to a new session. */
  private activePlayerSession = new Map<string, string>();
  private zoneConfig!: ZoneConfig;
  /** Set only for player-owned zones; the owning record backing this room. */
  private playerZone?: PlayerZoneRecord;

  onCreate(options: ZoneRoomOptions) {
    ZoneRoom.activeRooms.add(this);
    // Player-owned zones ("Worlds") resolve their config from the DB-backed
    // registry; the built-in zones use the static ZONE_CONFIGS table.
    if (isPlayerZoneId(options.zoneId)) {
      const record = getPlayerZone(options.zoneId);
      if (!record) throw new ServerError(4000, "That World no longer exists.");
      this.playerZone = record;
      this.zoneConfig = playerZoneToConfig(record);
    } else {
      this.zoneConfig = getZoneConfig(options.zoneId);
    }
    this.maxClients = MAX_PLAYERS_PER_ZONE;
    this.setState(new ZoneState());



    for (const npc of this.zoneConfig.npcs) {
      if (npc.combat) {
        this.mobHp.set(npc.id, npc.combat.maxHp);
        const spawnPos = tileToWorld(npc.tileX, npc.tileY);
        this.npcPositions.set(npc.id, { x: spawnPos.x, y: spawnPos.y });
      }
    }

    this.setSimulationInterval((deltaTime) => this.tick(deltaTime), 1000 / TICK_RATE);

    // Push refreshed world stats (holder count may update in the background).
    this.clock.setInterval(() => {
      if (this.state.players.size > 0) this.broadcast("worldStats", this.buildWorldStats());
    }, 60_000);

    // Ad impressions: each viewing player generates one per minute per slot.
    this.clock.setInterval(() => {
      if (this.state.players.size > 0) this.tickAdImpressions();
    }, AD_IMPRESSION_INTERVAL_MS);

    this.onMessage("input", (client, message: PendingInput) => {
      this.inputs.set(client.sessionId, {
        dx: clamp(message.dx, -1, 1),
        dy: clamp(message.dy, -1, 1),
      });
    });

    this.onMessage("chat", (client, message: { body?: string }) => {
      void this.handleChat(client, message.body ?? "");
    });

    this.onProtectedMessage("guildChat", (client, message: { body?: string }) => {
      this.handleGuildChat(client, message.body ?? "");
    });

    this.onProtectedMessage("partyInvite", (client, message: { targetName?: string }) => {
      this.handlePartyInvite(client, message.targetName ?? "");
    });

    this.onProtectedMessage("partyAccept", (client) => {
      this.handlePartyMutation(client, acceptInvite(this.nameFor(client)));
    });

    this.onProtectedMessage("partyDecline", (client) => {
      declineInvite(this.nameFor(client));
    });

    this.onProtectedMessage("partyLeave", (client) => {
      this.handlePartyMutation(client, leaveParty(this.nameFor(client)));
    });

    this.onMessage("requestParty", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) client.send("partyState", buildPartyStatePayload(player.name));
    });

    this.onProtectedMessage("partyChat", (client, message: { body?: string }) => {
      this.handlePartyChat(client, message.body ?? "");
    });

    this.onProtectedMessage("interact", (client, message: { npcId?: string }) => {
      void this.handleInteract(client, message.npcId ?? "");
    });

    this.onProtectedMessage("attack", (client, message: { npcId?: string }) => {
      void this.handleAttack(client, message.npcId ?? "");
    });

    this.onProtectedMessage("ability", (client, message: { abilityId?: string; npcId?: string }) => {
      void this.handleAbility(client, message.abilityId ?? "", message.npcId ?? "");
    });

    this.onProtectedMessage("attackPlayer", (client, message: { targetName?: string }) => {
      void this.handleAttackPlayer(client, message.targetName ?? "");
    });

    this.onProtectedMessage("attackCrystal", (client) => {
      this.handleAttackCrystal(client);
    });

    this.onProtectedMessage("duelChallenge", (client, message: { targetName?: string }) => {
      this.handleDuelChallenge(client, message.targetName ?? "");
    });
    this.onProtectedMessage("duelRespond", (client, message: { fromName?: string; accept?: boolean }) => {
      this.handleDuelRespond(client, message.fromName ?? "", Boolean(message.accept));
    });

    this.onProtectedMessage("togglePvpFlag", (client, message: { on?: boolean }) => {
      this.handleTogglePvpFlag(client, Boolean(message.on));
    });

    this.onProtectedMessage("lootPickup", (client, message: { bagId?: string }) => {
      void this.handleLootPickup(client, message.bagId ?? "");
    });

    this.onProtectedMessage("placeBounty", (client, message: { targetName?: string; gold?: number }) => {
      void this.handlePlaceBounty(client, message.targetName ?? "", message.gold ?? 0);
    });

    this.onProtectedMessage("burnForBlackPass", (client, message: { signature?: string }) => {
      void this.handleBurnForBlackPass(client, message.signature ?? "");
    });

    this.onProtectedMessage("buyVipPass", (client, message: { signature?: string }) => {
      void this.handleBuyVipPass(client, message.signature ?? "");
    });

    this.onProtectedMessage("buyVipPassGold", (client) => {
      void this.handleBuyVipPassGold(client);
    });

    // --- Player-owned zones ("Worlds") ---
    this.onProtectedMessage("buyZoneSlot", (client) => {
      void this.handleBuyZoneSlot(client);
    });
    this.onProtectedMessage("buyGoldFromPip", (client, message: { signature?: string; gold?: number }) => {
      void this.handleBuyGoldFromPip(client, message.signature ?? "", Number(message.gold) || 0);
    });
    this.onMessage("pipGoldInfo", (client) => {
      this.handlePipGoldInfo(client);
    });
    this.onProtectedMessage("zoneBuildSave", (client, message: { zoneId?: string; build?: unknown }) => {
      void this.handleZoneBuildSave(client, message.zoneId ?? "", message.build);
    });
    this.onProtectedMessage(
      "zoneMetaSet",
      (
        client,
        message: { zoneId?: string; displayName?: string; passPrice?: number; published?: boolean; gatherTax?: number },
      ) => {
        void this.handleZoneMetaSet(client, message.zoneId ?? "", message);
      },
    );
    this.onProtectedMessage("zoneEarningsCollect", (client, message: { zoneId?: string }) => {
      void this.handleZoneEarningsCollect(client, message.zoneId ?? "");
    });
    this.onProtectedMessage("buyZonePass", (client, message: { zoneId?: string }) => {
      void this.handleBuyZonePass(client, message.zoneId ?? "");
    });
    this.onMessage("worldsList", (client) => {
      this.handleWorldsList(client);
    });
    this.onProtectedMessage("myWorlds", (client) => {
      this.handleMyWorlds(client);
    });
    this.onProtectedMessage("assetInventory", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.sendAssetInventory(client, p.name);
    });
    this.onProtectedMessage("buildShopBuy", (client, message: { assetId?: string; qty?: number }) => {
      void this.handleBuildShopBuy(client, message.assetId ?? "", Number(message.qty) || 1);
    });
    this.onMessage("assetMarket", (client) => {
      client.send("assetMarket", { listings: getAssetListings() });
    });
    this.onProtectedMessage(
      "assetMarketList",
      (client, message: { assetId?: string; qty?: number; price?: number }) => {
        this.handleAssetMarketList(client, message.assetId ?? "", Number(message.qty) || 0, Number(message.price) || 0);
      },
    );
    this.onProtectedMessage("assetMarketCancel", (client, message: { id?: string }) => {
      this.handleAssetMarketCancel(client, message.id ?? "");
    });
    this.onProtectedMessage("assetMarketBuy", (client, message: { id?: string }) => {
      void this.handleAssetMarketBuy(client, message.id ?? "");
    });

    this.onProtectedMessage("chop", (client, message: { resourceId?: string }) => {
      void this.handleChop(client, message.resourceId ?? "");
    });

    this.onProtectedMessage("shopBuy", (client, message: { shopId?: string; itemId?: string }) => {
      void this.handleShopBuy(client, message.shopId ?? "", message.itemId ?? "");
    });

    this.onProtectedMessage("shopSell", (client, message: { shopId?: string; itemId?: string; quantity?: number }) => {
      void this.handleShopSell(
        client,
        message.shopId ?? "",
        message.itemId ?? "",
        message.quantity ?? 1,
      );
    });

    this.onProtectedMessage(
      "marketPlace",
      (client, message: { side?: string; goldAmount?: number; tokenPrice?: number; currency?: string }) => {
        void this.handleMarketPlace(
          client,
          message.side === "bid" ? "bid" : "ask",
          message.goldAmount ?? 0,
          message.tokenPrice ?? 0,
          message.currency ?? "base",
        );
      },
    );

    this.onProtectedMessage("marketCancel", (client, message: { orderId?: string }) => {
      void this.handleMarketCancel(client, message.orderId ?? "");
    });

    this.onProtectedMessage("marketFillAsk", (client, message: { orderId?: string; signature?: string }) => {
      void this.handleMarketFillAsk(client, message.orderId ?? "", message.signature ?? "");
    });

    this.onProtectedMessage("marketAcceptBid", (client, message: { orderId?: string }) => {
      void this.handleMarketAcceptBid(client, message.orderId ?? "");
    });

    this.onProtectedMessage("marketPayBid", (client, message: { orderId?: string; signature?: string }) => {
      void this.handleMarketPayBid(client, message.orderId ?? "", message.signature ?? "");
    });

    this.onMessage("marketRefresh", (client, message: { currency?: string }) => {
      void this.handleMarketRefresh(client, message?.currency);
    });

    this.onProtectedMessage("linkWallet", (client, message: { accessToken?: string }) => {
      void this.handleLinkWallet(client, message.accessToken ?? "");
    });

    this.onProtectedMessage("useItem", (client, message: { itemId?: string }) => {
      void this.handleUseItem(client, message.itemId ?? "");
    });

    this.onProtectedMessage(
      "equipItem",
      (client, message: { itemId?: string | null; slot?: string }) => {
        void this.handleEquipItem(client, message.itemId ?? null, message.slot);
      },
    );

    this.onProtectedMessage("repairGear", (client) => {
      void this.handleRepairGear(client);
    });

    this.onProtectedMessage("enhanceGear", (client, message: { slot?: string }) => {
      void this.handleEnhanceGear(client, message.slot ?? "");
    });

    this.onProtectedMessage("craft", (client, message: { recipeId?: string }) => {
      void this.handleCraft(client, message.recipeId ?? "");
    });

    this.onProtectedMessage("dismantle", (client, message: { itemId?: string }) => {
      void this.handleDismantle(client, message.itemId ?? "");
    });

    this.onProtectedMessage("buySoftItem", (client, message: { offerId?: string }) => {
      void this.handleBuySoftItem(client, message.offerId ?? "");
    });

    this.onProtectedMessage("casinoState", (client) => {
      void this.sendCasinoState(client);
    });
    this.onProtectedMessage("casinoDeposit", (client, message: { currencyId?: string; signature?: string }) => {
      void this.handleCasinoDeposit(client, message.currencyId ?? "", message.signature ?? "");
    });
    this.onProtectedMessage("casinoWithdraw", (client, message: { currencyId?: string; amount?: number }) => {
      void this.handleCasinoWithdraw(client, message.currencyId ?? "", Number(message.amount) || 0);
    });
    this.onProtectedMessage("blackjackDeal", (client, message: { currencyId?: string; bet?: number }) => {
      void this.handleBlackjackDeal(client, message.currencyId ?? "", Number(message.bet) || 0);
    });
    this.onProtectedMessage("blackjackAction", (client, message: { action?: string }) => {
      void this.handleBlackjackAction(client, message.action ?? "");
    });
    this.onProtectedMessage("casinoDailyClaim", (client) => {
      void this.handleCasinoDailyClaim(client);
    });

    // ---- Ad marketplace ----
    this.onProtectedMessage("adServing", (client) => {
      client.send("adServing", adService.getServing());
    });
    this.onProtectedMessage("adBrandDashboard", (client, m: { wallet?: string }) => {
      // Always send so houseWallet/mint reach the client even before the wallet
      // link resolves; show the balance for the linked wallet, or the one the
      // client reports if none is linked yet. Sync from the DB so the balance
      // reflects deposits credited on another instance/session.
      const wallet = this.playerWallets.get(client.sessionId) ?? m.wallet ?? "";
      void adService.syncBrand(wallet).then(() => {
        client.send("adBrandDashboard", adService.getBrandDashboard(wallet));
      });
    });
    this.onProtectedMessage("adDeposit", (client, m: { signature?: string; wallet?: string }) => {
      void this.handleAdDeposit(client, m.signature ?? "", m.wallet);
    });
    this.onProtectedMessage(
      "adCreateCampaign",
      (client, m: { name?: string; imageUrl?: string; headline?: string; clickUrl?: string; cpm?: number }) => {
        void this.handleAdCreateCampaign(client, m);
      },
    );
    this.onProtectedMessage("adPauseCampaign", (client, m: { id?: string; paused?: boolean }) => {
      void this.handleAdPauseCampaign(client, m.id ?? "", !!m.paused);
    });
    this.onProtectedMessage(
      "adEditCampaign",
      (client, m: { id?: string; name?: string; imageUrl?: string; headline?: string; clickUrl?: string; cpm?: number }) => {
        void this.handleAdEditCampaign(client, m);
      },
    );
    this.onProtectedMessage("adAdminList", (client) => {
      const wallet = this.playerWallets.get(client.sessionId);
      if (adService.isAdmin(wallet ?? null)) client.send("adAdminList", { campaigns: adService.listPending() });
      else client.send("adActionResult", { ok: false, error: "Not authorized." });
    });
    this.onProtectedMessage("adAdminDashboard", (client) => {
      const wallet = this.playerWallets.get(client.sessionId);
      if (!adService.isAdmin(wallet ?? null)) return void client.send("adActionResult", { ok: false, error: "Not authorized." });
      void adService.getAdminDashboard().then((d) => client.send("adAdminDashboard", d));
    });
    this.onProtectedMessage("adReview", (client, m: { id?: string; status?: string; note?: string }) => {
      void this.handleAdReview(client, m.id ?? "", m.status ?? "", m.note);
    });
    this.onProtectedMessage("adJoin", (client) => {
      void this.handleAdJoin(client);
    });
    this.onProtectedMessage("adProgram", (client) => {
      void this.handleAdProgram(client);
    });
    this.onProtectedMessage("adTransparency", (client) => {
      void this.handleAdTransparency(client);
    });
    this.onProtectedMessage("adClaim", (client) => {
      void this.handleAdClaim(client);
    });

    this.onProtectedMessage("mailFetch", (client) => {
      void this.sendMailState(client);
    });
    this.onProtectedMessage(
      "mailSend",
      (client, message: { to?: string; subject?: string; body?: string; gold?: number }) => {
        void this.handleMailSend(client, message.to ?? "", message.subject ?? "", message.body ?? "", Number(message.gold) || 0);
      },
    );
    this.onProtectedMessage("mailRead", (client, message: { id?: number }) => {
      void this.handleMailRead(client, Number(message.id) || 0);
    });
    this.onProtectedMessage("mailClaim", (client, message: { id?: number }) => {
      void this.handleMailClaim(client, Number(message.id) || 0);
    });
    this.onProtectedMessage("mailDelete", (client, message: { id?: number }) => {
      void this.handleMailDelete(client, Number(message.id) || 0);
    });

    this.onProtectedMessage("farmInteract", (client, message: { plotId?: string }) => {
      void this.handleFarmInteract(client, message.plotId ?? "");
    });

    this.onProtectedMessage("housingBuy", (client, message: { plotId?: string; structure?: string }) => {
      void this.handleHousingBuy(
        client,
        message.plotId ?? "",
        message.structure === "shop" ? "shop" : "house",
      );
    });

    this.onProtectedMessage(
      "housingCustomize",
      (client, message: { plotId?: string; roof?: string | null; sign?: string | null }) => {
        this.handleHousingCustomize(client, message.plotId ?? "", message);
      },
    );

    this.onProtectedMessage(
      "housingDecorate",
      (client, message: { plotId?: string; slot?: number; propId?: string | null }) => {
        this.handleHousingDecorate(
          client,
          message.plotId ?? "",
          message.slot ?? -1,
          message.propId ?? null,
        );
      },
    );

    this.onProtectedMessage("housingLight", (client, message: { plotId?: string; on?: boolean }) => {
      this.handleHousingLight(client, message.plotId ?? "", Boolean(message.on));
    });

    this.onProtectedMessage("housingRefuel", (client, message: { plotId?: string }) => {
      this.handleHousingRefuel(client, message.plotId ?? "");
    });

    this.onProtectedMessage("housingRest", (client, message: { plotId?: string }) => {
      void this.handleHousingRest(client, message.plotId ?? "");
    });

    this.onProtectedMessage("guildCreate", (client, message: { name?: string; tag?: string }) => {
      void this.handleGuildCreate(client, message.name ?? "", message.tag ?? "");
    });

    this.onProtectedMessage("guildJoin", (client, message: { guildId?: string }) => {
      this.handleGuildJoin(client, message.guildId ?? "");
    });

    this.onProtectedMessage("guildCancelRequest", (client) => {
      this.handleGuildCancelRequest(client);
    });

    this.onProtectedMessage("guildApprove", (client, message: { applicant?: string }) => {
      this.handleGuildJoinDecision(client, message.applicant ?? "", true);
    });

    this.onProtectedMessage("guildDeny", (client, message: { applicant?: string }) => {
      this.handleGuildJoinDecision(client, message.applicant ?? "", false);
    });

    this.onProtectedMessage("guildLeave", (client) => {
      this.handleGuildLeave(client);
    });

    this.onProtectedMessage("guildPromote", (client, message: { target?: string }) => {
      this.handleGuildRankAction(client, "promote", message.target ?? "");
    });
    this.onProtectedMessage("guildDemote", (client, message: { target?: string }) => {
      this.handleGuildRankAction(client, "demote", message.target ?? "");
    });
    this.onProtectedMessage("guildKick", (client, message: { target?: string }) => {
      this.handleGuildRankAction(client, "kick", message.target ?? "");
    });
    this.onProtectedMessage("guildSetTax", (client, message: { rate?: number }) => {
      this.handleGuildSetTax(client, message.rate ?? 0);
    });
    this.onProtectedMessage("guildDeposit", (client, message: { amount?: number }) => {
      void this.handleGuildBank(client, "deposit", message.amount ?? 0);
    });
    this.onProtectedMessage("guildWithdraw", (client, message: { amount?: number }) => {
      void this.handleGuildBank(client, "withdraw", message.amount ?? 0);
    });
    this.onProtectedMessage("guildDeclareWar", (client, message: { guildId?: string }) => {
      this.handleGuildWar(client, "declare", message.guildId ?? "");
    });
    this.onProtectedMessage("guildEndWar", (client, message: { guildId?: string }) => {
      this.handleGuildWar(client, "end", message.guildId ?? "");
    });

    this.onMessage("requestGuilds", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) client.send("guildState", buildGuildStatePayload(player.name));
    });

    this.onMessage("emote", (client, message: { emoteId?: string }) => {
      this.handleEmote(client, message.emoteId ?? "");
    });

    this.onMessage("toggleLamp", (client, message: { on?: boolean }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.lampOn = Boolean(message.on);
    });

    this.onProtectedMessage(
      "shopStock",
      (client, message: { plotId?: string; itemId?: string; quantity?: number; price?: number }) => {
        void this.handleShopStock(
          client,
          message.plotId ?? "",
          message.itemId ?? "",
          Math.floor(Number(message.quantity) || 0),
          Math.floor(Number(message.price) || 0),
        );
      },
    );

    this.onProtectedMessage("shopUnstock", (client, message: { plotId?: string; itemId?: string }) => {
      void this.handleShopUnstock(client, message.plotId ?? "", message.itemId ?? "");
    });

    this.onProtectedMessage(
      "shopBuyListing",
      (client, message: { plotId?: string; itemId?: string; quantity?: number }) => {
        void this.handleShopBuyListing(
          client,
          message.plotId ?? "",
          message.itemId ?? "",
          Math.floor(Number(message.quantity) || 0),
        );
      },
    );

    this.onProtectedMessage("shopCollect", (client, message: { plotId?: string }) => {
      void this.handleShopCollect(client, message.plotId ?? "");
    });

    this.onMessage("requestLeaderboard", (client) => {
      void getLeaderboard().then((payload) => client.send("leaderboard", payload));
    });

    this.onProtectedMessage("requestRespawn", (client, message: { payGold?: boolean }) => {
      void this.handleRequestRespawn(client, Boolean(message.payGold));
    });
  }

  private checkSpectator(client: Client): boolean {
    const player = this.state.players.get(client.sessionId);
    return !!player?.spectator;
  }

  private onProtectedMessage<T>(type: string, callback: (client: Client, message: T) => void | Promise<void>) {
    this.onMessage(type, (client, message: T) => {
      if (this.checkSpectator(client)) return;
      void Promise.resolve(callback(client, message)).catch(err => {
        console.error(`Error in protected handler ${type}:`, err);
      });
    });
  }

  async onAuth(_client: Client, options: JoinOptions) {
    const payload = options.accessToken ? verifyAccessToken(options.accessToken) : null;

    if (options.spectate) {
      return payload ? { ...options, wallet: payload.wallet } : options;
    }

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

    // Player-owned zones gate entry: the owner is always welcome, free zones
    // are open, and paid zones require an unexpired visitor pass.
    if (this.playerZone && !canEnterZone(this.playerZone.zoneId, name)) {
      throw new ServerError(403, "You need a visitor pass to enter this World.");
    }

    // Restore a persisted VIP Lodge pass into the in-memory map (survives restarts).
    if (wallet && saved?.vipPassUntil && saved.vipPassUntil > Date.now()) {
      const existing = ZoneRoom.vipPassUntil.get(wallet) ?? 0;
      if (saved.vipPassUntil > existing) ZoneRoom.vipPassUntil.set(wallet, saved.vipPassUntil);
    }
    // Restore lifetime Black-zone access.
    if (wallet && saved?.blackPass) {
      ZoneRoom.blackPassWallets.add(wallet);
    }

    if (!options.spectate && !saved && isInvitationSystemActive()) {
      const inviteCode = options?.inviteCode ? String(options.inviteCode).trim() : "";
      if (!inviteCode) {
        throw new ServerError(403, "Invitation code is required to register.");
      }
      try {
        if (!wallet) {
          throw new Error("Wallet is required to register with an invitation code.");
        }
        await validateAndUseInviteCode(inviteCode, wallet);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid invitation code.";
        throw new ServerError(403, msg);
      }
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
    player.guildTag = options.spectate ? "" : tagForMember(name);
    player.lampOn = false;
    player.weaponId = "";
    player.toolId = "";
    player.spectator = options.spectate || false;

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

    this.playerStamina.set(player.name, clampStamina(saved?.stamina ?? STARTING_STAMINA));

    // Safety net: never drop a player onto a blocked tile. Stale saved
    // coordinates inside a wall (e.g. the map corner) leave the player
    // unable to move in any direction — snap them back to the spawn tile.
    if (!player.spectator && !isWalkable(this.zoneConfig.id, player.x, player.y)) {
      player.x = spawn.x;
      player.y = spawn.y;
    }

    // Fresh arrivals get brief spawn immunity; criminal flag persists by time.
    this.playerImmuneUntil.set(client.sessionId, Date.now() + SPAWN_IMMUNITY_MS);
    player.pvpFlagged = false;
    player.criminal = (this.criminalUntil.get(player.name) ?? 0) > Date.now();

    // PvP season stats — lazy reset when the player's stored season has rolled over.
    {
      const season = getPvpSeason(Date.now());
      let rating = saved?.pvpRating ?? STARTING_PVP_RATING;
      let kills = saved?.pvpKills ?? 0;
      if ((saved?.pvpSeason ?? 0) !== season) {
        rating = STARTING_PVP_RATING;
        kills = 0;
      }
      this.playerPvpRating.set(player.name, rating);
      this.playerPvpKills.set(player.name, kills);
      this.playerPvpSeason.set(player.name, season);
    }

    // Soft currencies (HUD-P4).
    this.playerHonor.set(player.name, saved?.honor ?? 0);
    this.playerGuildCoin.set(player.name, saved?.guildCoin ?? 0);
    this.playerGems.set(player.name, saved?.gems ?? 0);

    this.state.players.set(client.sessionId, player);
    this.activePlayerSession.set(player.name, client.sessionId);
    setOnline(player.name, client, (type, payload) => client.send(type, payload));
    this.inputs.set(client.sessionId, { dx: 0, dy: 0 });
    this.questProgress.set(player.name, saved?.questProgress ?? { active: [], objectiveIndex: {}, completed: [] });
    this.inventories.set(player.name, normalizeInventory(saved?.inventory));
    // Collect any gold owed from asset sales made while offline.
    const owed = takePendingGold(player.name);
    this.playerGold.set(player.name, (saved?.gold ?? STARTING_GOLD) + owed);
    const eq = normalizeEquipment(saved?.equipment);
    this.playerEquipment.set(player.name, eq);
    player.weaponId = eq.weaponId ?? "";
    player.toolId = eq.toolId ?? "";
    player.speedMult = getMountSpeed(eq.mountId);
    player.petId = eq.petId ?? "";
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
    client.send("lootBags", { bags: [...this.lootBags.values()] });
    this.sendAssetInventory(client, player.name);
    // Player-owned zones aren't in the client's static ZONE_CONFIGS — push the
    // projected config so the client can render the owner's build.
    if (this.playerZone) {
      client.send("playerZoneConfig", this.zoneConfig);
    }
    if (this.zoneConfig.capturePoints?.length) {
      client.send("territoryState", this.buildTerritoryState());
    }
    if (this.isSiegeZone()) {
      client.send("siegeState", this.buildSiegeState());
    }
    ZoneRoom.broadcastWorldStatsToAll();

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: `${player.name} entered ${this.zoneConfig.displayName}.`,
      sentAt: Date.now(),
    });

    client.send("chat", {
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Anti-Bot",
      body: "🛡️ Anti-Bot System is active. Automated macros or pathing will result in a permanent ban.",
      sentAt: Date.now(),
    });

    void this.checkVisitZoneObjectives(client, player.name, this.zoneConfig.id);
  }

  async onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const isTransferring = this.transferring.has(client.sessionId);

    if (player && !isTransferring) {
      await this.persistPlayer(player);
      // Real disconnect (not a zone transfer): drop them from any party.
      const partyResult = leaveParty(player.name);
      if (partyResult.ok) {
        for (const member of partyResult.notify ?? []) {
          if (member !== player.name) {
            sendToPlayer(member, "partyState", buildPartyStatePayload(member));
          }
        }
      }
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
      // Only tear down per-player in-memory state if this session is still
      // the active one for the player name.  A rapid reconnect (e.g. avatar
      // change) can cause a new session's onJoin to run before the old
      // session's onLeave finishes – without this guard the stale onLeave
      // would delete the new session's gold, inventory, quest progress, etc.
      const isActive = this.activePlayerSession.get(player.name) === client.sessionId;
      if (isActive) {
        this.activePlayerSession.delete(player.name);
      }
      clearOnline(player.name, client);
      if (isActive) {
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
        this.playerStamina.delete(player.name);
        this.playerLastStaminaRegenAt.delete(player.name);
        this.playerLastHungerNoticeAt.delete(player.name);
        this.playerLastDarkNoticeAt.delete(player.name);
        this.playerLastRestAt.delete(player.name);
        this.craftingUntil.delete(player.name);
        this.playerSkills.delete(player.name);
        this.playerPvpRating.delete(player.name);
        this.playerPvpKills.delete(player.name);
        this.playerPvpSeason.delete(player.name);
      }
      // Leaving (or changing zone) mid-duel forfeits — the opponent wins.
      const duelOpponent = this.activeDuels.get(player.name);
      if (duelOpponent) this.endDuel(player.name, duelOpponent, duelOpponent);
      this.pendingDuels.delete(player.name);
      this.playerWallets.delete(client.sessionId);
    }

    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.chatCooldowns.delete(client.sessionId);
    this.attackCooldowns.delete(client.sessionId);
    this.cancelChopSession(client.sessionId, "left");
    this.transferring.delete(client.sessionId);
    ZoneRoom.broadcastWorldStatsToAll();
  }

  /** Total real (non-spectator) players online across every zone room. */
  private static globalOnlineCount(): number {
    let online = 0;
    for (const room of ZoneRoom.activeRooms) {
      for (const player of room.state.players.values()) {
        if (!player.spectator) online++;
      }
    }
    return online;
  }

  /** Push fresh world stats to every zone so the global online count stays in sync. */
  private static broadcastWorldStatsToAll() {
    const payload: WorldStatsPayload = {
      baseHolders: getCachedHolderCount(),
      online: ZoneRoom.globalOnlineCount(),
    };
    for (const room of ZoneRoom.activeRooms) {
      room.broadcast("worldStats", payload);
    }
  }

  private buildWorldStats(): WorldStatsPayload {
    return { baseHolders: getCachedHolderCount(), online: ZoneRoom.globalOnlineCount() };
  }

  private tick(deltaTime: number) {
    const dt = deltaTime / 1000;
    const now = Date.now();

    // Sweep expired loot bags + criminal flags roughly once a second.
    if (now - this.lastLootSweepAt > 1_000) {
      this.lastLootSweepAt = now;
      let bagsChanged = false;
      for (const [id, bag] of this.lootBags) {
        if (now >= bag.expiresAt) {
          this.lootBags.delete(id);
          bagsChanged = true;
        }
      }
      if (bagsChanged) this.broadcastLootBags();

      for (const [name, until] of this.criminalUntil) {
        if (now >= until) {
          this.criminalUntil.delete(name);
          const session = this.activePlayerSession.get(name);
          const player = session ? this.state.players.get(session) : undefined;
          if (player) player.criminal = false;
        }
      }

      // Duels: time out to a draw, and drop stale challenge invites.
      for (const [name, endsAt] of [...this.duelEndsAt]) {
        if (now >= endsAt) {
          const opp = this.activeDuels.get(name);
          if (opp) this.endDuel(name, opp, "");
        }
      }
      for (const [to, pend] of [...this.pendingDuels]) {
        if (pend.expires < now) this.pendingDuels.delete(to);
      }

      // Safety net: rescue any player stranded on a blocked tile (e.g. stale
      // saved coords inside lava/water) by snapping them back to spawn.
      const spawn = tileToWorld(this.zoneConfig.spawnTile.x, this.zoneConfig.spawnTile.y);
      for (const [sessionId, player] of this.state.players) {
        if (player.spectator || this.isKnockedOut(player.name)) continue;
        if (!isWalkable(this.zoneConfig.id, player.x, player.y)) {
          player.x = spawn.x;
          player.y = spawn.y;
          this.inputs.set(sessionId, { dx: 0, dy: 0 });
        }
      }

      // Push territory state ~1s while a point is being captured or contested
      // so clients see the capture ring advance.
      if (this.captureProgress.size > 0 || this.contestedPoints.size > 0) {
        this.broadcastTerritoryState();
      }
    }

    // Territory: advance capture progress + pay periodic income to owners.
    this.updateTerritories(deltaTime);
    if (now - this.lastTerritoryIncomeAt >= TERRITORY_INCOME_INTERVAL_MS) {
      this.lastTerritoryIncomeAt = now;
      this.payTerritoryIncome();
    }

    // Castle Siege upkeep (Black zone).
    this.updateSiege(now);

    // While any plot light burns, re-broadcast housing state every ~12s so the
    // energy bar updates and a drained light visibly switches off for everyone.
    if (now - this.lastPlotLightSweepAt > 12_000) {
      this.lastPlotLightSweepAt = now;
      if (anyPlotLit((this.zoneConfig.landPlots ?? []).map((p) => p.id), now)) {
        this.broadcastHousingState();
      }
    }

    for (const npc of this.zoneConfig.npcs) {
      if (!npc.combat) continue;
      const respawnAt = this.mobRespawnAt.get(npc.id);
      if (respawnAt && now >= respawnAt) {
        this.mobHp.set(npc.id, npc.combat.maxHp);
        const spawnPos = tileToWorld(npc.tileX, npc.tileY);
        this.npcPositions.set(npc.id, { x: spawnPos.x, y: spawnPos.y });
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

    // Slow stamina trickle so a player who runs out of food (and gold) still
    // recovers over time — food is just far faster. Runs whenever not knocked out.
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.isKnockedOut(player.name)) continue;

      const stamina = this.playerStamina.get(player.name) ?? STARTING_STAMINA;
      if (stamina >= MAX_STAMINA) continue;

      const lastTrickle = this.playerLastStaminaRegenAt.get(player.name) ?? 0;
      if (now - lastTrickle < STAMINA_REGEN_INTERVAL_MS) continue;

      this.playerLastStaminaRegenAt.set(player.name, now);
      this.playerStamina.set(player.name, clampStamina(stamina + STAMINA_REGEN_AMOUNT));
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
      const speed = PLAYER_SPEED * (player.speedMult || 1) * dt;

      const nextX = player.x + nx * speed;
      const nextY = player.y + ny * speed;

      if (player.spectator || isWalkable(this.zoneConfig.id, nextX, player.y)) {
        player.x = nextX;
      }
      if (player.spectator || isWalkable(this.zoneConfig.id, player.x, nextY)) {
        player.y = nextY;
      }

      this.checkPortals(sessionId, player.x, player.y);
    });

    // Active AI for Wild Slimes at night
    const timeState = getWorldTime(now);
    const isNightTime = timeState.phase === "night";
    const isStorm = getWeather(now).type === "storm";

    let npcMoved = false;

    for (const npc of this.zoneConfig.npcs) {
      if (!npc.combat) continue;
      const currentHp = this.mobHp.get(npc.id) ?? npc.combat.maxHp;
      if (currentHp <= 0) continue;

      const isWildSlime = npc.id.startsWith("wild_slime") || npc.id === "wild_slime";
      if (!isWildSlime) continue;

      const currentPos = this.npcPositions.get(npc.id);
      if (!currentPos) continue;

      let chasedPlayer: InstanceType<typeof PlayerSchema> | null = null;
      let minDistance = 250; // CHASE_RANGE

      if (isNightTime) {
        // Find closest alive player in the room (active at night!)
        this.state.players.forEach((player, sessionId) => {
          if (player.spectator) return;
          if (this.isKnockedOut(player.name)) return;
          if (this.transferring.has(sessionId)) return;
          const dist = Math.hypot(player.x - currentPos.x, player.y - currentPos.y);
          if (dist < minDistance) {
            minDistance = dist;
            chasedPlayer = player;
          }
        });
      }

      if (chasedPlayer) {
        // Chase player
        const dx = (chasedPlayer as any).x - currentPos.x;
        const dy = (chasedPlayer as any).y - currentPos.y;
        if (minDistance > 18) {
          const speed = 55 * dt;
          const nx = dx / minDistance;
          const ny = dy / minDistance;
          const nextX = currentPos.x + nx * speed;
          const nextY = currentPos.y + ny * speed;

          if (isWalkable(this.zoneConfig.id, nextX, currentPos.y)) {
            currentPos.x = nextX;
          }
          if (isWalkable(this.zoneConfig.id, currentPos.x, nextY)) {
            currentPos.y = nextY;
          }
          this.npcPositions.set(npc.id, currentPos);
          npcMoved = true;
        }

        // Attack player if within attack range (28px)
        if (minDistance <= 28) {
          const lastAttack = this.npcLastAttackAt.get(npc.id) ?? 0;
          if (now - lastAttack >= 1500) {
            this.npcLastAttackAt.set(npc.id, now);
            const client = this.clients.find((c) => c.sessionId === (chasedPlayer as any).sessionId);
            if (client) {
              const baseDamage = 15;
              const dmg = isStorm ? baseDamage * 4 : baseDamage;
              this.damagePlayer(client, chasedPlayer, dmg, `${npc.name} attack`);
            }
          }
        }
      } else {
        // Return to spawn tile
        const spawnPos = tileToWorld(npc.tileX, npc.tileY);
        const dx = spawnPos.x - currentPos.x;
        const dy = spawnPos.y - currentPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          const speed = 40 * dt;
          const nx = dx / dist;
          const ny = dy / dist;
          const nextX = currentPos.x + nx * speed;
          const nextY = currentPos.y + ny * speed;
          if (isWalkable(this.zoneConfig.id, nextX, currentPos.y)) {
            currentPos.x = nextX;
          }
          if (isWalkable(this.zoneConfig.id, currentPos.x, nextY)) {
            currentPos.y = nextY;
          }
          this.npcPositions.set(npc.id, currentPos);
          npcMoved = true;
        }
      }
    }

    // Broadcast NPC positions if any moved
    if (npcMoved) {
      const positionsPayload: { npcId: string; x: number; y: number }[] = [];
      for (const npc of this.zoneConfig.npcs) {
        if (npc.combat) {
          const pos = this.npcPositions.get(npc.id);
          if (pos) {
            positionsPayload.push({ npcId: npc.id, x: pos.x, y: pos.y });
          }
        }
      }
      this.broadcast("npcPositions", positionsPayload);
    }
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

  /**
   * Whether the client's linked wallet holds at least `minHold` $BASE.
   * Requires a linked wallet; on an RPC error we fail OPEN (a valid session
   * already proved holdings) rather than lock out a legitimate VIP.
   */
  private async walletHoldsAtLeast(client: Client, minHold: number): Promise<boolean> {
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) return false;
    try {
      const balance = await getWalletTokenBalance(wallet);
      return balance >= minHold;
    } catch (error) {
      console.warn(`[vip] balance lookup failed for ${wallet}; allowing on valid session.`, error);
      return true;
    }
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

      // Leaving jail: held until the sentence is served, then released + pardoned.
      if (this.zoneConfig.id === ZONE_JAIL) {
        const until = ZoneRoom.jailedUntil.get(player.name) ?? 0;
        if (until > Date.now()) {
          this.transferring.delete(client.sessionId);
          const secs = Math.ceil((until - Date.now()) / 1000);
          client.send("chat", this.systemChat("Warden", `Serve your time — ${secs}s left.`));
          return;
        }
        ZoneRoom.jailedUntil.delete(player.name);
        this.criminalUntil.delete(player.name);
        player.criminal = false;
      }

      // Criminals are barred from Safe zones (towns) until their flag expires.
      if (
        getZoneDangerTier(targetConfig.id) === "safe" &&
        (this.criminalUntil.get(player.name) ?? 0) > Date.now()
      ) {
        this.transferring.delete(client.sessionId);
        client.send("chat", this.systemChat("Guards", "Criminals can't enter town. Lie low until your bounty cools off."));
        return;
      }

      // Black zone requires a one-time lifetime $BASE burn.
      if (getZoneDangerTier(targetConfig.id) === "black") {
        const wallet = this.playerWallets.get(client.sessionId);
        if (!wallet || !ZoneRoom.blackPassWallets.has(wallet)) {
          this.transferring.delete(client.sessionId);
          client.send("blackZoneLocked", {
            mint: getBlackZoneBurnMint(),
            amount: BLACK_ZONE_BURN_AMOUNT,
            rpcUrl: getClientRpcUrl(),
          });
          return;
        }
      }

      // VIP-gated zones (e.g. the Community Lodge): enter if you hold the minimum
      // $BASE, OR hold an active timed VIP pass (gold + $BASE burn).
      if (targetConfig.vipMinHold && targetConfig.vipMinHold > 0) {
        const wallet = this.playerWallets.get(client.sessionId);
        const hasPass = wallet ? (ZoneRoom.vipPassUntil.get(wallet) ?? 0) > Date.now() : false;
        const isHolder = hasPass ? true : await this.walletHoldsAtLeast(client, targetConfig.vipMinHold);
        if (!isHolder && !hasPass) {
          this.transferring.delete(client.sessionId);
          client.send("vipLodgeLocked", {
            displayName: targetConfig.displayName,
            minHold: targetConfig.vipMinHold,
            passDays: VIP_PASS_DAYS,
            passGold: VIP_PASS_GOLD_COST,
            passBurn: VIP_PASS_BURN_AMOUNT,
            passGoldOnly: VIP_PASS_GOLD_ONLY_COST,
            mint: getBlackZoneBurnMint(),
            rpcUrl: getClientRpcUrl(),
          });
          return;
        }
      }

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
    if (!npc) {
      // Interactable scenery (arcade cabinet / blackjack table) — no NPC needed.
      const prop = this.zoneConfig.scenery?.find((s) => s.id === npcId && s.interact);
      if (prop) {
        const propPos = tileToWorld(prop.tileX, prop.tileY);
        if (Math.hypot(player.x - propPos.x, player.y - propPos.y) > NPC_INTERACT_RANGE) return;
        if (prop.interact === "arcade" && prop.arcadeUrl) {
          client.send("openArcade", { name: "Base Rush", url: prop.arcadeUrl });
        } else if (prop.interact === "blackjack") {
          client.send("openBlackjack", { name: "Blackjack" });
          void this.sendCasinoState(client);
        }
      }
      return;
    }

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
    if (npc.arcadeUrl) {
      client.send("openArcade", { name: npc.name, url: npc.arcadeUrl });
    }
    if (npc.blackjack) {
      client.send("openBlackjack", { name: npc.name });
      void this.sendCasinoState(client);
    }
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

  /** Use a weapon ability against a target — validates the equipped weapon grants it. */
  private async handleAbility(client: Client, abilityId: string, npcId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !abilityId || !npcId) return;

    const ability = getAbilityById(abilityId);
    if (!ability) return;

    const weaponId = this.playerEquipment.get(player.name)?.weaponId ?? null;
    if (!weaponGrantsAbility(weaponId, abilityId)) {
      client.send("inventoryResult", { ok: false, error: "Your weapon can't use that skill." });
      return;
    }

    await this.handleAttack(client, npcId, ability);
  }

  private async handleAttack(client: Client, npcId: string, ability?: AbilityDef) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !npcId) return;

    const npc = this.zoneConfig.npcs.find((entry) => entry.id === npcId);
    if (!npc?.combat) return;

    const now = Date.now();
    // Abilities track their own cooldown; the basic swing uses the shared one.
    const cooldownKey = ability ? `${client.sessionId}:${ability.id}` : client.sessionId;
    const cooldownMs = ability ? ability.cooldownMs : ATTACK_COOLDOWN_MS;
    const lastAttack = this.attackCooldowns.get(cooldownKey) ?? 0;
    if (now - lastAttack < cooldownMs) return;

    // Use the mob's LIVE position (it wanders via AI), not its spawn tile —
    // otherwise you can't hit a slime you're chasing once it leaves its origin.
    const npcPosition = this.npcPositions.get(npcId) ?? tileToWorld(npc.tileX, npc.tileY);
    const distance = Math.hypot(player.x - npcPosition.x, player.y - npcPosition.y);
    if (distance > ATTACK_RANGE) return;

    const currentHp = this.mobHp.get(npcId);
    if (currentHp === undefined || currentHp <= 0) return;

    const playerHp = this.playerHp.get(player.name) ?? getPlayerMaxHp(player.level);
    if (playerHp <= 0) return;

    const staminaCost = ability ? ability.staminaCost : STAMINA_COST_ATTACK;
    if (!this.spendStamina(client, player.name, staminaCost)) {
      this.attackCooldowns.set(cooldownKey, now); // throttle repeated swings
      this.notifyTooHungry(client, player.name, "fight");
      this.sendProfile(client, player);
      return;
    }

    this.attackCooldowns.set(cooldownKey, now);
    this.playerLastCombatAt.set(player.name, now);
    const equipment = normalizeEquipment(this.playerEquipment.get(player.name));
    const stats = getEquipmentStats(equipment);
    // Mobs have no armor (Phase 1); PvP in Phase 2 passes the target's armor.
    const hit = rollHit({
      attack: stats.attack,
      critChance: stats.critChance,
      critMult: stats.critMult,
      targetArmor: 0,
      skillMult: ability?.damageMult ?? 1,
    });
    const damage = hit.damage;
    const nextHp = Math.max(0, currentHp - damage);
    this.mobHp.set(npcId, nextHp);

    // Swinging wears the weapon (and a random armor piece below when hit back).
    this.wearGear(client, player, ["weapon"]);

    if (npc.combat) {
      const counterRaw =
        npcId.startsWith("wild_slime") ? 30 : npcId === "slime_brute" ? 72 : TRAINING_DUMMY_COUNTER_DAMAGE;
      // Armor mitigates incoming counter-damage with diminishing returns.
      const counterDamage = Math.max(1, Math.round(counterRaw * (1 - armorReduction(stats.armor))));
      this.damagePlayer(client, player, counterDamage, `${npc.name} counter-attack`);
      // Taking a hit wears a random worn armor piece.
      this.wearGear(client, player, this.randomWornArmorSlots(equipment));
    }

    const defeated = nextHp === 0;
    if (defeated) {
      this.mobRespawnAt.set(npcId, now + npc.combat.respawnMs);

      // Party play: nearby party members fighting in this zone share the spoils.
      const allies = this.nearbyPartyMembers(player, npcPosition);
      const baseXp = npc.combat.rewardXp;
      this.grantXp(client, player, partyKillXp(baseXp, allies.length), `defeated ${npc.name}`);
      for (const ally of allies) {
        this.grantXp(ally.client, ally.player, partyAssistXp(baseXp), `assisted vs ${npc.name}`);
        await this.checkDefeatObjectives(ally.client, ally.player.name, npcId);
        await this.persistPlayer(ally.player);
      }

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

      // Gems: a rare premium drop from powerful foes (HUD-P4).
      if (npc.combat.rewardXp >= GEM_ELITE_MIN_XP && Math.random() < GEM_DROP_CHANCE) {
        this.playerGems.set(player.name, (this.playerGems.get(player.name) ?? 0) + GEMS_PER_ELITE);
        client.send("chat", this.systemChat("Loot", `💎 You found ${GEMS_PER_ELITE} Gem!`));
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
      attackerName: player.name,
      crit: hit.crit,
    });

    // Refresh the HUD so the stamina gauge reflects the swing's energy cost.
    this.sendProfile(client, player);
  }

  /** Equipment field name that holds a given wearable slot. */
  private slotField(slot: EquipmentSlot): keyof PlayerEquipment & string {
    switch (slot) {
      case "weapon":
        return "weaponId";
      case "helmet":
        return "helmetId";
      case "chest":
        return "chestId";
      case "gloves":
        return "glovesId";
      case "boots":
        return "bootsId";
      case "cape":
        return "capeId";
      case "offhand":
        return "offhandId";
      default:
        return "weaponId";
    }
  }

  /** Pick one currently-equipped worn armor slot at random (excludes weapon/jewelry). */
  private randomWornArmorSlots(equipment: PlayerEquipment): EquipmentSlot[] {
    const candidates = WEARABLE_SLOTS.filter((slot) => {
      if (slot === "weapon") return false;
      const itemId = equipment[this.slotField(slot)] as string | null;
      return Boolean(itemId) && maxDurabilityForSlot(slot, itemId) > 0 && Number.isFinite(maxDurabilityForSlot(slot, itemId));
    });
    if (candidates.length === 0) return [];
    return [candidates[Math.floor(Math.random() * candidates.length)]];
  }

  /** Reduce durability of the given equipped slots; break gear that hits 0. */
  private wearGear(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    slots: EquipmentSlot[],
  ) {
    if (slots.length === 0) return;
    const equipment = normalizeEquipment(this.playerEquipment.get(player.name));
    const durability = { ...(equipment.durability ?? {}) };
    let broke = false;

    for (const slot of slots) {
      const field = this.slotField(slot);
      const itemId = equipment[field] as string | null;
      if (!itemId) continue;
      const max = maxDurabilityForSlot(slot, itemId);
      if (!Number.isFinite(max) || max <= 0) continue; // jewelry / non-wearing

      const current = durability[slot] ?? max;
      const next = current - 1;
      if (next <= 0) {
        // Gear breaks: remove it from the slot.
        (equipment as unknown as Record<string, unknown>)[field] = null;
        delete durability[slot];
        broke = true;
        const name = getItemDefinition(itemId).name;
        this.broadcastChat({
          id: crypto.randomUUID(),
          channel: "system",
          senderId: "system",
          senderName: "Gear",
          body: `${player.name}'s ${name} broke!`,
          sentAt: Date.now(),
        });
      } else {
        durability[slot] = next;
      }
    }

    equipment.durability = durability;
    this.playerEquipment.set(player.name, equipment);

    if (broke) {
      player.weaponId = equipment.weaponId ?? "";
      this.sendProfile(client, player);
      this.sendInventory(client, player.name);
      void this.persistPlayer(player);
    }
  }

  /** Repair all equipped gear to full durability for a gold fee. */
  private async handleRepairGear(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.isKnockedOut(player.name)) return;

    const equipment = normalizeEquipment(this.playerEquipment.get(player.name));
    const durability = { ...(equipment.durability ?? {}) };

    let missing = 0;
    const full: [EquipmentSlot, number][] = [];
    for (const slot of WEARABLE_SLOTS) {
      const itemId = equipment[this.slotField(slot)] as string | null;
      if (!itemId) continue;
      const max = maxDurabilityForSlot(slot, itemId);
      if (!Number.isFinite(max) || max <= 0) continue;
      const current = durability[slot] ?? max;
      missing += Math.max(0, max - current);
      full.push([slot, max]);
    }

    if (missing <= 0) {
      client.send("inventoryResult", { ok: false, error: "Your gear is already in good repair." });
      return;
    }

    // 2 gold per durability point restored — a steady gold sink for fighters.
    const cost = Math.max(5, Math.ceil(missing * 2));
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < cost) {
      client.send("inventoryResult", { ok: false, error: `Repair costs ${cost}g — not enough gold.` });
      return;
    }

    this.playerGold.set(player.name, gold - cost);
    for (const [slot, max] of full) durability[slot] = max;
    equipment.durability = durability;
    this.playerEquipment.set(player.name, equipment);

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Smith",
      body: `${player.name} repaired their gear for ${cost}g.`,
      sentAt: Date.now(),
    });

    this.sendProfile(client, player);
    this.sendInventory(client, player.name);
    client.send("inventoryResult", {
      ok: true,
      inventory: buildInventoryPayload(this.inventories.get(player.name) ?? [], equipment.weaponId ?? null),
    });
    await this.persistPlayer(player);
  }

  /** Attempt to enhance an equipped gear slot (+N) for a gold fee at a success rate. */
  private async handleEnhanceGear(client: Client, slot: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.isKnockedOut(player.name)) return;
    if (!ENHANCEABLE_SLOTS.includes(slot as EquipmentSlot)) {
      client.send("enhanceResult", { ok: false, error: "That can't be enhanced." });
      return;
    }
    const equipment = normalizeEquipment(this.playerEquipment.get(player.name));
    const field = this.equipFieldForSlot(slot);
    const itemId = field ? ((equipment as unknown as Record<string, unknown>)[field] as string | null) : null;
    if (!itemId) {
      client.send("enhanceResult", { ok: false, error: "Nothing equipped in that slot." });
      return;
    }
    const level = equipment.enhance?.[slot as EquipmentSlot] ?? 0;
    if (level >= MAX_ENHANCE_LEVEL) {
      client.send("enhanceResult", { ok: false, error: `Already at max +${MAX_ENHANCE_LEVEL}.` });
      return;
    }
    const cost = enhanceCost(level);
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < cost) {
      client.send("enhanceResult", { ok: false, error: `Enhancing costs ${cost}g.` });
      return;
    }

    // Gold is consumed on the attempt whether it succeeds or fails.
    this.playerGold.set(player.name, gold - cost);
    const success = Math.random() < enhanceSuccessRate(level);
    if (success) {
      equipment.enhance = { ...(equipment.enhance ?? {}), [slot]: level + 1 };
      this.playerEquipment.set(player.name, equipment);
    }

    this.sendProfile(client, player);
    client.send("equipmentState", buildEquipmentState(this.playerEquipment.get(player.name)));
    client.send("enhanceResult", {
      ok: true,
      success,
      slot,
      level: success ? level + 1 : level,
    });
    const itemName = getItemDefinition(itemId).name;
    this.broadcastChat(
      this.systemChat(
        "Smith",
        success
          ? `${player.name} enhanced ${itemName} to +${level + 1}!`
          : `${player.name}'s enhancement of ${itemName} to +${level + 1} failed.`,
      ),
    );
    await this.persistPlayer(player);
  }

  // ---- PvP combat, loot, and crime (Phase 2) ----

  private clientForName(name: string): Client | undefined {
    const sessionId = this.activePlayerSession.get(name);
    if (!sessionId) return undefined;
    return this.clients.find((entry) => entry.sessionId === sessionId);
  }

  private handleTogglePvpFlag(client: Client, on: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.pvpFlagged = on;
    client.send("chat", {
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "PvP",
      body: on ? "⚔️ PvP flag ON — you can fight (and be fought) in Yellow zones." : "🛡️ PvP flag OFF.",
      sentAt: Date.now(),
    } satisfies ChatMessagePayload);
  }

  private async handleAttackPlayer(client: Client, targetName: string) {
    const attacker = this.state.players.get(client.sessionId);
    if (!attacker || !targetName || targetName === attacker.name) return;
    if (this.isKnockedOut(attacker.name)) return;

    // Duel: if these two are dueling, route to the duel path — it bypasses all
    // zone/flag/war rules (consensual, works even in safe towns).
    if (this.areDueling(attacker.name, targetName)) {
      const dSession = this.activePlayerSession.get(targetName);
      const dVictim = dSession ? this.state.players.get(dSession) : undefined;
      if (dVictim) {
        this.duelStrike(client, attacker, dVictim);
        return;
      }
    }

    const tier: DangerTier = getZoneDangerTier(this.zoneConfig.id);
    if (tier === "safe") {
      client.send("chat", this.systemChat("PvP", "This is a Safe zone — no PvP here."));
      return;
    }

    const victimSession = this.activePlayerSession.get(targetName);
    const victim = victimSession ? this.state.players.get(victimSession) : undefined;
    const victimClient = victimSession ? this.clients.find((c) => c.sessionId === victimSession) : undefined;
    if (!victim || !victimClient || victim.spectator) return;
    if (this.isKnockedOut(victim.name)) return;

    // Starter protection — low levels can't be drawn into PvP.
    if (attacker.level < STARTER_PROTECTION_LEVEL || victim.level < STARTER_PROTECTION_LEVEL) {
      client.send("chat", this.systemChat("PvP", "Starter protection: low-level players can't be attacked."));
      return;
    }

    // Spawn immunity grace.
    if (Date.now() < (this.playerImmuneUntil.get(victimSession!) ?? 0)) {
      client.send("chat", this.systemChat("PvP", `${victim.name} still has spawn immunity.`));
      return;
    }

    // Guilds at war can fight freely (anywhere PvP is allowed); otherwise Yellow
    // zones are opt-in and need both fighters flagged.
    const atWar = arePlayersAtWar(attacker.name, victim.name);
    if (tier === "yellow" && !atWar && (!attacker.pvpFlagged || !victim.pvpFlagged)) {
      client.send("chat", this.systemChat("PvP", "In a Yellow zone both players must flag for PvP (or be at guild war)."));
      return;
    }

    const now = Date.now();
    if (now - (this.attackCooldowns.get(client.sessionId) ?? 0) < ATTACK_COOLDOWN_MS) return;

    const distance = Math.hypot(attacker.x - victim.x, attacker.y - victim.y);
    if (distance > ATTACK_RANGE) return;

    if (!this.spendStamina(client, attacker.name, STAMINA_COST_ATTACK)) {
      this.attackCooldowns.set(client.sessionId, now);
      this.notifyTooHungry(client, attacker.name, "fight");
      this.sendProfile(client, attacker);
      return;
    }
    this.attackCooldowns.set(client.sessionId, now);
    this.playerLastCombatAt.set(attacker.name, now);
    this.playerLastCombatAt.set(victim.name, now);

    const attackerStats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(attacker.name)));
    const victimStats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(victim.name)));
    const hit = rollHit({
      attack: attackerStats.attack,
      critChance: attackerStats.critChance,
      critMult: attackerStats.critMult,
      targetArmor: victimStats.armor,
    });

    this.wearGear(client, attacker, ["weapon"]);
    const knockedOut = this.damageVictimPvp(attacker, victimClient, victim, hit.damage, tier, atWar);

    this.broadcast("pvpHit", {
      attackerName: attacker.name,
      victimName: victim.name,
      damage: hit.damage,
      crit: hit.crit,
      knockedOut,
    });
    this.sendProfile(client, attacker);
  }

  // ---- Duels (consensual 1v1, no loot/crime/penalty) ----

  private areDueling(a: string, b: string): boolean {
    return this.activeDuels.get(a) === b;
  }

  private handleDuelChallenge(client: Client, targetName: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !targetName || targetName === player.name) return;
    if (player.spectator || this.isKnockedOut(player.name) || this.activeDuels.has(player.name)) return;

    const targetSession = this.activePlayerSession.get(targetName);
    const target = targetSession ? this.state.players.get(targetSession) : undefined;
    if (!target || target.spectator || this.isKnockedOut(target.name) || this.activeDuels.has(target.name)) {
      client.send("chat", this.systemChat("Duel", "They're not available to duel right now."));
      return;
    }
    if (Math.hypot(player.x - target.x, player.y - target.y) > DUEL_CHALLENGE_RANGE) {
      client.send("chat", this.systemChat("Duel", "Get closer to challenge them."));
      return;
    }

    this.pendingDuels.set(target.name, { from: player.name, expires: Date.now() + DUEL_CHALLENGE_TTL_MS });
    sendToPlayer(target.name, "duelInvite", { fromName: player.name });
    client.send("chat", this.systemChat("Duel", `Challenge sent to ${target.name}.`));
  }

  private handleDuelRespond(client: Client, fromName: string, accept: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const pending = this.pendingDuels.get(player.name);
    if (!pending || pending.from !== fromName || pending.expires < Date.now()) return;
    this.pendingDuels.delete(player.name);

    if (!accept) {
      sendToPlayer(fromName, "chat", this.systemChat("Duel", `${player.name} declined your duel.`));
      return;
    }

    const challengerSession = this.activePlayerSession.get(fromName);
    const challenger = challengerSession ? this.state.players.get(challengerSession) : undefined;
    if (!challenger || this.activeDuels.has(fromName) || this.activeDuels.has(player.name)) {
      client.send("chat", this.systemChat("Duel", "The duel could not start."));
      return;
    }

    const endsAt = Date.now() + DUEL_MAX_MS;
    this.activeDuels.set(fromName, player.name);
    this.activeDuels.set(player.name, fromName);
    this.duelEndsAt.set(fromName, endsAt);
    this.duelEndsAt.set(player.name, endsAt);
    // Both start fresh.
    for (const p of [challenger, player]) {
      this.playerHp.set(p.name, getPlayerMaxHp(p.level));
      this.sendProfile(this.clientForName(p.name) ?? client, p);
    }
    sendToPlayer(fromName, "duelStart", { opponent: player.name, endsAt });
    sendToPlayer(player.name, "duelStart", { opponent: fromName, endsAt });
    this.broadcastChat(this.systemChat("Duel", `⚔️ ${fromName} vs ${player.name} — duel on!`));
  }

  /** Resolve a single duel strike; ends the duel when the loser is downed. */
  private duelStrike(
    client: Client,
    attacker: InstanceType<typeof PlayerSchema>,
    victim: InstanceType<typeof PlayerSchema>,
  ) {
    const now = Date.now();
    if (now - (this.attackCooldowns.get(client.sessionId) ?? 0) < ATTACK_COOLDOWN_MS) return;
    if (Math.hypot(attacker.x - victim.x, attacker.y - victim.y) > ATTACK_RANGE) return;
    if (!this.spendStamina(client, attacker.name, STAMINA_COST_ATTACK)) {
      this.attackCooldowns.set(client.sessionId, now);
      this.notifyTooHungry(client, attacker.name, "duel");
      this.sendProfile(client, attacker);
      return;
    }
    this.attackCooldowns.set(client.sessionId, now);

    const aStats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(attacker.name)));
    const vStats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(victim.name)));
    const hit = rollHit({
      attack: aStats.attack,
      critChance: aStats.critChance,
      critMult: aStats.critMult,
      targetArmor: vStats.armor,
    });
    const vHp = Math.max(0, (this.playerHp.get(victim.name) ?? getPlayerMaxHp(victim.level)) - hit.damage);
    this.playerHp.set(victim.name, vHp);

    const down = vHp <= 0;
    this.broadcast("pvpHit", {
      attackerName: attacker.name,
      victimName: victim.name,
      damage: hit.damage,
      crit: hit.crit,
      knockedOut: down,
    });
    const victimClient = this.clientForName(victim.name);
    if (victimClient) {
      victimClient.send("playerDamage", {
        amount: hit.damage,
        currentHp: down ? getPlayerMaxHp(victim.level) : vHp,
        maxHp: getPlayerMaxHp(victim.level),
        knockedOut: false,
        freeRespawnAt: null,
      });
    }

    if (down) this.endDuel(attacker.name, victim.name, attacker.name);
    else this.sendProfile(client, attacker);
  }

  /** End a duel: restore both fighters and announce the result. winner "" = draw. */
  private endDuel(a: string, b: string, winner: string) {
    for (const name of [a, b]) {
      this.activeDuels.delete(name);
      this.duelEndsAt.delete(name);
      const session = this.activePlayerSession.get(name);
      const player = session ? this.state.players.get(session) : undefined;
      if (player) {
        this.playerHp.set(name, getPlayerMaxHp(player.level));
        const c = this.clientForName(name);
        if (c) {
          this.sendProfile(c, player);
          c.send("duelEnd", {
            winner,
            opponent: name === a ? b : a,
            result: winner === "" ? "draw" : winner === name ? "win" : "loss",
          });
        }
      }
    }
    this.broadcastChat(
      this.systemChat("Duel", winner ? `🏅 ${winner} won the duel!` : `🤝 ${a} vs ${b} ended in a draw.`),
    );
  }

  /** Apply PvP damage to a victim; on knockout drop loot, pay bounty, flag crime. Returns knockout. */
  private damageVictimPvp(
    attacker: InstanceType<typeof PlayerSchema>,
    victimClient: Client,
    victim: InstanceType<typeof PlayerSchema>,
    amount: number,
    tier: DangerTier,
    atWar = false,
  ): boolean {
    const maxHp = getPlayerMaxHp(victim.level);
    const current = this.playerHp.get(victim.name) ?? maxHp;
    const next = Math.max(0, current - amount);
    this.playerHp.set(victim.name, next);
    this.playerLastCombatAt.set(victim.name, Date.now());

    const knockedOut = next === 0;
    let arrested = false;
    if (knockedOut) {
      const victimWasCriminal = victim.criminal;
      // Drop loot per tier (red: resources; black: everything).
      this.dropLootBag(victim, tier);

      // Claim any bounty on the victim.
      const bounty = this.bounties.get(victim.name) ?? 0;
      if (bounty > 0) {
        this.bounties.delete(victim.name);
        const attackerClient = this.clientForName(attacker.name);
        if (attackerClient) this.grantGold(attackerClient, attacker, bounty, `bounty on ${victim.name}`);
        this.broadcastLootBags();
      }

      // Killing a non-criminal in a Yellow (lawful) zone makes the attacker a
      // criminal — unless it was a sanctioned guild-war kill.
      if (tier === "yellow" && !victimWasCriminal && !atWar) {
        this.markCriminal(attacker.name);
      }

      if (this.activePlayerSession.get(victim.name)) {
        this.inputs.set(this.activePlayerSession.get(victim.name)!, { dx: 0, dy: 0 });
      }

      if (victimWasCriminal) {
        // Caught! A criminal who's defeated goes straight to jail (no pay-to-respawn).
        arrested = true;
        ZoneRoom.jailedUntil.set(victim.name, Date.now() + JAIL_DURATION_MS);
        this.playerHp.set(victim.name, maxHp);
        this.playerKnockedOutUntil.delete(victim.name);
        victimClient.send("transfer", { targetZone: ZONE_JAIL, label: "Jail" });
        victimClient.send(
          "chat",
          this.systemChat(
            "Guards",
            `You were caught and jailed for ${Math.round(JAIL_DURATION_MS / 1000)}s!`,
          ),
        );
      } else {
        const spawn = tileToWorld(this.zoneConfig.spawnTile.x, this.zoneConfig.spawnTile.y);
        victim.x = spawn.x;
        victim.y = spawn.y;
        this.playerKnockedOutUntil.set(victim.name, Date.now() + RESPAWN_WAIT_MS);
      }

      // PvP season rating: reward the victor, dock the loser (floored at 0).
      this.playerPvpRating.set(
        attacker.name,
        (this.playerPvpRating.get(attacker.name) ?? STARTING_PVP_RATING) + PVP_KILL_RATING,
      );
      this.playerPvpKills.set(attacker.name, (this.playerPvpKills.get(attacker.name) ?? 0) + 1);
      this.playerPvpRating.set(
        victim.name,
        Math.max(0, (this.playerPvpRating.get(victim.name) ?? STARTING_PVP_RATING) - PVP_DEATH_RATING),
      );

      // Soft currencies: honor for the victor, plus guild coin if they're in a guild.
      this.playerHonor.set(attacker.name, (this.playerHonor.get(attacker.name) ?? 0) + HONOR_PER_KILL);
      if (getGuildForMember(attacker.name)) {
        this.playerGuildCoin.set(
          attacker.name,
          (this.playerGuildCoin.get(attacker.name) ?? 0) + GUILD_COIN_PER_KILL,
        );
      }
      const attackerClient = this.clientForName(attacker.name);
      if (attackerClient) {
        this.sendProfile(attackerClient, attacker);
        void this.persistPlayer(attacker);
      }

      this.broadcastChat(
        this.systemChat("PvP", `${victim.name} was defeated by ${attacker.name}!`),
      );
      void this.persistPlayer(victim);
    }

    // An arrested criminal is whisked to jail (healed), not left knocked out.
    const reportKnockedOut = knockedOut && !arrested;
    const freeRespawnAt = reportKnockedOut ? (this.playerKnockedOutUntil.get(victim.name) ?? null) : null;
    victimClient.send("playerDamage", {
      amount,
      currentHp: arrested ? maxHp : next,
      maxHp,
      knockedOut: reportKnockedOut,
      freeRespawnAt,
    });
    this.sendProfile(victimClient, victim);
    return knockedOut;
  }

  /** Spawn a loot bag at the victim with the dropped items for the zone tier. */
  private dropLootBag(victim: InstanceType<typeof PlayerSchema>, tier: DangerTier) {
    if (tier === "safe" || tier === "yellow") return; // no item loss in safe/yellow
    const inventory = this.inventories.get(victim.name) ?? [];
    const dropped: InventoryEntry[] = [];
    const kept: InventoryEntry[] = [];
    for (const entry of inventory) {
      const def = ITEMS[entry.itemId];
      // Red: only gathered materials drop. Black: everything in the bag drops.
      const dropThis = tier === "black" ? true : def?.kind === "material";
      if (dropThis) dropped.push({ ...entry });
      else kept.push({ ...entry });
    }

    // Black zones also bleed half the victim's loose gold.
    let goldDropped = 0;
    if (tier === "black") {
      const gold = this.playerGold.get(victim.name) ?? 0;
      goldDropped = Math.floor(gold / 2);
      if (goldDropped > 0) this.playerGold.set(victim.name, gold - goldDropped);
    }

    if (dropped.length === 0 && goldDropped === 0) return;
    this.inventories.set(victim.name, kept);
    const victimClient = this.clientForName(victim.name);
    if (victimClient) this.sendInventory(victimClient, victim.name);

    const bag: LootBagState = {
      id: crypto.randomUUID(),
      x: victim.x,
      y: victim.y,
      items: dropped,
      gold: goldDropped,
      expiresAt: Date.now() + 120_000,
    };
    this.lootBags.set(bag.id, bag);
    this.broadcastLootBags();
  }

  private async handleLootPickup(client: Client, bagId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !bagId) return;
    if (this.isKnockedOut(player.name)) return;
    const bag = this.lootBags.get(bagId);
    if (!bag) return;

    if (Math.hypot(player.x - bag.x, player.y - bag.y) > NPC_INTERACT_RANGE) {
      client.send("chat", this.systemChat("Loot", "Move closer to grab the loot bag."));
      return;
    }

    let inventory = this.inventories.get(player.name) ?? [];
    const leftover: InventoryEntry[] = [];
    for (const entry of bag.items) {
      const { inventory: nextInv, added } = addItemToInventory(inventory, entry.itemId, entry.quantity);
      inventory = nextInv;
      if (added < entry.quantity) leftover.push({ itemId: entry.itemId, quantity: entry.quantity - added });
    }
    this.inventories.set(player.name, inventory);
    if (bag.gold > 0) this.grantGold(client, player, bag.gold, "loot bag");

    if (leftover.length > 0) {
      // Inventory full — leave the rest in the bag.
      bag.items = leftover;
      bag.gold = 0;
      client.send("chat", this.systemChat("Loot", "Your bag is full — some loot remains."));
    } else {
      this.lootBags.delete(bagId);
    }
    this.broadcastLootBags();
    this.sendInventory(client, player.name);
    await this.persistPlayer(player);
  }

  private broadcastLootBags() {
    this.broadcast("lootBags", { bags: [...this.lootBags.values()] });
  }

  // ---- Territory Control (Phase 4) ----

  /** Advance capture progress for this zone's points (called each tick). */
  private updateTerritories(dtMs: number) {
    const points = this.zoneConfig.capturePoints;
    if (!points || points.length === 0) return;
    let ownershipChanged = false;

    for (const point of points) {
      const pos = tileToWorld(point.tileX, point.tileY);
      const owner = getTerritoryOwner(point.id);

      // Guild ids of players standing on the point.
      const present = new Set<string>();
      for (const player of this.state.players.values()) {
        if (player.spectator || this.isKnockedOut(player.name)) continue;
        if (Math.hypot(player.x - pos.x, player.y - pos.y) > CAPTURE_RANGE) continue;
        const gid = getGuildForMember(player.name)?.id;
        if (gid) present.add(gid);
      }

      if (present.size >= 2) {
        // Contested — capture is frozen.
        this.contestedPoints.add(point.id);
        continue;
      }
      this.contestedPoints.delete(point.id);

      if (present.size === 1) {
        const capGuild = [...present][0];
        if (capGuild === owner) {
          this.captureProgress.delete(point.id);
          continue;
        }
        const cur = this.captureProgress.get(point.id);
        if (!cur || cur.guildId !== capGuild) {
          this.captureProgress.set(point.id, { guildId: capGuild, progressMs: dtMs });
        } else {
          cur.progressMs += dtMs;
          if (cur.progressMs >= CAPTURE_TIME_MS) {
            setTerritoryOwner(point.id, this.zoneConfig.id, capGuild);
            this.captureProgress.delete(point.id);
            ownershipChanged = true;
            this.broadcastChat(
              this.systemChat("Territory", `🏴 [${guildTagById(capGuild)}] captured ${point.name}!`),
            );
          }
        }
      } else {
        // Empty — reset any partial capture.
        this.captureProgress.delete(point.id);
      }
    }

    if (ownershipChanged) this.broadcastTerritoryState();
  }

  /** Pay territory income into each owning guild's bank (called on an interval). */
  private payTerritoryIncome() {
    for (const point of this.zoneConfig.capturePoints ?? []) {
      const owner = getTerritoryOwner(point.id);
      if (!owner) continue;
      if (depositToBankById(owner, TERRITORY_INCOME)) {
        sendToPlayers(guildMembersById(owner), "chat", {
          id: crypto.randomUUID(),
          channel: "guild",
          senderId: "system",
          senderName: "Territory",
          body: `${point.name} paid ${TERRITORY_INCOME} gold into the guild bank.`,
          sentAt: Date.now(),
        } satisfies ChatMessagePayload);
        this.broadcastGuildState(guildMembersById(owner));
      }
    }
  }

  private buildTerritoryState(): TerritoryStatePayload {
    const points = this.zoneConfig.capturePoints ?? [];
    return {
      points: points.map((p): TerritoryPointState => {
        const owner = getTerritoryOwner(p.id);
        const cap = this.captureProgress.get(p.id);
        return {
          id: p.id,
          name: p.name,
          ownerGuildId: owner,
          ownerTag: guildTagById(owner),
          capturingTag: cap ? guildTagById(cap.guildId) : "",
          progress: cap ? Math.min(1, cap.progressMs / CAPTURE_TIME_MS) : 0,
          contested: this.contestedPoints.has(p.id),
        };
      }),
    };
  }

  private broadcastTerritoryState() {
    if (!this.zoneConfig.capturePoints?.length) return;
    this.broadcast("territoryState", this.buildTerritoryState());
  }

  // ---- Castle Siege (Phase 5) — Black Zone only ----

  private isSiegeZone(): boolean {
    return this.zoneConfig.id === ZONE_BLACK;
  }

  private buildSiegeState(): SiegeStatePayload {
    const window = getSiegeWindow(Date.now());
    return {
      active: window.active,
      hp: this.crystalHp,
      maxHp: KING_CRYSTAL_MAX_HP,
      sovereignTag: guildTagById(getSovereign()),
      nextChangeAt: window.nextChangeAt,
    };
  }

  private broadcastSiegeState() {
    if (this.isSiegeZone()) this.broadcast("siegeState", this.buildSiegeState());
  }

  /** Strike the King Crystal during an open siege window. */
  private handleAttackCrystal(client: Client) {
    if (!this.isSiegeZone()) return;
    const player = this.state.players.get(client.sessionId);
    if (!player || player.spectator || this.isKnockedOut(player.name)) return;
    if (!getSiegeWindow(Date.now()).active) return;
    if (this.crystalHp <= 0) return;

    const guild = getGuildForMember(player.name);
    if (!guild) {
      client.send("chat", this.systemChat("Siege", "Only guild members can lay siege to the crystal."));
      return;
    }

    const now = Date.now();
    if (now - (this.attackCooldowns.get(client.sessionId) ?? 0) < ATTACK_COOLDOWN_MS) return;

    const crystal = tileToWorld(KING_CRYSTAL_TILE.x, KING_CRYSTAL_TILE.y);
    if (Math.hypot(player.x - crystal.x, player.y - crystal.y) > SIEGE_ATTACK_RANGE) return;
    if (!this.spendStamina(client, player.name, STAMINA_COST_ATTACK)) {
      this.notifyTooHungry(client, player.name, "siege");
      return;
    }
    this.attackCooldowns.set(client.sessionId, now);
    this.playerLastCombatAt.set(player.name, now);

    const stats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(player.name)));
    const hit = rollHit({ attack: stats.attack, critChance: stats.critChance, critMult: stats.critMult, targetArmor: 0 });
    this.crystalHp = Math.max(0, this.crystalHp - hit.damage);
    this.wearGear(client, player, ["weapon"]);

    if (this.crystalHp <= 0) {
      // Crown the victor: prize into the guild bank + a world-wide announcement.
      setSovereign(guild.id);
      depositToBankById(guild.id, SIEGE_PRIZE);
      this.broadcastGuildState(guild.members);
      const msg = this.systemChat(
        "Castle Siege",
        `👑 [${guild.tag}] ${guild.name} shattered the King Crystal and rules MetricBase! (+${SIEGE_PRIZE.toLocaleString()} guild gold)`,
      );
      for (const room of ZoneRoom.activeRooms) room.broadcast("chat", msg);
    }

    this.broadcastSiegeState();
  }

  /** Per-tick siege upkeep: announce window open/close, reset HP each new siege. */
  private updateSiege(now: number) {
    if (!this.isSiegeZone()) return;
    const active = getSiegeWindow(now).active;

    if (active !== this.siegeWasActive) {
      this.siegeWasActive = active;
      if (active) {
        // Fresh crystal at the start of every siege window.
        this.crystalHp = KING_CRYSTAL_MAX_HP;
        this.broadcastChat(this.systemChat("Castle Siege", "⚔️ The siege has begun — strike the King Crystal in the Obsidian Reach!"));
      } else {
        this.crystalHp = KING_CRYSTAL_MAX_HP;
        this.broadcastChat(this.systemChat("Castle Siege", "🛡️ The siege window has closed. The crystal is sealed again."));
      }
      this.broadcastSiegeState();
      return;
    }

    // Heartbeat the siege state ~3s while a siege is open so HP/timer stay fresh.
    if (active && now - this.lastSiegeBroadcastAt > 3_000) {
      this.lastSiegeBroadcastAt = now;
      this.broadcastSiegeState();
    }
  }

  private markCriminal(name: string) {
    this.criminalUntil.set(name, Date.now() + CRIMINAL_DURATION_MS);
    const session = this.activePlayerSession.get(name);
    const player = session ? this.state.players.get(session) : undefined;
    if (player) player.criminal = true;
    const client = this.clientForName(name);
    if (client) {
      client.send("chat", this.systemChat("Crime", "You attacked an innocent — you're now a Criminal (red name). Towns are barred to you."));
    }
  }

  private async handlePlaceBounty(client: Client, targetName: string, gold: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !targetName) return;
    const amount = Math.floor(gold);
    if (amount < MIN_BOUNTY) {
      client.send("chat", this.systemChat("Bounty", `Bounties start at ${MIN_BOUNTY} gold.`));
      return;
    }
    const have = this.playerGold.get(player.name) ?? 0;
    if (have < amount) {
      client.send("chat", this.systemChat("Bounty", "Not enough gold for that bounty."));
      return;
    }
    this.playerGold.set(player.name, have - amount);
    this.bounties.set(targetName, (this.bounties.get(targetName) ?? 0) + amount);
    this.sendProfile(client, player);
    this.broadcastChat(
      this.systemChat("Bounty", `${player.name} placed a ${amount}g bounty on ${targetName}!`),
    );
  }

  private systemChat(senderName: string, body: string): ChatMessagePayload {
    return {
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName,
      body,
      sentAt: Date.now(),
    };
  }

  /** Verify an on-chain $BASE burn and grant a Black-zone access pass (1 hour). */
  private async handleBurnForBlackPass(client: Client, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) {
      client.send("blackPassResult", { ok: false, error: "Link a wallet first to burn $BASE." });
      return;
    }
    if (!signature) {
      client.send("blackPassResult", { ok: false, error: "Missing burn signature." });
      return;
    }

    const result = await verifyTokenBurn(signature, {
      ownerWallet: wallet,
      mint: getBlackZoneBurnMint(),
      minUiAmount: BLACK_ZONE_BURN_AMOUNT,
    });

    if (!result.ok) {
      client.send("blackPassResult", { ok: false, error: result.error ?? "Burn could not be verified." });
      return;
    }

    // One-time burn grants LIFETIME Black-zone access; persist it.
    ZoneRoom.blackPassWallets.add(wallet);
    await this.persistPlayer(player);
    client.send("blackPassResult", { ok: true });
    this.broadcastChat(
      this.systemChat("Obsidian Gate", `${player.name} burned ${BLACK_ZONE_BURN_AMOUNT.toLocaleString()} $BASE and unlocked the Black Zone forever!`),
    );
  }

  /** Buy a timed VIP Lodge pass: costs gold AND a verified $BASE burn. */
  private async handleBuyVipPass(client: Client, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) {
      client.send("vipPassResult", { ok: false, error: "Link a wallet first to buy a VIP pass." });
      return;
    }
    if (!signature) {
      client.send("vipPassResult", { ok: false, error: "Missing burn signature." });
      return;
    }

    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < VIP_PASS_GOLD_COST) {
      client.send("vipPassResult", { ok: false, error: `A VIP pass costs ${VIP_PASS_GOLD_COST.toLocaleString()} gold.` });
      return;
    }

    const result = await verifyTokenBurn(signature, {
      ownerWallet: wallet,
      mint: getBlackZoneBurnMint(),
      minUiAmount: VIP_PASS_BURN_AMOUNT,
    });
    if (!result.ok) {
      client.send("vipPassResult", { ok: false, error: result.error ?? "Burn could not be verified." });
      return;
    }

    this.playerGold.set(player.name, gold - VIP_PASS_GOLD_COST);
    ZoneRoom.vipPassUntil.set(wallet, Date.now() + VIP_PASS_DAYS * 24 * 60 * 60 * 1000);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("vipPassResult", { ok: true, days: VIP_PASS_DAYS });
    this.broadcastChat(
      this.systemChat("VIP Lodge", `${player.name} bought a ${VIP_PASS_DAYS}-day VIP pass (${VIP_PASS_GOLD_COST.toLocaleString()}g + ${VIP_PASS_BURN_AMOUNT.toLocaleString()} $BASE burned)!`),
    );
  }

  /** Buy a gold-only VIP Lodge pass — no burn, just a larger gold fee. */
  private async handleBuyVipPassGold(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) {
      client.send("vipPassResult", { ok: false, error: "Link a wallet first to buy a VIP pass." });
      return;
    }
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < VIP_PASS_GOLD_ONLY_COST) {
      client.send("vipPassResult", {
        ok: false,
        error: `A gold pass costs ${VIP_PASS_GOLD_ONLY_COST.toLocaleString()} gold.`,
      });
      return;
    }

    this.playerGold.set(player.name, gold - VIP_PASS_GOLD_ONLY_COST);
    ZoneRoom.vipPassUntil.set(wallet, Date.now() + VIP_PASS_DAYS * 24 * 60 * 60 * 1000);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("vipPassResult", { ok: true, days: VIP_PASS_DAYS });
    this.broadcastChat(
      this.systemChat(
        "VIP Lodge",
        `${player.name} bought a ${VIP_PASS_DAYS}-day VIP pass for ${VIP_PASS_GOLD_ONLY_COST.toLocaleString()}g!`,
      ),
    );
  }

  // === Player-owned zones ("Worlds") ===

  /** Buy a blank zone slot for gold (routed to the treasury) and own a World. */
  private async handleBuyZoneSlot(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    // Admins found Worlds for free (for testing / official Worlds).
    const free = adService.isAdmin(wallet);
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (!free && gold < ZONE_SLOT_COST) {
      return void client.send("zoneResult", {
        ok: false,
        error: `A World slot costs ${ZONE_SLOT_COST.toLocaleString()} gold.`,
      });
    }
    if (!free) {
      this.playerGold.set(player.name, gold - ZONE_SLOT_COST);
      await creditTreasuryGold("zone_slot", ZONE_SLOT_COST);
    }
    const zone = createPlayerZone(player.name, wallet);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("zoneResult", {
      ok: true,
      zoneId: zone.zoneId,
      message: free ? "World created (admin, free)! Build it, then publish." : "World created! Build it, then publish.",
    });
    this.sendMyWorlds(client, player.name);
    this.broadcastChat(
      this.systemChat("Worlds", `${player.name} founded a new World! Visit it from the Worlds board.`),
    );
  }

  /** Pip's currency desk: burn/transfer $BASE to the treasury for gold, 1:1. */
  private async handleBuyGoldFromPip(client: Client, signature: string, requestedGold: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    if (!wallet) {
      return void client.send("pipGoldResult", { ok: false, error: "Link a wallet first to buy gold from Pip." });
    }
    if (!signature || signature.length < 32) {
      return void client.send("pipGoldResult", { ok: false, error: "Missing payment transaction." });
    }
    const treasury = getTreasuryWallet();
    if (!treasury) {
      return void client.send("pipGoldResult", { ok: false, error: "Pip's gold desk is closed right now." });
    }
    if (await isPurchaseRedeemed(signature)) {
      return void client.send("pipGoldResult", { ok: false, error: "That payment was already redeemed." });
    }
    const mint = process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;
    const minUiAmount = Math.max(1, Math.floor(requestedGold) || 1);
    const v = await verifyPeerTokenTransfer(signature, { fromWallet: wallet, toWallet: treasury, mint, minUiAmount });
    if (!v.ok || v.uiAmount === undefined || v.uiAmount <= 0) {
      return void client.send("pipGoldResult", { ok: false, error: v.error ?? "Payment not found on-chain." });
    }
    // Credit gold 1:1 with the verified on-chain amount (never the client claim).
    const goldCredited = Math.floor(v.uiAmount);
    await recordTokenPurchase(signature, wallet, "pip_gold", v.uiAmount);
    this.playerGold.set(player.name, (this.playerGold.get(player.name) ?? STARTING_GOLD) + goldCredited);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("pipGoldResult", { ok: true, gold: goldCredited });
  }

  /** Tell the client where/how to pay $BASE for gold at Pip's desk. */
  private handlePipGoldInfo(client: Client) {
    const treasury = getTreasuryWallet();
    client.send("pipGoldInfo", {
      enabled: Boolean(treasury),
      treasury,
      mint: process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT,
      decimals: getMarketDecimals(),
      rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
    });
  }

  /** Owner saves an edited build for one of their zones. */
  private async handleZoneBuildSave(client: Client, zoneId: string, rawBuild: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const zone = getPlayerZone(zoneId);
    if (!zone || zone.ownerName !== player.name) {
      return void client.send("zoneResult", { ok: false, error: "You don't own that World." });
    }
    const { build, error } = sanitizeBuild(rawBuild);
    if (!build) return void client.send("zoneResult", { ok: false, error: error ?? "Invalid build." });

    // Reconcile placed assets against the owner's inventory. Newly-placed assets
    // are taken from inventory first (free); any shortfall is bought inline at
    // its gold price. Removed assets are returned to inventory. Grass/bare-dirt
    // (price 0) are free & unlimited. Admins build for free with no inventory use.
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    const isAdmin = adService.isAdmin(wallet);
    const oldCounts = countBuildAssets(zone.build);
    const newCounts = countBuildAssets(build);
    const consume = new Map<string, number>();
    const restore = new Map<string, number>();
    let goldCost = 0;
    for (const id of new Set([...oldCounts.keys(), ...newCounts.keys()])) {
      const price = zoneAssetPrice(id);
      if (price <= 0) continue; // free assets never touch inventory/gold
      const delta = (newCounts.get(id) ?? 0) - (oldCounts.get(id) ?? 0);
      if (delta > 0 && !isAdmin) {
        const fromInv = Math.min(getAssetQty(player.name, id), delta);
        if (fromInv > 0) consume.set(id, fromInv);
        goldCost += (delta - fromInv) * price;
      } else if (delta < 0 && !isAdmin) {
        restore.set(id, -delta);
      }
    }
    if (!isAdmin && goldCost > 0) {
      const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
      if (gold < goldCost) {
        return void client.send("zoneResult", {
          ok: false,
          error: `You need ${goldCost.toLocaleString()} gold to build this (you have ${gold.toLocaleString()}). Buy assets in the Build Shop first.`,
        });
      }
      this.playerGold.set(player.name, gold - goldCost);
      await creditTreasuryGold("zone_build", goldCost);
      this.sendProfile(client, player);
      await this.persistPlayer(player);
    }
    if (!isAdmin) {
      for (const [id, n] of consume) adjustAsset(player.name, id, -n);
      for (const [id, n] of restore) adjustAsset(player.name, id, n);
      if (consume.size || restore.size) this.sendAssetInventory(client, player.name);
    }
    const cost = goldCost;

    setZoneBuild(zoneId, build);
    // The build changed which tiles are solid — drop the cached collision grid.
    clearCollisionCache(zoneId);
    // Push the updated config to everyone currently in that World so their
    // scene re-renders (including the owner who just saved).
    const record = getPlayerZone(zoneId);
    if (record) {
      for (const room of ZoneRoom.activeRooms) {
        if (room.zoneConfig.id === zoneId) {
          const cfg = playerZoneToConfig(record);
          room.zoneConfig = cfg;
          room.broadcast("playerZoneConfig", cfg);
        }
      }
    }
    client.send("zoneResult", {
      ok: true,
      zoneId,
      message: cost > 0 ? `World saved — spent ${cost.toLocaleString()} gold.` : "World saved.",
    });
    this.sendMyWorlds(client, player.name);
  }

  /** Owner updates a zone's name / pass price / published flag. */
  private async handleZoneMetaSet(
    client: Client,
    zoneId: string,
    patch: { displayName?: string; passPrice?: number; published?: boolean; gatherTax?: number },
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const zone = getPlayerZone(zoneId);
    if (!zone || zone.ownerName !== player.name) {
      return void client.send("zoneResult", { ok: false, error: "You don't own that World." });
    }
    setZoneMeta(zoneId, {
      displayName: patch.displayName,
      passPrice: patch.passPrice,
      published: patch.published,
      gatherTax: patch.gatherTax,
    });
    client.send("zoneResult", { ok: true, zoneId, message: "World updated." });
    this.sendMyWorlds(client, player.name);
  }

  /** Owner withdraws accumulated pass earnings back into their gold balance. */
  private async handleZoneEarningsCollect(client: Client, zoneId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const zone = getPlayerZone(zoneId);
    if (!zone || zone.ownerName !== player.name) {
      return void client.send("zoneResult", { ok: false, error: "You don't own that World." });
    }
    const amount = collectZoneEarnings(zoneId);
    if (amount <= 0) return void client.send("zoneResult", { ok: false, error: "No earnings to collect yet." });
    this.playerGold.set(player.name, (this.playerGold.get(player.name) ?? STARTING_GOLD) + amount);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("zoneResult", { ok: true, zoneId, message: `Collected ${amount.toLocaleString()} gold.` });
    this.sendMyWorlds(client, player.name);
  }

  /** Buy a timed visitor pass to a published zone; gold goes to the owner. */
  private async handleBuyZonePass(client: Client, zoneId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const zone = getPlayerZone(zoneId);
    if (!zone || !zone.published) {
      return void client.send("zoneResult", { ok: false, error: "That World isn't open to visitors." });
    }
    if (zone.ownerName === player.name || zone.passPrice <= 0) {
      return void client.send("zoneResult", { ok: true, zoneId, message: "You already have access." });
    }
    if (canEnterZone(zoneId, player.name)) {
      return void client.send("zoneResult", { ok: true, zoneId, message: "Your pass is still valid." });
    }
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < zone.passPrice) {
      return void client.send("zoneResult", {
        ok: false,
        error: `A pass costs ${zone.passPrice.toLocaleString()} gold.`,
      });
    }
    this.playerGold.set(player.name, gold - zone.passPrice);
    addZoneEarnings(zoneId, zone.passPrice);
    grantZonePass(zoneId, player.name, Date.now() + ZONE_PASS_MS);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("zoneResult", { ok: true, zoneId, message: `Pass purchased — enjoy ${zone.displayName}!` });
  }

  /** Send the public directory of published Worlds to a client. */
  private handleWorldsList(client: Client) {
    client.send("worldsList", {
      worlds: getPublishedZones().map((z) => ({
        zoneId: z.zoneId,
        displayName: z.displayName,
        ownerName: z.ownerName,
        passPrice: z.passPrice,
        visits: z.visits,
      })),
    });
  }

  /** Send the requesting player their owned Worlds (with build + earnings). */
  private handleMyWorlds(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.sendMyWorlds(client, player.name);
  }

  private sendMyWorlds(client: Client, ownerName: string) {
    client.send("myWorlds", {
      worlds: getZonesOwnedBy(ownerName).map((z) => ({
        zoneId: z.zoneId,
        displayName: z.displayName,
        passPrice: z.passPrice,
        published: z.published,
        earnings: z.earnings,
        visits: z.visits,
        gatherTax: z.gatherTax,
        build: z.build,
      })),
    });
  }

  private sendAssetInventory(client: Client, playerName: string) {
    client.send("assetInventory", { assets: getAssetInventory(playerName) });
  }

  /** Buy build-asset items for gold (the Build Shop). Adds them to inventory. */
  private async handleBuildShopBuy(client: Client, assetId: string, qty: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const count = Math.max(1, Math.min(999, Math.floor(qty)));
    const price = zoneAssetPrice(assetId);
    if (!assetId || price <= 0) {
      return void client.send("buildShopResult", { ok: false, error: "That item can't be bought." });
    }
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    const free = adService.isAdmin(wallet);
    const total = price * count;
    if (!free) {
      const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
      if (gold < total) {
        return void client.send("buildShopResult", {
          ok: false,
          error: `Need ${total.toLocaleString()} gold (you have ${gold.toLocaleString()}).`,
        });
      }
      this.playerGold.set(player.name, gold - total);
      await creditTreasuryGold("build_shop", total);
      this.sendProfile(client, player);
      await this.persistPlayer(player);
    }
    adjustAsset(player.name, assetId, count);
    this.sendAssetInventory(client, player.name);
    client.send("buildShopResult", { ok: true, assetId, qty: count });
  }

  private broadcastAssetMarket() {
    const payload = { listings: getAssetListings() };
    for (const room of ZoneRoom.activeRooms) room.broadcast("assetMarket", payload);
  }

  /** Credit gold to a player by name across any room; queue it if they're offline. */
  private creditPlayerByName(name: string, amount: number) {
    if (amount <= 0) return;
    for (const room of ZoneRoom.activeRooms) {
      const sessionId = room.activePlayerSession.get(name);
      const p = sessionId ? room.state.players.get(sessionId) : undefined;
      const client = sessionId ? room.clients.find((c) => c.sessionId === sessionId) : undefined;
      if (p && client) {
        room.playerGold.set(name, (room.playerGold.get(name) ?? STARTING_GOLD) + amount);
        room.sendProfile(client, p);
        void room.persistPlayer(p);
        return;
      }
    }
    addPendingGold(name, amount); // offline — collected on next join
  }

  private handleAssetMarketList(client: Client, assetId: string, qty: number, price: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = createListing(player.name, assetId, qty, price);
    if (!result.ok) return void client.send("zoneResult", { ok: false, error: result.error });
    this.sendAssetInventory(client, player.name);
    this.broadcastAssetMarket();
    client.send("zoneResult", { ok: true, message: "Listed on the market." });
  }

  private handleAssetMarketCancel(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = cancelListing(player.name, id);
    if (!result.ok) return void client.send("zoneResult", { ok: false, error: result.error });
    this.sendAssetInventory(client, player.name);
    this.broadcastAssetMarket();
    client.send("zoneResult", { ok: true, message: "Listing cancelled — assets returned." });
  }

  private async handleAssetMarketBuy(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const listing = getListing(id);
    if (!listing) return void client.send("zoneResult", { ok: false, error: "That listing is gone." });
    if (listing.sellerName === player.name) {
      return void client.send("zoneResult", { ok: false, error: "That's your listing — cancel it instead." });
    }
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < listing.price) {
      return void client.send("zoneResult", { ok: false, error: `Need ${listing.price.toLocaleString()} gold.` });
    }
    this.playerGold.set(player.name, gold - listing.price);
    completeBuy(player.name, id);
    this.creditPlayerByName(listing.sellerName, listing.price);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    this.sendAssetInventory(client, player.name);
    this.broadcastAssetMarket();
    client.send("zoneResult", { ok: true, message: `Bought ${listing.qty}× for ${listing.price.toLocaleString()}g.` });
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
      if (!objective || objective.type !== "defeat_npc" || !defeatTargetMatch(objective.target, npcId)) {
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

  /**
   * Party members (other than `player`) present in this zone and within
   * `PARTY_ASSIST_RANGE` of `origin` — i.e. fighting alongside the killer.
   */
  private nearbyPartyMembers(
    player: InstanceType<typeof PlayerSchema>,
    origin: { x: number; y: number },
  ): { client: Client; player: InstanceType<typeof PlayerSchema> }[] {
    const party = getPartyForMember(player.name);
    if (!party) return [];

    const allies: { client: Client; player: InstanceType<typeof PlayerSchema> }[] = [];
    for (const [sessionId, other] of this.state.players) {
      if (other.name === player.name) continue;
      if (!party.members.includes(other.name)) continue;
      if (Math.hypot(other.x - origin.x, other.y - origin.y) > PARTY_ASSIST_RANGE) continue;
      const allyClient = this.clients.find((entry) => entry.sessionId === sessionId);
      if (allyClient) allies.push({ client: allyClient, player: other });
    }
    return allies;
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
      equippedToolId: equipment?.toolId ?? null,
      stamina: this.playerStamina.get(player.name) ?? STARTING_STAMINA,
      maxStamina: MAX_STAMINA,
      knockedOut,
      freeRespawnAt: knockedOut ? (this.playerKnockedOutUntil.get(player.name) ?? null) : null,
      honor: this.playerHonor.get(player.name) ?? 0,
      guildCoin: this.playerGuildCoin.get(player.name) ?? 0,
      gems: this.playerGems.get(player.name) ?? 0,
    });
    // Keep the client's equipment + combat-stat panel in sync with every profile push.
    client.send("equipmentState", buildEquipmentState(this.playerEquipment.get(player.name)));
  }

  /**
   * Spend stamina on an activity. Returns false (without spending) when the
   * player is too low — the caller should refuse the action and tell them to
   * eat. Successful spends push a fresh profile so the HUD gauge updates.
   */
  private spendStamina(client: Client, playerName: string, cost: number): boolean {
    const current = this.playerStamina.get(playerName) ?? STARTING_STAMINA;
    if (!hasStaminaFor(current, cost)) return false;
    this.playerStamina.set(playerName, clampStamina(current - cost));
    return true;
  }

  private restoreStamina(playerName: string, amount: number): number {
    const current = this.playerStamina.get(playerName) ?? STARTING_STAMINA;
    const next = clampStamina(current + amount);
    this.playerStamina.set(playerName, next);
    return next - current;
  }

  private notifyTooHungry(client: Client, playerName: string, activity: string) {
    const now = Date.now();
    const last = this.playerLastHungerNoticeAt.get(playerName) ?? 0;
    if (now - last < 5_000) return; // throttle so spammed actions don't flood chat
    this.playerLastHungerNoticeAt.set(playerName, now);
    client.send("chat", {
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Hunger",
      body: `You're too hungry to ${activity}. Eat some food (cooked fish, bread, or salmon) to restore energy.`,
      sentAt: Date.now(),
    });
  }

  private notifyDark(client: Client, playerName: string) {
    const now = Date.now();
    const last = this.playerLastDarkNoticeAt.get(playerName) ?? 0;
    if (now - last < 20_000) return; // gentle, infrequent reminder
    this.playerLastDarkNoticeAt.set(playerName, now);
    client.send("chat", {
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Night",
      body: "🌙 It's dark — light your lamp (L) to gather at full speed.",
      sentAt: now,
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
    if (this.zoneConfig.id === ZONE_INTERIOR) return;
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

    // Guild income tax: a slice of earnings is skimmed straight to the guild bank.
    const tax = applyGuildTax(player.name, amount);
    const kept = amount - tax;

    const next = (this.playerGold.get(player.name) ?? STARTING_GOLD) + kept;
    this.playerGold.set(player.name, next);
    this.sendProfile(client, player);

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body:
        tax > 0
          ? `${player.name} earned ${kept} gold (${reason}; ${tax} to guild bank).`
          : `${player.name} earned ${amount} gold (${reason}).`,
      sentAt: Date.now(),
    });

    // Keep guildmates' bank display fresh after a tax deposit.
    if (tax > 0) this.broadcastGuildState(guildMemberNames(player.name));
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

  private async handleMarketRefresh(client: Client, chartCurrency?: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const wallet = this.getClientWallet(client) ?? null;
    client.send("marketResult", { ok: true, market: await buildMarketState(wallet, chartCurrency) });
  }

  private async handleMarketPlace(
    client: Client,
    side: "bid" | "ask",
    goldAmount: number,
    tokenPrice: number,
    currency: string,
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
      currency,
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

  private async grantLoot(
    client: Client,
    playerName: string,
    itemId: string,
    quantity: number,
  ): Promise<number> {
    const current = this.inventories.get(playerName) ?? [];
    const { inventory, added } = addItemToInventory(current, itemId, quantity);
    if (added <= 0) return 0;

    this.inventories.set(playerName, inventory);
    this.sendInventory(client, playerName);

    const player = this.state.players.get(client.sessionId);
    if (!player) return added;

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Loot",
      body: `${player.name} received ${added}x ${getItemDefinition(itemId).name}.`,
      sentAt: Date.now(),
    });

    await this.checkCollectObjectives(client, playerName);
    return added;
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
    // Eating food also restores energy (the hunger loop).
    const energyRestored = this.restoreStamina(player.name, getConsumableStamina(itemId));
    this.inventories.set(player.name, inventory);
    this.sendProfile(client, player);
    this.sendInventory(client, player.name);

    const gains: string[] = [];
    if (healed > 0) gains.push(`+${healed} HP`);
    if (energyRestored > 0) gains.push(`+${energyRestored} energy`);
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Item",
      body:
        gains.length > 0
          ? `${player.name} used ${item.name} (${gains.join(", ")}).`
          : `${player.name} used ${item.name}.`,
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

    if (Date.now() < (this.craftingUntil.get(player.name) ?? 0)) {
      client.send("craftResult", { ok: false, recipeId, error: "You're already crafting something." });
      return;
    }

    const inventory = this.inventories.get(player.name) ?? [];
    const weaponId = this.playerEquipment.get(player.name)?.weaponId ?? null;
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;

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

    // Crafting takes time at the workbench. Lock the player, then deliver the
    // result after the cast finishes (materials are consumed on completion, so a
    // disconnect mid-craft costs nothing). The client keeps its button in a
    // "Crafting…" pending state until the delayed craftResult arrives.
    const duration = getCraftDurationMs(recipe);
    this.craftingUntil.set(player.name, Date.now() + duration);
    this.clock.setTimeout(() => {
      void this.completeCraft(client, player.name, recipeId);
    }, duration);
  }

  /** Salvage one unit of a bag item back into a fraction of its craft materials. */
  private async handleDismantle(client: Client, itemId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const refund = getDismantleRefund(itemId);
    if (!refund) {
      client.send("craftResult", { ok: false, error: "That item can't be dismantled." });
      return;
    }

    let inventory = this.inventories.get(player.name) ?? [];
    const weaponId = this.playerEquipment.get(player.name)?.weaponId ?? null;
    if (getItemQuantity(inventory, itemId) < 1) {
      client.send("craftResult", {
        ok: false,
        error: "You don't have that item.",
        inventory: buildInventoryPayload(inventory, weaponId),
      });
      return;
    }

    inventory = removeItemFromInventory(inventory, itemId, 1).inventory;
    const gained: string[] = [];
    for (const part of refund) {
      const result = addItemToInventory(inventory, part.itemId, part.quantity);
      inventory = result.inventory;
      if (result.added > 0) gained.push(`${result.added}x ${ITEMS[part.itemId]?.name ?? part.itemId}`);
    }
    this.inventories.set(player.name, inventory);
    this.sendInventory(client, player.name);

    const itemName = ITEMS[itemId]?.name ?? itemId;
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Crafting",
      body: `${player.name} dismantled ${itemName}${gained.length ? ` into ${gained.join(", ")}` : ""}.`,
      sentAt: Date.now(),
    });

    client.send("craftResult", { ok: true, inventory: buildInventoryPayload(inventory, weaponId) });
    await this.persistPlayer(player);
  }

  /** Soft-currency balance map for a currency id. */
  private softMap(currency: SoftCurrencyId): Map<string, number> {
    if (currency === "honor") return this.playerHonor;
    if (currency === "guildCoin") return this.playerGuildCoin;
    return this.playerGems;
  }

  /** Spend a soft currency (Honor/Guild Coin/Gems) on a Quartermaster offer. */
  private async handleBuySoftItem(client: Client, offerId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const offer = getSoftOffer(offerId);
    if (!offer) {
      client.send("softShopResult", { ok: false, error: "That offer is no longer available." });
      return;
    }

    const balances = this.softMap(offer.currency);
    const have = balances.get(player.name) ?? 0;
    if (have < offer.cost) {
      client.send("softShopResult", { ok: false, error: "You can't afford that yet." });
      return;
    }

    const inventory = this.inventories.get(player.name) ?? [];
    const projected = addItemToInventory(inventory, offer.itemId, offer.quantity);
    if (projected.added <= 0) {
      client.send("softShopResult", { ok: false, error: "Your bag is full." });
      return;
    }

    balances.set(player.name, have - offer.cost);
    this.inventories.set(player.name, projected.inventory);
    this.sendInventory(client, player.name);
    this.sendProfile(client, player);
    client.send("softShopResult", { ok: true });
    await this.persistPlayer(player);
  }

  // ---- Casino: Community Lodge Blackjack (custodial on-chain balances) ----

  private casinoHouseAddress(): string | null {
    return getHouseWalletAddress() ?? getTreasuryWallet();
  }

  /** Resolve the deposit mint for a currency — BASE follows TOKEN_MINT (env). */
  private resolveCasinoMint(currencyId: string): string | null {
    const currency = getCasinoCurrency(currencyId);
    if (currency.native) return null;
    if (currencyId === "base") return process.env.TOKEN_MINT?.trim() || currency.mint;
    return currency.mint;
  }

  private handToState(entry: { hand: ActiveHand; settlement?: Settlement }): BlackjackState {
    const { hand, settlement } = entry;
    const done = hand.phase === "done";
    return {
      currencyId: hand.currencyId,
      bet: toUiAmount(hand.escrowUnits, hand.currencyId),
      playerCards: hand.player,
      dealerCards: done ? hand.dealer : [hand.dealer[0]],
      dealerHidden: !done,
      phase: done ? "done" : "player",
      canDouble: hand.phase === "player" && hand.player.length === 2,
      outcome: settlement?.outcome,
      net: settlement ? toUiAmount(settlement.netUnits, hand.currencyId) : undefined,
    };
  }

  private async buildCasinoState(wallet: string | null, playerName: string): Promise<CasinoStatePayload> {
    const balancesBase = wallet ? await getCasinoBalances(wallet) : {};
    const balances: Record<string, number> = {};
    for (const [cur, units] of Object.entries(balancesBase)) balances[cur] = toUiAmount(units, cur);
    const entry = this.blackjackHands.get(playerName);
    const mints: Record<string, string | null> = {};
    for (const currency of CASINO_CURRENCIES) mints[currency.id] = this.resolveCasinoMint(currency.id);
    const daily = wallet ? await getDailyStatus(wallet) : { available: false, streak: 0 };
    return {
      balances,
      houseWallet: this.casinoHouseAddress(),
      rpcUrl: process.env.SOLANA_RPC_URL ?? null,
      mints,
      withdrawEnabled: isWithdrawEnabled(),
      hand: entry ? this.handToState(entry) : null,
      dailyAvailable: daily.available,
      dailyStreak: daily.streak,
    };
  }

  private async sendCasinoState(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    client.send("casinoState", await this.buildCasinoState(this.playerWallets.get(client.sessionId) ?? null, player.name));
  }

  private async handleCasinoDeposit(client: Client, currencyId: string, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    if (!wallet) return void client.send("casinoResult", { ok: false, error: "Connect your wallet first." });
    const table = getCasinoTable(currencyId);
    if (!table || !isCasinoCurrencyActive(currencyId)) {
      return void client.send("casinoResult", { ok: false, error: "That table is currently closed." });
    }
    if (!signature || signature.length < 32) {
      return void client.send("casinoResult", { ok: false, error: "Missing deposit transaction." });
    }
    const house = this.casinoHouseAddress();
    if (!house) return void client.send("casinoResult", { ok: false, error: "Deposits are disabled right now." });

    const currency = getCasinoCurrency(currencyId);
    console.warn(
      "[casino] deposit attempt",
      JSON.stringify({ player: player.name, wallet, currencyId, house, mint: this.resolveCasinoMint(currencyId), signature }),
    );
    let uiAmount: number | undefined;
    if (currency.native) {
      const v = await verifyPeerSolTransfer(signature, { fromWallet: wallet, toWallet: house, minUiAmount: table.minDeposit });
      if (!v.ok) return void client.send("casinoResult", { ok: false, error: v.error ?? "Deposit not found." });
      uiAmount = v.uiAmount;
    } else {
      const mint = this.resolveCasinoMint(currencyId);
      if (!mint) return void client.send("casinoResult", { ok: false, error: "Currency is misconfigured." });
      const v = await verifyPeerTokenTransfer(signature, {
        fromWallet: wallet,
        toWallet: house,
        mint,
        minUiAmount: table.minDeposit,
      });
      if (!v.ok) return void client.send("casinoResult", { ok: false, error: v.error ?? "Deposit not found." });
      uiAmount = v.uiAmount;
    }
    if (uiAmount === undefined || uiAmount <= 0) {
      return void client.send("casinoResult", { ok: false, error: "Could not read the deposit amount." });
    }

    const units = toBaseUnits(uiAmount, currencyId);
    console.warn("[casino] deposit verified", JSON.stringify({ wallet, currencyId, uiAmount, units }));
    const credit = await creditDepositOnce(wallet, currencyId, units, signature);
    if (!credit.credited) {
      return void client.send("casinoResult", { ok: false, error: "That deposit was already credited." });
    }
    client.send("casinoResult", { ok: true, state: await this.buildCasinoState(wallet, player.name) });
  }

  private async handleCasinoWithdraw(client: Client, currencyId: string, amountUi: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    if (!wallet) return void client.send("casinoResult", { ok: false, error: "Connect your wallet first." });
    const table = getCasinoTable(currencyId);
    if (!table) return void client.send("casinoResult", { ok: false, error: "Unknown table." });
    if (!isWithdrawEnabled()) {
      return void client.send("casinoResult", { ok: false, error: "Withdrawals aren't available yet." });
    }
    if (amountUi <= 0) return void client.send("casinoResult", { ok: false, error: "Enter an amount to withdraw." });
    const units = toBaseUnits(amountUi, currencyId);
    if (units <= 0) return void client.send("casinoResult", { ok: false, error: "Amount is too small." });

    // Debit first so a balance can't be withdrawn twice; refund if the payout fails.
    const debit = await adjustCasinoBalance(wallet, currencyId, -units);
    if (!debit.ok) return void client.send("casinoResult", { ok: false, error: "Insufficient balance." });

    const payout = await sendPayout(wallet, currencyId, units, this.resolveCasinoMint(currencyId));
    if (!payout.ok) {
      await adjustCasinoBalance(wallet, currencyId, units);
      return void client.send("casinoResult", {
        ok: false,
        error: payout.error ?? "Payout failed.",
        state: await this.buildCasinoState(wallet, player.name),
      });
    }
    await recordWithdrawal(wallet, currencyId, units, payout.signature ?? `payout-${Date.now()}`);
    client.send("casinoResult", {
      ok: true,
      signature: payout.signature,
      state: await this.buildCasinoState(wallet, player.name),
    });
  }

  private async finishBlackjack(wallet: string, entry: { hand: ActiveHand; settlement?: Settlement }) {
    const settlement = resolveHand(entry.hand);
    if (settlement.returnUnits > 0) {
      await adjustCasinoBalance(wallet, entry.hand.currencyId, settlement.returnUnits);
    }
    entry.settlement = settlement;
  }

  private async handleBlackjackDeal(client: Client, currencyId: string, betUi: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    if (!wallet) return void client.send("casinoResult", { ok: false, error: "Connect your wallet first." });
    const table = getCasinoTable(currencyId);
    if (!table || !isCasinoCurrencyActive(currencyId)) {
      return void client.send("casinoResult", { ok: false, error: "That table is currently closed." });
    }

    const existing = this.blackjackHands.get(player.name);
    if (existing && existing.hand.phase === "player") {
      return void client.send("casinoResult", { ok: false, error: "Finish your current hand first." });
    }
    if (betUi < table.minBet || betUi > table.maxBet) {
      return void client.send("casinoResult", {
        ok: false,
        error: `Bet must be between ${table.minBet} and ${table.maxBet}.`,
      });
    }
    const betUnits = toBaseUnits(betUi, currencyId);
    if (betUnits <= 0) return void client.send("casinoResult", { ok: false, error: "Bet is too small." });

    // House-risk guard: never accept a bet the house couldn't pay out in full.
    const houseAddr = this.casinoHouseAddress();
    if (houseAddr) {
      const houseBal = await getHouseBalanceUi(houseAddr, currencyId, this.resolveCasinoMint(currencyId));
      if (houseBal !== null && betUi * MAX_HAND_RETURN_MULT > houseBal) {
        return void client.send("casinoResult", {
          ok: false,
          error: "Table limit reached — the house can't cover that bet right now. Try a smaller bet.",
        });
      }
    }

    const debit = await adjustCasinoBalance(wallet, currencyId, -betUnits);
    if (!debit.ok) {
      return void client.send("casinoResult", { ok: false, error: "Not enough balance — deposit to play." });
    }

    const hand = startHand(currencyId as CasinoCurrencyId, betUnits);
    const entry: { hand: ActiveHand; settlement?: Settlement } = { hand };
    this.blackjackHands.set(player.name, entry);
    if (hand.phase === "done") await this.finishBlackjack(wallet, entry); // a natural ends instantly
    client.send("casinoResult", { ok: true, state: await this.buildCasinoState(wallet, player.name) });
  }

  private async handleCasinoDailyClaim(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    if (!wallet) return void client.send("casinoResult", { ok: false, error: "Connect your wallet first." });

    const claim = await claimDaily(wallet);
    if (!claim) {
      return void client.send("casinoResult", {
        ok: false,
        error: "Daily bonus already claimed — come back tomorrow!",
        state: await this.buildCasinoState(wallet, player.name),
      });
    }
    const gold = dailyBonusGold(claim.streak);
    this.playerGold.set(player.name, (this.playerGold.get(player.name) ?? STARTING_GOLD) + gold);
    this.sendProfile(client, player);
    client.send("chat", this.systemChat("Lodge", `🎁 Daily bonus: +${gold} gold (day ${claim.streak} streak)!`));
    client.send("casinoResult", { ok: true, state: await this.buildCasinoState(wallet, player.name) });
    await this.persistPlayer(player);
  }

  // ---- Ad marketplace handlers ----

  /** Every minute, each viewing player generates one impression per visible slot. */
  private tickAdImpressions() {
    const zoneId = this.zoneConfig.id;
    for (const [sessionId, player] of this.state.players) {
      if (player.spectator) continue;
      const wallet = this.playerWallets.get(sessionId) ?? null;
      // Frequency cap: bill a campaign at most once per player per tick, even if
      // it shows on several surfaces (e.g. its own billboard + banner fallback).
      const charged = new Set<string>();
      for (const slot of AD_SLOTS) {
        // Banner = everyone; billboard = players in that billboard's zone.
        if (slot.surface === "billboard" && slot.zoneId !== zoneId) continue;
        const campaignId = adService.slotCampaign(slot.id);
        if (!campaignId || charged.has(campaignId)) continue;
        charged.add(campaignId);
        adService.recordCampaignImpression(campaignId, wallet);
      }
    }
    const serving = adService.getServing();
    if (serving.creatives.length > 0) this.broadcast("adServing", serving);
  }

  private async handleAdDeposit(client: Client, signature: string, claimedWallet?: string) {
    // Use the linked wallet, or the one the client reports — the deposit is
    // verified against the transaction's actual payer, so a claimed wallet can
    // only credit itself if it really paid.
    const wallet = this.playerWallets.get(client.sessionId) ?? claimedWallet;
    if (!wallet) return void client.send("adActionResult", { ok: false, error: "Connect your wallet first." });
    if (!signature || signature.length < 32) {
      return void client.send("adActionResult", { ok: false, error: "Missing deposit transaction." });
    }
    const house = adService.houseWallet();
    if (!house) return void client.send("adActionResult", { ok: false, error: "Ad deposits are disabled." });
    const mint = this.resolveCasinoMint("base");
    if (!mint) return void client.send("adActionResult", { ok: false, error: "Currency misconfigured." });

    const v = await verifyPeerTokenTransfer(signature, {
      fromWallet: wallet,
      toWallet: house,
      mint,
      minUiAmount: AD_MIN_DEPOSIT,
    });
    if (!v.ok || v.uiAmount === undefined) {
      return void client.send("adActionResult", { ok: false, error: v.error ?? "Deposit not found." });
    }
    const res = await adService.creditDeposit(wallet, v.uiAmount, signature);
    // Always refresh the dashboard so the balance shows even if it was already
    // credited (creditDeposit re-syncs the balance from the DB).
    client.send("adBrandDashboard", adService.getBrandDashboard(wallet));
    if (!res.credited) {
      return void client.send("adActionResult", { ok: false, error: "That deposit was already credited — balance refreshed." });
    }
    client.send("adActionResult", { ok: true });
  }

  private async handleAdCreateCampaign(
    client: Client,
    m: { name?: string; imageUrl?: string; headline?: string; clickUrl?: string; cpm?: number },
  ) {
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) return void client.send("adActionResult", { ok: false, error: "Connect your wallet first." });
    const name = m.name ?? "";
    const imageUrl = m.imageUrl ?? "";
    const headline = m.headline ?? "";
    const clickUrl = m.clickUrl ?? "";
    const cpm = Number(m.cpm) || 0;
    const invalid = validateCampaign(name, imageUrl, headline, clickUrl, cpm);
    if (invalid) return void client.send("adActionResult", { ok: false, error: invalid });
    await adService.createCampaign(wallet, { name, imageUrl, headline, clickUrl, cpm });
    client.send("adActionResult", { ok: true });
    client.send("adBrandDashboard", adService.getBrandDashboard(wallet));
  }

  private async handleAdPauseCampaign(client: Client, id: string, paused: boolean) {
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) return void client.send("adActionResult", { ok: false, error: "Connect your wallet first." });
    const res = await adService.pauseCampaign(wallet, id, paused);
    client.send("adActionResult", res);
    client.send("adBrandDashboard", adService.getBrandDashboard(wallet));
    this.broadcast("adServing", adService.getServing());
  }

  private async handleAdEditCampaign(
    client: Client,
    m: { id?: string; name?: string; imageUrl?: string; headline?: string; clickUrl?: string; cpm?: number },
  ) {
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) return void client.send("adActionResult", { ok: false, error: "Connect your wallet first." });
    const name = m.name ?? "";
    const imageUrl = m.imageUrl ?? "";
    const headline = m.headline ?? "";
    const clickUrl = m.clickUrl ?? "";
    const cpm = Number(m.cpm) || 0;
    const invalid = validateCampaign(name, imageUrl, headline, clickUrl, cpm);
    if (invalid) return void client.send("adActionResult", { ok: false, error: invalid });
    const res = await adService.editCampaign(wallet, m.id ?? "", { name, imageUrl, headline, clickUrl, cpm });
    client.send("adActionResult", res);
    client.send("adBrandDashboard", adService.getBrandDashboard(wallet));
    this.broadcast("adServing", adService.getServing());
  }

  private async handleAdReview(client: Client, id: string, status: string, note?: string) {
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    if (!adService.isAdmin(wallet)) return void client.send("adActionResult", { ok: false, error: "Not authorized." });
    if (status !== "approved" && status !== "rejected") {
      return void client.send("adActionResult", { ok: false, error: "Invalid status." });
    }
    await adService.review(id, status, note);
    client.send("adActionResult", { ok: true });
    client.send("adAdminList", { campaigns: adService.listPending() });
    this.broadcast("adServing", adService.getServing());
  }

  private async handleAdJoin(client: Client) {
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) return void client.send("adActionResult", { ok: false, error: "Connect your wallet to join." });
    const invited = await getInvitedCount(wallet);
    // Admins (treasury wallet) bypass the invite requirement.
    if (!adService.isAdmin(wallet) && invited < AD_REQUIRED_INVITES) {
      return void client.send("adActionResult", {
        ok: false,
        error: `Invite ${AD_REQUIRED_INVITES} friends to qualify — you've invited ${invited}.`,
      });
    }
    await adService.join(wallet);
    client.send("adActionResult", { ok: true });
    client.send("adProgram", adService.getProgram(wallet, invited));
  }

  private async handleAdProgram(client: Client) {
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) {
      return void client.send("adProgram", {
        member: false,
        earnings: 0,
        lifetime: 0,
        impressions: 0,
        withdrawEnabled: false,
        invitedCount: 0,
      });
    }
    // Admins are auto-enrolled in the program.
    if (adService.isAdmin(wallet)) await adService.join(wallet);
    else await adService.ensureMemberLoaded(wallet);
    client.send("adProgram", adService.getProgram(wallet, await getInvitedCount(wallet)));
  }

  private async handleAdTransparency(client: Client) {
    const wallet = this.playerWallets.get(client.sessionId) ?? "";
    if (wallet) await adService.ensureMemberLoaded(wallet);
    const invited = wallet ? await getInvitedCount(wallet) : 0;
    client.send("adTransparency", await adService.getTransparency(wallet, invited));
  }

  private async handleAdClaim(client: Client) {
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) return void client.send("adActionResult", { ok: false, error: "Connect your wallet first." });
    const res = await adService.claim(wallet);
    client.send("adActionResult", res);
    client.send("adProgram", adService.getProgram(wallet, await getInvitedCount(wallet)));
  }

  private async handleBlackjackAction(client: Client, action: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    if (!wallet) return void client.send("casinoResult", { ok: false, error: "Connect your wallet first." });
    const entry = this.blackjackHands.get(player.name);
    if (!entry || entry.hand.phase !== "player") {
      return void client.send("casinoResult", { ok: false, error: "No hand in play — deal first." });
    }
    const hand = entry.hand;

    if (action === "hit") {
      playerHit(hand);
      if (hand.phase === "done") await this.finishBlackjack(wallet, entry);
    } else if (action === "stand") {
      await this.finishBlackjack(wallet, entry);
    } else if (action === "double") {
      if (hand.player.length !== 2) {
        return void client.send("casinoResult", { ok: false, error: "You can only double on your first two cards." });
      }
      const debit = await adjustCasinoBalance(wallet, hand.currencyId, -hand.betUnits);
      if (!debit.ok) {
        return void client.send("casinoResult", { ok: false, error: "Not enough balance to double down." });
      }
      playerDouble(hand);
      await this.finishBlackjack(wallet, entry);
    } else {
      return void client.send("casinoResult", { ok: false, error: "Unknown action." });
    }
    client.send("casinoResult", { ok: true, state: await this.buildCasinoState(wallet, player.name) });
  }

  // ---- Mail ----

  private async sendMailState(client: Client, playerName?: string) {
    const name = playerName ?? this.state.players.get(client.sessionId)?.name;
    if (!name) return;
    const [messages, unread] = await Promise.all([getInbox(name), countUnread(name)]);
    client.send("mailState", { messages, unread });
  }

  private async handleMailSend(client: Client, to: string, subject: string, body: string, gold: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const recipient = to.trim();
    const cleanSubject = subject.trim().slice(0, 120);
    const cleanBody = body.slice(0, 500);

    const invalid = validateMail(recipient, cleanSubject, cleanBody, gold);
    if (invalid) return void client.send("mailResult", { ok: false, error: invalid });
    if (recipient.toLowerCase() === player.name.toLowerCase()) {
      return void client.send("mailResult", { ok: false, error: "You can't mail yourself." });
    }
    if (!(await characterExists(recipient))) {
      return void client.send("mailResult", { ok: false, error: "No adventurer by that name." });
    }

    const cost = MAIL_SEND_COST + gold;
    const balance = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (balance < cost) {
      return void client.send("mailResult", {
        ok: false,
        error: `You need ${cost} gold (${MAIL_SEND_COST} postage + ${gold} attached).`,
      });
    }

    this.playerGold.set(player.name, balance - cost);
    await insertMail(player.name, recipient, cleanSubject, cleanBody, gold);
    this.sendProfile(client, player);
    client.send("mailResult", { ok: true });
    await this.persistPlayer(player);

    // Nudge the recipient if they're online so their inbox badge updates.
    const recipientClient = this.clientForName(recipient);
    if (recipientClient) {
      void this.sendMailState(recipientClient, recipient);
      recipientClient.send("chat", this.systemChat("Mail", `📬 New mail from ${player.name}.`));
    }
  }

  private async handleMailRead(client: Client, id: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !id) return;
    await markMailRead(id, player.name);
    await this.sendMailState(client, player.name);
  }

  private async handleMailClaim(client: Client, id: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !id) return;
    const gold = await claimMailGold(id, player.name);
    if (gold > 0) {
      this.playerGold.set(player.name, (this.playerGold.get(player.name) ?? STARTING_GOLD) + gold);
      this.sendProfile(client, player);
      client.send("chat", this.systemChat("Mail", `You claimed ${gold} gold.`));
      await this.persistPlayer(player);
    }
    await this.sendMailState(client, player.name);
  }

  private async handleMailDelete(client: Client, id: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !id) return;
    await deleteMail(id, player.name);
    await this.sendMailState(client, player.name);
  }

  private async completeCraft(client: Client, playerName: string, recipeId: string) {
    this.craftingUntil.delete(playerName);

    const player = this.state.players.get(client.sessionId);
    if (!player || player.name !== playerName) return; // left or changed seat
    const recipe = getRecipe(recipeId);
    if (!recipe) return;

    let inventory = this.inventories.get(playerName) ?? [];
    const weaponId = this.playerEquipment.get(playerName)?.weaponId ?? null;
    let gold = this.playerGold.get(playerName) ?? STARTING_GOLD;

    // Re-validate — materials/gold/space may have changed during the cast.
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
    if (addItemToInventory(inventory, recipe.output.itemId, recipe.output.quantity).added <= 0) {
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
    this.playerGold.set(playerName, gold);
    this.inventories.set(playerName, inventory);
    this.sendInventory(client, playerName);
    this.sendProfile(client, player);

    const outputName = ITEMS[recipe.output.itemId]?.name ?? recipe.output.itemId;
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Crafting",
      body: `${playerName} crafted ${recipe.output.quantity}x ${outputName}.`,
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

  /** Map an equip-slot label (from the client) to its PlayerEquipment field. */
  private equipFieldForSlot(slot: string): (keyof PlayerEquipment & string) | null {
    switch (slot) {
      case "weapon":
        return "weaponId";
      case "tool":
        return "toolId";
      case "helmet":
        return "helmetId";
      case "chest":
        return "chestId";
      case "gloves":
        return "glovesId";
      case "boots":
        return "bootsId";
      case "ring1":
        return "ring1Id";
      case "ring2":
        return "ring2Id";
      case "necklace":
        return "necklaceId";
      case "cape":
        return "capeId";
      case "offhand":
        return "offhandId";
      case "mount":
        return "mountId";
      case "pet":
        return "petId";
      default:
        return null;
    }
  }

  private async handleEquipItem(
    client: Client,
    itemId: string | null,
    slot?: string,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.isKnockedOut(player.name)) return;

    const current = normalizeEquipment(this.playerEquipment.get(player.name));
    const inventory = this.inventories.get(player.name) ?? [];

    if (itemId === null) {
      // Unequip the named slot (default weapon for older clients).
      const field = this.equipFieldForSlot(slot ?? "weapon") ?? "weaponId";
      const next = normalizeEquipment(current);
      (next as unknown as Record<string, unknown>)[field] = null;
      const normalized = normalizeEquipment(next);
      this.playerEquipment.set(player.name, normalized);
      player.weaponId = normalized.weaponId ?? "";
      player.toolId = normalized.toolId ?? "";
      player.speedMult = getMountSpeed(normalized.mountId);
      player.petId = normalized.petId ?? "";
      this.sendProfile(client, player);
      this.sendInventory(client, player.name);
      client.send("inventoryResult", {
        ok: true,
        equippedWeaponId: normalized.weaponId,
        equippedToolId: normalized.toolId,
        inventory: buildInventoryPayload(inventory, normalized.weaponId),
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

    if (
      item.kind !== "weapon" &&
      item.kind !== "tool" &&
      item.kind !== "armor" &&
      item.kind !== "mount" &&
      item.kind !== "pet"
    ) {
      client.send("inventoryResult", { ok: false, error: "That item cannot be equipped." });
      return;
    }

    if (getItemQuantity(inventory, itemId) <= 0) {
      client.send("inventoryResult", { ok: false, error: "You don't have that item." });
      return;
    }

    // Resolve the target equipment field + wearable slot for the item.
    let field: (keyof PlayerEquipment & string) | null;
    let wearSlot: EquipmentSlot | null = null;
    if (item.kind === "weapon") {
      field = "weaponId";
      wearSlot = "weapon";
    } else if (item.kind === "tool") {
      field = "toolId";
    } else if (item.kind === "mount") {
      field = "mountId";
    } else if (item.kind === "pet") {
      field = "petId";
    } else {
      const gear = getGearStat(itemId);
      if (!gear) {
        client.send("inventoryResult", { ok: false, error: "That item cannot be equipped." });
        return;
      }
      // Rings: fill the first empty ring slot, else replace ring1.
      const preferSecond = gear.slot === "ring" && current.ring1Id !== null && current.ring2Id === null;
      const gearField = fieldForGearSlot(gear.slot as GearKindSlot, preferSecond);
      field = `${gearField}Id` as keyof PlayerEquipment & string;
      if (WEARABLE_SLOTS.includes(gearField as EquipmentSlot)) {
        wearSlot = gearField as EquipmentSlot;
      }
    }

    if (!field) {
      client.send("inventoryResult", { ok: false, error: "That item cannot be equipped." });
      return;
    }

    const next = normalizeEquipment(current);
    (next as unknown as Record<string, unknown>)[field] = itemId;
    // Fresh gear starts at full durability.
    if (wearSlot) {
      const max = maxDurabilityForSlot(wearSlot, itemId);
      if (Number.isFinite(max) && max > 0) {
        next.durability = { ...(next.durability ?? {}), [wearSlot]: max };
      }
    }
    const normalized = normalizeEquipment(next);
    this.playerEquipment.set(player.name, normalized);
    player.weaponId = normalized.weaponId ?? "";
    player.toolId = normalized.toolId ?? "";
    player.speedMult = getMountSpeed(normalized.mountId);
    player.petId = normalized.petId ?? "";
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
      equippedWeaponId: normalized.weaponId,
      equippedToolId: normalized.toolId,
      inventory: buildInventoryPayload(inventory, normalized.weaponId),
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

    if (!hasStaminaFor(this.playerStamina.get(player.name) ?? STARTING_STAMINA, STAMINA_COST_GATHER)) {
      this.notifyTooHungry(client, player.name, "gather");
      client.send("chopResult", {
        resourceId,
        available: true,
        depleted: false,
        skillXpGained: 0,
        woodcuttingLevel: skillLevel,
        skill: gather.skill,
        skillLevel,
        ok: false,
        error: "You're too hungry to gather. Eat some food first.",
      });
      return;
    }

    // Working in the dark is slow — unless you carry a lamp.
    const darkPenalty = gatherDurationMultiplier(now, player.lampOn);
    if (darkPenalty > 1.01) this.notifyDark(client, player.name);

    const toolId = this.playerEquipment.get(player.name)?.toolId ?? null;
    const durationMs = Math.round(
      gather.durationMs(skillLevel) * getToolSpeedMultiplier(toolId, gather.skill) * darkPenalty,
    );
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

    // Working the node burns energy (the food/hunger loop).
    this.playerStamina.set(
      player.name,
      clampStamina((this.playerStamina.get(player.name) ?? STARTING_STAMINA) - STAMINA_COST_GATHER),
    );

    // Steel-tier tools roll for a bonus drop on top of the node's base yield.
    const toolId = this.playerEquipment.get(player.name)?.toolId;
    const toolBonus = Math.random() < getToolYieldBonus(toolId, gather.skill) ? 1 : 0;
    // The fish bite in the rain — a bonus catch chance while it's wet.
    const rainBonus =
      gather.skill === "fishing" && Math.random() < rainFishingBonus(now) ? 1 : 0;
    const bonusYield = toolBonus + rainBonus;
    const lootQuantity = gather.lootQuantity + bonusYield;

    // Luck-based rare drop (amber/gemstone/pearl), independent of the yield roll.
    const rareItemId = rollRareGatherDrop(gather.skill, gather.nodeLevel);

    const client = this.clients.find((entry) => entry.sessionId === sessionId);
    if (client) {
      await this.grantLoot(client, player.name, gather.lootItemId, lootQuantity);
      if (rareItemId && (await this.grantLoot(client, player.name, rareItemId, 1)) > 0) {
        this.broadcastChat({
          id: crypto.randomUUID(),
          channel: "system",
          senderId: "system",
          senderName: gather.label,
          body: `✨ ${player.name} found a rare ${getItemDefinition(rareItemId).name}!`,
          sentAt: now,
        });
      }
    }

    // Visitor gather tax: in a player-owned World, a non-owner pays the owner a
    // per-gather fee (the owner's revenue for stocking their World with nodes).
    if (client && this.playerZone && this.playerZone.ownerName !== player.name) {
      const tax = getZoneGatherTax(this.playerZone.zoneId);
      const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
      if (tax > 0 && gold >= tax) {
        this.playerGold.set(player.name, gold - tax);
        addZoneTax(this.playerZone.zoneId, tax);
      }
    }

    const skillXpGained = gather.skillXp;
    const { newLevel, leveledUp } = this.grantSkillXp(player.name, gather.skill, skillXpGained);
    if (client) {
      this.sendSkillState(client, player.name);
      this.sendProfile(client, player); // reflect spent stamina on the HUD gauge
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

    // Party play: nearby party members in this zone share a slice of gather XP.
    const nodePosition = tileToWorld(resource.tileX, resource.tileY);
    for (const ally of this.nearbyPartyMembers(player, nodePosition)) {
      const result = this.grantSkillXp(
        ally.player.name,
        gather.skill,
        partyGatherShareXp(skillXpGained),
      );
      this.sendSkillState(ally.client, ally.player.name);
      if (result.leveledUp) {
        this.broadcastChat({
          id: crypto.randomUUID(),
          channel: "system",
          senderId: "system",
          senderName: gather.label,
          body: `${ally.player.name} reached ${gather.label} level ${result.newLevel}!`,
          sentAt: now,
        });
        await this.persistPlayer(ally.player);
      }
    }

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: gather.label,
      body: `${player.name} ${gather.verb} ${resource.name} (+${skillXpGained} ${gather.label} XP)${bonusYield > 0 ? " — bonus haul!" : ""}.`,
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
      const active = getFarmPlot(plot.id);
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
    for (const plot of getFarmPlotsForZone(this.zoneConfig.id)) {
      // Broadcast once when a plot first becomes ready so clients flip to the
      // ripe stage without us streaming state every tick.
      if (now >= plot.readyAt && !plot.readyBroadcast) {
        markReadyBroadcast(plot.plotId);
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
    const active = getFarmPlot(plotId);
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
      if (!this.spendStamina(client, player.name, STAMINA_COST_FARM)) {
        this.notifyTooHungry(client, player.name, "farm");
        client.send("farmResult", {
          ok: false,
          plotId,
          action: "plant",
          error: "You're too hungry to farm. Eat some food first.",
        });
        return;
      }
      inventory = removeItemFromInventory(inventory, crop.seedItemId, 1).inventory;
      this.inventories.set(player.name, inventory);
      this.sendInventory(client, player.name);
      this.sendProfile(client, player);
      plantFarmPlot({
        plotId,
        zoneId: this.zoneConfig.id,
        cropId: crop.cropItemId,
        seedId: crop.seedItemId,
        plantedAt: now,
        readyAt: now + crop.growMs,
        planterName: player.name,
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
    if (!this.spendStamina(client, player.name, STAMINA_COST_FARM)) {
      this.notifyTooHungry(client, player.name, "farm");
      client.send("farmResult", {
        ok: false,
        plotId,
        error: "You're too hungry to harvest. Eat some food first.",
      });
      return;
    }
    this.sendProfile(client, player);
    const crop = getFarmCropBySeed(active.seedId);
    const yieldQty = crop?.yield ?? 1;
    await this.grantLoot(client, player.name, active.cropId, yieldQty);
    const skillXp = crop?.skillXp ?? 10;
    const { newLevel, leveledUp } = this.grantSkillXp(player.name, "farming", skillXp);
    this.sendSkillState(client, player.name);
    harvestFarmPlot(plotId);
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

  private ownedShopFor(plotId: string, playerName: string) {
    const owned = getPlotOwner(plotId);
    if (!owned || owned.structure !== "shop") return null;
    return owned.ownerName === playerName ? owned : null;
  }

  private async handleShopStock(
    client: Client,
    plotId: string,
    itemId: string,
    quantity: number,
    price: number,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.isKnockedOut(player.name)) return;
    const shop = this.ownedShopFor(plotId, player.name);
    if (!shop) {
      client.send("playerShopResult", { ok: false, plotId, error: "That isn't your shop." });
      return;
    }
    if (quantity <= 0 || price <= 0 || price > 1_000_000) {
      client.send("playerShopResult", { ok: false, plotId, error: "Enter a quantity and price." });
      return;
    }
    const inv = this.inventories.get(player.name) ?? [];
    if (getItemQuantity(inv, itemId) < quantity) {
      client.send("playerShopResult", { ok: false, plotId, error: "You don't have that many." });
      return;
    }
    const listings = shop.listings.map((l) => ({ ...l }));
    const existing = listings.find((l) => l.itemId === itemId);
    if (!existing && listings.length >= MAX_SHOP_LISTINGS) {
      client.send("playerShopResult", { ok: false, plotId, error: "Shop shelves are full." });
      return;
    }
    const { inventory, removed } = removeItemFromInventory(inv, itemId, quantity);
    if (removed <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "You don't have that item." });
      return;
    }
    this.inventories.set(player.name, inventory);
    if (existing) {
      existing.quantity += removed;
      existing.price = price;
    } else {
      listings.push({ itemId, quantity: removed, price });
    }
    updatePlotShop(plotId, listings, shop.earnings);
    this.sendInventory(client, player.name);
    this.broadcastHousingState();
    client.send("playerShopResult", { ok: true, plotId });
  }

  private async handleShopUnstock(client: Client, plotId: string, itemId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const shop = this.ownedShopFor(plotId, player.name);
    if (!shop) return;
    const listings = shop.listings.map((l) => ({ ...l }));
    const idx = listings.findIndex((l) => l.itemId === itemId);
    if (idx < 0) return;
    const listing = listings[idx];
    const inv = this.inventories.get(player.name) ?? [];
    const { inventory, added } = addItemToInventory(inv, itemId, listing.quantity);
    if (added <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "Make inventory space first." });
      return;
    }
    this.inventories.set(player.name, inventory);
    if (added >= listing.quantity) listings.splice(idx, 1);
    else listing.quantity -= added;
    updatePlotShop(plotId, listings, shop.earnings);
    this.sendInventory(client, player.name);
    this.broadcastHousingState();
    client.send("playerShopResult", { ok: true, plotId });
  }

  private async handleShopBuyListing(
    client: Client,
    plotId: string,
    itemId: string,
    quantity: number,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.isKnockedOut(player.name)) return;
    const owned = getPlotOwner(plotId);
    if (!owned || owned.structure !== "shop") {
      client.send("playerShopResult", { ok: false, plotId, error: "No shop here." });
      return;
    }
    if (owned.ownerName === player.name) {
      client.send("playerShopResult", { ok: false, plotId, error: "That's your own shop." });
      return;
    }
    if (quantity <= 0) return;
    const listings = owned.listings.map((l) => ({ ...l }));
    const listing = listings.find((l) => l.itemId === itemId);
    if (!listing || listing.quantity <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "Sold out." });
      return;
    }
    const wantQty = Math.min(quantity, listing.quantity);
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    const affordable = Math.min(wantQty, Math.floor(gold / listing.price));
    if (affordable <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "Not enough gold." });
      return;
    }
    const inv = this.inventories.get(player.name) ?? [];
    const { inventory, added } = addItemToInventory(inv, itemId, affordable);
    if (added <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "Your inventory is full." });
      return;
    }
    const cost = added * listing.price;
    const nextGold = gold - cost;
    this.inventories.set(player.name, inventory);
    this.playerGold.set(player.name, nextGold);
    listing.quantity -= added;
    const remaining = listings.filter((l) => l.quantity > 0);
    updatePlotShop(plotId, remaining, owned.earnings + cost);
    this.sendProfile(client, player);
    this.sendInventory(client, player.name);
    this.broadcastHousingState();
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Shop",
      body: `${player.name} bought ${added}x ${getItemDefinition(itemId).name} from ${owned.ownerName}'s shop.`,
      sentAt: Date.now(),
    });
    client.send("playerShopResult", { ok: true, plotId, gold: nextGold });
    await this.persistPlayer(player);
  }

  private async handleShopCollect(client: Client, plotId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const shop = this.ownedShopFor(plotId, player.name);
    if (!shop || shop.earnings <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "Nothing to collect." });
      return;
    }
    const nextGold = (this.playerGold.get(player.name) ?? STARTING_GOLD) + shop.earnings;
    this.playerGold.set(player.name, nextGold);
    updatePlotShop(plotId, shop.listings, 0);
    this.sendProfile(client, player);
    this.broadcastHousingState();
    client.send("playerShopResult", { ok: true, plotId, gold: nextGold });
    await this.persistPlayer(player);
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
    blockPlotFootprint(this.zoneConfig.id, plot);
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

  private handleHousingCustomize(
    client: Client,
    plotId: string,
    opts: { roof?: string | null; sign?: string | null },
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId) return;

    const owner = getPlotOwner(plotId);
    if (!owner || owner.ownerName !== player.name) {
      client.send("housingResult", { ok: false, plotId, error: "You don't own this plot." });
      return;
    }

    if ("roof" in opts) {
      const roof = opts.roof ?? null;
      // null clears back to the default colour; otherwise must be a known id.
      if (roof !== null && !isValidRoofId(roof)) {
        client.send("housingResult", { ok: false, plotId, error: "Unknown paint colour." });
        return;
      }
      setPlotRoof(plotId, roof);
    }

    if ("sign" in opts) {
      // sanitizeSign trims/caps and returns null for empty (clears the sign).
      setPlotSign(plotId, sanitizeSign(opts.sign));
    }

    this.broadcastHousingState();
    client.send("housingResult", { ok: true, plotId, ownerName: player.name });
  }

  private handleHousingDecorate(
    client: Client,
    plotId: string,
    slot: number,
    propId: string | null,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId) return;

    const owner = getPlotOwner(plotId);
    if (!owner || owner.ownerName !== player.name) {
      client.send("housingResult", { ok: false, plotId, error: "You don't own this plot." });
      return;
    }

    if (!Number.isInteger(slot) || slot < 0 || slot >= PLOT_DECOR_SLOTS) {
      client.send("housingResult", { ok: false, plotId, error: "Invalid decoration slot." });
      return;
    }

    // null clears the corner; otherwise must be a known prop id.
    if (propId !== null && !isValidDecorId(propId)) {
      client.send("housingResult", { ok: false, plotId, error: "Unknown decoration." });
      return;
    }

    setPlotDecor(plotId, slot, propId);
    this.broadcastHousingState();
    client.send("housingResult", { ok: true, plotId, ownerName: player.name });
  }

  private handleHousingLight(client: Client, plotId: string, on: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId) return;

    const owner = getPlotOwner(plotId);
    if (!owner || owner.ownerName !== player.name) {
      client.send("housingResult", { ok: false, plotId, error: "You don't own this plot." });
      return;
    }

    if (on && getPlotLight(plotId).energy <= 0) {
      client.send("housingResult", {
        ok: false,
        plotId,
        error: "The light is out of energy — refuel it with Lamp Oil.",
      });
      return;
    }

    setPlotLight(plotId, on);
    this.broadcastHousingState();
    client.send("housingResult", { ok: true, plotId, ownerName: player.name });
  }

  private handleHousingRefuel(client: Client, plotId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId) return;

    const owner = getPlotOwner(plotId);
    if (!owner || owner.ownerName !== player.name) {
      client.send("housingResult", { ok: false, plotId, error: "You don't own this plot." });
      return;
    }

    if (getPlotLight(plotId).energy >= LIGHT_MAX_ENERGY) {
      client.send("housingResult", { ok: false, plotId, error: "The light is already full." });
      return;
    }

    const inventory = this.inventories.get(player.name) ?? [];
    const { inventory: nextInv, removed } = removeItemFromInventory(inventory, LIGHT_OIL_ITEM, 1);
    if (removed <= 0) {
      client.send("housingResult", {
        ok: false,
        plotId,
        error: "You need Lamp Oil — craft it at the workbench (2 River Fish + 1 Wood).",
      });
      return;
    }

    this.inventories.set(player.name, nextInv);
    refuelPlot(plotId, LIGHT_REFUEL_AMOUNT);
    this.sendInventory(client, player.name);
    this.broadcastHousingState();
    client.send("housingResult", { ok: true, plotId, ownerName: player.name });
    void this.persistPlayer(player);
  }

  /** Rest at your own house to recover energy + HP (on a cooldown). */
  private async handleHousingRest(client: Client, plotId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId) return;
    if (this.isKnockedOut(player.name)) {
      client.send("housingResult", { ok: false, plotId, error: "You can't rest while knocked out." });
      return;
    }

    const owner = getPlotOwner(plotId);
    if (!owner || owner.ownerName !== player.name) {
      client.send("housingResult", { ok: false, plotId, error: "You can only rest in your own home." });
      return;
    }
    if (owner.structure !== "house") {
      client.send("housingResult", { ok: false, plotId, error: "You can only rest in a house, not a shop." });
      return;
    }

    const now = Date.now();
    const last = this.playerLastRestAt.get(player.name) ?? 0;
    const remaining = REST_COOLDOWN_MS - (now - last);
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60_000);
      client.send("housingResult", {
        ok: false,
        plotId,
        error: `You're well-rested. Rest again in ${mins} minute${mins === 1 ? "" : "s"}.`,
      });
      return;
    }

    this.playerLastRestAt.set(player.name, now);
    this.playerStamina.set(player.name, MAX_STAMINA);
    this.playerHp.set(player.name, getPlayerMaxHp(player.level));
    this.sendProfile(client, player);
    client.send("housingResult", { ok: true, plotId, ownerName: player.name });
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Home",
      body: `😴 ${player.name} rested at home and feels refreshed (energy + HP restored).`,
      sentAt: now,
    });
    await this.persistPlayer(player);
  }

  private async handleGuildCreate(client: Client, rawName: string, rawTag: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const name = sanitizeGuildName(rawName);
    const tag = sanitizeGuildTag(rawTag);
    const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
    if (gold < GUILD_CREATE_COST) {
      client.send("guildResult", {
        ok: false,
        gold,
        error: `Founding a guild costs ${GUILD_CREATE_COST} gold.`,
      });
      return;
    }

    const result = createGuild(name, tag, player.name);
    if (!result.ok) {
      client.send("guildResult", { ok: false, error: result.error });
      return;
    }

    const nextGold = gold - GUILD_CREATE_COST;
    this.playerGold.set(player.name, nextGold);
    player.guildTag = tagForMember(player.name);
    this.sendProfile(client, player);
    client.send("guildResult", { ok: true, gold: nextGold });
    client.send("guildState", buildGuildStatePayload(player.name));

    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Guild",
      body: `${player.name} founded the guild [${tag}] ${name}!`,
      sentAt: Date.now(),
    });
    await this.persistPlayer(player);
  }

  /** Submit a join request; the guild's leader/officers must approve it. */
  private handleGuildJoin(client: Client, guildId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const result = requestJoinGuild(player.name, guildId);
    if (!result.ok) {
      client.send("guildResult", { ok: false, error: result.error });
      return;
    }

    client.send("guildResult", { ok: true });
    client.send("guildState", buildGuildStatePayload(player.name));
    // Notify the guild's online members so leaders/officers see the request.
    if (result.guild) {
      this.broadcastGuildState(result.guild.members);
      sendToPlayers(result.guild.members, "chat", {
        id: crypto.randomUUID(),
        channel: "guild",
        senderId: "system",
        senderName: "Guild",
        body: `${player.name} requested to join — a leader or officer can approve it.`,
        sentAt: Date.now(),
      } satisfies ChatMessagePayload);
    }
  }

  private handleGuildCancelRequest(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const guild = cancelJoinRequest(player.name);
    client.send("guildResult", { ok: true });
    client.send("guildState", buildGuildStatePayload(player.name));
    if (guild) this.broadcastGuildState(guild.members);
  }

  private handleGuildJoinDecision(
    client: Client,
    applicant: string,
    approve: boolean,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !applicant) return;
    const result = approve
      ? approveJoinRequest(player.name, applicant)
      : denyJoinRequest(player.name, applicant);
    if (!result.ok) {
      client.send("guildResult", { ok: false, error: result.error });
      return;
    }
    client.send("guildResult", { ok: true });

    const guild = result.guild;
    if (!guild) return;
    // Refresh everyone in the guild, plus the applicant (now a member or rejected).
    this.broadcastGuildState(guild.members);
    const applicantSession = this.activePlayerSession.get(applicant);
    const applicantPlayer = applicantSession ? this.state.players.get(applicantSession) : undefined;
    if (approve && applicantPlayer) {
      applicantPlayer.guildTag = tagForMember(applicant);
      this.sendProfile(this.clientForName(applicant) ?? client, applicantPlayer);
    }
    sendToPlayer(applicant, "guildState", buildGuildStatePayload(applicant));
    sendToPlayer(applicant, "chat", {
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Guild",
      body: approve
        ? `You were accepted into [${guild.tag}] ${guild.name}!`
        : `Your request to join [${guild.tag}] ${guild.name} was declined.`,
      sentAt: Date.now(),
    } satisfies ChatMessagePayload);
  }

  private handleGuildLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const result = leaveGuild(player.name);
    if (!result.ok) {
      client.send("guildResult", { ok: false, error: result.error });
      return;
    }

    player.guildTag = "";
    this.sendProfile(client, player);
    client.send("guildResult", { ok: true });
    client.send("guildState", buildGuildStatePayload(player.name));
  }

  /** Push a fresh, per-recipient guild state to every online member by name. */
  private broadcastGuildState(memberNames: string[]) {
    for (const member of memberNames) {
      sendToPlayer(member, "guildState", buildGuildStatePayload(member));
    }
  }

  private handleGuildRankAction(
    client: Client,
    action: "promote" | "demote" | "kick",
    target: string,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !target) return;
    const members = guildMemberNames(player.name);
    const result =
      action === "promote"
        ? promoteMember(player.name, target)
        : action === "demote"
          ? demoteMember(player.name, target)
          : kickMember(player.name, target);
    if (!result.ok) {
      client.send("guildResult", { ok: false, error: result.error });
      return;
    }
    client.send("guildResult", { ok: true });
    // Notify everyone who was in the guild (incl. a kicked member, so their UI clears).
    this.broadcastGuildState(members);
    if (action === "kick") {
      // Refresh the kicked player's nameplate tag.
      const session = this.activePlayerSession.get(target);
      const kicked = session ? this.state.players.get(session) : undefined;
      if (kicked) kicked.guildTag = tagForMember(target);
      sendToPlayer(target, "guildState", buildGuildStatePayload(target));
    }
  }

  private handleGuildSetTax(client: Client, rate: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = setGuildTax(player.name, rate);
    if (!result.ok) {
      client.send("guildResult", { ok: false, error: result.error });
      return;
    }
    client.send("guildResult", { ok: true });
    this.broadcastGuildState(guildMemberNames(player.name));
  }

  private async handleGuildBank(client: Client, action: "deposit" | "withdraw", amount: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const want = Math.floor(amount);

    if (action === "deposit") {
      const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
      if (want <= 0 || gold < want) {
        client.send("guildResult", { ok: false, error: "Not enough gold to deposit." });
        return;
      }
      const result = depositToBank(player.name, want);
      if (!result.ok) {
        client.send("guildResult", { ok: false, error: result.error });
        return;
      }
      this.playerGold.set(player.name, gold - want);
    } else {
      const result = withdrawFromBank(player.name, want);
      if (!result.ok || !result.amount) {
        client.send("guildResult", { ok: false, error: result.error });
        return;
      }
      const gold = this.playerGold.get(player.name) ?? STARTING_GOLD;
      this.playerGold.set(player.name, gold + result.amount);
    }

    this.sendProfile(client, player);
    client.send("guildResult", { ok: true });
    this.broadcastGuildState(guildMemberNames(player.name));
    await this.persistPlayer(player);
  }

  private handleGuildWar(client: Client, action: "declare" | "end", guildId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !guildId) return;
    const result = action === "declare" ? declareWar(player.name, guildId) : endWar(player.name, guildId);
    if (!result.ok) {
      client.send("guildResult", { ok: false, error: result.error });
      return;
    }
    client.send("guildResult", { ok: true });

    const myGuild = getGuildForMember(player.name);
    const myMembers = myGuild?.members ?? [];
    const theirMembers = result.against?.members ?? [];
    this.broadcastGuildState([...myMembers, ...theirMembers]);

    if (action === "declare" && myGuild && result.against) {
      this.broadcastChat(
        this.systemChat("War", `⚔️ [${myGuild.tag}] declared WAR on [${result.against.tag}]!`),
      );
    } else if (action === "end" && myGuild && result.against) {
      this.broadcastChat(
        this.systemChat("War", `🕊️ [${myGuild.tag}] made peace with [${result.against.tag}].`),
      );
    }
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
    if (player.spectator) return;
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
      stamina: clampStamina(this.playerStamina.get(player.name) ?? STARTING_STAMINA),
      vipPassUntil: (() => {
        const wallet = this.playerWallets.get(player.sessionId);
        const until = wallet ? ZoneRoom.vipPassUntil.get(wallet) ?? 0 : 0;
        return until > Date.now() ? until : null;
      })(),
      blackPass: (() => {
        const wallet = this.playerWallets.get(player.sessionId);
        return wallet ? ZoneRoom.blackPassWallets.has(wallet) : false;
      })(),
      pvpRating: this.playerPvpRating.get(player.name) ?? STARTING_PVP_RATING,
      pvpKills: this.playerPvpKills.get(player.name) ?? 0,
      pvpSeason: this.playerPvpSeason.get(player.name) ?? getPvpSeason(Date.now()),
      honor: this.playerHonor.get(player.name) ?? 0,
      guildCoin: this.playerGuildCoin.get(player.name) ?? 0,
      gems: this.playerGems.get(player.name) ?? 0,
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

  private handleGuildChat(client: Client, rawBody: string) {
    const now = Date.now();
    const lastSent = this.chatCooldowns.get(client.sessionId) ?? 0;
    if (now - lastSent < CHAT_COOLDOWN_MS) return;

    const body = rawBody.trim().slice(0, CHAT_MAX_LENGTH);
    if (!body) return;

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const guild = getGuildForMember(player.name);
    if (!guild) {
      client.send("guildResult", { ok: false, error: "You're not in a guild." });
      return;
    }

    this.chatCooldowns.set(client.sessionId, now);
    // Deliver to every online guild member across all zones via presence.
    sendToPlayers(guild.members, "chat", {
      id: crypto.randomUUID(),
      channel: "guild",
      senderId: client.sessionId,
      senderName: player.name,
      body,
      sentAt: now,
    } satisfies ChatMessagePayload);
  }

  private nameFor(client: Client): string {
    return this.state.players.get(client.sessionId)?.name ?? "";
  }

  /** Push fresh party state to each affected member and ack the actor. */
  private handlePartyMutation(client: Client, mutation: PartyMutation) {
    if (!mutation.ok) {
      client.send("partyResult", { ok: false, error: mutation.error });
      return;
    }
    for (const member of mutation.notify ?? []) {
      sendToPlayer(member, "partyState", buildPartyStatePayload(member));
    }
    client.send("partyResult", { ok: true });
  }

  private handlePartyInvite(client: Client, rawTarget: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const target = rawTarget.trim().slice(0, 16);
    if (!target) return;
    if (!isOnline(target)) {
      client.send("partyResult", { ok: false, error: "That player isn't online." });
      return;
    }

    const result = invitePlayer(player.name, target);
    if (!result.ok) {
      client.send("partyResult", { ok: false, error: result.error });
      return;
    }

    sendToPlayer(target, "partyInvite", { fromName: player.name });
    for (const member of result.notify ?? []) {
      sendToPlayer(member, "partyState", buildPartyStatePayload(member));
    }
    client.send("partyResult", { ok: true });
  }

  private handlePartyChat(client: Client, rawBody: string) {
    const now = Date.now();
    const lastSent = this.chatCooldowns.get(client.sessionId) ?? 0;
    if (now - lastSent < CHAT_COOLDOWN_MS) return;

    const body = rawBody.trim().slice(0, CHAT_MAX_LENGTH);
    if (!body) return;

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const party = getPartyForMember(player.name);
    if (!party) {
      client.send("partyResult", { ok: false, error: "You're not in a party." });
      return;
    }

    this.chatCooldowns.set(client.sessionId, now);
    sendToPlayers(party.members, "chat", {
      id: crypto.randomUUID(),
      channel: "party",
      senderId: client.sessionId,
      senderName: player.name,
      body,
      sentAt: now,
    } satisfies ChatMessagePayload);
  }



  private broadcastChat(message: ChatMessagePayload) {
    if (message.channel === "zone") {
      for (const room of ZoneRoom.activeRooms) {
        room.broadcast("chat", message);
      }
    } else {
      this.broadcast("chat", message);
    }
  }

  onDispose() {
    ZoneRoom.activeRooms.delete(this);
  }
}

/** Match quest defeat targets against NPC IDs.  Wild slimes use IDs like
 *  "wild_slime", "wild_slime_2", etc. — all prefixed with "wild_slime". */
function defeatTargetMatch(target: string, npcId: string): boolean {
  if (target === npcId) return true;
  if (target === "wild_slime" && npcId.startsWith("wild_slime")) return true;
  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeName(name?: string): string {
  const trimmed = (name ?? "Traveler").trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : "Traveler";
}