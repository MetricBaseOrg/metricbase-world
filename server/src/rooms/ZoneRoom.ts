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
  getShopDefinition,
  getZoneConfig,
  removeItemFromInventory,
  STARTING_GOLD,
  JoinOptions,
  normalizeCharacterAppearance,
  defaultAppearanceForGender,
  type PlayerProfilePayload,
  normalizeInventory,
  normalizeSkills,
  woodcuttingLevelFromXp,
  computeMineDurationMs,
  computeFishDurationMs,
  FARM_RANGE,
  farmPlotCenterOffset,
  getFarmCropBySeed,
  getCropMarket,
  FARM_CROPS,
  zonePropFootprint,
  DEFAULT_FARM_SEED,
  bagCapacity,
  dailyDayKey,
  isBuildTileBlocked,
  dailyTasksFor,
  loginRewardGold,
  currentSeason,
  estimateReward,
  SEASON_POINTS,
  type SeasonCategory,
  type SeasonStatePayload,
  nextBagExpansion,
  nextZoneExpansion,
  zoneGridSize,
  type DailyStatePayload,
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
  sanitizeSalePrice,
  structureLabel,
  type HousingMarketListing,
  type P2PMarketListing,
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
  JOB_KINDS,
  type JobView,
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
  MAJOR_REPAIR_FRACTION,
  priceRegionOf,
  priceRegions,
  TOWNS,
  repairCostPerPoint,
  repairMaterialFor,
  restoreSlotWear,
  stashSlotWear,
  armorReduction,
  rollHit,
  WEARABLE_SLOTS,
  type AbilityDef,
  getAbilityById,
  weaponGrantsAbility,
  getZoneDangerTier,
  DANGER_TIER_META,
  normalizePlayerZoneTier,
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
  KING_CRYSTAL_ARMOR,
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
  getGatherPerks,
  getToolYieldBonus,
  getFarmGrowthMultiplier,
  rollRareGatherDrop,
  rollFishSpecies,
  FISHING_CAST_GOLD,
  getItemBaseValue,
  gatherTaxGold,
  fishWatersForLoot,
  type FishSpecies,
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
  TRAINING_DUMMY_NPC_ID,
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
  COMPANY_CREATE_COST,
  sanitizeCompanyName,
  getPipSellPrice,
  type CompanyContractKind,
  type CompanyRank,
  type CompanyType,
  SHARE_LISTING_COST,
  SHARE_MIN_TRADE,
  SHARE_MAX_TRADE,
  quoteBuy,
  quoteSell,
  shareTradeFee,
} from "@metricbase/shared";
import { verifyAccessToken } from "../auth/accessToken.js";
import { isTelegramIdentity } from "../auth/telegramAuth.js";
import { getMinTokenUiAmount, isTokenGateEnabled } from "../auth/tokenGate.js";
import {
  CharacterBindingError,
  loadCharacterByName,
  loadCharacterByWallet,
  renameCharacter,
  resolveCharacterForJoin,
  saveCharacter,
} from "../db/characters.js";
import { isInvitationSystemActive, validateAndUseInviteCode, getInvitedCount } from "../db/invitations.js";
import { banWallet, deleteCharacterTraces, isWalletBanned, listBans, unbanWallet } from "../db/bans.js";
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
  getSentBox,
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
import {
  dynamicBuyPrices,
  dynamicSellPrices,
  effectiveBuyPrice,
  effectiveSellPrice,
  recordSale,
} from "../market/sellPressure.js";
import { recordConsumed, recordProduced } from "../economy/itemFlows.js";
import {
  anyPlotLit,
  buildLandPlotStates,
  claimPlot,
  getForSalePlots,
  getPlotLight,
  getPlotOwner,
  getStockedShopPlots,
  refuelPlot,
  setPlotDecor,
  setPlotLight,
  setPlotRoof,
  setPlotSale,
  setPlotSign,
  transferPlot,
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
  getCompanyForMember,
  getCompanyById,
  companyMemberNames,
  companyTypeOf,
  createCompany,
  requestJoinCompany,
  cancelJoinRequest as cancelCompanyJoinRequest,
  approveJoinRequest as approveCompanyJoinRequest,
  denyJoinRequest as denyCompanyJoinRequest,
  leaveCompany,
  kickCompanyMember,
  setCompanyRank,
  setCompanyMotd,
  setCompanyRates,
  setCompanySalary,
  depositCompanyGold,
  withdrawCompanyGold,
  contributeWarehouse,
  stockWarehouse,
  takeFromWarehouse,
  applyCompanyCut,
  creditCompanyTreasury,
  refundCompanyTreasury,
  tickCompanyActivity,
  postCompanyContract,
  cancelCompanyContract,
  acceptCompanyContract,
  deliverCompanyContract,
  peekContractCollect,
  reduceContractCollect,
  dismissCompanyContract,
  bumpCompanyContractProgress,
  buildCompanyStatePayload,
  broadcastCompanyState as broadcastCompanyStateFn,
} from "../company/companyRegistry.js";
import {
  isListed as isCompanyListed,
  getMarket as getShareMarket,
  listCompany as listShareMarket,
  sharesOf,
  tradeCooldownRemaining,
  applyBuy as applyShareBuy,
  applySell as applyShareSell,
  settleDelisting,
  setDividendVote,
  freeSharesFor,
  createBaseListing,
  cancelBaseListing,
  fillBaseListing,
  getBaseListing,
  canPlaceOrder,
  placeBuyOrder,
  placeSellOrder,
  cancelOrder,
  buildExchangeState,
  buildMarketDetail,
  type OrderCredit,
} from "../exchange/exchangeRegistry.js";
import {
  addZoneEarnings,
  addZoneTax,
  canEnterZone,
  isZoneGuildmate,
  collectZoneEarnings,
  createPlayerZone,
  getPlayerZone,
  getPublishedZones,
  getZoneGatherTax,
  getZonesOwnedBy,
  expandZone,
  grantZonePass,
  isPlayerZoneId,
  recordZoneVisit,
  sanitizeBuild,
  setZoneBuild,
  setZoneMeta,
} from "../zones/zoneRegistry.js";
import { creditTreasuryGold } from "../economy/treasury.js";
import { fillTownOrder, getTownOrders, playerOrderGoldRemaining } from "../economy/townDemand.js";
import {
  cropGrowthMultNow,
  cropYieldMultNow,
  fishBonusChanceNow,
  oreBonusChanceNow,
} from "../economy/events.js";
import { currentSinkMultiplier } from "../economy/metrics.js";
import {
  baseItemIdOf,
  bonusYieldChance,
  COMPANY_TYPE_PERKS,
  CRAFT_FAMILIES,
  CRAFT_RESPEC_COST,
  craftFamilyOf,
  emptyCraftMastery,
  fineChance,
  isQualityEligible,
  masterChance,
  MASTERY_DAILY_XP_CAP,
  masteryLevel,
  masteryXpForCraft,
  MAX_CRAFT_SPECS,
  normalizeCraftMastery,
  qualityVariantId,
  RAIN_CROP_GROWTH_MULT,
  type CraftFamily,
  type CraftMasteryPayload,
  type CraftMasteryState,
} from "@metricbase/shared";
import {
  acceptRun,
  activeRunOf,
  caravanCooldownMs,
  claimDroppedRun,
  deliverRun,
  dropRunOnDeath,
  offersFrom,
  playerFreightRemaining,
} from "../economy/caravans.js";
import { bumpMetric, burnGold, mintGold } from "../economy/metrics.js";
import { creditGoldForPurchase, isPurchaseRedeemed, recordTokenPurchase } from "../db/tokenPurchases.js";
import { emptyDailyRow, loadDailyState, saveDailyState, type DailyRow } from "../db/daily.js";
import {
  emptySeasonRow,
  loadSeasonState,
  awardSeasonPointsDb,
  loadSeasonAggregate,
  loadSeasonRank,
  getSeasonRewardPool,
  hasPayoutWallet,
} from "../db/season.js";
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
import {
  acceptJob,
  abandonJob,
  applyDelivery,
  bumpJobProgress,
  cancelJob,
  collectDelivered,
  dismissJob,
  getJob,
  getJobsState,
  postJob,
} from "../jobs/jobRegistry.js";
import { getTerritoryOwner, setTerritoryOwner } from "../territory/territoryRegistry.js";
import { getSovereign, setSovereign } from "../siege/siegeRegistry.js";
import { clearOnline, isOnline, kickPlayer, sendToPlayer, sendToPlayers, setOnline } from "../social/presence.js";
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

/** WebSocket close code sent to a character's old session when a newer login for
 *  the same name takes over (single-session enforcement). The client just shows
 *  a normal disconnect — it does not auto-rejoin, so there's no kick loop. */
const GOODBYE_DUPLICATE_LOGIN = 4001;

/** Build the global P2P housing market: every owned plot currently for sale,
 *  annotated with its zone's display name for the buyer's browser. */
function getHousingMarketListings(): HousingMarketListing[] {
  return getForSalePlots().map((plot) => {
    let zoneName = plot.zoneId;
    try {
      zoneName = getZoneConfig(plot.zoneId)?.displayName ?? plot.zoneId;
    } catch {
      /* unknown/unloaded zone — fall back to the id */
    }
    return {
      plotId: plot.plotId,
      zoneId: plot.zoneId,
      zoneName,
      structure: plot.structure,
      ownerName: plot.ownerName,
      ownerWallet: plot.ownerWallet,
      sign: plot.sign,
      roof: plot.roof,
      saleGold: plot.saleGold ?? null,
      saleBase: plot.saleBase ?? null,
    };
  });
}

/** Build the global P2P item market: every item stocked in any player-run shop
 *  across all zones, annotated for the browser tab in Pip's Market. */
function getP2pMarketListings(): P2PMarketListing[] {
  const out: P2PMarketListing[] = [];
  for (const plot of getStockedShopPlots()) {
    let zoneName = plot.zoneId;
    try {
      zoneName = getZoneConfig(plot.zoneId)?.displayName ?? plot.zoneId;
    } catch {
      /* unknown/unloaded zone — fall back to the id */
    }
    for (const listing of plot.listings) {
      if (listing.quantity <= 0) continue;
      out.push({
        plotId: plot.plotId,
        zoneId: plot.zoneId,
        zoneName,
        shopName: plot.sign ?? null,
        ownerName: plot.ownerName,
        itemId: listing.itemId,
        quantity: listing.quantity,
        price: listing.price,
      });
    }
  }
  // Cheapest first per item so bargains surface; stable for equal prices.
  out.sort((a, b) => a.itemId.localeCompare(b.itemId) || a.price - b.price);
  return out;
}

/** Count each placeable asset used in a build (ground paint + scenery + nodes). */
function countBuildAssets(build: PlayerZoneBuild): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const t of build.tiles) add(t.type);
  for (const s of build.scenery) add(s.prop);
  for (const r of build.resources) add(r.prop ?? r.name);
  return counts;
}

/** How long (seconds) the server keeps a dropped player's character in the
 *  world, waiting for a silent client reconnect, before actually removing them.
 *  Covers a backgrounded tab or a brief network blip; must comfortably exceed
 *  the client's reconnect-retry span (see attemptReconnect in network.ts). */
const RECONNECT_GRACE_SECONDS = 60;

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
  /** Craft mastery + specialization per pid (craftQuality.ts). */
  private craftMastery = new Map<string, CraftMasteryState>();
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
    {
      resourceId: string;
      playerName: string;
      startedAt: number;
      endsAt: number;
      durationMs: number;
      /** Fishing catch minigame: the client resolves success/fail; endsAt is a timeout. */
      minigame?: boolean;
    }
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
  /** Bag expansion steps purchased with $BASE burns (0 = base 16 slots). */
  private playerBagLevel = new Map<string, number>();
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
  /**
   * Castle Siege (Black zone only): King Crystal HP + last broadcast window
   * state. HP is STATIC so every Black Zone room instance (Colyseus spawns a
   * second room when one fills) fights the same crystal — otherwise each room
   * would have its own crystal and the prize could be won twice per window.
   */
  private static crystalHp = KING_CRYSTAL_MAX_HP;
  private siegeWasActive = false;
  private lastSiegeBroadcastAt = 0;
  /** Wallets with LIFETIME Black-zone access (one-time $BASE burn). DB-backed. */
  private static blackPassWallets = new Set<string>();
  /** VIP Lodge passes (wallet -> expiry) bought with gold + a $BASE burn.
   *  NOTE: in-memory; resets on restart. Move to DB persistence for production. */
  private static vipPassUntil = new Map<string, number>();
  /** Jail sentences (player name -> release time). In-memory; clears on restart. */
  private static jailedUntil = new Map<string, number>();
  /** Tracks which session ID is "active" for each player key (pid = wallet).
   *  Used to prevent a stale onLeave from wiping in-memory state belonging to a
   *  new session. */
  private activePlayerSession = new Map<string, string>();
  /** Tracks which session ID is "active" for each WALLET (pid). This is the
   *  single-session guard for the wallet-keyed data maps — keyed on the immutable
   *  wallet so a rename's reconnect supersedes the old session cleanly. */
  private activeWalletSession = new Map<string, string>();
  /** name -> pid (wallet) for players currently in this room, so features that
   *  address an ONLINE player by display name can resolve their stable id. */
  private nameToPid = new Map<string, string>();
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



    this.syncMobStateToConfig();

    this.setSimulationInterval((deltaTime) => this.tick(deltaTime), 1000 / TICK_RATE);

    // Push refreshed world stats (holder count may update in the background).
    this.clock.setInterval(() => {
      if (this.state.players.size > 0) this.broadcast("worldStats", this.buildWorldStats());
    }, 60_000);

    // Periodically autosave all online players in this room to prevent progress loss on crash
    this.clock.setInterval(async () => {
      if (this.state.players.size > 0) {
        const promises: Promise<void>[] = [];
        for (const player of this.state.players.values()) {
          if (!player.spectator) {
            promises.push(this.persistPlayer(player));
          }
        }
        await Promise.allSettled(promises);
      }
    }, 5 * 60 * 1000);

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
    this.onProtectedMessage("renameCharacter", (client, message: { newName?: string }) => {
      void this.handleRenameCharacter(client, String(message.newName ?? ""));
    });
    this.onProtectedMessage(
      "zoneMetaSet",
      (
        client,
        message: { zoneId?: string; displayName?: string; passPrice?: number; published?: boolean; gatherTax?: number; dangerTier?: DangerTier; guildOnly?: boolean },
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
    this.onProtectedMessage("cropMarketTrade", (client, message: { market?: string; action?: string; qty?: number }) => {
      void this.handleCropMarketTrade(client, String(message.market ?? ""), String(message.action ?? ""), Number(message.qty) || 1);
    });
    this.onProtectedMessage("dailyState", (client) => {
      void this.handleDailyState(client);
    });
    this.onProtectedMessage("seasonState", (client) => {
      void this.handleSeasonState(client);
    });
    this.onProtectedMessage("dailyClaimTask", (client, message: { taskId?: string }) => {
      void this.handleDailyClaimTask(client, String(message.taskId ?? ""));
    });
    this.onProtectedMessage("dailyClaimLogin", (client) => {
      void this.handleDailyClaimLogin(client);
    });
    this.onProtectedMessage("zoneExpand", (client, message: { zoneId?: string; signature?: string }) => {
      void this.handleZoneExpand(client, String(message.zoneId ?? ""), String(message.signature ?? ""));
    });
    this.onProtectedMessage("bagExpand", (client, message: { signature?: string }) => {
      void this.handleBagExpand(client, String(message.signature ?? ""));
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

    this.onProtectedMessage("chop", (client, message: { resourceId?: string; minigame?: boolean }) => {
      void this.handleChop(client, message.resourceId ?? "", Boolean(message.minigame));
    });
    // Public profile card: anyone can look up a player by exact name.
    this.onProtectedMessage("playerProfile", (client, message: { name?: string }) => {
      void this.handlePlayerProfile(client, String(message?.name ?? "").trim());
    });

    this.onProtectedMessage("fishingResolve", (client, message: { resourceId?: string; success?: boolean }) => {
      void this.handleFishingResolve(client, String(message.resourceId ?? ""), Boolean(message.success));
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

    // ----- Craft mastery / specialization (craftQuality.ts) -----
    this.onMessage("craftMastery", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      client.send("craftMastery", this.buildCraftMasteryPayload(this.pidOf(player)));
    });
    this.onProtectedMessage("craftSpecSet", (client, m: { family?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const family = m.family as CraftFamily;
      const mastery = this.craftMastery.get(this.pidOf(player)) ?? emptyCraftMastery();
      if (!CRAFT_FAMILIES.includes(family)) {
        return void client.send("craftMasteryResult", { ok: false, error: "Unknown craft family." });
      }
      if (mastery.specs.includes(family)) {
        return void client.send("craftMasteryResult", { ok: false, error: "Already specialized in that family." });
      }
      if (mastery.specs.length >= MAX_CRAFT_SPECS) {
        return void client.send("craftMasteryResult", {
          ok: false,
          error: `You can master only ${MAX_CRAFT_SPECS} families — respec to change paths.`,
        });
      }
      mastery.specs.push(family);
      this.craftMastery.set(this.pidOf(player), mastery);
      void this.persistPlayer(player);
      client.send("craftMasteryResult", { ok: true });
      client.send("craftMastery", this.buildCraftMasteryPayload(this.pidOf(player)));
    });
    this.onProtectedMessage("craftRespec", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const mastery = this.craftMastery.get(this.pidOf(player)) ?? emptyCraftMastery();
      if (mastery.specs.length === 0) {
        return void client.send("craftMasteryResult", { ok: false, error: "You have no specializations to reset." });
      }
      // Adaptive sink: the respec fee breathes with mint pressure (±20%).
      const respecCost = Math.round(CRAFT_RESPEC_COST * currentSinkMultiplier());
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      if (gold < respecCost) {
        return void client.send("craftMasteryResult", {
          ok: false,
          error: `A respec costs ${respecCost.toLocaleString()} gold.`,
        });
      }
      this.playerGold.set(this.pidOf(player), gold - respecCost);
      burnGold(respecCost);
      bumpMetric("gold.sink.respec", respecCost);
      // XP is kept — the respec fee buys back the SLOTS, not your knowledge.
      mastery.specs = [];
      this.craftMastery.set(this.pidOf(player), mastery);
      this.sendProfile(client, player);
      void this.persistPlayer(player);
      client.send("craftMasteryResult", { ok: true });
      client.send("craftMastery", this.buildCraftMasteryPayload(this.pidOf(player)));
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
    this.onProtectedMessage("adAdminCredit", (client, m: { amount?: number }) => {
      void this.handleAdAdminCredit(client, Number(m.amount ?? 0));
    });
    // ---- Admin moderation (treasury/ADMIN_WALLETS only; re-checked per message) ----
    this.onProtectedMessage("adminBanList", (client) => {
      void this.handleAdminBanList(client);
    });
    this.onProtectedMessage(
      "adminBan",
      (client, m: { name?: string; reason?: string; deleteCharacter?: boolean }) => {
        void this.handleAdminBan(client, m);
      },
    );
    this.onProtectedMessage("adminUnban", (client, m: { wallet?: string }) => {
      void this.handleAdminUnban(client, String(m.wallet ?? ""));
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

    // ===== P2P housing resale market =====
    this.onProtectedMessage(
      "housingListSale",
      (client, message: { plotId?: string; saleGold?: unknown; saleBase?: unknown }) => {
        this.handleHousingListSale(client, message.plotId ?? "", message.saleGold, message.saleBase);
      },
    );
    this.onProtectedMessage("housingUnlistSale", (client, message: { plotId?: string }) => {
      this.handleHousingListSale(client, message.plotId ?? "", null, null);
    });
    this.onMessage("housingMarket", (client) => {
      client.send("housingMarket", { listings: getHousingMarketListings() });
    });
    this.onMessage("p2pMarket", (client) => {
      client.send("p2pMarket", { listings: getP2pMarketListings() });
    });
    this.onProtectedMessage("housingBuyResale", (client, message: { plotId?: string }) => {
      void this.handleHousingBuyResaleGold(client, message.plotId ?? "");
    });
    this.onProtectedMessage(
      "housingBuyResaleBase",
      (client, message: { plotId?: string; signature?: string }) => {
        void this.handleHousingBuyResaleBase(client, message.plotId ?? "", message.signature ?? "");
      },
    );

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

    // ----- Merchant Companies -----
    this.onProtectedMessage(
      "companyCreate",
      (client, m: { name?: string; emblem?: string; color?: number; companyType?: string }) => {
        this.handleCompanyCreate(client, m.name ?? "", m.emblem ?? "", m.color ?? 0, m.companyType ?? "");
      },
    );
    this.onProtectedMessage("companyJoin", (client, m: { companyId?: string }) => {
      this.handleCompanyJoin(client, m.companyId ?? "");
    });
    this.onProtectedMessage("companyCancelRequest", (client) => {
      this.handleCompanyCancelRequest(client);
    });
    this.onProtectedMessage("companyApprove", (client, m: { applicant?: string }) => {
      this.handleCompanyJoinDecision(client, "approve", m.applicant ?? "");
    });
    this.onProtectedMessage("companyDeny", (client, m: { applicant?: string }) => {
      this.handleCompanyJoinDecision(client, "deny", m.applicant ?? "");
    });
    this.onProtectedMessage("companyLeave", (client) => {
      this.handleCompanyLeave(client);
    });
    this.onProtectedMessage("companyKick", (client, m: { target?: string }) => {
      this.handleCompanyKick(client, m.target ?? "");
    });
    this.onProtectedMessage("companySetRank", (client, m: { target?: string; rank?: string }) => {
      this.handleCompanySetRank(client, m.target ?? "", (m.rank ?? "") as CompanyRank);
    });
    this.onProtectedMessage("companySetMotd", (client, m: { motd?: string }) => {
      this.handleCompanySetMotd(client, m.motd ?? "");
    });
    this.onProtectedMessage("companySetRates", (client, m: { revenueShare?: number; dividendRate?: number }) => {
      this.handleCompanySetRates(client, m.revenueShare ?? 0, m.dividendRate ?? 0);
    });
    this.onProtectedMessage("companySetSalary", (client, m: { target?: string; gold?: number }) => {
      this.handleCompanySetSalary(client, m.target ?? "", m.gold ?? 0);
    });
    this.onProtectedMessage("companyDeposit", (client, m: { amount?: number }) => {
      void this.handleCompanyDeposit(client, m.amount ?? 0);
    });
    this.onProtectedMessage("companyWithdraw", (client, m: { amount?: number }) => {
      void this.handleCompanyWithdraw(client, m.amount ?? 0);
    });
    this.onProtectedMessage("companyContribute", (client, m: { itemId?: string; qty?: number }) => {
      void this.handleCompanyContribute(client, m.itemId ?? "", m.qty ?? 0);
    });
    this.onProtectedMessage("companyTake", (client, m: { itemId?: string; qty?: number }) => {
      void this.handleCompanyTake(client, m.itemId ?? "", m.qty ?? 0);
    });
    this.onProtectedMessage("companySell", (client, m: { itemId?: string; qty?: number }) => {
      this.handleCompanySell(client, m.itemId ?? "", m.qty ?? 0);
    });
    this.onProtectedMessage(
      "companyContractPost",
      (client, m: { companyId?: string; kind?: string; itemId?: string | null; qty?: number; rewardGold?: number }) => {
        void this.handleCompanyContractPost(
          client,
          m.companyId ?? "",
          (m.kind ?? "") as CompanyContractKind,
          m.itemId ?? null,
          m.qty ?? 0,
          m.rewardGold ?? 0,
        );
      },
    );
    this.onProtectedMessage("companyContractCancel", (client, m: { id?: string }) => {
      void this.handleCompanyContractCancel(client, m.id ?? "");
    });
    this.onProtectedMessage("companyContractAccept", (client, m: { id?: string }) => {
      this.handleCompanyContractAccept(client, m.id ?? "");
    });
    this.onProtectedMessage("companyContractDeliver", (client, m: { id?: string; qty?: number }) => {
      this.handleCompanyContractDeliver(client, m.id ?? "", m.qty ?? 0);
    });
    this.onProtectedMessage("companyContractCollect", (client, m: { id?: string }) => {
      void this.handleCompanyContractCollect(client, m.id ?? "");
    });
    this.onProtectedMessage("companyContractDismiss", (client, m: { id?: string }) => {
      this.handleCompanyContractDismiss(client, m.id ?? "");
    });
    this.onProtectedMessage("companyChat", (client, m: { body?: string }) => {
      this.handleCompanyChat(client, m.body ?? "");
    });
    this.onMessage("requestCompanies", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) client.send("companyState", buildCompanyStatePayload(player.name));
    });

    // ----- Town order boards -----
    this.onMessage("townOrders", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      client.send("townOrders", {
        orders: getTownOrders(),
        playerDailyRemaining: playerOrderGoldRemaining(this.pidOf(player)),
      });
    });
    this.onProtectedMessage("townOrderFill", (client, m: { orderId?: string }) => {
      void this.handleTownOrderFill(client, m.orderId ?? "");
    });
    // ----- Caravan freight -----
    this.onMessage("caravanBoard", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const pid = this.pidOf(player);
      client.send("caravanBoard", {
        offers: offersFrom(this.zoneConfig.id),
        active: activeRunOf(pid),
        playerDailyRemaining: playerFreightRemaining(pid),
        cooldownMs: caravanCooldownMs(pid, companyTypeOf(player.name) === "logistics"),
      });
    });
    this.onProtectedMessage("caravanAccept", (client, m: { toZone?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const result = acceptRun(this.pidOf(player), this.zoneConfig.id, m.toZone ?? "", companyTypeOf(player.name) === "logistics");
      if (result.ok && result.run) {
        client.send("chat", this.systemChat("Caravan", `Cargo loaded! Haul it to ${result.run.toLabel} within 30 minutes — 🪙 ${result.run.feeGold} on delivery.`));
      }
      client.send("caravanResult", { ok: result.ok, error: result.error, accepted: result.run ?? null });
    });
    this.onProtectedMessage("caravanDeliver", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const result = deliverRun(this.pidOf(player), this.zoneConfig.id, companyTypeOf(player.name) === "logistics");
      if (result.ok) {
        if ((result.goldPaid ?? 0) > 0) {
          this.grantGold(client, player, result.goldPaid ?? 0, "caravan delivery");
        } else {
          client.send("chat", this.systemChat("Caravan", "Delivered — but the freight budget for today is spent. No fee this time."));
        }
      }
      client.send("caravanResult", { ok: result.ok, error: result.error, goldPaid: result.goldPaid });
    });

    // Regional price comparison for the goods in the player's bag: what each
    // town's vendor pays right now — the arbitrage screen.
    this.onMessage("regionalPrices", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const regions = priceRegions();
      const now = Date.now();
      const seen = new Set<string>();
      const rows: { itemId: string; prices: number[] }[] = [];
      for (const entry of this.inventories.get(this.pidOf(player)) ?? []) {
        if (seen.has(entry.itemId)) continue;
        seen.add(entry.itemId);
        const base = getItemBaseValue(entry.itemId);
        if (base <= 0) continue;
        rows.push({
          itemId: entry.itemId,
          prices: regions.map((r) => effectiveSellPrice(entry.itemId, base, now, r.zoneId)),
        });
      }
      client.send("regionalPrices", { regions, rows });
    });

    // ----- Stock Exchange -----
    this.onProtectedMessage("exchangeList", (client) => {
      void this.handleExchangeList(client);
    });
    this.onProtectedMessage("exchangeBuy", (client, m: { companyId?: string; shares?: number }) => {
      void this.handleExchangeTrade(client, "buy", m.companyId ?? "", m.shares ?? 0);
    });
    this.onProtectedMessage("exchangeSell", (client, m: { companyId?: string; shares?: number }) => {
      void this.handleExchangeTrade(client, "sell", m.companyId ?? "", m.shares ?? 0);
    });
    this.onMessage("requestExchange", (client) => {
      this.sendExchangeState(client);
    });
    this.onMessage("requestMarketDetail", (client, m: { companyId?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !m.companyId) return;
      const detail = buildMarketDetail(m.companyId, player.name);
      if (detail) client.send("marketDetail", detail);
    });
    this.onProtectedMessage("exchangeVote", (client, m: { companyId?: string; pct?: number | null }) => {
      this.handleExchangeVote(client, m.companyId ?? "", m.pct ?? null);
    });
    this.onProtectedMessage("exchangeListBase", (client, m: { companyId?: string; shares?: number; priceBase?: number }) => {
      this.handleExchangeListBase(client, m.companyId ?? "", m.shares ?? 0, m.priceBase ?? 0);
    });
    this.onProtectedMessage("exchangeCancelBase", (client, m: { id?: string }) => {
      this.handleExchangeCancelBase(client, m.id ?? "");
    });
    this.onProtectedMessage("exchangeBuyBase", (client, m: { id?: string; signature?: string }) => {
      void this.handleExchangeBuyBase(client, m.id ?? "", m.signature ?? "");
    });
    this.onProtectedMessage("exchangeOrder", (client, m: { companyId?: string; side?: string; shares?: number; limitPrice?: number }) => {
      void this.handleExchangeOrder(client, m.companyId ?? "", (m.side ?? "") as "buy" | "sell", m.shares ?? 0, m.limitPrice ?? 0);
    });
    this.onProtectedMessage("exchangeCancelOrder", (client, m: { id?: string }) => {
      void this.handleExchangeCancelOrder(client, m.id ?? "");
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

    this.onMessage("requestJobs", (client) => {
      this.sendJobsState(client);
    });
    this.onProtectedMessage(
      "jobPost",
      (client, message: { kind?: string; itemId?: string; qty?: number; rewardGold?: number; deliverZoneId?: string }) => {
        void this.handleJobPost(
          client,
          message.kind ?? "",
          message.itemId ?? null,
          Math.floor(Number(message.qty) || 0),
          Math.floor(Number(message.rewardGold) || 0),
          message.deliverZoneId || null,
        );
      },
    );
    this.onProtectedMessage("jobCancel", (client, message: { id?: string }) => {
      void this.handleJobCancel(client, message.id ?? "");
    });
    this.onProtectedMessage("jobAccept", (client, message: { id?: string }) => {
      this.handleJobAccept(client, message.id ?? "");
    });
    this.onProtectedMessage("jobAbandon", (client, message: { id?: string }) => {
      this.handleJobAbandon(client, message.id ?? "");
    });
    this.onProtectedMessage("jobDeliver", (client, message: { id?: string }) => {
      void this.handleJobDeliver(client, message.id ?? "");
    });
    this.onProtectedMessage("jobCollect", (client, message: { id?: string }) => {
      void this.handleJobCollect(client, message.id ?? "");
    });
    this.onProtectedMessage("jobDismiss", (client, message: { id?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      dismissJob(player.name, message.id ?? "");
      this.sendJobsState(client);
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
        `You need at least ${getMinTokenUiAmount()} MetricBase tokens to enter.`,
      );
    }

    return { ...options, wallet: payload.wallet };
  }

  async onJoin(client: Client, options: JoinOptions, auth?: JoinAuthData) {
    // Spectators are anonymous watchers: no wallet identity (a wallet here
    // would kick the owner's PLAYING session via single-session-per-wallet),
    // no character load/persist, and never a real character's name — the
    // walletless name-protection rejected bonded names (which made spectating
    // impossible), and borrowing one would let a watcher impersonate it in chat.
    const wallet = options.spectate ? null : this.resolveJoinWallet(options, auth);
    // Banned wallets can't enter even with a still-valid access token.
    if (wallet && (await isWalletBanned(wallet))) {
      throw new ServerError(403, "This account has been banned.");
    }
    let name = sanitizeName(options?.name);
    let saved: Awaited<ReturnType<typeof resolveCharacterForJoin>> = null;

    if (options.spectate) {
      name = `Guest${Math.floor(1000 + Math.random() * 9000)}`;
    } else {
      if (wallet) {
        const bonded = await loadCharacterByWallet(wallet);
        if (bonded) {
          name = bonded.name;
        }
      }

      try {
        saved = await resolveCharacterForJoin(wallet, name);
      } catch (error) {
        if (error instanceof CharacterBindingError) {
          throw new ServerError(403, error.message);
        }
        throw error;
      }
    }

    // Player-owned zones gate entry: the owner is always welcome, free zones
    // are open, and paid zones require an unexpired visitor pass.
    if (this.playerZone && !canEnterZone(this.playerZone.zoneId, name)) {
      const guildGated =
        this.playerZone.guildOnly && !isZoneGuildmate(this.playerZone.ownerName, name);
      throw new ServerError(
        403,
        guildGated
          ? "This World is open to its owner's guild members only."
          : "You need a visitor pass to enter this World.",
      );
    }
    // Count the visit for the directory's popularity stats (dedup per day;
    // owner entries don't count).
    if (this.playerZone && !options.spectate) {
      recordZoneVisit(this.playerZone.zoneId, name);
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

    // Two default heroes only: everyone renders as their gender's default
    // look (legacy custom appearances are collapsed here). Cosmetic-only —
    // stats/level/xp/gold/inventory are all read from `saved` untouched.
    const appearance = defaultAppearanceForGender(
      saved?.appearance ?? normalizeCharacterAppearance(options?.appearance),
    );
    // Persist the reset once so the DB no longer holds the legacy look.
    if (saved) {
      const prev = saved.appearance;
      const changed =
        !prev ||
        prev.bodyColor !== appearance.bodyColor ||
        prev.hairColor !== appearance.hairColor ||
        prev.outfitColor !== appearance.outfitColor ||
        prev.hairStyle !== appearance.hairStyle ||
        prev.outfitStyle !== appearance.outfitStyle;
      if (changed) {
        saved = { ...saved, appearance };
        await saveCharacter(saved);
      }
    }

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
      this.playerHp.set(this.pidOf(player), maxHp);
    } else if (savedHp <= 0 && knockedUntil && Date.now() < knockedUntil) {
      player.x = spawn.x;
      player.y = spawn.y;
      this.playerHp.set(this.pidOf(player), 0);
      this.playerKnockedOutUntil.set(player.name, knockedUntil);
    } else if (saved && saved.zoneId === this.zoneConfig.id) {
      player.x = saved.x;
      player.y = saved.y;
      this.playerHp.set(this.pidOf(player), Math.min(savedHp, maxHp));
    } else {
      player.x = spawn.x;
      player.y = spawn.y;
      this.playerHp.set(this.pidOf(player), Math.min(savedHp, maxHp));
    }

    this.playerStamina.set(this.pidOf(player), clampStamina(saved?.stamina ?? STARTING_STAMINA));

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
      this.playerPvpRating.set(this.pidOf(player), rating);
      this.playerPvpKills.set(this.pidOf(player), kills);
      this.playerPvpSeason.set(this.pidOf(player), season);
    }

    // Soft currencies (HUD-P4).
    this.playerHonor.set(this.pidOf(player), saved?.honor ?? 0);
    this.playerGuildCoin.set(this.pidOf(player), saved?.guildCoin ?? 0);
    this.playerGems.set(this.pidOf(player), saved?.gems ?? 0);
    this.playerBagLevel.set(this.pidOf(player), saved?.bagLevel ?? 0);

    this.state.players.set(client.sessionId, player);
    const pid = this.pidOf(player);
    // SINGLE-SESSION ENFORCEMENT: the data-bearing in-memory maps are keyed by
    // WALLET (pid), so two live sessions for the same wallet share them — and
    // whichever leaves first deletes them, wiping the survivor's items. Keying
    // this on the WALLET (not the display name) also makes a RENAME safe: the
    // reconnect under the new name is the same wallet, so it supersedes the old
    // session instead of coexisting with it. Disconnect any prior live session
    // for this wallet; it's marked `transferring` so its onLeave skips the
    // persist, and since activeWalletSession now points here its onLeave also
    // skips the wallet-keyed map deletion. Genuine reconnects reuse the same
    // sessionId, so they never trip this.
    const priorSessionId = this.activeWalletSession.get(pid);
    this.activeWalletSession.set(pid, client.sessionId);
    // Display-name -> session/pid for features that address an ONLINE player by
    // name (mail/duel/party/messaging).
    this.activePlayerSession.set(player.name, client.sessionId);
    this.nameToPid.set(player.name, pid);
    if (priorSessionId && priorSessionId !== client.sessionId) {
      this.transferring.add(priorSessionId);
      const priorClient = this.clients.find((entry) => entry.sessionId === priorSessionId);
      priorClient?.leave(GOODBYE_DUPLICATE_LOGIN);
    }
    // Load daily-quest state (ticks the login streak); entering someone else's
    // World counts toward the "visit a player World" task.
    void this.ensureDaily(player.name).then(() => {
      if (this.playerZone && this.playerZone.ownerName !== player.name) {
        this.bumpDaily(player.name, "visitWorld");
      }
    });
    setOnline(player.name, client, (type, payload) => client.send(type, payload));
    this.inputs.set(client.sessionId, { dx: 0, dy: 0 });
    this.questProgress.set(this.pidOf(player), saved?.questProgress ?? { active: [], objectiveIndex: {}, completed: [] });
    this.inventories.set(this.pidOf(player), normalizeInventory(saved?.inventory));
    // Collect any gold owed from asset sales made while offline.
    const owed = takePendingGold(player.name);
    this.playerGold.set(this.pidOf(player), (saved?.gold ?? STARTING_GOLD) + owed);
    const eq = normalizeEquipment(saved?.equipment);
    this.playerEquipment.set(this.pidOf(player), eq);
    player.weaponId = eq.weaponId ?? "";
    player.toolId = eq.toolId ?? "";
    player.speedMult = getMountSpeed(eq.mountId);
    player.petId = eq.petId ?? "";
    // Seed the public vitals immediately (the tick loop keeps them fresh).
    player.maxHp = getPlayerMaxHp(player.level);
    player.hp = this.playerHp.get(this.pidOf(player)) ?? player.maxHp;
    player.stamina = this.playerStamina.get(this.pidOf(player)) ?? STARTING_STAMINA;
    this.npcInteractAt.set(this.pidOf(player), saved?.npcInteractAt ?? {});
    this.craftMastery.set(this.pidOf(player), normalizeCraftMastery(saved?.craftMastery));
    this.mobGoldClaimed.set(this.pidOf(player), saved?.mobGoldClaimed ?? {});
    this.playerSkills.set(this.pidOf(player), normalizeSkills(saved?.skills));

    this.sendProfile(client, player);
    this.sendQuestState(client, player.name);
    this.sendInventory(client, player.name);
    this.sendMobHealth(client);
    this.sendResourceHealth(client);
    this.sendSkillState(client, player.name);
    client.send("farmState", this.buildFarmState());
    client.send("housingState", this.buildHousingState());
    client.send("companyState", buildCompanyStatePayload(player.name));
    client.send("exchangeState", buildExchangeState(player.name, this.listableCompanyIdFor(player.name)));
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

    void this.checkVisitZoneObjectives(client, player.name, this.zoneConfig.id);
    void this.notifyMissingPayoutWallet(client, wallet);
  }

  /**
   * Telegram players sign in with no Solana address, so their Season points
   * accrue toward a payout they CANNOT receive. Nothing else in the game tells
   * them that, and they'd only discover it at season end — so nudge them to set
   * a reward wallet. Silent for everyone else, and silent once they've set one.
   */
  private async notifyMissingPayoutWallet(client: Client, wallet: string | null) {
    if (!wallet || !isTelegramIdentity(wallet)) return;
    try {
      if (await hasPayoutWallet(wallet)) return;
      client.send("chat", {
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Season",
        body:
          "🏆 You're signed in with Telegram, so we don't have a Solana address to send your Season $BASE rewards to. " +
          "Open your dashboard and paste your wallet address into “Reward wallet” — you can keep playing without it, " +
          "but rewards can't be paid until it's set.",
        sentAt: Date.now(),
      });
    } catch (error) {
      console.warn("[season] payout-wallet notice failed:", error);
    }
  }

  async onLeave(client: Client, consented?: boolean) {
    const player = this.state.players.get(client.sessionId);
    const isTransferring = this.transferring.has(client.sessionId);

    // Keep AFK / briefly-disconnected players in the world. An unexpected drop
    // (backgrounded tab, flaky network) arrives with consented=false; hold the
    // session open so the character stays put and the client can silently
    // reconnect. Only an explicit Leave World (consented=true) — or the grace
    // window elapsing without a reconnect — actually removes them. Zone
    // transfers manage their own handoff, so they skip this.
    if (player && !consented && !isTransferring) {
      try {
        await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
        // Reconnected within the window: the same session resumes with all its
        // in-memory state intact — nothing to tear down.
        return;
      } catch {
        // Grace window elapsed without a reconnect — fall through to teardown.
      }
    }

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
      // Only tear down per-player in-memory state if this session is still the
      // active one — a rapid reconnect (avatar change, RENAME) can run a new
      // session's onJoin before the old session's onLeave finishes; without this
      // guard the stale onLeave would delete the new session's state. The
      // WALLET-keyed data maps use the wallet guard (so a rename's new-name
      // session, same wallet, is protected); the name-keyed transient maps use
      // the name guard.
      const pid = this.pidOf(player);
      const isActiveWallet = this.activeWalletSession.get(pid) === client.sessionId;
      const isActiveName = this.activePlayerSession.get(player.name) === client.sessionId;
      if (isActiveWallet) {
        this.activeWalletSession.delete(pid);
      }
      if (isActiveName) {
        this.activePlayerSession.delete(player.name);
        this.nameToPid.delete(player.name);
      }
      clearOnline(player.name, client);
      if (isActiveWallet) {
        this.questProgress.delete(pid);
        this.inventories.delete(pid);
        this.playerGold.delete(pid);
        this.playerHp.delete(pid);
        this.playerEquipment.delete(pid);
        this.npcInteractAt.delete(pid);
        this.craftMastery.delete(pid);
        this.mobGoldClaimed.delete(pid);
        this.playerStamina.delete(pid);
        this.playerSkills.delete(pid);
        this.playerPvpRating.delete(pid);
        this.playerPvpKills.delete(pid);
        this.playerPvpSeason.delete(pid);
      }
      if (isActiveName) {
        this.playerKnockedOutUntil.delete(player.name);
        this.playerLastCombatAt.delete(player.name);
        this.playerLastRegenAt.delete(player.name);
        this.playerLastStaminaRegenAt.delete(player.name);
        this.playerLastHungerNoticeAt.delete(player.name);
        this.playerLastDarkNoticeAt.delete(player.name);
        this.playerLastRestAt.delete(player.name);
        this.craftingUntil.delete(player.name);
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

  /** Persist all non-spectator players across all active rooms. */
  public static async persistAllActivePlayers(): Promise<void> {
    console.log(`[Autosave] Persisting all active players across ${ZoneRoom.activeRooms.size} rooms.`);
    const promises: Promise<void>[] = [];
    for (const room of ZoneRoom.activeRooms) {
      for (const player of room.state.players.values()) {
        if (!player.spectator) {
          promises.push(room.persistPlayer(player));
        }
      }
    }
    const results = await Promise.allSettled(promises);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    console.log(`[Autosave] Persistence complete. Succeeded: ${succeeded}, Failed: ${failed}.`);
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

    // Mirror server-side vitals into the synced schema so everyone can read
    // opponent HP/energy (overhead bars + the PvP target frame). Assign only
    // on change to keep the patch stream small.
    for (const [, player] of this.state.players) {
      const maxHp = getPlayerMaxHp(player.level);
      const hp = this.playerHp.get(this.pidOf(player)) ?? maxHp;
      const stamina = this.playerStamina.get(this.pidOf(player)) ?? STARTING_STAMINA;
      if (player.maxHp !== maxHp) player.maxHp = maxHp;
      if (player.hp !== hp) player.hp = hp;
      if (player.stamina !== stamina) player.stamina = stamina;
      // Reconcile the public hauling flag with the caravan run registry — one
      // source of truth covers accept / deliver / drop / seize / spoil.
      const hauling = activeRunOf(this.pidOf(player)) !== null;
      if (player.hauling !== hauling) player.hauling = hauling;
    }

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
      const currentHp = this.playerHp.get(this.pidOf(player)) ?? maxHp;
      if (currentHp >= maxHp) continue;

      const lastCombat = this.playerLastCombatAt.get(player.name) ?? 0;
      if (now - lastCombat < COMBAT_RECENT_MS) continue;

      const lastRegen = this.playerLastRegenAt.get(player.name) ?? 0;
      if (now - lastRegen < HP_REGEN_INTERVAL_MS) continue;

      this.playerLastRegenAt.set(player.name, now);
      this.playerHp.set(this.pidOf(player), Math.min(maxHp, currentHp + HP_REGEN_AMOUNT));
      this.sendProfile(client, player);
    }

    // Slow stamina trickle so a player who runs out of food (and gold) still
    // recovers over time — food is just far faster. Runs whenever not knocked out.
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.isKnockedOut(player.name)) continue;

      const stamina = this.playerStamina.get(this.pidOf(player)) ?? STARTING_STAMINA;
      if (stamina >= MAX_STAMINA) continue;

      const lastTrickle = this.playerLastStaminaRegenAt.get(player.name) ?? 0;
      if (now - lastTrickle < STAMINA_REGEN_INTERVAL_MS) continue;

      this.playerLastStaminaRegenAt.set(player.name, now);
      this.playerStamina.set(this.pidOf(player), clampStamina(stamina + STAMINA_REGEN_AMOUNT));
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
      // Interactable scenery — arcade/blackjack tables, or a placed crop market.
      const prop = this.zoneConfig.scenery?.find(
        (s) => s.id === npcId && (s.interact || getCropMarket(s.prop) || s.prop === "shop-blue"),
      );
      if (prop) {
        // Multi-tile buildings anchor at their back corner; measure from the
        // footprint centre so standing at the front counts as "close".
        const n = zonePropFootprint(prop.prop);
        const propPos = tileToWorld(prop.tileX + (n - 1) / 2, prop.tileY + (n - 1) / 2);
        if (Math.hypot(player.x - propPos.x, player.y - propPos.y) > NPC_INTERACT_RANGE + (n - 1) * 32) return;
        const market = getCropMarket(prop.prop);
        if (prop.interact === "arcade" && prop.arcadeUrl) {
          client.send("openArcade", { name: "Base Rush", url: prop.arcadeUrl });
        } else if (prop.interact === "blackjack") {
          client.send("openBlackjack", { name: "Blackjack" });
          void this.sendCasinoState(client);
        } else if (market) {
          client.send("openCropMarket", {
            market: market.propId,
            seedPrice: effectiveBuyPrice(market.seedItemId, market.seedPrice, this.priceRegion()),
            cropSellPrice: effectiveSellPrice(market.cropItemId, market.cropSellPrice, Date.now(), this.priceRegion()),
          });
        } else if (prop.prop === "shop-blue") {
          // A placed Shop building is a working general store — same stock,
          // prices, and price-pressure as Pip's in the Hub.
          await this.openShopForNpc(client, player, {
            id: "hub_merchant",
            name: "Rudi",
            tileX: prop.tileX,
            tileY: prop.tileY,
            dialogue: "Welcome to Rudi's Provisions — now serving this World!",
            shopId: "pip_general",
          });
        }
      }
      return;
    }

    const npcPosition = tileToWorld(npc.tileX, npc.tileY);
    const distance = Math.hypot(player.x - npcPosition.x, player.y - npcPosition.y);
    if (distance > NPC_INTERACT_RANGE) return;

    const progress = this.getQuestProgress(player.name);
    for (const questId of getQuestsOfferedByNpc(npcId, progress)) {
      this.questProgress.set(this.pidOf(player), startQuest(progress, questId));
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
    const interactAt = { ...(this.npcInteractAt.get(this.pidOf(player)) ?? {}) };
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
      this.npcInteractAt.set(this.pidOf(player), interactAt);
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

    const weaponId = this.playerEquipment.get(this.pidOf(player))?.weaponId ?? null;
    if (!weaponGrantsAbility(weaponId, abilityId)) {
      client.send("inventoryResult", { ok: false, error: "Your weapon can't use that skill." });
      return;
    }

    await this.handleAttack(client, npcId, ability);
  }

  /**
   * Initialise (and reconcile) per-mob combat state to the CURRENT zoneConfig.
   * Called from onCreate and after every live `zoneConfig` swap (build save,
   * expand, tier change). Newly placed dens get full HP + a spawn position;
   * mobs that still exist keep their live HP (a save won't heal a mob mid-fight);
   * combat state for removed dens is pruned. Without this, a den placed & saved
   * while the room is live has no `mobHp` entry, so `handleAttack` early-returns
   * on `currentHp === undefined` and the mob takes no damage.
   */
  syncMobStateToConfig() {
    const liveCombatIds = new Set<string>();
    for (const npc of this.zoneConfig.npcs) {
      if (!npc.combat) continue;
      liveCombatIds.add(npc.id);
      if (!this.mobHp.has(npc.id)) this.mobHp.set(npc.id, npc.combat.maxHp);
      if (!this.npcPositions.has(npc.id)) {
        const spawnPos = tileToWorld(npc.tileX, npc.tileY);
        this.npcPositions.set(npc.id, { x: spawnPos.x, y: spawnPos.y });
      }
    }
    // Drop combat state for mobs whose den was erased/moved out of existence.
    for (const id of [...this.mobHp.keys()]) if (!liveCombatIds.has(id)) this.mobHp.delete(id);
    for (const id of [...this.npcPositions.keys()]) if (!liveCombatIds.has(id)) this.npcPositions.delete(id);
    for (const id of [...this.mobRespawnAt.keys()]) if (!liveCombatIds.has(id)) this.mobRespawnAt.delete(id);
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

    const playerHp = this.playerHp.get(this.pidOf(player)) ?? getPlayerMaxHp(player.level);
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
    const equipment = normalizeEquipment(this.playerEquipment.get(this.pidOf(player)));
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
      // The training dummy is a safe practice target — it never hits back.
      const counterRaw =
        npcId === TRAINING_DUMMY_NPC_ID ? 0
        : npcId.startsWith("wild_slime") ? 30
        : npcId === "slime_brute" ? 72
        : TRAINING_DUMMY_COUNTER_DAMAGE;
      if (counterRaw > 0) {
        // Armor mitigates incoming counter-damage with diminishing returns.
        const counterDamage = Math.max(1, Math.round(counterRaw * (1 - armorReduction(stats.armor))));
        this.damagePlayer(client, player, counterDamage, `${npc.name} counter-attack`);
        // Taking a hit wears a random worn armor piece.
        this.wearGear(client, player, this.randomWornArmorSlots(equipment));
      }
    }

    const defeated = nextHp === 0;
    // Actual kill spoils, echoed on the broadcast so the client can render
    // the coin-burst + "+XP" juice with real numbers (0 = nothing granted).
    let killGold = 0;
    let killXp = 0;
    if (defeated) {
      bumpMetric("mob.kills", 1);
      this.bumpDaily(player.name, "mobs");
      this.tickJobProgress(player.name, "mobs");
      this.mobRespawnAt.set(npcId, now + npc.combat.respawnMs);

      // Party play: nearby party members fighting in this zone share the spoils.
      const allies = this.nearbyPartyMembers(player, npcPosition);
      const baseXp = npc.combat.rewardXp;
      killXp = partyKillXp(baseXp, allies.length);
      this.grantXp(client, player, killXp, `defeated ${npc.name}`);
      for (const ally of allies) {
        this.grantXp(ally.client, ally.player, partyAssistXp(baseXp), `assisted vs ${npc.name}`);
        await this.checkDefeatObjectives(ally.client, ally.player.name, npcId);
        await this.persistPlayer(ally.player);
      }

      const rewards = getMobRewardConfig(npcId);
      if (rewards && rewards.goldReward > 0) {
        if (rewards.goldOnceOnly) {
          const claimed = { ...(this.mobGoldClaimed.get(this.pidOf(player)) ?? {}) };
          if (!claimed[npcId]) {
            this.grantGold(client, player, rewards.goldReward, `defeated ${npc.name}`);
            killGold = rewards.goldReward;
            claimed[npcId] = true;
            this.mobGoldClaimed.set(this.pidOf(player), claimed);
          }
        } else {
          this.grantGold(client, player, rewards.goldReward, `defeated ${npc.name}`);
          killGold = rewards.goldReward;
        }
      }

      if (rewards?.lootItemId) {
        const got = await this.grantLoot(client, player.name, rewards.lootItemId, rewards.lootQuantity);
        recordProduced(rewards.lootItemId, got, this.priceRegion());
      }

      // Gems: a rare premium drop from powerful foes (HUD-P4).
      if (npc.combat.rewardXp >= GEM_ELITE_MIN_XP && Math.random() < GEM_DROP_CHANCE) {
        this.playerGems.set(this.pidOf(player), (this.playerGems.get(this.pidOf(player)) ?? 0) + GEMS_PER_ELITE);
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
      goldReward: defeated ? killGold : undefined,
      xpReward: defeated ? killXp : undefined,
    });

    // Refresh the HUD so the stamina gauge reflects the swing's energy cost.
    this.sendProfile(client, player);
  }

  /** Equipment field name that holds a given wearable slot. */
  /** True when this item id sits in any equipment slot (incl. mount/pet). */
  private isItemEquipped(player: InstanceType<typeof PlayerSchema>, itemId: string): boolean {
    const eq = this.playerEquipment.get(this.pidOf(player));
    if (!eq) return false;
    return [
      eq.weaponId, eq.toolId, eq.helmetId, eq.chestId, eq.glovesId, eq.bootsId,
      eq.ring1Id, eq.ring2Id, eq.necklaceId, eq.capeId, eq.offhandId, eq.mountId, eq.petId,
    ].includes(itemId);
  }

  /**
   * Guard for paths that remove items from the bag: taking the LAST copy of an
   * equipped item would leave ghost equipment (the stats stay while the item is
   * sold/stocked/delivered/dismantled away). Extra copies may leave freely.
   */
  private wouldStripEquipped(
    player: InstanceType<typeof PlayerSchema>,
    inventory: InventoryEntry[],
    itemId: string,
    removeQty: number,
  ): boolean {
    return this.isItemEquipped(player, itemId) && getItemQuantity(inventory, itemId) - removeQty < 1;
  }

  private slotField(slot: EquipmentSlot): keyof PlayerEquipment & string {
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
    const equipment = normalizeEquipment(this.playerEquipment.get(this.pidOf(player)));
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
        // Gear breaks: remove it from the slot. The item leaves the world —
        // that's demand in the supply/demand economy.
        (equipment as unknown as Record<string, unknown>)[field] = null;
        delete durability[slot];
        broke = true;
        recordConsumed(itemId, 1, this.priceRegion());
        bumpMetric("gear.broken");
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
    this.playerEquipment.set(this.pidOf(player), equipment);

    if (broke) {
      player.weaponId = equipment.weaponId ?? "";
      player.toolId = equipment.toolId ?? "";
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

    const equipment = normalizeEquipment(this.playerEquipment.get(this.pidOf(player)));
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

    // Major repairs (≥30% of max restored) also need the piece's tier material
    // — the material demand keeps its price honest in the supply/demand economy.
    // Pieces whose material is missing from the bag are skipped, not blocked.
    let inventory = this.inventories.get(this.pidOf(player)) ?? [];
    const repaired: [EquipmentSlot, number][] = [];
    const materialsUsed = new Map<string, number>();
    const skipped: string[] = [];
    let cost = 0;
    for (const [slot, max] of full) {
      const itemId = equipment[this.slotField(slot)] as string | null;
      if (!itemId) continue;
      const current = durability[slot] ?? max;
      const restore = max - current;
      if (restore <= 0) continue;
      if (restore / max >= MAJOR_REPAIR_FRACTION) {
        const material = repairMaterialFor(itemId);
        if (material) {
          const used = materialsUsed.get(material) ?? 0;
          if (getItemQuantity(inventory, material) - used < 1) {
            skipped.push(`${getItemDefinition(itemId).name} (needs 1× ${getItemDefinition(material).name})`);
            continue;
          }
          materialsUsed.set(material, used + 1);
        }
      }
      // Gold per point scales with gear tier (repairCostPerPoint in shop.ts).
      cost += restore * repairCostPerPoint(itemId);
      repaired.push([slot, max]);
    }

    if (repaired.length === 0) {
      client.send("inventoryResult", {
        ok: false,
        error: skipped.length ? `Missing repair materials: ${skipped.join(", ")}.` : "Your gear is already in good repair.",
      });
      return;
    }

    // Blacksmith-company members repair cheaper (COMPANY_TYPE_PERKS).
    if (companyTypeOf(player.name) === "blacksmith") {
      cost *= COMPANY_TYPE_PERKS.blacksmith.repairCostMult ?? 1;
    }
    // Adaptive sink: fees breathe with 7-day mint pressure (±20%, on /stats).
    cost *= currentSinkMultiplier();
    cost = Math.max(5, Math.ceil(cost));
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < cost) {
      client.send("inventoryResult", { ok: false, error: `Repair costs ${cost}g — not enough gold.` });
      return;
    }

    this.playerGold.set(this.pidOf(player), gold - cost);
    burnGold(cost); // smith fee leaves the economy
    bumpMetric("repair.count", repaired.length);
    bumpMetric("repair.gold", cost);
    for (const [material, qty] of materialsUsed) {
      inventory = removeItemFromInventory(inventory, material, qty).inventory;
      recordConsumed(material, qty, this.priceRegion());
    }
    this.inventories.set(this.pidOf(player), inventory);
    for (const [slot, max] of repaired) durability[slot] = max;
    equipment.durability = durability;
    this.playerEquipment.set(this.pidOf(player), equipment);

    const matNote = [...materialsUsed].map(([id, q]) => `${q}× ${getItemDefinition(id).name}`).join(", ");
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Smith",
      body: `${player.name} repaired their gear for ${cost}g${matNote ? ` + ${matNote}` : ""}.`,
      sentAt: Date.now(),
    });
    if (skipped.length) {
      client.send("chat", this.systemChat("Smith", `Skipped: ${skipped.join(", ")}.`));
    }

    this.sendProfile(client, player);
    this.sendInventory(client, player.name);
    client.send("inventoryResult", {
      ok: true,
      inventory: buildInventoryPayload(this.inventories.get(this.pidOf(player)) ?? [], equipment.weaponId ?? null, this.bagCapOf(player.name)),
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
    const equipment = normalizeEquipment(this.playerEquipment.get(this.pidOf(player)));
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
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < cost) {
      client.send("enhanceResult", { ok: false, error: `Enhancing costs ${cost}g.` });
      return;
    }

    // Gold is consumed on the attempt whether it succeeds or fails.
    this.playerGold.set(this.pidOf(player), gold - cost);
    const success = Math.random() < enhanceSuccessRate(level);
    if (success) {
      equipment.enhance = { ...(equipment.enhance ?? {}), [slot]: level + 1 };
      this.playerEquipment.set(this.pidOf(player), equipment);
    }

    this.sendProfile(client, player);
    client.send("equipmentState", buildEquipmentState(this.playerEquipment.get(this.pidOf(player))));
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

    // Player Worlds carry their tier on the runtime config (owner-set); static
    // zones resolve from ZONE_CONFIGS. Prefer the config so both work.
    const tier: DangerTier = this.zoneConfig.dangerTier ?? getZoneDangerTier(this.zoneConfig.id);
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

    const attackerStats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(this.pidForName(attacker.name))));
    const victimStats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(this.pidForName(victim.name))));
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
      this.playerHp.set(this.pidForName(p.name), getPlayerMaxHp(p.level));
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

    const aStats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(this.pidForName(attacker.name))));
    const vStats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(this.pidForName(victim.name))));
    const hit = rollHit({
      attack: aStats.attack,
      critChance: aStats.critChance,
      critMult: aStats.critMult,
      targetArmor: vStats.armor,
    });
    const vHp = Math.max(0, (this.playerHp.get(this.pidForName(victim.name)) ?? getPlayerMaxHp(victim.level)) - hit.damage);
    this.playerHp.set(this.pidForName(victim.name), vHp);

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
        this.playerHp.set(this.pidForName(name), getPlayerMaxHp(player.level));
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
    const current = this.playerHp.get(this.pidForName(victim.name)) ?? maxHp;
    const next = Math.max(0, current - amount);
    this.playerHp.set(this.pidForName(victim.name), next);
    this.playerLastCombatAt.set(victim.name, Date.now());

    const knockedOut = next === 0;
    let arrested = false;
    if (knockedOut) {
      bumpMetric("pvp.kills", 1);
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
        this.playerHp.set(this.pidForName(victim.name), maxHp);
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
        this.pidForName(attacker.name),
        (this.playerPvpRating.get(this.pidForName(attacker.name)) ?? STARTING_PVP_RATING) + PVP_KILL_RATING,
      );
      this.playerPvpKills.set(this.pidForName(attacker.name), (this.playerPvpKills.get(this.pidForName(attacker.name)) ?? 0) + 1);
      this.bumpSeason(attacker.name, "pvpWin", 1);
      this.playerPvpRating.set(
        this.pidForName(victim.name),
        Math.max(0, (this.playerPvpRating.get(this.pidForName(victim.name)) ?? STARTING_PVP_RATING) - PVP_DEATH_RATING),
      );

      // Soft currencies: honor for the victor, plus guild coin if they're in a guild.
      this.playerHonor.set(this.pidForName(attacker.name), (this.playerHonor.get(this.pidForName(attacker.name)) ?? 0) + HONOR_PER_KILL);
      if (getGuildForMember(attacker.name)) {
        this.playerGuildCoin.set(
          this.pidForName(attacker.name),
          (this.playerGuildCoin.get(this.pidForName(attacker.name)) ?? 0) + GUILD_COIN_PER_KILL,
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
    // Caravan cargo drops with the body in PvP zones — whoever grabs the bag
    // inherits the freight run (interception gameplay).
    const cargoRunId = dropRunOnDeath(this.pidForName(victim.name));
    const inventory = this.inventories.get(this.pidForName(victim.name)) ?? [];
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
      const gold = this.playerGold.get(this.pidForName(victim.name)) ?? 0;
      goldDropped = Math.floor(gold / 2);
      if (goldDropped > 0) {
        this.playerGold.set(this.pidForName(victim.name), gold - goldDropped);
        // Dropped gold leaves circulation; pickup mints it back (net zero, and
        // expired bags are honestly burned rather than silently vanishing).
        burnGold(goldDropped);
        bumpMetric("sink.pvp_loot", goldDropped);
      }
    }

    if (dropped.length === 0 && goldDropped === 0 && !cargoRunId) return;
    this.inventories.set(this.pidForName(victim.name), kept);
    const victimClient = this.clientForName(victim.name);
    if (victimClient) this.sendInventory(victimClient, victim.name);

    const bag: LootBagState = {
      id: crypto.randomUUID(),
      x: victim.x,
      y: victim.y,
      items: dropped,
      gold: goldDropped,
      expiresAt: Date.now() + 120_000,
      ...(cargoRunId ? { cargoRunId } : {}),
    };
    this.lootBags.set(bag.id, bag);
    this.broadcastLootBags();
    if (cargoRunId) {
      this.broadcastChat(this.systemChat("Caravan", `${victim.name} dropped their cargo satchel — it's up for grabs!`));
    }
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

    let inventory = this.inventories.get(this.pidOf(player)) ?? [];
    const leftover: InventoryEntry[] = [];
    for (const entry of bag.items) {
      const { inventory: nextInv, added } = addItemToInventory(inventory, entry.itemId, entry.quantity, this.bagCapOf(player.name));
      inventory = nextInv;
      if (added < entry.quantity) leftover.push({ itemId: entry.itemId, quantity: entry.quantity - added });
    }
    this.inventories.set(this.pidOf(player), inventory);
    if (bag.gold > 0) this.grantGold(client, player, bag.gold, "loot bag");
    if (bag.cargoRunId) {
      const run = claimDroppedRun(bag.cargoRunId, this.pidOf(player));
      delete bag.cargoRunId;
      if (run) {
        this.broadcastChat(this.systemChat("Caravan", `${player.name} seized the cargo satchel — now hauling to ${run.toLabel}!`));
      } else {
        client.send("chat", this.systemChat("Caravan", "The satchel's seal is broken — you can't take this freight (already hauling?)."));
      }
    }

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
      hp: ZoneRoom.crystalHp,
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
    if (ZoneRoom.crystalHp <= 0) return;

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

    const stats = getEquipmentStats(normalizeEquipment(this.playerEquipment.get(this.pidOf(player))));
    const hit = rollHit({
      attack: stats.attack,
      critChance: stats.critChance,
      critMult: stats.critMult,
      targetArmor: KING_CRYSTAL_ARMOR,
    });
    ZoneRoom.crystalHp = Math.max(0, ZoneRoom.crystalHp - hit.damage);
    this.wearGear(client, player, ["weapon"]);

    if (ZoneRoom.crystalHp <= 0) {
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
        ZoneRoom.crystalHp = KING_CRYSTAL_MAX_HP;
        this.broadcastChat(this.systemChat("Castle Siege", "⚔️ The siege has begun — strike the King Crystal in the Obsidian Reach!"));
      } else {
        ZoneRoom.crystalHp = KING_CRYSTAL_MAX_HP;
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
    const have = this.playerGold.get(this.pidOf(player)) ?? 0;
    if (have < amount) {
      client.send("chat", this.systemChat("Bounty", "Not enough gold for that bounty."));
      return;
    }
    this.playerGold.set(this.pidOf(player), have - amount);
    // Placement leaves circulation now; the payout mints on claim (net zero).
    burnGold(amount);
    bumpMetric("sink.bounty", amount);
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
    bumpMetric("base.burned", Math.round(result.burned ?? BLACK_ZONE_BURN_AMOUNT));
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

    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
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

    this.playerGold.set(this.pidOf(player), gold - VIP_PASS_GOLD_COST);
    void creditTreasuryGold("vip_pass", VIP_PASS_GOLD_COST);
    bumpMetric("base.burned", Math.round(result.burned ?? VIP_PASS_BURN_AMOUNT));
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
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < VIP_PASS_GOLD_ONLY_COST) {
      client.send("vipPassResult", {
        ok: false,
        error: `A gold pass costs ${VIP_PASS_GOLD_ONLY_COST.toLocaleString()} gold.`,
      });
      return;
    }

    this.playerGold.set(this.pidOf(player), gold - VIP_PASS_GOLD_ONLY_COST);
    void creditTreasuryGold("vip_pass", VIP_PASS_GOLD_ONLY_COST);
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
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (!free && gold < ZONE_SLOT_COST) {
      return void client.send("zoneResult", {
        ok: false,
        error: `A World slot costs ${ZONE_SLOT_COST.toLocaleString()} gold.`,
      });
    }
    if (!free) {
      this.playerGold.set(this.pidOf(player), gold - ZONE_SLOT_COST);
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
      return void client.send("pipGoldResult", { ok: false, error: "Link a wallet first to buy gold from Rudi." });
    }
    if (!signature || signature.length < 32) {
      return void client.send("pipGoldResult", { ok: false, error: "Missing payment transaction." });
    }
    const treasury = getTreasuryWallet();
    if (!treasury) {
      return void client.send("pipGoldResult", { ok: false, error: "Rudi's gold desk is closed right now." });
    }
    if (await isPurchaseRedeemed(signature)) {
      return void client.send("pipGoldResult", { ok: false, signature, error: "That payment was already credited." });
    }
    const mint = process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;
    const minUiAmount = Math.max(1, Math.floor(requestedGold) || 1);

    // Verify the on-chain payment. A network hiccup or a not-yet-settled tx is
    // transient — flag it retryable so the client re-submits the SAME signature
    // rather than the player losing paid $BASE.
    let v;
    try {
      v = await verifyPeerTokenTransfer(signature, { fromWallet: wallet, toWallet: treasury, mint, minUiAmount }, 10);
    } catch (error) {
      console.warn("[pip] verify threw:", error);
      return void client.send("pipGoldResult", {
        ok: false,
        signature,
        retryable: true,
        error: "Couldn't reach the network to confirm your payment. Your $BASE is safe — it'll be credited automatically.",
      });
    }
    if (!v.ok || v.uiAmount === undefined || v.uiAmount <= 0) {
      return void client.send("pipGoldResult", {
        ok: false,
        signature,
        retryable: v.retryable === true,
        error: v.error ?? "Payment not found on-chain.",
      });
    }

    // Credit gold 1:1 with the verified on-chain amount (never the client claim),
    // atomically with recording the signature so a crash can't lose it and a
    // retry can't double-credit.
    const goldCredited = Math.floor(v.uiAmount);
    let res;
    try {
      res = await creditGoldForPurchase(signature, wallet, "pip_gold", v.uiAmount, player.name, goldCredited);
    } catch (error) {
      console.error("[pip] credit failed after verify:", error);
      return void client.send("pipGoldResult", {
        ok: false,
        signature,
        retryable: true,
        error: "Payment verified but crediting hit a snag. Your $BASE is safe — it'll be credited automatically.",
      });
    }
    if (!res.credited) {
      return void client.send("pipGoldResult", { ok: false, signature, error: "That payment was already credited." });
    }
    // Sync the live session to the authoritative DB balance (viaPending means the
    // character row wasn't saved yet, so it's applied on their next join).
    if (res.newGold != null) this.playerGold.set(this.pidOf(player), res.newGold);
    else if (!res.viaPending)
      this.playerGold.set(this.pidOf(player), (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + goldCredited);
    this.sendProfile(client, player);
    client.send("pipGoldResult", { ok: true, signature, gold: goldCredited, viaPending: res.viaPending });
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
  /** Change a player's display name. Identity stays the immutable wallet, so this
   *  persists the current session first (nothing in-flight is lost), cascades the
   *  rename across every name reference in the DB, then tells the client — which
   *  reconnects under the new name. Wallet-keyed single-session enforcement means
   *  the reconnect cleanly supersedes this session (no shared-state wipe). */
  private async handleRenameCharacter(client: Client, rawNewName: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet) {
      return void client.send("renameResult", { ok: false, error: "Connect your wallet to change your name." });
    }
    // Save current in-memory state (gold/inventory/skills gained this session)
    // under the wallet BEFORE renaming, so the reconnect reloads it intact.
    await this.persistPlayer(player);
    const result = await renameCharacter(wallet, rawNewName);
    if (!result.ok) {
      return void client.send("renameResult", { ok: false, error: result.error });
    }
    client.send("renameResult", { ok: true, newName: result.newName });
  }

  private async handleZoneBuildSave(client: Client, zoneId: string, rawBuild: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const zone = getPlayerZone(zoneId);
    if (!zone || zone.ownerName !== player.name) {
      return void client.send("zoneResult", { ok: false, error: "You don't own that World." });
    }
    const { build, error } = sanitizeBuild(rawBuild, zoneGridSize(zone.expandLevel));
    if (!build) return void client.send("zoneResult", { ok: false, error: error ?? "Invalid build." });
    // Visitors arrive at the spawn tile — refuse a build that traps them in a
    // building footprint or an unbridged river.
    if (isBuildTileBlocked(build, build.spawnTile.x, build.spawnTile.y)) {
      return void client.send("zoneResult", {
        ok: false,
        error: "The visitor spawn (📍) is on a blocked tile — move it somewhere walkable first.",
      });
    }

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
    let placed = 0;
    for (const id of new Set([...oldCounts.keys(), ...newCounts.keys()])) {
      const price = zoneAssetPrice(id);
      if (price <= 0) continue; // free assets never touch inventory/gold
      const delta = (newCounts.get(id) ?? 0) - (oldCounts.get(id) ?? 0);
      if (delta > 0) placed += delta;
      if (delta > 0 && !isAdmin) {
        const fromInv = Math.min(getAssetQty(player.name, id), delta);
        if (fromInv > 0) consume.set(id, fromInv);
        goldCost += (delta - fromInv) * price;
      } else if (delta < 0 && !isAdmin) {
        restore.set(id, -delta);
      }
    }
    if (!isAdmin && goldCost > 0) {
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      if (gold < goldCost) {
        return void client.send("zoneResult", {
          ok: false,
          error: `You need ${goldCost.toLocaleString()} gold to build this (you have ${gold.toLocaleString()}). Buy assets in the Build Shop first.`,
        });
      }
      this.playerGold.set(this.pidOf(player), gold - goldCost);
      await creditTreasuryGold("zone_build", goldCost);
      this.sendProfile(client, player);
      await this.persistPlayer(player);
    }
    if (!isAdmin) {
      for (const [id, n] of consume) adjustAsset(player.name, id, -n);
      for (const [id, n] of restore) adjustAsset(player.name, id, n);
      if (consume.size || restore.size) this.sendAssetInventory(client, player.name);
    }
    if (placed > 0) bumpMetric("asset.placed", placed);
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
          // Re-init combat state so dens placed this save are attackable at once.
          room.syncMobStateToConfig();
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
    patch: {
      displayName?: string;
      passPrice?: number;
      published?: boolean;
      gatherTax?: number;
      dangerTier?: DangerTier;
      guildOnly?: boolean;
    },
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const zone = getPlayerZone(zoneId);
    if (!zone || zone.ownerName !== player.name) {
      return void client.send("zoneResult", { ok: false, error: "You don't own that World." });
    }
    const tierChanged = patch.dangerTier !== undefined && patch.dangerTier !== zone.dangerTier;
    const accessChanged = typeof patch.guildOnly === "boolean" && patch.guildOnly !== zone.guildOnly;
    setZoneMeta(zoneId, {
      displayName: patch.displayName,
      passPrice: patch.passPrice,
      published: patch.published,
      gatherTax: patch.gatherTax,
      dangerTier: patch.dangerTier,
      guildOnly: patch.guildOnly,
    });
    // Access changes only gate NEW entries — visitors already inside are told,
    // not ejected (matches how pass expiry behaves).
    if (accessChanged) {
      for (const room of ZoneRoom.activeRooms) {
        if (room.zoneConfig.id === zoneId) {
          room.broadcast(
            "chat",
            room.systemChat(
              "Worlds",
              patch.guildOnly
                ? "🛡️ This World is now open to the owner's guild only."
                : "🌐 This World is now open to everyone.",
            ),
          );
        }
      }
    }
    // A tier change rewrites the PvP rules — push the fresh config to everyone
    // currently inside so their client (and this room's combat checks) update
    // without a rejoin.
    if (tierChanged) {
      const record = getPlayerZone(zoneId);
      if (record) {
        const label = DANGER_TIER_META[normalizePlayerZoneTier(record.dangerTier)].label;
        for (const room of ZoneRoom.activeRooms) {
          if (room.zoneConfig.id === zoneId) {
            const cfg = playerZoneToConfig(record);
            room.zoneConfig = cfg;
            room.syncMobStateToConfig();
            room.broadcast("playerZoneConfig", cfg);
            room.broadcast("chat", room.systemChat("Worlds", `⚔️ This World is now a ${label}.`));
          }
        }
      }
    }
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
    this.playerGold.set(this.pidOf(player), (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + amount);
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
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < zone.passPrice) {
      return void client.send("zoneResult", {
        ok: false,
        error: `A pass costs ${zone.passPrice.toLocaleString()} gold.`,
      });
    }
    this.playerGold.set(this.pidOf(player), gold - zone.passPrice);
    addZoneEarnings(zoneId, zone.passPrice);
    bumpMetric("pass.sold", 1);
    bumpMetric("pass.gold", zone.passPrice);
    grantZonePass(zoneId, player.name, Date.now() + ZONE_PASS_MS);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("zoneResult", { ok: true, zoneId, message: `Pass purchased — enjoy ${zone.displayName}!` });
  }

  // ---- Daily quests + login streak ----------------------------------------
  // Process-global so state follows the player across zone rooms; persisted to
  // daily_state so it survives restarts.
  private static dailyStates = new Map<string, DailyRow>();

  /** Reset progress/claims when the UTC day rolls over (streak is separate). */
  private static rollDailyDay(state: DailyRow): void {
    const today = dailyDayKey();
    if (state.day === today) return;
    state.day = today;
    state.progress = {};
    state.claimed = {};
    state.loginClaimed = false;
  }

  /** Load (or create) a player's daily state and apply the login-streak tick. */
  private async ensureDaily(playerName: string): Promise<DailyRow> {
    let state = ZoneRoom.dailyStates.get(playerName);
    if (!state) {
      state = (await loadDailyState(playerName)) ?? emptyDailyRow(dailyDayKey());
      ZoneRoom.dailyStates.set(playerName, state);
    }
    ZoneRoom.rollDailyDay(state);
    const today = dailyDayKey();
    if (state.lastLoginDay !== today) {
      const yesterday = dailyDayKey(Date.now() - 24 * 60 * 60 * 1000);
      state.streak = state.lastLoginDay === yesterday ? state.streak + 1 : 1;
      state.lastLoginDay = today;
      void saveDailyState(playerName, state);
    }
    return state;
  }

  private buildDailyPayload(state: DailyRow): DailyStatePayload {
    return {
      day: state.day,
      streak: Math.max(1, state.streak),
      loginClaimed: state.loginClaimed,
      loginGold: loginRewardGold(Math.max(1, state.streak)),
      tasks: dailyTasksFor(state.day).map((t) => ({
        ...t,
        progress: Math.min(t.target, state.progress[t.id] ?? 0),
        claimed: Boolean(state.claimed[t.id]),
      })),
    };
  }

  private clientFor(playerName: string): Client | undefined {
    const session = this.activePlayerSession.get(playerName);
    if (!session) return undefined;
    for (const c of this.clients) if (c.sessionId === session) return c;
    return undefined;
  }

  /** Tick a daily task counter (no-op unless that task is active today). */
  private bumpDaily(playerName: string, taskId: string, n = 1): void {
    // Season points accrue from the SAME activities, but unconditionally (not
    // gated on the daily task being active/unclaimed). One hook feeds both.
    this.bumpSeason(playerName, taskId as SeasonCategory, n);
    const state = ZoneRoom.dailyStates.get(playerName);
    if (!state) return;
    ZoneRoom.rollDailyDay(state);
    const task = dailyTasksFor(state.day).find((t) => t.id === taskId);
    if (!task || state.claimed[taskId]) return;
    const cur = state.progress[taskId] ?? 0;
    if (cur >= task.target) return;
    state.progress[taskId] = Math.min(task.target, cur + n);
    void saveDailyState(playerName, state);
    // Push fresh state so progress bars tick live while the panel is open.
    const client = this.clientFor(playerName);
    if (client) client.send("dailyState", this.buildDailyPayload(state));
  }

  private async handleDailyState(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const state = await this.ensureDaily(player.name);
    client.send("dailyState", this.buildDailyPayload(state));
  }

  private async handleDailyClaimTask(client: Client, taskId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const state = await this.ensureDaily(player.name);
    const task = dailyTasksFor(state.day).find((t) => t.id === taskId);
    if (!task) return void client.send("dailyResult", { ok: false, error: "That task isn't active today." });
    if (state.claimed[taskId]) return void client.send("dailyResult", { ok: false, error: "Already claimed." });
    if ((state.progress[taskId] ?? 0) < task.target) {
      return void client.send("dailyResult", { ok: false, error: "Not finished yet." });
    }
    state.claimed[taskId] = true;
    if (task.gold > 0) {
      mintGold(task.gold);
      bumpMetric("daily.gold", task.gold);
      this.playerGold.set(this.pidOf(player), (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + task.gold);
    }
    if (task.gems > 0) this.playerGems.set(this.pidOf(player), (this.playerGems.get(this.pidOf(player)) ?? 0) + task.gems);
    bumpMetric("daily.claimed", 1);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    void saveDailyState(player.name, state);
    client.send("dailyResult", {
      ok: true,
      message: `Claimed ${task.gold.toLocaleString()}g${task.gems > 0 ? ` + ${task.gems}💎` : ""}!`,
    });
    client.send("dailyState", this.buildDailyPayload(state));
  }

  private async handleDailyClaimLogin(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const state = await this.ensureDaily(player.name);
    if (state.loginClaimed) return void client.send("dailyResult", { ok: false, error: "Already claimed today." });
    const gold = loginRewardGold(Math.max(1, state.streak));
    state.loginClaimed = true;
    mintGold(gold);
    bumpMetric("daily.gold", gold);
    bumpMetric("daily.login", 1);
    this.playerGold.set(this.pidOf(player), (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + gold);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    void saveDailyState(player.name, state);
    client.send("dailyResult", { ok: true, message: `Day ${state.streak} login bonus: ${gold.toLocaleString()}g!` });
    client.send("dailyState", this.buildDailyPayload(state));
    // Daily login is also worth season points.
    this.bumpSeason(player.name, "login", 1);
  }

  // ── Season points ──────────────────────────────────────────────────────────
  // The DB is the single source of truth. Every award — activity points here,
  // referral + richest-daily bonuses in the invitations/leaderboard modules — is
  // an ATOMIC increment (awardSeasonPointsDb) that composes without clobbering.
  // No in-memory cache to go stale or lose updates, and no join-race: points
  // count from the very first action, and season rollover is handled in the
  // upsert (a stale-season row is reset on the next award).

  /** Award season points for an activity (atomic DB increment; unknown or
   * zero-value categories are ignored). */
  private bumpSeason(playerName: string, category: SeasonCategory, n = 1): void {
    const pts = SEASON_POINTS[category];
    if (!pts || n <= 0) return;
    void awardSeasonPointsDb(playerName, category, pts * n);
  }

  private async handleSeasonState(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const season = currentSeason();
    const row = (await loadSeasonState(player.name)) ?? emptySeasonRow(season.id);
    // A row left over from a previous season reads as zero for the new one.
    const points = row.seasonId === season.id ? row.points : 0;
    const breakdown = row.seasonId === season.id ? row.breakdown : {};
    const [agg, rank, rewardPool] = await Promise.all([
      loadSeasonAggregate(season.id, 25),
      loadSeasonRank(season.id, player.name),
      getSeasonRewardPool(),
    ]);
    const payload: SeasonStatePayload = {
      seasonId: season.id,
      seasonNumber: season.number,
      endsAt: season.endMs,
      rewardPool,
      points,
      breakdown,
      rank: points > 0 ? Math.max(1, rank) : 0,
      totalPlayers: agg.totalPlayers,
      estimatedReward: estimateReward(points, agg.totalPoints, rewardPool),
      leaderboard: agg.leaderboard,
    };
    client.send("seasonState", payload);
  }

  /** Inventory slots for a player (base 16, more with purchased bag levels). */
  private bagCapOf(playerName: string): number {
    return bagCapacity(this.playerBagLevel.get(this.pidForName(playerName)) ?? 0);
  }

  /**
   * Expand the player's bag by burning $BASE on-chain — 3 steps with rising
   * prices (BAG_EXPANSIONS). Verified + deduped exactly like a World expand.
   */
  private async handleBagExpand(client: Client, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const level = this.playerBagLevel.get(this.pidOf(player)) ?? 0;
    const step = nextBagExpansion(level);
    if (!step) {
      return void client.send("bagExpandResult", { ok: false, error: "Your bag is already at its maximum size." });
    }
    const wallet = this.playerWallets.get(client.sessionId) ?? null;

    if (!adService.isAdmin(wallet)) {
      if (!wallet) return void client.send("bagExpandResult", { ok: false, error: "Link a wallet first to burn $BASE." });
      if (!signature || signature.length < 32) {
        return void client.send("bagExpandResult", { ok: false, error: "Missing burn transaction." });
      }
      if (await isPurchaseRedeemed(signature)) {
        return void client.send("bagExpandResult", { ok: false, error: "That burn was already used." });
      }
      const result = await verifyTokenBurn(signature, {
        ownerWallet: wallet,
        mint: getBlackZoneBurnMint(),
        minUiAmount: step.burnCost,
      });
      if (!result.ok) {
        return void client.send("bagExpandResult", { ok: false, error: result.error ?? "Burn could not be verified." });
      }
      await recordTokenPurchase(signature, wallet, "bag_expand", step.burnCost);
      bumpMetric("base.burned", Math.round(result.burned ?? step.burnCost));
    }

    this.playerBagLevel.set(this.pidOf(player), level + 1);
    bumpMetric("bag.expanded", 1);
    await this.persistPlayer(player);
    this.sendInventory(client, player.name);
    client.send("bagExpandResult", { ok: true, capacity: step.slots, message: `Bag expanded to ${step.slots} slots!` });
  }

  /**
   * Expand a World's grid by burning $BASE on-chain. Three steps with rising
   * prices (ZONE_EXPANSIONS); the burn is verified like the Black Zone pass and
   * deduped by signature so a retry can never double-expand.
   */
  private async handleZoneExpand(client: Client, zoneId: string, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const zone = getPlayerZone(zoneId);
    if (!zone || zone.ownerName !== player.name) {
      return void client.send("zoneResult", { ok: false, error: "You don't own that World." });
    }
    const step = nextZoneExpansion(zone.expandLevel);
    if (!step) {
      return void client.send("zoneResult", { ok: false, error: "Your World is already at its maximum size." });
    }
    const wallet = this.playerWallets.get(client.sessionId) ?? null;

    // Admins expand free (testing); everyone else proves a $BASE burn.
    if (!adService.isAdmin(wallet)) {
      if (!wallet) return void client.send("zoneResult", { ok: false, error: "Link a wallet first to burn $BASE." });
      if (!signature || signature.length < 32) {
        return void client.send("zoneResult", { ok: false, error: "Missing burn transaction." });
      }
      if (await isPurchaseRedeemed(signature)) {
        return void client.send("zoneResult", { ok: false, error: "That burn was already used." });
      }
      const result = await verifyTokenBurn(signature, {
        ownerWallet: wallet,
        mint: getBlackZoneBurnMint(),
        minUiAmount: step.burnCost,
      });
      if (!result.ok) {
        return void client.send("zoneResult", { ok: false, error: result.error ?? "Burn could not be verified." });
      }
      await recordTokenPurchase(signature, wallet, "zone_expand", step.burnCost);
      bumpMetric("base.burned", Math.round(result.burned ?? step.burnCost));
    }

    const newLevel = expandZone(zoneId);
    bumpMetric("zone.expanded", 1);
    clearCollisionCache(zoneId);
    // Push the resized config to everyone currently inside so the ground,
    // borders, and collision all grow live.
    const record = getPlayerZone(zoneId);
    if (record) {
      for (const room of ZoneRoom.activeRooms) {
        if (room.zoneConfig.id === zoneId) {
          const cfg = playerZoneToConfig(record);
          room.zoneConfig = cfg;
          room.syncMobStateToConfig();
          room.broadcast("playerZoneConfig", cfg);
        }
      }
    }
    const size = zoneGridSize(newLevel);
    this.broadcastChat(
      this.systemChat("Worlds", `${player.name} expanded ${zone.displayName} to ${size}×${size} tiles!`),
    );
    client.send("zoneResult", { ok: true, zoneId, message: `World expanded to ${size}×${size}!` });
    this.sendMyWorlds(client, player.name);
  }

  /** Trade at a placed crop-market building: buy its seeds or sell its crop. */
  private async handleCropMarketTrade(client: Client, marketId: string, action: string, rawQty: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const market = getCropMarket(marketId);
    if (!market) return void client.send("cropMarketResult", { ok: false, error: "Unknown market." });
    // A matching market building must be placed in this zone, near the player.
    const near = (this.zoneConfig.scenery ?? []).some((s) => {
      if (s.prop !== market.propId) return false;
      const n = zonePropFootprint(s.prop);
      const pos = tileToWorld(s.tileX + (n - 1) / 2, s.tileY + (n - 1) / 2);
      return Math.hypot(player.x - pos.x, player.y - pos.y) <= NPC_INTERACT_RANGE + (n - 1) * 32 + 24;
    });
    if (!near) return void client.send("cropMarketResult", { ok: false, error: "Walk up to the market first." });

    const qty = Math.max(1, Math.min(99, Math.floor(rawQty) || 1));
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    const inventory = this.inventories.get(this.pidOf(player)) ?? [];

    if (action === "buySeed") {
      const { inventory: next, added } = addItemToInventory(inventory, market.seedItemId, qty, this.bagCapOf(player.name));
      if (added <= 0) return void client.send("cropMarketResult", { ok: false, error: "Inventory full." });
      const cost = effectiveBuyPrice(market.seedItemId, market.seedPrice, this.priceRegion()) * added;
      if (gold < cost) return void client.send("cropMarketResult", { ok: false, error: "Not enough gold." });
      this.playerGold.set(this.pidOf(player), gold - cost);
      burnGold(cost);
      bumpMetric("buy.count", added);
      bumpMetric("buy.gold", cost);
      recordConsumed(market.seedItemId, added, this.priceRegion()); // shop purchase = demand signal
      this.inventories.set(this.pidOf(player), next);
      this.sendProfile(client, player);
      this.sendInventory(client, player.name);
      await this.persistPlayer(player);
      return void client.send("cropMarketResult", {
        ok: true,
        market: marketId,
        message: `Bought ${added}× ${ITEMS[market.seedItemId]?.name ?? "seeds"} for ${cost.toLocaleString()}g.`,
        seedPrice: effectiveBuyPrice(market.seedItemId, market.seedPrice, this.priceRegion()),
        cropSellPrice: effectiveSellPrice(market.cropItemId, market.cropSellPrice, Date.now(), this.priceRegion()),
      });
    }

    if (action === "sellCrop") {
      const owned = getItemQuantity(inventory, market.cropItemId);
      const count = Math.min(qty, owned);
      if (count <= 0) {
        return void client.send("cropMarketResult", {
          ok: false,
          error: `You have no ${ITEMS[market.cropItemId]?.name ?? "crops"} to sell.`,
        });
      }
      const { inventory: next } = removeItemFromInventory(inventory, market.cropItemId, count);
      // Same dynamic pricing as Pip: supply/demand drift + dump saturation.
      const payout = effectiveSellPrice(market.cropItemId, market.cropSellPrice, Date.now(), this.priceRegion()) * count;
      recordSale(market.cropItemId, count, Date.now(), this.priceRegion());
      this.playerGold.set(this.pidOf(player), gold + payout);
      mintGold(payout);
      bumpMetric("sell.count", count);
      bumpMetric("sell.gold", payout);
      this.bumpDaily(player.name, "sell", count);
      this.inventories.set(this.pidOf(player), next);
      this.sendProfile(client, player);
      this.sendInventory(client, player.name);
      await this.persistPlayer(player);
      return void client.send("cropMarketResult", {
        ok: true,
        market: marketId,
        message: `Sold ${count}× ${ITEMS[market.cropItemId]?.name ?? "crops"} for ${payout.toLocaleString()}g.`,
        seedPrice: effectiveBuyPrice(market.seedItemId, market.seedPrice, this.priceRegion()),
        cropSellPrice: effectiveSellPrice(market.cropItemId, market.cropSellPrice, Date.now(), this.priceRegion()),
      });
    }
  }

  /** Players currently inside a given zone across all live rooms. */
  private static zoneOnlineCount(zoneId: string): number {
    let online = 0;
    for (const room of ZoneRoom.activeRooms) {
      if (room.zoneConfig.id !== zoneId) continue;
      for (const player of room.state.players.values()) {
        if (!player.spectator) online++;
      }
    }
    return online;
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
        createdAt: z.createdAt,
        online: ZoneRoom.zoneOnlineCount(z.zoneId),
        gatherTax: z.gatherTax,
        dangerTier: normalizePlayerZoneTier(z.dangerTier),
        guildOnly: Boolean(z.guildOnly),
        props: z.build.scenery.length + z.build.resources.length,
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
        dangerTier: normalizePlayerZoneTier(z.dangerTier),
        guildOnly: Boolean(z.guildOnly),
        passesSold: z.passesSold,
        passGold: z.passGold,
        taxGold: z.taxGold,
        lifetimeEarnings: z.lifetimeEarnings,
        online: ZoneRoom.zoneOnlineCount(z.zoneId),
        expandLevel: z.expandLevel,
        gridSize: zoneGridSize(z.expandLevel),
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
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      if (gold < total) {
        return void client.send("buildShopResult", {
          ok: false,
          error: `Need ${total.toLocaleString()} gold (you have ${gold.toLocaleString()}).`,
        });
      }
      this.playerGold.set(this.pidOf(player), gold - total);
      await creditTreasuryGold("build_shop", total);
      this.sendProfile(client, player);
      await this.persistPlayer(player);
    }
    adjustAsset(player.name, assetId, count);
    bumpMetric("asset.bought", count);
    if (!free) bumpMetric("asset.buyGold", total);
    this.sendAssetInventory(client, player.name);
    client.send("buildShopResult", { ok: true, assetId, qty: count });
  }

  private broadcastAssetMarket() {
    const payload = { listings: getAssetListings() };
    for (const room of ZoneRoom.activeRooms) room.broadcast("assetMarket", payload);
  }

  /** Credit gold to a player by name across any room; queue it if they're offline. */
  private creditPlayerByName(name: string, amount: number) {
    ZoneRoom.creditPlayerGlobal(name, amount);
  }

  /** Credit gold to a player by display name from ANY context (no room instance
   * needed) — scans all active rooms and pays the online session by pid, or
   * falls back to pending_gold when they're offline. Used by the company daily
   * payout runner (which lives outside any room). */
  public static creditPlayerGlobal(name: string, amount: number) {
    if (amount <= 0) return;
    for (const room of ZoneRoom.activeRooms) {
      const sessionId = room.activePlayerSession.get(name);
      const p = sessionId ? room.state.players.get(sessionId) : undefined;
      const client = sessionId ? room.clients.find((c) => c.sessionId === sessionId) : undefined;
      if (p && client) {
        // Gold is keyed by pid (wallet since the identity migration), NOT by
        // name — crediting the name key silently voided online payouts (job
        // rewards, market sales) because nothing ever read it back.
        const pid = room.pidOf(p);
        room.playerGold.set(pid, (room.playerGold.get(pid) ?? STARTING_GOLD) + amount);
        room.sendProfile(client, p);
        void room.persistPlayer(p);
        return;
      }
    }
    addPendingGold(name, amount); // offline — collected on next join
  }

  /** System-chat a line into every active room (town board posts, etc.). */
  public static announceGlobal(senderName: string, body: string) {
    const msg = {
      id: crypto.randomUUID(),
      channel: "system" as const,
      senderId: "system",
      senderName,
      body,
      sentAt: Date.now(),
    };
    for (const room of ZoneRoom.activeRooms) room.broadcastChat(msg);
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
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < listing.price) {
      return void client.send("zoneResult", { ok: false, error: `Need ${listing.price.toLocaleString()} gold.` });
    }
    this.playerGold.set(this.pidOf(player), gold - listing.price);
    completeBuy(player.name, id);
    bumpMetric("asset.sold", listing.qty);
    bumpMetric("asset.saleGold", listing.price);
    this.creditPlayerByName(listing.sellerName, listing.price);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    this.sendAssetInventory(client, player.name);
    this.broadcastAssetMarket();
    client.send("zoneResult", { ok: true, message: `Bought ${listing.qty}× for ${listing.price.toLocaleString()}g.` });
  }

  // ===== Player-to-player jobs (hire & be hired) =====

  private sendJobsState(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) client.send("jobsState", getJobsState(player.name));
  }

  /** Nudge every online client to refresh an open Jobs panel. */
  private broadcastJobsChanged() {
    for (const room of ZoneRoom.activeRooms) room.broadcast("jobsChanged", {});
  }

  private async handleJobPost(
    client: Client,
    kind: string,
    itemId: string | null,
    qty: number,
    rewardGold: number,
    deliverZoneId: string | null = null,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    // Haul destinations are limited to the three towns — they have boards,
    // and a destination in someone's locked World would be ungriefable bait.
    if (deliverZoneId && priceRegionOf(deliverZoneId) === null) {
      return void client.send("jobResult", { ok: false, error: "Delivery destination must be one of the three towns." });
    }
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < rewardGold) {
      return void client.send("jobResult", {
        ok: false,
        error: `Need ${rewardGold.toLocaleString()} gold to escrow the reward (you have ${gold.toLocaleString()}).`,
      });
    }
    const result = postJob(player.name, kind, itemId, qty, rewardGold, this.zoneConfig.id, deliverZoneId);
    if (!result.ok) return void client.send("jobResult", { ok: false, error: result.error });
    // Escrow the reward now; it's refunded on cancel, paid to the worker on completion.
    this.playerGold.set(this.pidOf(player), gold - rewardGold);
    bumpMetric("jobs.posted");
    bumpMetric("jobs.escrowGold", rewardGold);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    this.sendJobsState(client);
    this.broadcastJobsChanged();
    client.send("jobResult", { ok: true, message: "Job posted to the board!" });
  }

  private async handleJobCancel(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = cancelJob(player.name, id);
    if (!result.ok) return void client.send("jobResult", { ok: false, error: result.error });
    this.playerGold.set(this.pidOf(player), (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + result.refund);
    bumpMetric("jobs.cancelled");
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    this.sendJobsState(client);
    this.broadcastJobsChanged();
    client.send("jobResult", { ok: true, message: `Job cancelled — ${result.refund.toLocaleString()}g refunded.` });
  }

  private handleJobAccept(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = acceptJob(player.name, id);
    if (!result.ok) return void client.send("jobResult", { ok: false, error: result.error });
    this.sendJobsState(client);
    this.broadcastJobsChanged();
    client.send("jobResult", { ok: true, message: "Job accepted — get to work!" });
  }

  private handleJobAbandon(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = abandonJob(player.name, id);
    if (!result.ok) return void client.send("jobResult", { ok: false, error: result.error });
    this.sendJobsState(client);
    this.broadcastJobsChanged();
    client.send("jobResult", { ok: true, message: "Job abandoned — it's back on the board." });
  }

  /** Worker hands over supply items from their bag (partial deliveries OK). */
  private async handleJobDeliver(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const job = getJob(id);
    if (!job || job.status !== "taken" || job.workerName !== player.name || job.kind !== "supply" || !job.itemId) {
      return void client.send("jobResult", { ok: false, error: "Nothing to deliver for that job." });
    }
    if (job.deliverZoneId && job.deliverZoneId !== this.zoneConfig.id) {
      const label = TOWNS.find((t) => t.zoneId === job.deliverZoneId)?.label ?? job.deliverZoneId;
      return void client.send("jobResult", { ok: false, error: `This is a haul contract — deliver at ${label}.` });
    }
    const remaining = job.qty - job.progress;
    const current = this.inventories.get(this.pidOf(player)) ?? [];
    if (this.wouldStripEquipped(player, current, job.itemId, Math.min(remaining, getItemQuantity(current, job.itemId)))) {
      return void client.send("jobResult", { ok: false, error: "That's equipped — unequip it first." });
    }
    const { inventory, removed } = removeItemFromInventory(current, job.itemId, remaining);
    if (removed <= 0) {
      const itemName = getItemDefinition(job.itemId).name;
      return void client.send("jobResult", { ok: false, error: `You have no ${itemName} to deliver.` });
    }
    this.inventories.set(this.pidOf(player), inventory);
    this.sendInventory(client, player.name);
    const applied = applyDelivery(id, removed);
    if (!applied) return;
    if (applied.completed) {
      await this.completeJob(applied.job);
      client.send("jobResult", { ok: true, message: `Delivery complete! ${job.rewardGold.toLocaleString()}g earned.` });
    } else {
      client.send("jobResult", {
        ok: true,
        message: `Delivered ${removed} — ${applied.job.qty - applied.job.progress} to go.`,
      });
    }
    this.sendJobsState(client);
    this.broadcastJobsChanged();
    await this.persistPlayer(player);
  }

  /** Deliver items into a town order at its board. Caps + demand recording
   * live in fillTownOrder (economy/townDemand.ts); this handler verifies the
   * player is AT the town (travel is the point), owns the goods unequipped,
   * then removes items and pays via grantGold (guild/company skim applies). */
  private async handleTownOrderFill(client: Client, orderId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !orderId) return;
    const order = getTownOrders().find((o) => o.id === orderId);
    if (!order) {
      return void client.send("townOrderResult", { ok: false, error: "That order is gone — the board rotates." });
    }
    if (order.zoneId !== this.zoneConfig.id) {
      return void client.send("townOrderResult", {
        ok: false,
        error: `Deliver at ${order.townLabel}'s board — orders pay on location.`,
      });
    }
    const current = this.inventories.get(this.pidOf(player)) ?? [];
    const available = getItemQuantity(current, order.itemId);
    if (available <= 0) {
      return void client.send("townOrderResult", {
        ok: false,
        error: `You have no ${getItemDefinition(order.itemId).name} to deliver.`,
      });
    }
    if (this.wouldStripEquipped(player, current, order.itemId, available)) {
      return void client.send("townOrderResult", { ok: false, error: "That's equipped — unequip it first." });
    }
    const outcome = fillTownOrder(orderId, this.pidOf(player), available);
    if (!outcome.ok || outcome.delivered <= 0) {
      return void client.send("townOrderResult", { ok: false, error: outcome.error ?? "Could not fill the order." });
    }
    const { inventory } = removeItemFromInventory(current, order.itemId, outcome.delivered);
    this.inventories.set(this.pidOf(player), inventory);
    this.sendInventory(client, player.name);
    this.grantGold(client, player, outcome.goldPaid, `supplied ${order.townLabel}`);
    const itemName = getItemDefinition(order.itemId).name;
    if ((outcome.order?.remaining ?? 0) <= 0) {
      ZoneRoom.announceGlobal("Town Board", `📋 ${order.townLabel}'s ${itemName} order was filled by ${player.name}!`);
    }
    client.send("townOrderResult", {
      ok: true,
      orderId,
      delivered: outcome.delivered,
      goldPaid: outcome.goldPaid,
    });
    client.send("townOrders", {
      orders: getTownOrders(),
      playerDailyRemaining: playerOrderGoldRemaining(this.pidOf(player)),
    });
    await this.persistPlayer(player);
  }

  /** Employer picks up items a worker delivered on a finished supply job. */
  private async handleJobCollect(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const job = getJob(id);
    if (!job || job.employerName !== player.name || !job.itemId || job.itemsToCollect <= 0) {
      return void client.send("jobResult", { ok: false, error: "Nothing to collect." });
    }
    const added = await this.grantLoot(client, player.name, job.itemId, job.itemsToCollect);
    if (added <= 0) {
      return void client.send("jobResult", { ok: false, error: "Your bag is full — make room first." });
    }
    collectDelivered(player.name, id, added);
    this.sendJobsState(client);
    client.send("jobResult", { ok: true, message: `Collected ${added}× ${getItemDefinition(job.itemId).name}.` });
    await this.persistPlayer(player);
  }

  /** Pay the worker the escrowed reward and let the employer know by mail. */
  private async completeJob(job: JobView) {
    if (!job.workerName) return;
    this.creditPlayerByName(job.workerName, job.rewardGold);
    bumpMetric("jobs.completed");
    bumpMetric("jobs.goldPaid", job.rewardGold);
    this.bumpDaily(job.workerName, "jobs");
    const def = JOB_KINDS[job.kind];
    const desc = def.describe(job.qty, job.itemId ? getItemDefinition(job.itemId).name : undefined);
    await insertMail(
      "Job Board",
      job.employerName,
      `${def.emoji} Job completed by ${job.workerName}`,
      `Your job "${desc}" was completed by ${job.workerName}. ` +
        (job.kind === "supply"
          ? "Open the Jobs panel to collect your delivered items."
          : "The escrowed reward has been paid out."),
      0,
    );
    // Ring the employer's bell right away instead of on their next inbox open.
    void this.pushMailToRecipient(job.employerName, `📬 Job completed by ${job.workerName} — report in your mailbox.`);
    this.broadcastJobsChanged();
  }

  /** Activity-contract hook: mirrors bumpDaily at gather/harvest/mob sites. */
  private tickJobProgress(playerName: string, kind: "gather" | "harvest" | "mobs", n = 1) {
    const completed = bumpJobProgress(playerName, kind, n);
    if (completed) void this.completeJob(completed);
    // Company: stamp the member's activity (dividend eligibility) and advance any
    // accepted activity contract of the matching kind.
    tickCompanyActivity(playerName);
    bumpCompanyContractProgress(playerName, kind, n);
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
      this.questProgress.set(this.pidForName(playerName), progress);

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
      this.questProgress.set(this.pidForName(playerName), progress);

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
    this.questProgress.set(this.pidForName(playerName), progress);
    bumpMetric("quest.completed", 1);
    this.grantXp(client, player, quest.rewardXp, `completed ${quest.title}`);
    if (quest.rewardGold) {
      this.grantGold(client, player, quest.rewardGold, `completed ${quest.title}`);
    }

    if (quest.rewardItemId) {
      const got = await this.grantLoot(client, player.name, quest.rewardItemId, quest.rewardItemQuantity ?? 1);
      recordProduced(quest.rewardItemId, got, this.priceRegion());
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
      this.questProgress.set(this.pidForName(playerName), progress);

      if (result.completed) {
        progress = await this.finishQuest(client, playerName, questId, progress);
      }
    }

    this.sendQuestState(client, playerName);
  }

  private async checkCollectObjectives(client: Client, playerName: string) {
    let progress = this.getQuestProgress(playerName);
    const inventory = this.inventories.get(this.pidForName(playerName)) ?? [];

    for (const questId of [...progress.active]) {
      const quest = getQuestDefinition(questId);
      const objectiveIndex = progress.objectiveIndex[questId] ?? 0;
      const objective = quest.objectives[objectiveIndex];
      if (!objective || objective.type !== "collect_item") continue;
      if (!isCollectObjectiveMet(objective, inventory)) continue;

      const result = advanceQuestObjective(progress, questId);
      progress = result.progress;
      this.questProgress.set(this.pidForName(playerName), progress);

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
      this.playerHp.set(this.pidOf(player), maxHp);
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
      this.questProgress.get(this.pidForName(playerName)) ?? { active: [], objectiveIndex: {}, completed: [] }
    );
  }

  private async openShopForNpc(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    npc: ZoneConfig["npcs"][number],
  ) {
    // Resolve by the NPC's OWN shopId — several NPCs share pip_general (Pip,
    // Mara, Fen) but a ShopDefinition registers only one npcId, so the old
    // getShopByNpcId(npc.id) lookup silently failed for every merchant except
    // Pip (v0.153 regression: "can't interact with Mara/Fen").
    let shop: ReturnType<typeof getShopDefinition> | null = null;
    if (npc.shopId) {
      try {
        shop = getShopDefinition(npc.shopId);
      } catch {
        shop = null;
      }
    }
    if (!shop) return;

    const inventory = this.inventories.get(this.pidOf(player)) ?? [];
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
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
        dynamicSellPrices(shop.sellPrices, Date.now(), this.priceRegion()),
        dynamicBuyPrices(shop.buyOffers, this.priceRegion()),
      ),
    );
  }

  private sendProfile(client: Client, player: InstanceType<typeof PlayerSchema>) {
    const maxHp = getPlayerMaxHp(player.level);
    const equipment = this.playerEquipment.get(this.pidOf(player));
    const knockedOut = this.isKnockedOut(player.name);
    client.send("profile", {
      level: player.level,
      xp: player.xp,
      gold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
      hp: this.playerHp.get(this.pidOf(player)) ?? maxHp,
      maxHp,
      equippedWeaponId: equipment?.weaponId ?? null,
      equippedToolId: equipment?.toolId ?? null,
      stamina: this.playerStamina.get(this.pidOf(player)) ?? STARTING_STAMINA,
      maxStamina: MAX_STAMINA,
      knockedOut,
      freeRespawnAt: knockedOut ? (this.playerKnockedOutUntil.get(player.name) ?? null) : null,
      honor: this.playerHonor.get(this.pidOf(player)) ?? 0,
      guildCoin: this.playerGuildCoin.get(this.pidOf(player)) ?? 0,
      gems: this.playerGems.get(this.pidOf(player)) ?? 0,
    });
    // Keep the client's equipment + combat-stat panel in sync with every profile push.
    client.send("equipmentState", buildEquipmentState(this.playerEquipment.get(this.pidOf(player))));
  }

  /**
   * Spend stamina on an activity. Returns false (without spending) when the
   * player is too low — the caller should refuse the action and tell them to
   * eat. Successful spends push a fresh profile so the HUD gauge updates.
   */
  private spendStamina(client: Client, playerName: string, cost: number): boolean {
    const current = this.playerStamina.get(this.pidForName(playerName)) ?? STARTING_STAMINA;
    if (!hasStaminaFor(current, cost)) return false;
    this.playerStamina.set(this.pidForName(playerName), clampStamina(current - cost));
    return true;
  }

  private restoreStamina(playerName: string, amount: number): number {
    const current = this.playerStamina.get(this.pidForName(playerName)) ?? STARTING_STAMINA;
    const next = clampStamina(current + amount);
    this.playerStamina.set(this.pidForName(playerName), next);
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
    const hp = this.playerHp.get(this.pidForName(playerName));
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
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      if (gold < RESPAWN_GOLD_COST) {
        return { ok: false, error: `You need ${RESPAWN_GOLD_COST} gold to respawn now.` };
      }
      this.playerGold.set(this.pidOf(player), gold - RESPAWN_GOLD_COST);
    } else if (now < freeRespawnAt) {
      return { ok: false, error: "Free respawn is not ready yet." };
    }

    const maxHp = getPlayerMaxHp(player.level);
    const spawn = tileToWorld(this.zoneConfig.spawnTile.x, this.zoneConfig.spawnTile.y);
    player.x = spawn.x;
    player.y = spawn.y;
    this.playerHp.set(this.pidOf(player), maxHp);
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
      gold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
      hp: this.playerHp.get(this.pidOf(player)) ?? maxHp,
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
    const current = this.playerHp.get(this.pidOf(player)) ?? maxHp;
    const next = Math.max(0, current - amount);
    this.playerHp.set(this.pidOf(player), next);
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

  /** This room's price region (one of the three towns), or null = global
   * pricing (player Worlds, interiors, Black Zone). See priceRegionOf. */
  private priceRegion(): string | null {
    return priceRegionOf(this.zoneConfig.id);
  }

  private grantGold(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    amount: number,
    reason: string,
  ) {
    if (amount <= 0) return;

    // Track gold entering circulation for the economy dashboard.
    mintGold(amount);
    if (reason.startsWith("defeated")) bumpMetric("mob.gold", amount);
    else if (reason.startsWith("completed")) bumpMetric("quest.gold", amount);

    // Guild income tax + company revenue-share: slices of the earning are
    // skimmed straight into the guild bank / company treasury. Both cap at 10%,
    // so the player always keeps ≥ 80%. Pure transfers — the gold was already
    // minted above; nothing is minted twice.
    const tax = applyGuildTax(player.name, amount);
    const cut = applyCompanyCut(player.name, amount);
    const kept = amount - tax - cut;

    const next = (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + kept;
    this.playerGold.set(this.pidOf(player), next);
    this.sendProfile(client, player);

    const skimNote =
      tax > 0 && cut > 0
        ? ` (${reason}; ${tax} to guild bank, ${cut} to company)`
        : tax > 0
          ? ` (${reason}; ${tax} to guild bank)`
          : cut > 0
            ? ` (${reason}; ${cut} to company)`
            : ` (${reason})`;
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: `${player.name} earned ${kept} gold${skimNote}.`,
      sentAt: Date.now(),
    });

    // Keep guildmates' bank + company members' treasury displays fresh.
    if (tax > 0) this.broadcastGuildState(guildMemberNames(player.name));
    if (cut > 0) broadcastCompanyStateFn(companyMemberNames(player.name));
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
      playerGold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
      side,
      goldAmount,
      tokenPrice,
      currency,
    });

    this.playerGold.set(this.pidOf(player), playerGold);
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
      playerGold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
    });

    this.playerGold.set(this.pidOf(player), playerGold);
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
      buyerGold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
      orderId,
      signature,
    });

    this.playerGold.set(this.pidOf(player), buyerGold);
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
      sellerGold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
      orderId,
    });

    this.playerGold.set(this.pidOf(player), sellerGold);
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
      buyerGold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
      orderId,
      signature,
    });

    this.playerGold.set(this.pidOf(player), buyerGold);
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

    // Charge the current (supply/demand-adjusted) price — the same one the
    // shop catalog displayed.
    const price = effectiveBuyPrice(itemId, offer.price, this.priceRegion());
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < price) {
      client.send("shopResult", { ok: false, error: "Not enough gold." });
      return;
    }

    const current = this.inventories.get(this.pidOf(player)) ?? [];
    const { inventory, added } = addItemToInventory(current, itemId, 1, this.bagCapOf(player.name));
    if (added <= 0) {
      client.send("shopResult", { ok: false, error: "Inventory full." });
      return;
    }

    this.playerGold.set(this.pidOf(player), gold - price);
    burnGold(price);
    bumpMetric("buy.count", 1);
    bumpMetric("buy.gold", price);
    // A shop purchase is a DEMAND signal (players want more than they have),
    // so it pushes the price up — counting it as supply made popular items
    // get cheaper the more people bought them, which read backwards.
    recordConsumed(itemId, 1, this.priceRegion());
    this.inventories.set(this.pidOf(player), inventory);
    this.sendProfile(client, player);
    this.sendInventory(client, player.name);

    const item = getItemDefinition(itemId);
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Shop",
      body: `${player.name} bought ${item.name} for ${price} gold.`,
      sentAt: Date.now(),
    });

    client.send("shopResult", {
      ok: true,
      gold: this.playerGold.get(this.pidOf(player)),
      inventory: buildInventoryPayload(
        inventory,
        this.playerEquipment.get(this.pidOf(player))?.weaponId ?? null,
        this.bagCapOf(player.name),
      ),
    });
    await this.persistPlayer(player);
  }

  /** The one place NPC vendor proceeds are computed: apply the supply-adjusted
   * price, record the sale so the price softens (capping the sell faucet), mint
   * the gold, and book the sell metrics. Returns the payout. Shared by player
   * shop-sell and company warehouse-sell so both behave identically. */
  private vendorSellProceeds(itemId: string, basePrice: number, qty: number): number {
    // Quality variants price + saturate under their base id (value ignores
    // quality; a dump of Fine axes softens the axe market, not a shadow one).
    const marketId = baseItemIdOf(itemId);
    const unitPrice = effectiveSellPrice(marketId, basePrice, Date.now(), this.priceRegion());
    const payout = unitPrice * qty;
    recordSale(marketId, qty, Date.now(), this.priceRegion());
    mintGold(payout);
    bumpMetric("sell.count", qty);
    bumpMetric("sell.gold", payout);
    return payout;
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

    // Quality variants vendor at their BASE item's price (value ignores
    // quality); the variant itself is what leaves the bag. Saturation and the
    // S/D ledger key on the base id so variants share the base's market.
    const basePrice = shop.sellPrices[itemId] ?? shop.sellPrices[baseItemIdOf(itemId)];
    if (!basePrice) {
      client.send("shopResult", { ok: false, error: "Merchant won't buy that item." });
      return;
    }

    const sellQuantity = Math.max(1, Math.floor(quantity));
    const current = this.inventories.get(this.pidOf(player)) ?? [];
    if (this.wouldStripEquipped(player, current, itemId, sellQuantity)) {
      client.send("shopResult", { ok: false, error: "That's equipped — unequip it first." });
      return;
    }
    const { inventory, removed } = removeItemFromInventory(current, itemId, sellQuantity);
    if (removed <= 0) {
      client.send("shopResult", { ok: false, error: "You don't have that item." });
      return;
    }

    // Pay the current (supply-adjusted) price, then record the sale so the price
    // softens — this caps the gather→sell gold faucet.
    const payout = this.vendorSellProceeds(itemId, basePrice, removed);
    this.bumpDaily(player.name, "sell", removed);
    const gold = (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + payout;
    this.playerGold.set(this.pidOf(player), gold);
    this.inventories.set(this.pidOf(player), inventory);
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
      dynamicSellPrices(shop.sellPrices, Date.now(), this.priceRegion()),
    );
    client.send("shopResult", {
      ok: true,
      gold,
      inventory: buildInventoryPayload(
        inventory,
        this.playerEquipment.get(this.pidOf(player))?.weaponId ?? null,
        this.bagCapOf(player.name),
      ),
      buyOffers: updated.buyOffers,
      sellOffers: updated.sellOffers,
    });
    await this.checkCollectObjectives(client, player.name);
    await this.persistPlayer(player);
  }

  private sendInventory(client: Client, playerName: string) {
    const inventory = this.inventories.get(this.pidForName(playerName)) ?? [];
    const equipment = this.playerEquipment.get(this.pidForName(playerName));
    client.send("inventory", buildInventoryPayload(inventory, equipment?.weaponId ?? null, this.bagCapOf(playerName)));
  }

  private async grantLoot(
    client: Client,
    playerName: string,
    itemId: string,
    quantity: number,
  ): Promise<number> {
    const current = this.inventories.get(this.pidForName(playerName)) ?? [];
    const { inventory, added } = addItemToInventory(current, itemId, quantity, this.bagCapOf(playerName));
    // Never let loot vanish silently — a full bag used to eat the item while
    // the XP still flowed, which read as "gathered but got nothing".
    if (added < quantity) {
      const lost = quantity - Math.max(0, added);
      client.send(
        "chat",
        this.systemChat(
          "Loot",
          `🎒 Bag full — ${lost}× ${getItemDefinition(itemId).name} left behind! Free up space or expand your bag.`,
        ),
      );
    }
    if (added <= 0) return 0;

    this.inventories.set(this.pidForName(playerName), inventory);
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
    const inventory = this.inventories.get(this.pidForName(playerName)) ?? [];
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

    const current = this.inventories.get(this.pidOf(player)) ?? [];
    const { inventory, removed } = removeItemFromInventory(current, itemId, 1);
    if (removed <= 0) {
      client.send("inventoryResult", { ok: false, error: "You don't have that item." });
      return;
    }

    recordConsumed(itemId, 1, this.priceRegion());
    const healAmount = getConsumableHeal(itemId) || POTION_HEAL_AMOUNT;
    const maxHp = getPlayerMaxHp(player.level);
    const currentHp = this.playerHp.get(this.pidOf(player)) ?? maxHp;
    const healed = Math.min(healAmount, maxHp - currentHp);
    const nextHp = Math.min(maxHp, currentHp + healAmount);
    this.playerHp.set(this.pidOf(player), nextHp);
    // Eating food also restores energy (the hunger loop).
    const energyRestored = this.restoreStamina(player.name, getConsumableStamina(itemId));
    this.inventories.set(this.pidOf(player), inventory);
    this.sendProfile(client, player);
    this.sendInventory(client, player.name);

    // Everyone nearby sees the consumption (bubble over the player + the PvP
    // target frame's "recent items" row) — mid-fight potions are public info.
    this.broadcast("itemUsed", {
      playerName: player.name,
      itemId,
      healed,
      energyRestored,
    });

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
        this.playerEquipment.get(this.pidOf(player))?.weaponId ?? null,
        this.bagCapOf(player.name),
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

    const inventory = this.inventories.get(this.pidOf(player)) ?? [];
    const weaponId = this.playerEquipment.get(this.pidOf(player))?.weaponId ?? null;
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;

    // Verify the player has every ingredient before consuming anything.
    for (const input of recipe.inputs) {
      if (getItemQuantity(inventory, input.itemId) < input.quantity) {
        const def = ITEMS[input.itemId];
        client.send("craftResult", {
          ok: false,
          recipeId,
          gold,
          error: `Need ${input.quantity}x ${def?.name ?? input.itemId}.`,
          inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(player.name)),
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
        inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(player.name)),
      });
      return;
    }

    // Make sure there is room for the output (non-stackables need a free slot).
    const projected = addItemToInventory(inventory, recipe.output.itemId, recipe.output.quantity, this.bagCapOf(player.name));
    if (projected.added <= 0) {
      client.send("craftResult", {
        ok: false,
        recipeId,
        error: "Your bag is full.",
        inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(player.name)),
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

    let inventory = this.inventories.get(this.pidOf(player)) ?? [];
    const weaponId = this.playerEquipment.get(this.pidOf(player))?.weaponId ?? null;
    if (getItemQuantity(inventory, itemId) < 1) {
      client.send("craftResult", {
        ok: false,
        error: "You don't have that item.",
        inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(player.name)),
      });
      return;
    }
    if (this.wouldStripEquipped(player, inventory, itemId, 1)) {
      client.send("craftResult", { ok: false, error: "That's equipped — unequip it first." });
      return;
    }

    inventory = removeItemFromInventory(inventory, itemId, 1).inventory;
    recordConsumed(itemId, 1, this.priceRegion());
    const gained: string[] = [];
    for (const part of refund) {
      const result = addItemToInventory(inventory, part.itemId, part.quantity, this.bagCapOf(player.name));
      inventory = result.inventory;
      if (result.added > 0) {
        gained.push(`${result.added}x ${ITEMS[part.itemId]?.name ?? part.itemId}`);
        recordProduced(part.itemId, result.added, this.priceRegion());
      }
      if (result.added < part.quantity) {
        client.send(
          "chat",
          this.systemChat("Crafting", `🎒 Bag full — ${part.quantity - result.added}× ${ITEMS[part.itemId]?.name ?? part.itemId} was lost.`),
        );
      }
    }
    this.inventories.set(this.pidOf(player), inventory);
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

    client.send("craftResult", { ok: true, inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(player.name)) });
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

    // Soft-currency maps are pid-keyed (wallet), not name-keyed.
    const balances = this.softMap(offer.currency);
    const have = balances.get(this.pidOf(player)) ?? 0;
    if (have < offer.cost) {
      client.send("softShopResult", { ok: false, error: "You can't afford that yet." });
      return;
    }

    const inventory = this.inventories.get(this.pidOf(player)) ?? [];
    const projected = addItemToInventory(inventory, offer.itemId, offer.quantity, this.bagCapOf(player.name));
    if (projected.added <= 0) {
      client.send("softShopResult", { ok: false, error: "Your bag is full." });
      return;
    }

    balances.set(this.pidOf(player), have - offer.cost);
    recordConsumed(offer.itemId, projected.added, this.priceRegion()); // shop purchase = demand signal
    this.inventories.set(this.pidOf(player), projected.inventory);
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
    this.playerGold.set(this.pidOf(player), (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + gold);
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

  /** Admin-only: credit ad balance directly from the tokens already sitting in
   *  the admin (house) wallet. Normal brands deposit by transferring $BASE to
   *  the house wallet — the admin can't transfer to itself, so its held
   *  balance backs the credit instead (verified live on-chain, so the admin
   *  can't credit more than the wallet actually holds). */
  private async handleAdAdminCredit(client: Client, amount: number) {
    const wallet = this.playerWallets.get(client.sessionId);
    if (!wallet || !adService.isAdmin(wallet)) {
      return void client.send("adActionResult", { ok: false, error: "Not authorized." });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return void client.send("adActionResult", { ok: false, error: "Enter a positive $BASE amount." });
    }
    try {
      const held = await getWalletTokenBalance(wallet);
      if (held < amount) {
        return void client.send("adActionResult", {
          ok: false,
          error: `The admin wallet holds ${Math.floor(held).toLocaleString()} $BASE — can't credit ${Math.floor(amount).toLocaleString()}.`,
        });
      }
      // Unique synthetic signature keeps the idempotent deposit ledger honest
      // (each credit is its own auditable ledger row, kind "deposit").
      await adService.creditDeposit(wallet, amount, `admin-credit-${crypto.randomUUID()}`);
      client.send("adBrandDashboard", adService.getBrandDashboard(wallet));
      client.send("adActionResult", { ok: true });
    } catch (error) {
      console.warn("[ads] admin credit failed:", error);
      client.send("adActionResult", { ok: false, error: "Credit failed — check the server logs." });
    }
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

  // ---- Admin moderation: ban / unban / list --------------------------------

  private isAdminClient(client: Client): boolean {
    return adService.isAdmin(this.playerWallets.get(client.sessionId) ?? null);
  }

  private async sendAdminBanList(client: Client) {
    client.send("adminBanList", {
      ok: true,
      isAdmin: true,
      bans: (await listBans()).map((b) => ({
        wallet: b.wallet,
        name: b.name,
        reason: b.reason,
        bannedAt: b.bannedAt,
      })),
    });
  }

  private async handleAdminBanList(client: Client) {
    if (!this.isAdminClient(client)) {
      return void client.send("adminBanList", { ok: false, isAdmin: false, bans: [] });
    }
    await this.sendAdminBanList(client);
  }

  private async handleAdminBan(
    client: Client,
    m: { name?: string; reason?: string; deleteCharacter?: boolean },
  ) {
    const fail = (error: string) => void client.send("adminActionResult", { ok: false, error });
    if (!this.isAdminClient(client)) return fail("Not authorized.");
    const name = String(m.name ?? "").trim();
    if (!name) return fail("Player name is required.");
    try {
      const target = await loadCharacterByName(name);
      if (!target) return fail(`No character named "${name}".`);
      const wallet = target.walletAddress;
      if (!wallet) return fail(`"${target.name}" has no bonded wallet — nothing durable to ban.`);
      if (adService.isAdmin(wallet)) return fail("You can't ban an admin account.");
      const reason = String(m.reason ?? "").trim() || `Banned by admin ${new Date().toISOString().slice(0, 10)}`;
      await banWallet(wallet, target.name, reason);
      const kicked = kickPlayer(target.name);
      let deleted = 0;
      if (m.deleteCharacter) deleted = await deleteCharacterTraces(wallet, target.name);
      client.send("adminActionResult", {
        ok: true,
        message: `${target.name} banned${kicked ? " and kicked" : ""}${deleted ? ", character deleted" : ""}.`,
      });
      await this.sendAdminBanList(client);
    } catch (error) {
      console.warn("[admin] ban failed:", error);
      fail("Ban failed — check the server logs.");
    }
  }

  private async handleAdminUnban(client: Client, wallet: string) {
    const fail = (error: string) => void client.send("adminActionResult", { ok: false, error });
    if (!this.isAdminClient(client)) return fail("Not authorized.");
    if (!wallet) return fail("Wallet is required.");
    try {
      await unbanWallet(wallet);
      client.send("adminActionResult", { ok: true, message: "Unbanned — they can play again." });
      await this.sendAdminBanList(client);
    } catch (error) {
      console.warn("[admin] unban failed:", error);
      fail("Unban failed — check the server logs.");
    }
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
    const [messages, sent, unread] = await Promise.all([getInbox(name), getSentBox(name), countUnread(name)]);
    client.send("mailState", { messages, sent, unread });
  }

  /** Push a fresh inbox to a recipient in ANY zone (cross-room presence), so
   * the 🔔 rings when mail arrives — not on the next mail-panel open. */
  private async pushMailToRecipient(recipient: string, notice: string) {
    const [messages, sent, unread] = await Promise.all([
      getInbox(recipient),
      getSentBox(recipient),
      countUnread(recipient),
    ]);
    if (sendToPlayer(recipient, "mailState", { messages, sent, unread })) {
      sendToPlayer(recipient, "chat", this.systemChat("Mail", notice));
    }
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
    const balance = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (balance < cost) {
      return void client.send("mailResult", {
        ok: false,
        error: `You need ${cost} gold (${MAIL_SEND_COST} postage + ${gold} attached).`,
      });
    }

    this.playerGold.set(this.pidOf(player), balance - cost);
    await insertMail(player.name, recipient, cleanSubject, cleanBody, gold);
    this.sendProfile(client, player);
    client.send("mailResult", { ok: true });
    await this.persistPlayer(player);

    // Nudge the recipient if they're online — in any zone, not just this room.
    void this.pushMailToRecipient(recipient, `📬 New mail from ${player.name}.`);
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
      this.playerGold.set(this.pidOf(player), (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + gold);
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

  private buildCraftMasteryPayload(pid: string): CraftMasteryPayload {
    const mastery = this.craftMastery.get(pid) ?? emptyCraftMastery();
    const day = new Date().toISOString().slice(0, 10);
    const xpToday = mastery.day === day ? mastery.xpToday : 0;
    const levels: CraftMasteryPayload["levels"] = {};
    for (const family of CRAFT_FAMILIES) {
      const xp = mastery.xp[family] ?? 0;
      if (xp > 0 || mastery.specs.includes(family)) levels[family] = { level: masteryLevel(xp), xp };
    }
    return {
      specs: mastery.specs,
      levels,
      xpTodayRemaining: Math.max(0, MASTERY_DAILY_XP_CAP - xpToday),
      // Adaptive: what a respec costs RIGHT NOW (mint-pressure adjusted).
      respecCost: Math.round(CRAFT_RESPEC_COST * currentSinkMultiplier()),
      maxSpecs: MAX_CRAFT_SPECS,
    };
  }

  private async completeCraft(client: Client, playerName: string, recipeId: string) {
    this.craftingUntil.delete(playerName);

    const player = this.state.players.get(client.sessionId);
    if (!player || player.name !== playerName) return; // left or changed seat
    const recipe = getRecipe(recipeId);
    if (!recipe) return;

    let inventory = this.inventories.get(this.pidForName(playerName)) ?? [];
    const weaponId = this.playerEquipment.get(this.pidForName(playerName))?.weaponId ?? null;
    let gold = this.playerGold.get(this.pidForName(playerName)) ?? STARTING_GOLD;

    // Re-validate — materials/gold/space may have changed during the cast.
    for (const input of recipe.inputs) {
      if (getItemQuantity(inventory, input.itemId) < input.quantity) {
        const def = ITEMS[input.itemId];
        client.send("craftResult", {
          ok: false,
          recipeId,
          gold,
          error: `Need ${input.quantity}x ${def?.name ?? input.itemId}.`,
          inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(playerName)),
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
        inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(playerName)),
      });
      return;
    }
    if (addItemToInventory(inventory, recipe.output.itemId, recipe.output.quantity, this.bagCapOf(playerName)).added <= 0) {
      client.send("craftResult", {
        ok: false,
        recipeId,
        error: "Your bag is full.",
        inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(playerName)),
      });
      return;
    }

    // ---- Mastery + quality roll (craftQuality.ts) ----
    // Specialized families earn value-weighted, daily-capped mastery XP and
    // roll Fine/Master variants (gear) or bonus yield (goods). Non-spec
    // families always produce Standard — trade with a specialist instead.
    const pid = this.pidForName(playerName);
    const mastery = this.craftMastery.get(pid) ?? emptyCraftMastery();
    const family = craftFamilyOf(recipe.output.itemId);
    let outputItemId = recipe.output.itemId;
    let outputQty = recipe.output.quantity;
    let qualityNote = "";
    if (mastery.specs.includes(family)) {
      const day = new Date().toISOString().slice(0, 10);
      if (mastery.day !== day) {
        mastery.day = day;
        mastery.xpToday = 0;
      }
      const inputCost =
        recipe.inputs.reduce((sum, i) => sum + getItemBaseValue(i.itemId) * i.quantity, 0) + recipe.goldCost;
      const xpGain = Math.min(masteryXpForCraft(inputCost), Math.max(0, MASTERY_DAILY_XP_CAP - mastery.xpToday));
      if (xpGain > 0) {
        mastery.xp[family] = (mastery.xp[family] ?? 0) + xpGain;
        mastery.xpToday += xpGain;
      }
      const level = masteryLevel(mastery.xp[family] ?? 0);
      // Blacksmith-company members roll better quality (COMPANY_TYPE_PERKS).
      const rollMult =
        companyTypeOf(playerName) === "blacksmith"
          ? (COMPANY_TYPE_PERKS.blacksmith.qualityRollMult ?? 1)
          : 1;
      const roll = Math.random() / rollMult;
      if (isQualityEligible(recipe.output.itemId)) {
        if (roll < masterChance(level)) {
          outputItemId = qualityVariantId(recipe.output.itemId, "master");
          bumpMetric("craft.quality.master");
          qualityNote = " 🌟 MASTER quality!";
        } else if (roll < masterChance(level) + fineChance(level)) {
          outputItemId = qualityVariantId(recipe.output.itemId, "fine");
          bumpMetric("craft.quality.fine");
          qualityNote = " ✨ Fine quality!";
        }
      } else if (roll < bonusYieldChance(level)) {
        outputQty += 1;
        bumpMetric("craft.bonusYield");
        qualityNote = " ✨ Bonus yield!";
      }
      this.craftMastery.set(pid, mastery);
    }

    for (const input of recipe.inputs) {
      inventory = removeItemFromInventory(inventory, input.itemId, input.quantity).inventory;
      recordConsumed(input.itemId, input.quantity, this.priceRegion());
    }
    // The pre-check guaranteed the base quantity fits; a bonus-yield unit may
    // not — grant what actually fits and record only that.
    const addResult = addItemToInventory(inventory, outputItemId, outputQty, this.bagCapOf(playerName));
    inventory = addResult.inventory;
    const granted = addResult.added;
    recordProduced(outputItemId, granted, this.priceRegion());
    gold -= recipe.goldCost;
    this.playerGold.set(this.pidForName(playerName), gold);
    this.inventories.set(this.pidForName(playerName), inventory);
    bumpMetric("craft.count", granted);
    this.bumpDaily(playerName, "craft", granted);
    if (recipe.goldCost > 0) burnGold(recipe.goldCost); // forge fee sink
    this.sendInventory(client, playerName);
    this.sendProfile(client, player);

    const outputName = ITEMS[outputItemId]?.name ?? outputItemId;
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Crafting",
      body: `${playerName} crafted ${granted}x ${outputName}.${qualityNote}`,
      sentAt: Date.now(),
    });

    client.send("craftResult", {
      ok: true,
      recipeId,
      gold,
      inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(playerName)),
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

    const current = normalizeEquipment(this.playerEquipment.get(this.pidOf(player)));
    const inventory = this.inventories.get(this.pidOf(player)) ?? [];

    if (itemId === null) {
      // Unequip the named slot (default weapon for older clients).
      const field = this.equipFieldForSlot(slot ?? "weapon") ?? "weaponId";
      const next = normalizeEquipment(current);
      // Remember the damage on the departing item so re-equipping resumes it.
      stashSlotWear(next, (slot ?? "weapon") as EquipmentSlot);
      (next as unknown as Record<string, unknown>)[field] = null;
      const normalized = normalizeEquipment(next);
      this.playerEquipment.set(this.pidOf(player), normalized);
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
        inventory: buildInventoryPayload(inventory, normalized.weaponId, this.bagCapOf(player.name)),
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
      wearSlot = "tool";
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
      // Every gear slot needs the stash/restore bookkeeping: jewelry has no
      // durability but IS enhanceable, and skipping it here meant a re-equipped
      // ring/necklace lost its +N (stashed on unequip, never restored) while a
      // swapped-in one silently inherited the old slot's +N. Each helper
      // no-ops the part (wear / enhance) that doesn't apply to the slot.
      wearSlot = gearField as EquipmentSlot;
    }

    if (!field) {
      client.send("inventoryResult", { ok: false, error: "That item cannot be equipped." });
      return;
    }

    const next = normalizeEquipment(current);
    // Stash the outgoing item's damage, then resume any stashed damage on the
    // incoming one — swapping gear can't launder wear into a free repair.
    if (wearSlot) stashSlotWear(next, wearSlot);
    (next as unknown as Record<string, unknown>)[field] = itemId;
    if (wearSlot) restoreSlotWear(next, wearSlot, itemId);
    const normalized = normalizeEquipment(next);
    this.playerEquipment.set(this.pidOf(player), normalized);
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
      inventory: buildInventoryPayload(inventory, normalized.weaponId, this.bagCapOf(player.name)),
    });
    await this.persistPlayer(player);
  }

  private async handleChop(client: Client, resourceId: string, minigame = false) {
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

    if (!hasStaminaFor(this.playerStamina.get(this.pidOf(player)) ?? STARTING_STAMINA, STAMINA_COST_GATHER)) {
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

    // Bait money: every cast burns a little gold, win or lose (FISHING_CAST_GOLD).
    // Fishing-company members pay a reduced rate (COMPANY_TYPE_PERKS).
    const baitCost = Math.max(
      1,
      Math.round(
        FISHING_CAST_GOLD *
          (companyTypeOf(player.name) === "fishing" ? (COMPANY_TYPE_PERKS.fishing.baitCostMult ?? 1) : 1) *
          currentSinkMultiplier(),
      ),
    );
    if (gather.skill === "fishing" && baitCost > 0) {
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      if (gold < baitCost) {
        client.send("chopResult", {
          resourceId,
          available: true,
          depleted: false,
          skillXpGained: 0,
          woodcuttingLevel: skillLevel,
          skill: gather.skill,
          skillLevel,
          ok: false,
          error: `You need ${baitCost}g of bait to cast. Sell a catch or two to Rudi first.`,
        });
        return;
      }
      this.playerGold.set(this.pidOf(player), gold - baitCost);
      burnGold(baitCost);
      bumpMetric("fishing.bait.gold", baitCost);
      this.sendProfile(client, player);
    }

    // Working in the dark is slow — unless you carry a lamp.
    const darkPenalty = gatherDurationMultiplier(now, player.lampOn);
    if (darkPenalty > 1.01) this.notifyDark(client, player.name);

    const toolId = this.playerEquipment.get(this.pidOf(player))?.toolId ?? null;
    // Fishing (new clients) is a catch minigame: the client resolves success or
    // escape via fishingResolve; endsAt becomes a generous timeout that CANCELS
    // rather than auto-completes. Older clients omit the flag and keep the
    // classic timed gather.
    const isFishingMinigame = minigame && gather.skill === "fishing";
    const durationMs = isFishingMinigame
      ? 25_000
      : Math.round(gather.durationMs(skillLevel) * getToolSpeedMultiplier(toolId, gather.skill) * darkPenalty);
    const startedAt = now;
    const endsAt = now + durationMs;

    this.activeChopSessions.set(client.sessionId, {
      resourceId,
      playerName: player.name,
      startedAt,
      endsAt,
      durationMs,
      minigame: isFishingMinigame,
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
        if (session.minigame) this.cancelChopSession(sessionId, "escaped");
        else void this.completeChopSession(sessionId, session, resource, player, now);
      }
    }
  }

  /**
   * Fishing minigame outcome from the client. Success completes the gather
   * (loot/XP/tax exactly like a timed catch); failure lets the fish escape.
   * Server-side sanity: session must be ours, a fishing minigame, on the same
   * resource, and at least 2s old (no instant catches).
   */
  private async handleFishingResolve(client: Client, resourceId: string, success: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const session = this.activeChopSessions.get(client.sessionId);
    if (!session || !session.minigame || session.resourceId !== resourceId) return;
    const now = Date.now();
    if (success && now - session.startedAt < 2000) {
      // Too fast to be a real catch — treat as an escape.
      this.cancelChopSession(client.sessionId, "escaped");
      return;
    }
    if (!success) {
      this.cancelChopSession(client.sessionId, "escaped");
      return;
    }
    const resource = (this.zoneConfig.resources ?? []).find((entry) => entry.id === resourceId);
    if (!resource) {
      this.cancelChopSession(client.sessionId, "invalid");
      return;
    }
    await this.completeChopSession(client.sessionId, session, resource, player, now);
  }

  /**
   * Public profile card for a clicked name tag. Only surfaces what's already
   * visible in-game (level, guild, skills, PvP record) — never gold,
   * inventory, or location.
   */
  private async handlePlayerProfile(client: Client, name: string) {
    const fail = (error: string) =>
      client.send("playerProfileResult", { ok: false, error } satisfies PlayerProfilePayload);
    if (!name || name.length > 16) {
      fail("Player not found.");
      return;
    }
    const record = await loadCharacterByName(name);
    if (!record) {
      fail("Player not found.");
      return;
    }
    const guild = getGuildForMember(record.name);
    const skills = buildSkillStatePayload(normalizeSkills(record.skills));
    // Prefer live values for online players (level-ups since last persist).
    const live = [...this.state.players.values()].find((p) => p.name === record.name);
    client.send("playerProfileResult", {
      ok: true,
      name: record.name,
      online: isOnline(record.name),
      level: live?.level ?? record.level,
      guildName: guild?.name,
      guildTag: guild?.tag,
      appearance: defaultAppearanceForGender(record.appearance),
      skills: {
        woodcutting: skills.woodcutting.level,
        mining: skills.mining?.level ?? 1,
        fishing: skills.fishing?.level ?? 1,
        farming: skills.farming?.level ?? 1,
      },
      pvpRating: record.pvpRating,
      pvpKills: record.pvpKills,
      honor: record.honor,
    } satisfies PlayerProfilePayload);
  }

  private cancelChopSession(sessionId: string, reason: string) {
    const session = this.activeChopSessions.get(sessionId);
    if (!session) return;

    this.activeChopSessions.delete(sessionId);
    if (this.resourceChopper.get(session.resourceId) === sessionId) {
      this.resourceChopper.delete(session.resourceId);
    }

    // An escaped fish still cost the cast: the energy is spent either way
    // (movement/zone cancels stay free — only a played-out escape drains).
    if (reason === "escaped") {
      const player = this.state.players.get(sessionId);
      if (player) {
        this.playerStamina.set(
          this.pidOf(player),
          clampStamina((this.playerStamina.get(this.pidOf(player)) ?? STARTING_STAMINA) - STAMINA_COST_GATHER),
        );
        const client = this.clients.find((entry) => entry.sessionId === sessionId);
        if (client) this.sendProfile(client, player);
      }
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
      this.pidOf(player),
      clampStamina((this.playerStamina.get(this.pidOf(player)) ?? STARTING_STAMINA) - STAMINA_COST_GATHER),
    );

    // Steel-tier tools roll for a bonus drop on top of the node's base yield.
    const equipment = this.playerEquipment.get(this.pidOf(player));
    const toolId = equipment?.toolId;
    // Accessory/tool perks (master rods, lures, angler gear): extra XP, extra
    // rare-drop chance, and an extra yield roll.
    const perks = getGatherPerks(equipment, gather.skill);
    // Mining-company members roll extra bonus-ore chance (COMPANY_TYPE_PERKS),
    // and a Vein Discovery event adds more in its zone.
    const companyOreBonus =
      gather.skill === "mining" && companyTypeOf(player.name) === "mining"
        ? (COMPANY_TYPE_PERKS.mining.oreYieldBonus ?? 0)
        : 0;
    const eventOreBonus = gather.skill === "mining" ? oreBonusChanceNow(this.zoneConfig.id) : 0;
    const toolBonus =
      Math.random() < getToolYieldBonus(toolId, gather.skill) + perks.yieldBonus + companyOreBonus + eventOreBonus
        ? 1
        : 0;
    // The fish bite in the rain — and a Fish Run event boosts its zone too.
    const rainBonus =
      gather.skill === "fishing" &&
      Math.random() < rainFishingBonus(now) + fishBonusChanceNow(this.zoneConfig.id)
        ? 1
        : 0;
    const bonusYield = toolBonus + rainBonus;
    const lootQuantity = gather.lootQuantity + bonusYield;

    // Luck-based rare drop (amber/gemstone/pearl), independent of the yield roll.
    const rareItemId = rollRareGatherDrop(gather.skill, gather.nodeLevel, perks.rareBonus);

    // Fishing: roll WHICH species this catch was. Common rolls keep the node's
    // base loot (River Fish / Salmon), rarer rolls upgrade the whole catch.
    let lootItemId = gather.lootItemId;
    // Mixed-yield nodes (crop-field) roll one item from their pool per gather.
    if (gather.lootPool?.length) {
      lootItemId = gather.lootPool[Math.floor(Math.random() * gather.lootPool.length)];
    }
    let caughtSpecies: FishSpecies | null = null;
    if (gather.skill === "fishing") {
      const waters = fishWatersForLoot(gather.lootItemId);
      if (waters) {
        const luck = perks.rareBonus + getWeather(now).rain * 0.1;
        caughtSpecies = rollFishSpecies(waters, luck);
        lootItemId = caughtSpecies.itemId;
      }
    }

    const client = this.clients.find((entry) => entry.sessionId === sessionId);
    let haulValue = 0; // Pip value of what was actually banked (drives gather tax)
    let bankedQty = 0; // what actually fit in the bag (drives the catch celebration)
    if (client) {
      // Each completed gather wears the equipped tool by one point.
      this.wearGear(client, player, ["tool"]);
      const grantedQty = await this.grantLoot(client, player.name, lootItemId, lootQuantity);
      bankedQty = grantedQty;
      haulValue += getItemBaseValue(lootItemId) * grantedQty;
      recordProduced(lootItemId, grantedQty, this.priceRegion());
      if (rareItemId && (await this.grantLoot(client, player.name, rareItemId, 1)) > 0) {
        haulValue += getItemBaseValue(rareItemId);
        recordProduced(rareItemId, 1, this.priceRegion());
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
    // PERCENT of the haul's value (what they actually banked, at Pip prices) —
    // charged up to what they carry, never below zero.
    if (client && this.playerZone && this.playerZone.ownerName !== player.name) {
      const taxPct = getZoneGatherTax(this.playerZone.zoneId);
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      const tax = Math.min(gatherTaxGold(taxPct, haulValue), gold);
      if (tax > 0) {
        this.playerGold.set(this.pidOf(player), gold - tax);
        addZoneTax(this.playerZone.zoneId, tax);
        bumpMetric("gathertax.gold", tax);
      }
    }

    bumpMetric("gather.count", lootQuantity);
    bumpMetric(`gather.${gather.skill}`, lootQuantity);
    // Catch-by-rarity counters for the /stats fishing chart.
    if (caughtSpecies) bumpMetric(`fish.${caughtSpecies.rarity}`, lootQuantity);
    this.bumpDaily(player.name, "gather", lootQuantity);
    this.tickJobProgress(player.name, "gather", lootQuantity);

    const skillXpGained = Math.round(gather.skillXp * (1 + perks.xpBonus));
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

    // Rare+ catches get a zone-wide shout; every catch names the species.
    if (caughtSpecies && caughtSpecies.rarity !== "common") {
      const shout: Record<string, string> = {
        uncommon: "🎣",
        rare: "✨ RARE!",
        epic: "🌟 EPIC!",
        legendary: "🏆 LEGENDARY!",
      };
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: gather.label,
        body: `${shout[caughtSpecies.rarity]} ${player.name} reeled in a ${caughtSpecies.name}! (+${skillXpGained} ${gather.label} XP)`,
        sentAt: now,
      });
    } else {
      this.broadcastChat({
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: gather.label,
        body: `${player.name} ${gather.verb} ${caughtSpecies ? caughtSpecies.name : resource.name} (+${skillXpGained} ${gather.label} XP)${bonusYield > 0 ? " — bonus haul!" : ""}.`,
        sentAt: now,
      });
    }

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
      // Real banked item for the drop-collect FX (crop fields carry the rolled
      // seed here — the client shows its art, not a generic log).
      ...(bankedQty > 0 ? { lootItemId, lootQuantity: bankedQty } : {}),
      ...(caughtSpecies && bankedQty > 0
        ? {
            caughtItemId: caughtSpecies.itemId,
            caughtRarity: caughtSpecies.rarity,
            // Celebrate what actually fit in the bag, not the attempted haul.
            caughtQuantity: bankedQty,
          }
        : {}),
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
        lootPool: undefined as string[] | undefined,
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
        lootPool: undefined as string[] | undefined,
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
    // Crop patches carry a skill override — harvesting them trains Farming.
    const wSkill = (w.skill ?? "woodcutting") as GatherSkill;
    return {
      skill: wSkill,
      label: wSkill === "farming" ? "Farming" : "Woodcutting",
      verb: wSkill === "farming" ? "harvested" : "felled",
      requiredLevel: w.requiredLevel ?? 1,
      nodeLevel: w.treeLevel,
      skillXp: w.skillXp,
      respawnMs: w.respawnMs,
      lootItemId: w.lootItemId,
      lootQuantity: w.lootQuantity,
      lootPool: w.lootPool,
      durationMs: (lvl: number) => computeChopDurationMs(w.treeLevel, lvl),
    };
  }

  /** The stable per-account key for all in-memory player state: the verified
   *  WALLET, falling back to the display name only for walletless local/dev
   *  sessions (token gate off). Anchoring the maps to the immutable wallet means
   *  a rename can never orphan a player's in-memory state. */
  private pidOf(player: InstanceType<typeof PlayerSchema>): string {
    return this.playerWallets.get(player.sessionId) ?? player.name;
  }

  /** Resolve an ONLINE player's display name to their stable pid (wallet). Used
   *  by features that address another player by name (duels, bounties, PvP). For
   *  a name not currently in this room it returns the name unchanged (offline
   *  addressing is handled per-feature against the DB). */
  private pidForName(name: string): string {
    return this.nameToPid.get(name) ?? name;
  }

  private skillLevelFor(playerName: string, skill: GatherSkill): number {
    const skills = this.playerSkills.get(this.pidForName(playerName)) ?? normalizeSkills();
    // All gather skills share the same XP curve.
    return woodcuttingLevelFromXp(skills[skill]);
  }

  private grantWoodcuttingXp(playerName: string, amount: number) {
    return this.grantSkillXp(playerName, "woodcutting", amount);
  }

  private grantSkillXp(playerName: string, skill: GatherSkill, amount: number) {
    const skills = this.playerSkills.get(this.pidForName(playerName)) ?? normalizeSkills();
    const previousLevel = woodcuttingLevelFromXp(skills[skill]);
    const updated = { ...skills, [skill]: skills[skill] + amount };
    this.playerSkills.set(this.pidForName(playerName), updated);
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

    const off = farmPlotCenterOffset(plot);
    const plotPos = tileToWorld(plot.tileX + off, plot.tileY + off);
    if (Math.hypot(player.x - plotPos.x, player.y - plotPos.y) > FARM_RANGE) {
      client.send("farmResult", { ok: false, plotId, error: "Move closer to the plot." });
      return;
    }

    const weaponId = this.playerEquipment.get(this.pidOf(player))?.weaponId ?? null;
    const active = getFarmPlot(plotId);
    const now = Date.now();

    if (!active) {
      // Plant whichever seed the player owns (crop-table order: wheat first,
      // then carrot); fall back to the default seed for the error message.
      let inventory = this.inventories.get(this.pidOf(player)) ?? [];
      const ownedSeed = Object.keys(FARM_CROPS).find((seedId) => getItemQuantity(inventory, seedId) >= 1);
      const crop = getFarmCropBySeed(ownedSeed ?? DEFAULT_FARM_SEED);
      if (!crop) return;
      if (!ownedSeed) {
        client.send("farmResult", {
          ok: false,
          plotId,
          action: "plant",
          error: `You need a ${ITEMS[crop.seedItemId]?.name ?? "seed"} (buy from Rudi or a crop market).`,
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
      recordConsumed(crop.seedItemId, 1, this.priceRegion());
      this.inventories.set(this.pidOf(player), inventory);
      this.sendInventory(client, player.name);
      this.sendProfile(client, player);
      // A better hoe makes the planted crop mature sooner (locked in at plant).
      let growMult = getFarmGrowthMultiplier(this.playerEquipment.get(this.pidOf(player))?.toolId);
      // Farming-company members plant faster-growing crops (COMPANY_TYPE_PERKS).
      if (companyTypeOf(player.name) === "farming") {
        growMult *= COMPANY_TYPE_PERKS.farming.cropGrowthMult ?? 1;
      }
      // Rain waters the seedbed (scaled by intensity), and a Growth Spurt
      // event speeds everything planted while it lasts.
      growMult *= 1 - (1 - RAIN_CROP_GROWTH_MULT) * getWeather(now).rain;
      growMult *= cropGrowthMultNow();
      plantFarmPlot({
        plotId,
        zoneId: this.zoneConfig.id,
        cropId: crop.cropItemId,
        seedId: crop.seedItemId,
        plantedAt: now,
        readyAt: now + Math.round(crop.growMs * growMult),
        planterName: player.name,
      });
      this.broadcastFarmState();
      client.send("farmResult", {
        ok: true,
        plotId,
        action: "plant",
        inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(player.name)),
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
    // Farming gear pays off at the plot too: hoe/hat can add a bonus crop,
    // and hat/ring boost the harvest XP.
    const farmEq = this.playerEquipment.get(this.pidOf(player));
    const farmPerks = getGatherPerks(farmEq, "farming");
    const bonusCrop =
      Math.random() < getToolYieldBonus(farmEq?.toolId, "farming") + farmPerks.yieldBonus ? 1 : 0;
    // Economic events (blight) scale harvests — never below a single crop.
    const yieldQty = Math.max(1, Math.floor(((crop?.yield ?? 1) + bonusCrop) * cropYieldMultNow()));
    bumpMetric("farm.harvest", yieldQty);
    this.bumpDaily(player.name, "harvest", yieldQty);
    this.tickJobProgress(player.name, "harvest", yieldQty);
    const grantedCrop = await this.grantLoot(client, player.name, active.cropId, yieldQty);
    recordProduced(active.cropId, grantedCrop, this.priceRegion());
    // Visitor gather tax: harvesting in someone else's World pays the owner a
    // percent of the crop's value, same rule as chopping/mining/fishing there.
    if (this.playerZone && this.playerZone.ownerName !== player.name) {
      const taxPct = getZoneGatherTax(this.playerZone.zoneId);
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      const tax = Math.min(gatherTaxGold(taxPct, getItemBaseValue(active.cropId) * grantedCrop), gold);
      if (tax > 0) {
        this.playerGold.set(this.pidOf(player), gold - tax);
        addZoneTax(this.playerZone.zoneId, tax);
        bumpMetric("gathertax.gold", tax);
        this.sendProfile(client, player);
      }
    }
    const skillXp = Math.round((crop?.skillXp ?? 10) * (1 + farmPerks.xpBonus));
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

    const inventory = this.inventories.get(this.pidOf(player)) ?? [];
    client.send("farmResult", {
      ok: true,
      plotId,
      action: "harvest",
      skillXpGained: skillXp,
      farmingLevel: newLevel,
      inventory: buildInventoryPayload(inventory, weaponId, this.bagCapOf(player.name)),
      playerName: player.name,
      cropId: active.cropId,
      cropQuantity: grantedCrop,
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
    const inv = this.inventories.get(this.pidOf(player)) ?? [];
    if (getItemQuantity(inv, itemId) < quantity) {
      client.send("playerShopResult", { ok: false, plotId, error: "You don't have that many." });
      return;
    }
    if (this.wouldStripEquipped(player, inv, itemId, quantity)) {
      client.send("playerShopResult", { ok: false, plotId, error: "That's equipped — unequip it first." });
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
    this.inventories.set(this.pidOf(player), inventory);
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
    const inv = this.inventories.get(this.pidOf(player)) ?? [];
    const { inventory, added } = addItemToInventory(inv, itemId, listing.quantity, this.bagCapOf(player.name));
    if (added <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "Make inventory space first." });
      return;
    }
    this.inventories.set(this.pidOf(player), inventory);
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
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    const affordable = Math.min(wantQty, Math.floor(gold / listing.price));
    if (affordable <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "Not enough gold." });
      return;
    }
    const inv = this.inventories.get(this.pidOf(player)) ?? [];
    const { inventory, added } = addItemToInventory(inv, itemId, affordable, this.bagCapOf(player.name));
    if (added <= 0) {
      client.send("playerShopResult", { ok: false, plotId, error: "Your inventory is full." });
      return;
    }
    const cost = added * listing.price;
    const nextGold = gold - cost;
    this.inventories.set(this.pidOf(player), inventory);
    this.playerGold.set(this.pidOf(player), nextGold);
    // A player-shop purchase is a demand signal like an NPC-shop buy, but
    // weighted by the gold actually paid vs the item's base value — otherwise
    // near-free self-listings bought back by an alt could pump an item's price
    // multiplier for nothing. Paying full value credits full demand.
    const baseValue = getItemBaseValue(itemId);
    if (baseValue > 0) {
      recordConsumed(itemId, Math.min(added, Math.floor(cost / baseValue)), this.priceRegion());
    }
    bumpMetric("pshop.sold", added);
    bumpMetric("pshop.saleGold", cost);
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
    const nextGold = (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + shop.earnings;
    this.playerGold.set(this.pidOf(player), nextGold);
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

    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
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
    this.playerGold.set(this.pidOf(player), nextGold);
    void creditTreasuryGold("plot", PLOT_PRICE);
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

    const inventory = this.inventories.get(this.pidOf(player)) ?? [];
    const { inventory: nextInv, removed } = removeItemFromInventory(inventory, LIGHT_OIL_ITEM, 1);
    if (removed <= 0) {
      client.send("housingResult", {
        ok: false,
        plotId,
        error: "You need Lamp Oil — craft it at the workbench (2 River Fish + 1 Wood).",
      });
      return;
    }

    recordConsumed(LIGHT_OIL_ITEM, 1, this.priceRegion());
    this.inventories.set(this.pidOf(player), nextInv);
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
    this.playerStamina.set(this.pidOf(player), MAX_STAMINA);
    this.playerHp.set(this.pidOf(player), getPlayerMaxHp(player.level));
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

  // ===== P2P housing resale market =====

  /** Nudge every online client to refresh an open Housing Market panel. */
  private broadcastHousingMarketChanged() {
    for (const room of ZoneRoom.activeRooms) room.broadcast("housingMarketChanged", {});
  }

  /** Re-broadcast a specific zone's housing state to any room hosting it — used
   *  after a cross-zone ownership transfer so the plot re-renders for everyone
   *  standing in the zone where the house physically sits. */
  private static broadcastHousingForZone(zoneId: string) {
    for (const room of ZoneRoom.activeRooms) {
      if (room.zoneConfig.id === zoneId) room.broadcastHousingState();
    }
  }

  /** Owner lists (or, with both prices null, withdraws) their plot for resale. */
  private handleHousingListSale(client: Client, plotId: string, saleGoldRaw: unknown, saleBaseRaw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId) return;
    const owner = getPlotOwner(plotId);
    if (!owner || owner.ownerName !== player.name) {
      client.send("housingResult", { ok: false, plotId, error: "You can only sell your own property." });
      return;
    }
    const saleGold = sanitizeSalePrice(saleGoldRaw, "gold");
    const saleBase = sanitizeSalePrice(saleBaseRaw, "base");
    if (saleBase !== null && !owner.ownerWallet) {
      client.send("housingResult", { ok: false, plotId, error: "Link a wallet before pricing in $BASE." });
      return;
    }
    setPlotSale(plotId, saleGold, saleBase);
    ZoneRoom.broadcastHousingForZone(owner.zoneId);
    this.broadcastHousingMarketChanged();
    const listed = saleGold !== null || saleBase !== null;
    client.send("housingResult", {
      ok: true,
      plotId,
      ownerName: player.name,
      message: listed ? "Your property is now on the market." : "Listing withdrawn.",
    });
  }

  /** Buy a listed house/shop with in-game gold (atomic, server-side). */
  private async handleHousingBuyResaleGold(client: Client, plotId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId || this.isKnockedOut(player.name)) return;
    const owner = getPlotOwner(plotId);
    if (!owner || (owner.saleGold ?? null) === null) {
      return void client.send("housingResult", { ok: false, plotId, error: "That property isn't for sale in gold." });
    }
    if (owner.ownerName === player.name) {
      return void client.send("housingResult", { ok: false, plotId, error: "You already own this — unlist it instead." });
    }
    const price = owner.saleGold as number;
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < price) {
      return void client.send("housingResult", { ok: false, plotId, gold, error: `You need ${price.toLocaleString()} gold.` });
    }
    const sellerName = owner.ownerName;
    const zoneId = owner.zoneId;
    const nextGold = gold - price;
    this.playerGold.set(this.pidOf(player), nextGold);
    const wallet = this.getClientWallet(client) ?? this.playerWallets.get(client.sessionId) ?? null;
    const previous = transferPlot(plotId, player.name, wallet);
    // Seller receives the sale price plus any uncollected shop earnings (reset on
    // transfer), paid immediately if online or queued as pending gold otherwise.
    this.creditPlayerByName(sellerName, price + (previous?.earnings ?? 0));
    bumpMetric("house.resaleGold", price);
    this.sendProfile(client, player);
    ZoneRoom.broadcastHousingForZone(zoneId);
    this.broadcastHousingMarketChanged();
    this.announceHouseSale(player.name, sellerName, structureLabel(owner.structure), `${price.toLocaleString()} gold`);
    client.send("housingResult", { ok: true, plotId, gold: nextGold, ownerName: player.name, message: "Property purchased!" });
    await this.persistPlayer(player);
  }

  /** Buy a listed house/shop with $BASE the buyer already sent to the seller's
   *  wallet on-chain (direct, non-custodial). Verifies the signature, then
   *  transfers ownership. Idempotent via the recorded signature. */
  private async handleHousingBuyResaleBase(client: Client, plotId: string, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !plotId || this.isKnockedOut(player.name)) return;
    const wallet = this.getClientWallet(client) ?? this.playerWallets.get(client.sessionId) ?? null;
    if (!wallet) return void client.send("housingResult", { ok: false, plotId, error: "Link a wallet to pay with $BASE." });
    if (!signature || signature.length < 32) {
      return void client.send("housingResult", { ok: false, plotId, error: "Missing payment transaction." });
    }
    const owner = getPlotOwner(plotId);
    if (!owner || (owner.saleBase ?? null) === null) {
      return void client.send("housingResult", { ok: false, plotId, error: "That property isn't for sale in $BASE." });
    }
    if (owner.ownerName === player.name) {
      return void client.send("housingResult", { ok: false, plotId, error: "You already own this." });
    }
    if (!owner.ownerWallet) {
      return void client.send("housingResult", { ok: false, plotId, error: "The seller has no wallet to receive $BASE." });
    }
    if (await isPurchaseRedeemed(signature)) {
      return void client.send("housingResult", { ok: false, plotId, signature, error: "That payment was already used." });
    }
    const price = owner.saleBase as number;
    const mint = process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;
    let v;
    try {
      v = await verifyPeerTokenTransfer(signature, { fromWallet: wallet, toWallet: owner.ownerWallet, mint, minUiAmount: price }, 10);
    } catch (error) {
      console.warn("[house] $BASE verify threw:", error);
      return void client.send("housingResult", {
        ok: false,
        plotId,
        signature,
        retryable: true,
        error: "Couldn't confirm your payment on-chain. Your $BASE is safe — try again in a moment.",
      });
    }
    if (!v.ok || v.uiAmount === undefined || v.uiAmount <= 0) {
      return void client.send("housingResult", {
        ok: false,
        plotId,
        signature,
        retryable: v.retryable === true,
        error: v.error ?? "Payment not found on-chain.",
      });
    }
    // Payment confirmed. Ensure the seller still owns it (a concurrent gold sale
    // could have transferred it while the buyer was paying) before handing over.
    const current = getPlotOwner(plotId);
    if (!current || current.ownerName !== owner.ownerName) {
      return void client.send("housingResult", {
        ok: false,
        plotId,
        signature,
        error: "This property was just sold to someone else — contact the seller for a $BASE refund.",
      });
    }
    const sellerName = current.ownerName;
    const zoneId = current.zoneId;
    // Transfer first (persisted), then record the signature so a mid-flight crash
    // leaves the payment safely retryable rather than consumed without the house.
    const previous = transferPlot(plotId, player.name, wallet);
    await recordTokenPurchase(signature, wallet, `house_resale:${plotId}`, v.uiAmount);
    if (previous?.earnings) this.creditPlayerByName(sellerName, previous.earnings);
    bumpMetric("house.resaleBase", Math.round(v.uiAmount));
    ZoneRoom.broadcastHousingForZone(zoneId);
    this.broadcastHousingMarketChanged();
    this.announceHouseSale(player.name, sellerName, structureLabel(owner.structure), `${price.toLocaleString()} $BASE`);
    client.send("housingResult", { ok: true, plotId, signature, ownerName: player.name, message: "Property purchased with $BASE!" });
    await this.persistPlayer(player);
  }

  private announceHouseSale(buyer: string, seller: string, what: string, priceLabel: string) {
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Housing",
      body: `🏡 ${buyer} bought ${seller}'s ${what} for ${priceLabel}.`,
      sentAt: Date.now(),
    });
  }

  private async handleGuildCreate(client: Client, rawName: string, rawTag: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const name = sanitizeGuildName(rawName);
    const tag = sanitizeGuildTag(rawTag);
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
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
    this.playerGold.set(this.pidOf(player), nextGold);
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
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      if (want <= 0 || gold < want) {
        client.send("guildResult", { ok: false, error: "Not enough gold to deposit." });
        return;
      }
      const result = depositToBank(player.name, want);
      if (!result.ok) {
        client.send("guildResult", { ok: false, error: result.error });
        return;
      }
      this.playerGold.set(this.pidOf(player), gold - want);
    } else {
      const result = withdrawFromBank(player.name, want);
      if (!result.ok || !result.amount) {
        client.send("guildResult", { ok: false, error: result.error });
        return;
      }
      const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
      this.playerGold.set(this.pidOf(player), gold + result.amount);
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
    const skills = this.playerSkills.get(this.pidForName(playerName)) ?? normalizeSkills();
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
      gold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
      questProgress: this.getQuestProgress(player.name),
      appearance: {
        bodyColor: player.bodyColor,
        hairColor: player.hairColor,
        outfitColor: player.outfitColor,
        hairStyle: player.hairStyle as "short" | "long" | "spiky",
        outfitStyle: player.outfitStyle as "robe" | "armor" | "casual",
      },
      inventory: normalizeInventory(this.inventories.get(this.pidOf(player))),
      hp: this.playerHp.get(this.pidOf(player)) ?? getPlayerMaxHp(player.level),
      equipment: normalizeEquipment(this.playerEquipment.get(this.pidOf(player))),
      npcInteractAt: this.npcInteractAt.get(this.pidOf(player)) ?? {},
      craftMastery: this.craftMastery.get(this.pidOf(player)) ?? emptyCraftMastery(),
      mobGoldClaimed: this.mobGoldClaimed.get(this.pidOf(player)) ?? {},
      knockedOutUntil: this.isKnockedOut(player.name)
        ? (this.playerKnockedOutUntil.get(player.name) ?? null)
        : null,
      skills: normalizeSkills(this.playerSkills.get(this.pidOf(player))),
      stamina: clampStamina(this.playerStamina.get(this.pidOf(player)) ?? STARTING_STAMINA),
      vipPassUntil: (() => {
        const wallet = this.playerWallets.get(player.sessionId);
        const until = wallet ? ZoneRoom.vipPassUntil.get(wallet) ?? 0 : 0;
        return until > Date.now() ? until : null;
      })(),
      blackPass: (() => {
        const wallet = this.playerWallets.get(player.sessionId);
        return wallet ? ZoneRoom.blackPassWallets.has(wallet) : false;
      })(),
      pvpRating: this.playerPvpRating.get(this.pidOf(player)) ?? STARTING_PVP_RATING,
      pvpKills: this.playerPvpKills.get(this.pidOf(player)) ?? 0,
      pvpSeason: this.playerPvpSeason.get(this.pidOf(player)) ?? getPvpSeason(Date.now()),
      honor: this.playerHonor.get(this.pidOf(player)) ?? 0,
      guildCoin: this.playerGuildCoin.get(this.pidOf(player)) ?? 0,
      gems: this.playerGems.get(this.pidOf(player)) ?? 0,
      bagLevel: this.playerBagLevel.get(this.pidOf(player)) ?? 0,
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

  // ===== Merchant Companies =====================================================

  /** Push fresh company state to each named member (per-recipient), cross-zone. */
  private broadcastCompanyState(names: string[]) {
    broadcastCompanyStateFn(names);
  }

  private handleCompanyCreate(
    client: Client,
    rawName: string,
    emblem: string,
    color: number,
    companyType: string,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const name = sanitizeCompanyName(rawName);
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < COMPANY_CREATE_COST) {
      client.send("companyResult", {
        ok: false,
        gold,
        error: `Founding a company costs ${COMPANY_CREATE_COST.toLocaleString()} gold.`,
      });
      return;
    }
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    const result = createCompany(name, emblem, color, companyType as CompanyType, player.name, wallet);
    if (!result.ok) {
      client.send("companyResult", { ok: false, error: result.error });
      return;
    }
    const nextGold = gold - COMPANY_CREATE_COST;
    this.playerGold.set(this.pidOf(player), nextGold);
    burnGold(COMPANY_CREATE_COST); // registration fee leaves the economy (a sink)
    bumpMetric("company.created");
    bumpMetric("company.create.gold", COMPANY_CREATE_COST);
    this.sendProfile(client, player);
    void this.persistPlayer(player);
    client.send("companyResult", { ok: true, gold: nextGold, message: "Company founded!" });
    client.send("companyState", buildCompanyStatePayload(player.name));
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "System",
      body: `${player.name} founded the company "${name}".`,
      sentAt: Date.now(),
    });
  }

  private handleCompanyJoin(client: Client, companyId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = requestJoinCompany(player.name, companyId);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", { ok: true, message: "Application sent." });
    client.send("companyState", buildCompanyStatePayload(player.name));
    if (result.company) this.broadcastCompanyState(result.company.members);
  }

  private handleCompanyCancelRequest(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const company = cancelCompanyJoinRequest(player.name);
    client.send("companyResult", { ok: true, message: "Request cancelled." });
    client.send("companyState", buildCompanyStatePayload(player.name));
    if (company) this.broadcastCompanyState(company.members);
  }

  private handleCompanyJoinDecision(client: Client, action: "approve" | "deny", applicant: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !applicant) return;
    const result =
      action === "approve"
        ? approveCompanyJoinRequest(player.name, applicant)
        : denyCompanyJoinRequest(player.name, applicant);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", { ok: true });
    if (result.company) this.broadcastCompanyState(result.company.members);
    // Refresh the applicant so their UI updates (joined, or request cleared).
    sendToPlayer(applicant, "companyState", buildCompanyStatePayload(applicant));
  }

  private handleCompanyLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const company = getCompanyForMember(player.name);
    const companyId = company?.id;
    const members = companyMemberNames(player.name);
    const result = leaveCompany(player.name);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    // Refund escrow of any contracts orphaned by a disband — to the poster
    // company treasury (B2B) or the poster's personal gold (legacy contracts).
    for (const refund of result.refunds ?? []) {
      if (refund.companyId && refundCompanyTreasury(refund.companyId, refund.amount)) {
        const posterCompany = getCompanyById(refund.companyId);
        if (posterCompany) this.broadcastCompanyState(posterCompany.members);
      } else {
        this.creditPlayerByName(refund.name, refund.amount);
      }
    }
    // A disbanded company that was listed on the exchange is delisted; its
    // reserve is returned to shareholders pro-rata by shares held.
    if (result.disbanded && companyId && isCompanyListed(companyId)) {
      for (const payout of settleDelisting(companyId)) {
        this.creditPlayerByName(payout.name, payout.gold);
      }
      this.broadcastExchangeChanged();
    }
    client.send("companyResult", { ok: true, message: "You left the company." });
    client.send("companyState", buildCompanyStatePayload(player.name));
    this.broadcastCompanyState(members);
  }

  private handleCompanyKick(client: Client, target: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !target) return;
    const members = companyMemberNames(player.name);
    const result = kickCompanyMember(player.name, target);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", { ok: true });
    this.broadcastCompanyState(members);
    sendToPlayer(target, "companyState", buildCompanyStatePayload(target));
  }

  private handleCompanySetRank(client: Client, target: string, rank: CompanyRank) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !target) return;
    const result = setCompanyRank(player.name, target, rank);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", { ok: true });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private handleCompanySetMotd(client: Client, motd: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = setCompanyMotd(player.name, motd);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    const members = companyMemberNames(player.name);
    client.send("companyResult", { ok: true, message: "Announcement updated." });
    this.broadcastCompanyState(members);
    // Surface the new announcement in company chat so members see it live.
    const company = getCompanyForMember(player.name);
    if (company && company.motd) {
      sendToPlayers(members, "chat", {
        id: crypto.randomUUID(),
        channel: "company",
        senderId: "system",
        senderName: company.name,
        body: `📢 ${company.motd}`,
        sentAt: Date.now(),
      } satisfies ChatMessagePayload);
    }
  }

  private handleCompanySetRates(client: Client, revenueShare: number, dividendRate: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = setCompanyRates(player.name, revenueShare, dividendRate);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", { ok: true, message: "Rates updated." });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private handleCompanySetSalary(client: Client, target: string, gold: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !target) return;
    const result = setCompanySalary(player.name, target, gold);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", { ok: true, message: "Salary updated." });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private async handleCompanyDeposit(client: Client, amount: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const want = Math.floor(amount);
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (!Number.isFinite(want) || want <= 0) {
      return void client.send("companyResult", { ok: false, error: "Enter a positive amount." });
    }
    if (gold < want) {
      return void client.send("companyResult", { ok: false, error: "You don't have that much gold." });
    }
    const result = depositCompanyGold(player.name, want);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    const nextGold = gold - want;
    this.playerGold.set(this.pidOf(player), nextGold); // pure transfer — no burn
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("companyResult", { ok: true, gold: nextGold, message: `Deposited ${want.toLocaleString()}g.` });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private async handleCompanyWithdraw(client: Client, amount: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = withdrawCompanyGold(player.name, amount);
    if (!result.ok || result.amount == null) {
      return void client.send("companyResult", { ok: false, error: result.error });
    }
    const nextGold = (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + result.amount;
    this.playerGold.set(this.pidOf(player), nextGold);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("companyResult", {
      ok: true,
      gold: nextGold,
      message: `Withdrew ${result.amount.toLocaleString()}g.`,
    });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private async handleCompanyContribute(client: Client, itemId: string, qty: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !itemId) return;
    const pid = this.pidOf(player);
    const inv = this.inventories.get(pid) ?? [];
    const have = getItemQuantity(inv, itemId);
    const want = Math.min(Math.floor(qty), have);
    if (want <= 0) return void client.send("companyResult", { ok: false, error: "You don't have that item." });
    if (this.wouldStripEquipped(player, inv, itemId, want)) {
      return void client.send("companyResult", { ok: false, error: "That's equipped — unequip it first." });
    }
    const result = contributeWarehouse(player.name, itemId, want);
    if (!result.ok || !result.added) {
      return void client.send("companyResult", { ok: false, error: result.error ?? "Couldn't contribute." });
    }
    // Remove exactly what the warehouse accepted (a neutral P2P transfer — no
    // recordProduced/recordConsumed).
    const { inventory } = removeItemFromInventory(inv, itemId, result.added);
    this.inventories.set(pid, inventory);
    this.sendInventory(client, player.name);
    await this.persistPlayer(player);
    const item = getItemDefinition(itemId);
    client.send("companyResult", {
      ok: true,
      message: `Contributed ${result.added}× ${item.name} to the warehouse.`,
    });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private async handleCompanyTake(client: Client, itemId: string, qty: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !itemId) return;
    const taken = takeFromWarehouse(player.name, itemId, qty, "withdrawItems");
    if (!taken.ok || !taken.removed || !taken.companyId) {
      return void client.send("companyResult", { ok: false, error: taken.error ?? "Couldn't withdraw." });
    }
    const pid = this.pidOf(player);
    const inv = this.inventories.get(pid) ?? [];
    const { inventory, added } = addItemToInventory(inv, itemId, taken.removed, this.bagCapOf(player.name));
    this.inventories.set(pid, inventory);
    // Return any items that didn't fit the player's bag back to the warehouse.
    const leftover = taken.removed - added;
    if (leftover > 0) stockWarehouse(taken.companyId, itemId, leftover);
    this.sendInventory(client, player.name);
    await this.persistPlayer(player);
    const item = getItemDefinition(itemId);
    client.send("companyResult", {
      ok: true,
      message:
        leftover > 0
          ? `Withdrew ${added}× ${item.name} — bag full, ${leftover} left in the warehouse.`
          : `Withdrew ${added}× ${item.name}.`,
    });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private handleCompanySell(client: Client, itemId: string, qty: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !itemId) return;
    const basePrice = getPipSellPrice(itemId);
    if (!basePrice) {
      return void client.send("companyResult", { ok: false, error: "Rudi won't buy that item." });
    }
    const taken = takeFromWarehouse(player.name, itemId, qty, "sellWarehouse");
    if (!taken.ok || !taken.removed || !taken.companyId) {
      return void client.send("companyResult", { ok: false, error: taken.error ?? "Couldn't sell." });
    }
    // Same softened faucet as a player vendor sale — no new pump vector.
    const payout = this.vendorSellProceeds(itemId, basePrice, taken.removed);
    creditCompanyTreasury(taken.companyId, payout, "vendor");
    const item = getItemDefinition(itemId);
    client.send("companyResult", {
      ok: true,
      message: `Sold ${taken.removed}× ${item.name} for ${payout.toLocaleString()}g to the treasury.`,
    });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private async handleCompanyContractPost(
    client: Client,
    companyId: string,
    kind: CompanyContractKind,
    itemId: string | null,
    qty: number,
    rewardGold: number,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    // Escrow is debited from the POSTER's company treasury inside the registry
    // (B2B) — the poster must be in a company with the postContracts permission.
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    const result = postCompanyContract(player.name, wallet, companyId, kind, itemId, qty, rewardGold);
    if (!result.ok || !result.contract) {
      return void client.send("companyResult", { ok: false, error: result.error });
    }
    bumpMetric("company.contract.posted");
    client.send("companyResult", { ok: true, message: "Contract posted — reward escrowed from your treasury." });
    client.send("companyState", buildCompanyStatePayload(player.name));
    // Refresh both companies: the poster's (treasury dropped) and the target's (board grew).
    if (result.posterCompanyId) {
      const posterCompany = getCompanyById(result.posterCompanyId);
      if (posterCompany) this.broadcastCompanyState(posterCompany.members);
    }
    const company = getCompanyById(companyId);
    if (company) this.broadcastCompanyState(company.members);
  }

  private async handleCompanyContractCancel(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = cancelCompanyContract(player.name, id);
    if (!result.ok || result.refund == null) {
      return void client.send("companyResult", { ok: false, error: result.error });
    }
    if (result.refundedToCompany) {
      // B2B: the registry already returned the escrow to the poster company treasury.
      client.send("companyResult", {
        ok: true,
        message: `Contract cancelled — ${result.refund.toLocaleString()}g refunded to your treasury.`,
      });
    } else {
      // Legacy contract escrowed from personal gold — refund it there.
      const nextGold = (this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD) + result.refund;
      this.playerGold.set(this.pidOf(player), nextGold);
      this.sendProfile(client, player);
      await this.persistPlayer(player);
      client.send("companyResult", {
        ok: true,
        gold: nextGold,
        message: `Contract cancelled — ${result.refund.toLocaleString()}g refunded.`,
      });
    }
    client.send("companyState", buildCompanyStatePayload(player.name));
  }

  private handleCompanyContractAccept(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = acceptCompanyContract(player.name, id);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", { ok: true, message: "Contract accepted." });
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  private handleCompanyContractDeliver(client: Client, id: string, qty: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = deliverCompanyContract(player.name, id, qty);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", {
      ok: true,
      message: result.completed
        ? `Contract complete — ${(result.reward ?? 0).toLocaleString()}g paid to the treasury.`
        : "Delivered.",
    });
    if (result.completed) bumpMetric("company.contract.completed");
    this.broadcastCompanyState(companyMemberNames(player.name));
  }

  /** Poster collects the goods a company delivered on a completed supply contract. */
  private async handleCompanyContractCollect(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const peek = peekContractCollect(player.name, id);
    if (!peek.ok || !peek.itemId || !peek.qty) {
      return void client.send("companyResult", { ok: false, error: peek.error });
    }
    const item = getItemDefinition(peek.itemId);
    // B2B: goods land in the poster company's warehouse. Legacy contracts (no
    // poster company) fall back to the poster's personal bag.
    const posterCompany = peek.posterCompanyId ? getCompanyById(peek.posterCompanyId) : null;
    if (peek.posterCompanyId && posterCompany) {
      const added = stockWarehouse(peek.posterCompanyId, peek.itemId, peek.qty);
      if (added <= 0) {
        return void client.send("companyResult", { ok: false, error: "Your company warehouse is full." });
      }
      reduceContractCollect(id, added);
      const leftover = peek.qty - added;
      client.send("companyResult", {
        ok: true,
        message:
          leftover > 0
            ? `Collected ${added}× ${item.name} into the warehouse — full, ${leftover} left to collect.`
            : `Collected ${added}× ${item.name} into the warehouse.`,
      });
      this.broadcastCompanyState(posterCompany.members);
      client.send("companyState", buildCompanyStatePayload(player.name));
      return;
    }
    const pid = this.pidOf(player);
    const inv = this.inventories.get(pid) ?? [];
    const { inventory, added } = addItemToInventory(inv, peek.itemId, peek.qty, this.bagCapOf(player.name));
    if (added <= 0) {
      return void client.send("companyResult", { ok: false, error: "Your bag is full." });
    }
    this.inventories.set(pid, inventory);
    reduceContractCollect(id, added);
    this.sendInventory(client, player.name);
    await this.persistPlayer(player);
    const leftover = peek.qty - added;
    client.send("companyResult", {
      ok: true,
      message:
        leftover > 0
          ? `Collected ${added}× ${item.name} — bag full, ${leftover} left to collect.`
          : `Collected ${added}× ${item.name}.`,
    });
    client.send("companyState", buildCompanyStatePayload(player.name));
  }

  private handleCompanyContractDismiss(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = dismissCompanyContract(player.name, id);
    if (!result.ok) return void client.send("companyResult", { ok: false, error: result.error });
    client.send("companyResult", { ok: true });
    client.send("companyState", buildCompanyStatePayload(player.name));
  }

  private handleCompanyChat(client: Client, rawBody: string) {
    const now = Date.now();
    const lastSent = this.chatCooldowns.get(client.sessionId) ?? 0;
    if (now - lastSent < CHAT_COOLDOWN_MS) return;
    const body = rawBody.trim().slice(0, CHAT_MAX_LENGTH);
    if (!body) return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const company = getCompanyForMember(player.name);
    if (!company) {
      client.send("companyResult", { ok: false, error: "You're not in a company." });
      return;
    }
    this.chatCooldowns.set(client.sessionId, now);
    sendToPlayers(company.members, "chat", {
      id: crypto.randomUUID(),
      channel: "company",
      senderId: client.sessionId,
      senderName: player.name,
      body,
      sentAt: now,
    } satisfies ChatMessagePayload);
  }

  // ===== Stock Exchange =========================================================

  /** The company a player OWNS that isn't listed yet (so they can list it). */
  private listableCompanyIdFor(name: string): string | null {
    const company = getCompanyForMember(name);
    if (company && company.ownerName === name && !isCompanyListed(company.id)) return company.id;
    return null;
  }

  private sendExchangeState(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    client.send("exchangeState", buildExchangeState(player.name, this.listableCompanyIdFor(player.name)));
  }

  /** Nudge every online client to refresh an open Exchange panel. */
  private broadcastExchangeChanged() {
    ZoneRoom.notifyExchangeChanged();
  }

  /** Static form for callers outside a room instance (the weekly dividend runner). */
  public static notifyExchangeChanged() {
    for (const room of ZoneRoom.activeRooms) room.broadcast("exchangeChanged", {});
  }

  private handleExchangeVote(client: Client, companyId: string, pct: number | null) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !companyId) return;
    const result = setDividendVote(companyId, player.name, pct);
    if (!result.ok) return void client.send("exchangeResult", { ok: false, error: result.error });
    client.send("exchangeResult", { ok: true, message: pct == null ? "Vote cleared." : `Voted ${pct}% dividend.` });
    const detail = buildMarketDetail(companyId, player.name);
    if (detail) client.send("marketDetail", detail);
    this.broadcastExchangeChanged();
  }

  private refreshMarketDetail(client: Client, companyId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const detail = buildMarketDetail(companyId, player.name);
    if (detail) client.send("marketDetail", detail);
  }

  private handleExchangeListBase(client: Client, companyId: string, shares: number, priceBase: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !companyId) return;
    const wallet = this.getClientWallet(client) ?? this.playerWallets.get(client.sessionId) ?? null;
    const result = createBaseListing(companyId, player.name, wallet, shares, priceBase);
    if (!result.ok) return void client.send("exchangeResult", { ok: false, error: result.error });
    client.send("exchangeResult", { ok: true, message: `Listed ${Math.floor(shares)} shares for ${priceBase} $BASE.` });
    this.refreshMarketDetail(client, companyId);
    this.broadcastExchangeChanged();
  }

  private handleExchangeCancelBase(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !id) return;
    const result = cancelBaseListing(id, player.name);
    if (!result.ok) return void client.send("exchangeResult", { ok: false, error: result.error });
    client.send("exchangeResult", { ok: true, message: "Listing cancelled." });
    if (result.companyId) this.refreshMarketDetail(client, result.companyId);
    this.broadcastExchangeChanged();
  }

  /** Buy a $BASE share block. Mirrors the audited housing-resale $BASE flow:
   * verify the buyer's on-chain $BASE payment to the seller, then move the shares
   * in the ledger and record the signature idempotently. */
  private async handleExchangeBuyBase(client: Client, id: string, signature: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !id) return;
    const wallet = this.getClientWallet(client) ?? this.playerWallets.get(client.sessionId) ?? null;
    if (!wallet) return void client.send("exchangeResult", { ok: false, error: "Link a wallet to pay with $BASE." });
    if (!signature || signature.length < 32) {
      return void client.send("exchangeResult", { ok: false, error: "Missing payment transaction." });
    }
    const listing = getBaseListing(id);
    if (!listing) return void client.send("exchangeResult", { ok: false, error: "That listing is gone." });
    if (listing.sellerName === player.name) {
      return void client.send("exchangeResult", { ok: false, error: "That's your own listing." });
    }
    if (await isPurchaseRedeemed(signature)) {
      return void client.send("exchangeResult", { ok: false, signature, error: "That payment was already used." });
    }
    const mint = process.env.TOKEN_MINT?.trim() || METRICBASE_TOKEN_MINT;
    let v;
    try {
      v = await verifyPeerTokenTransfer(
        signature,
        { fromWallet: wallet, toWallet: listing.sellerWallet, mint, minUiAmount: listing.priceBase },
        10,
      );
    } catch (error) {
      console.warn("[exchange] $BASE verify threw:", error);
      return void client.send("exchangeResult", {
        ok: false,
        signature,
        retryable: true,
        error: "Couldn't confirm your payment on-chain. Your $BASE is safe — try again in a moment.",
      });
    }
    if (!v.ok || v.uiAmount === undefined || v.uiAmount <= 0) {
      return void client.send("exchangeResult", {
        ok: false,
        signature,
        retryable: v.retryable === true,
        error: v.error ?? "Payment not found on-chain.",
      });
    }
    // Payment confirmed. Move the shares (re-checks the seller still holds them),
    // then record the signature so a mid-flight crash leaves the payment retryable.
    const filled = fillBaseListing(id, player.name, wallet);
    if (!filled.ok || !filled.companyId) {
      return void client.send("exchangeResult", {
        ok: false,
        signature,
        error: filled.error ?? "The shares were no longer available — contact the seller for a $BASE refund.",
      });
    }
    await recordTokenPurchase(signature, wallet, `share_base:${id}`, v.uiAmount);
    bumpMetric("exchange.baseTrades");
    bumpMetric("exchange.baseVolume", Math.round(v.uiAmount));
    client.send("exchangeResult", {
      ok: true,
      signature,
      message: `Bought ${filled.shares?.toLocaleString()} shares for ${listing.priceBase} $BASE.`,
    });
    this.sendExchangeState(client);
    this.refreshMarketDetail(client, filled.companyId);
    this.broadcastExchangeChanged();
    // Notify the seller of the completed sale.
    if (filled.sellerName) {
      sendToPlayer(filled.sellerName, "chat", {
        id: crypto.randomUUID(),
        channel: "system",
        senderId: "system",
        senderName: "Exchange",
        body: `💵 ${player.name} bought your ${filled.shares?.toLocaleString()} shares for ${listing.priceBase} $BASE.`,
        sentAt: Date.now(),
      });
    }
  }

  /** Apply order-fill gold credits: seller proceeds + taker-buyer refunds. */
  private applyOrderCredits(credits: OrderCredit[]) {
    for (const c of credits) this.creditPlayerByName(c.name, c.amount);
  }

  private async handleExchangeOrder(
    client: Client,
    companyId: string,
    side: "buy" | "sell",
    rawShares: number,
    rawPrice: number,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !companyId) return;
    const shares = Math.floor(rawShares);
    const limitPrice = Math.floor(rawPrice);
    const check = canPlaceOrder(companyId, player.name, side, shares, limitPrice);
    if (!check.ok) return void client.send("exchangeResult", { ok: false, error: check.error });
    const pid = this.pidOf(player);
    const wallet = this.playerWallets.get(client.sessionId) ?? null;

    if (side === "buy") {
      const cost = limitPrice * shares;
      const gold = this.playerGold.get(pid) ?? STARTING_GOLD;
      if (gold < cost) {
        return void client.send("exchangeResult", {
          ok: false,
          error: `Need ${cost.toLocaleString()} gold to escrow this order (you have ${gold.toLocaleString()}).`,
        });
      }
      this.playerGold.set(pid, gold - cost); // escrow the whole order up front
      const result = placeBuyOrder(companyId, player.name, wallet, shares, limitPrice);
      if (!result.ok) {
        this.playerGold.set(pid, gold); // refund on failure
        return void client.send("exchangeResult", { ok: false, error: result.error });
      }
      this.applyOrderCredits(result.credits ?? []);
      this.sendProfile(client, player);
      await this.persistPlayer(player);
      client.send("exchangeResult", { ok: true, gold: this.playerGold.get(pid), message: "Buy order placed." });
    } else {
      const result = placeSellOrder(companyId, player.name, wallet, shares, limitPrice);
      if (!result.ok) return void client.send("exchangeResult", { ok: false, error: result.error });
      this.applyOrderCredits(result.credits ?? []); // the seller's own proceeds land here
      this.sendProfile(client, player);
      await this.persistPlayer(player);
      client.send("exchangeResult", { ok: true, gold: this.playerGold.get(pid), message: "Sell order placed." });
    }
    bumpMetric("exchange.orders");
    this.refreshMarketDetail(client, companyId);
    this.broadcastExchangeChanged();
  }

  private async handleExchangeCancelOrder(client: Client, id: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !id) return;
    const result = cancelOrder(id, player.name);
    if (!result.ok) return void client.send("exchangeResult", { ok: false, error: result.error });
    if (result.refundGold && result.refundGold > 0) {
      const pid = this.pidOf(player);
      this.playerGold.set(pid, (this.playerGold.get(pid) ?? STARTING_GOLD) + result.refundGold);
      this.sendProfile(client, player);
      await this.persistPlayer(player);
    }
    client.send("exchangeResult", {
      ok: true,
      gold: this.playerGold.get(this.pidOf(player)),
      message: result.refundGold ? `Order cancelled — ${result.refundGold.toLocaleString()}g refunded.` : "Order cancelled.",
    });
    if (result.companyId) this.refreshMarketDetail(client, result.companyId);
    this.broadcastExchangeChanged();
  }

  private async handleExchangeList(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const company = getCompanyForMember(player.name);
    if (!company || company.ownerName !== player.name) {
      return void client.send("exchangeResult", { ok: false, error: "Only a company owner can list it." });
    }
    if (isCompanyListed(company.id)) {
      return void client.send("exchangeResult", { ok: false, error: "Your company is already listed." });
    }
    // Adaptive sink: the listing fee breathes with mint pressure (±20%).
    const listingCost = Math.round(SHARE_LISTING_COST * currentSinkMultiplier());
    const gold = this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD;
    if (gold < listingCost) {
      return void client.send("exchangeResult", {
        ok: false,
        gold,
        error: `Listing costs ${listingCost.toLocaleString()} gold.`,
      });
    }
    const result = listShareMarket(company.id);
    if (!result.ok) return void client.send("exchangeResult", { ok: false, error: result.error });
    const nextGold = gold - listingCost;
    this.playerGold.set(this.pidOf(player), nextGold);
    burnGold(listingCost); // listing fee is a sink
    bumpMetric("exchange.listed");
    bumpMetric("exchange.listing.gold", listingCost);
    this.sendProfile(client, player);
    await this.persistPlayer(player);
    client.send("exchangeResult", { ok: true, gold: nextGold, message: `${company.name} is now listed!` });
    this.sendExchangeState(client);
    this.broadcastExchangeChanged();
    this.broadcastChat({
      id: crypto.randomUUID(),
      channel: "system",
      senderId: "system",
      senderName: "Exchange",
      body: `${company.name} went public on the Stock Exchange.`,
      sentAt: Date.now(),
    });
  }

  private async handleExchangeTrade(
    client: Client,
    side: "buy" | "sell",
    companyId: string,
    rawShares: number,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !companyId) return;
    const market = getShareMarket(companyId);
    if (!market) return void client.send("exchangeResult", { ok: false, error: "That company isn't listed." });
    const n = Math.floor(rawShares);
    if (!Number.isFinite(n) || n < SHARE_MIN_TRADE || n > SHARE_MAX_TRADE) {
      return void client.send("exchangeResult", { ok: false, error: `Trade ${SHARE_MIN_TRADE}–${SHARE_MAX_TRADE.toLocaleString()} shares.` });
    }
    if (tradeCooldownRemaining(player.name, companyId) > 0) {
      return void client.send("exchangeResult", { ok: false, error: "Slow down — trading too fast." });
    }
    const wallet = this.playerWallets.get(client.sessionId) ?? null;
    const pid = this.pidOf(player);
    const gold = this.playerGold.get(pid) ?? STARTING_GOLD;

    if (side === "buy") {
      const quote = quoteBuy(market.circulatingShares, n, market.basePrice, market.slope);
      if (gold < quote.net) {
        return void client.send("exchangeResult", {
          ok: false,
          error: `Need ${quote.net.toLocaleString()} gold (you have ${gold.toLocaleString()}).`,
        });
      }
      const applied = applyShareBuy(companyId, player.name, wallet, n);
      if (!applied) return void client.send("exchangeResult", { ok: false, error: "Trade failed." });
      const fee = this.tradeFeeFor(player.name, applied.gross); // buyer paid gross + fee
      this.playerGold.set(pid, gold - (applied.gross + fee.fee));
      creditCompanyTreasury(companyId, fee.treasury, "shares");
      burnGold(fee.burn);
      bumpMetric("exchange.trades");
      bumpMetric("exchange.volume.gold", applied.gross);
      this.finishExchangeTrade(client, player, companyId, `Bought ${n} shares for ${(applied.gross + fee.fee).toLocaleString()}g.`);
    } else {
      const free = freeSharesFor(companyId, player.name);
      if (free < n) {
        return void client.send("exchangeResult", {
          ok: false,
          error: `You only have ${free.toLocaleString()} sellable shares (some may be committed to $BASE listings).`,
        });
      }
      const applied = applyShareSell(companyId, player.name, wallet, n);
      if (!applied) return void client.send("exchangeResult", { ok: false, error: "Trade failed." });
      const fee = this.tradeFeeFor(player.name, applied.gross);
      const net = Math.max(0, applied.gross - fee.fee);
      this.playerGold.set(pid, gold + net);
      creditCompanyTreasury(companyId, fee.treasury, "shares");
      burnGold(fee.burn);
      bumpMetric("exchange.trades");
      bumpMetric("exchange.volume.gold", applied.gross);
      this.finishExchangeTrade(client, player, companyId, `Sold ${n} shares for ${net.toLocaleString()}g.`);
    }
  }

  /** Trade fee with the merchant-company perk applied: the TREASURY-routed
   * portion shrinks, the BURN portion never does (it's the wash-trade
   * deterrent). Applies to bonding-curve trades; order-book fills unchanged. */
  private tradeFeeFor(playerName: string, gross: number): { fee: number; treasury: number; burn: number } {
    const fee = shareTradeFee(gross);
    if (companyTypeOf(playerName) !== "merchant") return fee;
    const treasury = Math.floor(fee.treasury * (COMPANY_TYPE_PERKS.merchant.exchangeTreasuryFeeMult ?? 1));
    return { fee: treasury + fee.burn, treasury, burn: fee.burn };
  }

  private finishExchangeTrade(
    client: Client,
    player: InstanceType<typeof PlayerSchema>,
    companyId: string,
    message: string,
  ) {
    this.sendProfile(client, player);
    void this.persistPlayer(player);
    client.send("exchangeResult", {
      ok: true,
      gold: this.playerGold.get(this.pidOf(player)) ?? STARTING_GOLD,
      message,
    });
    this.sendExchangeState(client);
    const detail = buildMarketDetail(companyId, player.name);
    if (detail) client.send("marketDetail", detail);
    this.broadcastExchangeChanged();
    // The share-trade fee changed the company treasury — refresh its members.
    const company = getCompanyById(companyId);
    if (company) this.broadcastCompanyState(company.members);
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