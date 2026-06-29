import { Client, getStateCallbacks, Room } from "colyseus.js";
import {
  AttackResultPayload,
  ChopCancelPayload,
  ChopResultPayload,
  ChopStartPayload,
  CharacterLookupResponse,
  ChatMessagePayload,
  getZoneConfig,
  JoinOptions,
  InventoryResultPayload,
  InventoryStatePayload,
  type EquipmentStatePayload,
  type LootBagsPayload,
  type PvpHitPayload,
  type TerritoryStatePayload,
  type SiegeStatePayload,
  type DuelInvitePayload,
  type DuelStartPayload,
  type DuelEndPayload,
  CraftResultPayload,
  FarmStatePayload,
  FarmResultPayload,
  HousingStatePayload,
  HousingResultPayload,
  GuildStatePayload,
  GuildResultPayload,
  PartyStatePayload,
  PartyResultPayload,
  PartyInvitePayload,
  PlayerShopResultPayload,
  LeaderboardPayload,
  EmotePayload,
  WorldStatsPayload,
  MobHealthPayload,
  normalizeCharacterAppearance,
  PlayerDamagePayload,
  ProfilePayload,
  ResourceHealthPayload,
  RespawnResultPayload,
  QuestStatePayload,
  SkillStatePayload,
  ShopOpenPayload,
  ShopResultPayload,
  MarketResultPayload,
  ZONE_HUB,
  ZoneState,
  ZoneTransferPayload,
  type CharacterAppearance,
  type Player,
} from "@metricbase/shared";
import { getValidWalletSession } from "../wallet/tokenGate";
import { getHttpServerUrl, getWebSocketUrl } from "./serverUrl";

export interface RemotePlayer {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  guildTag: string;
  lampOn: boolean;
  appearance: CharacterAppearance;
  spectator: boolean;
  pvpFlagged: boolean;
  criminal: boolean;
  speedMult: number;
}

type ConnectionListener = (connected: boolean, playerCount: number) => void;
type PlayersListener = (players: RemotePlayer[], localSessionId: string | null) => void;
type ChatListener = (message: ChatMessagePayload) => void;
type ZoneListener = (zoneId: string, zoneName: string) => void;
type TransferListener = (payload: ZoneTransferPayload) => void;
type ProfileListener = (profile: ProfilePayload) => void;
type NpcDialogueListener = (npcName: string, dialogue: string) => void;
type ArcadeListener = (payload: { name: string; url: string }) => void;
type LootBagsListener = (payload: LootBagsPayload) => void;
type PvpHitListener = (payload: PvpHitPayload) => void;
type TerritoryStateListener = (payload: TerritoryStatePayload) => void;
type SiegeStateListener = (payload: SiegeStatePayload) => void;
type DuelInviteListener = (payload: DuelInvitePayload) => void;
type DuelStartListener = (payload: DuelStartPayload) => void;
type DuelEndListener = (payload: DuelEndPayload) => void;
type BlackZoneLockedListener = (payload: { mint: string; amount: number; rpcUrl: string }) => void;
type BlackPassResultListener = (payload: { ok: boolean; error?: string }) => void;
export interface VipLodgeLockedPayload {
  displayName: string;
  minHold: number;
  passDays: number;
  passGold: number;
  passBurn: number;
  passGoldOnly: number;
  mint: string;
  rpcUrl: string;
}
type VipLodgeLockedListener = (payload: VipLodgeLockedPayload) => void;
type VipPassResultListener = (payload: { ok: boolean; error?: string; days?: number }) => void;
type QuestStateListener = (state: QuestStatePayload) => void;
type MobHealthListener = (payload: MobHealthPayload) => void;
type AttackResultListener = (payload: AttackResultPayload) => void;
type InventoryListener = (state: InventoryStatePayload) => void;
type EquipmentStateListener = (state: EquipmentStatePayload) => void;
type InventoryResultListener = (payload: InventoryResultPayload) => void;
type CraftResultListener = (payload: CraftResultPayload) => void;
type FarmStateListener = (payload: FarmStatePayload) => void;
type FarmResultListener = (payload: FarmResultPayload) => void;
type HousingStateListener = (payload: HousingStatePayload) => void;
type HousingResultListener = (payload: HousingResultPayload) => void;
type EmoteListener = (payload: EmotePayload) => void;
type WorldStatsListener = (payload: WorldStatsPayload) => void;
type PlayerShopResultListener = (payload: PlayerShopResultPayload) => void;
type LeaderboardListener = (payload: LeaderboardPayload) => void;
type ShopOpenListener = (payload: ShopOpenPayload) => void;
type ShopResultListener = (payload: ShopResultPayload) => void;
type MarketResultListener = (payload: MarketResultPayload) => void;
type WalletLinkedListener = (payload: { ok: boolean; wallet?: string; error?: string }) => void;
type RespawnResultListener = (payload: RespawnResultPayload) => void;
type PlayerDamageListener = (payload: PlayerDamagePayload) => void;
type ResourceHealthListener = (payload: ResourceHealthPayload) => void;
type ChopResultListener = (payload: ChopResultPayload) => void;
type ChopStartListener = (payload: ChopStartPayload) => void;
type ChopCancelListener = (payload: ChopCancelPayload) => void;
type SkillStateListener = (payload: SkillStatePayload) => void;
type GuildStateListener = (payload: GuildStatePayload) => void;
type GuildResultListener = (payload: GuildResultPayload) => void;
type PartyStateListener = (payload: PartyStatePayload) => void;
type PartyResultListener = (payload: PartyResultPayload) => void;
type PartyInviteListener = (payload: PartyInvitePayload) => void;
type NpcPositionsPayload = { npcId: string; x: number; y: number }[];
type NpcPositionsListener = (payload: NpcPositionsPayload) => void;

export class NetworkManager {
  private client: Client | null = null;
  private room: Room | null = null;
  private playerName = "Traveler";
  private accessToken: string | null = null;
  private appearance: CharacterAppearance | null = null;
  private currentZoneId = ZONE_HUB;
  private isSpectatorMode = false;
  private connectionListeners = new Set<ConnectionListener>();
  private playersListeners = new Set<PlayersListener>();
  private chatListeners = new Set<ChatListener>();
  private zoneListeners = new Set<ZoneListener>();
  private transferListeners = new Set<TransferListener>();
  private profileListeners = new Set<ProfileListener>();
  private npcDialogueListeners = new Set<NpcDialogueListener>();
  private arcadeListeners = new Set<ArcadeListener>();
  private lootBagsListeners = new Set<LootBagsListener>();
  private latestLootBags: LootBagsPayload = { bags: [] };
  private pvpHitListeners = new Set<PvpHitListener>();
  private territoryStateListeners = new Set<TerritoryStateListener>();
  private latestTerritory: TerritoryStatePayload = { points: [] };
  private siegeStateListeners = new Set<SiegeStateListener>();
  private latestSiege: SiegeStatePayload | null = null;
  private duelInviteListeners = new Set<DuelInviteListener>();
  private duelStartListeners = new Set<DuelStartListener>();
  private duelEndListeners = new Set<DuelEndListener>();
  private blackZoneLockedListeners = new Set<BlackZoneLockedListener>();
  private blackPassResultListeners = new Set<BlackPassResultListener>();
  private vipLodgeLockedListeners = new Set<VipLodgeLockedListener>();
  private vipPassResultListeners = new Set<VipPassResultListener>();
  private questStateListeners = new Set<QuestStateListener>();
  private mobHealthListeners = new Set<MobHealthListener>();
  private attackResultListeners = new Set<AttackResultListener>();
  private inventoryListeners = new Set<InventoryListener>();
  private equipmentStateListeners = new Set<EquipmentStateListener>();
  private latestEquipmentState: EquipmentStatePayload | null = null;
  private inventoryResultListeners = new Set<InventoryResultListener>();
  private craftResultListeners = new Set<CraftResultListener>();
  private farmStateListeners = new Set<FarmStateListener>();
  private farmResultListeners = new Set<FarmResultListener>();
  private latestFarmState: FarmStatePayload = { plots: [] };
  private housingStateListeners = new Set<HousingStateListener>();
  private housingResultListeners = new Set<HousingResultListener>();
  private latestHousingState: HousingStatePayload = { plots: [] };
  private emoteListeners = new Set<EmoteListener>();
  private worldStatsListeners = new Set<WorldStatsListener>();
  private latestWorldStats: WorldStatsPayload = { baseHolders: null, online: 0 };
  private playerShopResultListeners = new Set<PlayerShopResultListener>();
  private leaderboardListeners = new Set<LeaderboardListener>();
  private shopOpenListeners = new Set<ShopOpenListener>();
  private shopResultListeners = new Set<ShopResultListener>();
  private marketResultListeners = new Set<MarketResultListener>();
  private walletLinkedListeners = new Set<WalletLinkedListener>();
  private respawnResultListeners = new Set<RespawnResultListener>();
  private playerDamageListeners = new Set<PlayerDamageListener>();
  private resourceHealthListeners = new Set<ResourceHealthListener>();
  private chopResultListeners = new Set<ChopResultListener>();
  private npcPositionsListeners = new Set<NpcPositionsListener>();
  private chopStartListeners = new Set<ChopStartListener>();
  private chopCancelListeners = new Set<ChopCancelListener>();
  private skillStateListeners = new Set<SkillStateListener>();
  private guildStateListeners = new Set<GuildStateListener>();
  private guildResultListeners = new Set<GuildResultListener>();
  private latestGuildState: GuildStatePayload = { myGuild: null, guilds: [], myRequestGuildId: null };
  private partyStateListeners = new Set<PartyStateListener>();
  private partyResultListeners = new Set<PartyResultListener>();
  private partyInviteListeners = new Set<PartyInviteListener>();
  private latestPartyState: PartyStatePayload = { party: null };
  private latestQuestState: QuestStatePayload = { active: [], completed: [] };
  private latestInventory: InventoryStatePayload = { items: [], capacity: 16 };
  private latestSkillState: SkillStatePayload = { woodcutting: { level: 1, xp: 0 } };
  private isTransferring = false;
  private mobHealth = new Map<string, MobHealthPayload>();
  private resourceHealth = new Map<string, ResourceHealthPayload>();
  private lastPlayerSnapshot = "";
  private playerCallbacksCleanup: (() => void) | null = null;
  private playerCache = new Map<string, RemotePlayer>();
  private playerListenCleanup = new Map<string, () => void>();

  getAccessToken(): string | null {
    return this.accessToken;
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get isConnected(): boolean {
    return this.room !== null;
  }

  getRemotePlayers(): RemotePlayer[] {
    return this.getPlayers();
  }

  getLocalPlayerFromState(): RemotePlayer | null {
    const sessionId = this.sessionId;
    if (!sessionId) return null;

    const cached = this.playerCache.get(sessionId);
    if (cached) return cached;

    const map = this.room?.state?.players;
    if (!map || map.size === 0) return null;

    const direct = map.get(sessionId);
    if (direct) {
      return this.toRemotePlayer(sessionId, direct);
    }

    let fallback: RemotePlayer | null = null;
    map.forEach((player: Player, key: string) => {
      if (fallback) return;
      if (key === sessionId || player.sessionId === sessionId || player.name === this.playerName) {
        fallback = this.toRemotePlayer(key, player);
      }
    });
    return fallback;
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
    inviteCode?: string,
    spectate?: boolean,
  ): Promise<void> {
    this.playerName = playerName;
    this.accessToken = accessToken ?? null;
    this.appearance = appearance ? normalizeCharacterAppearance(appearance) : null;
    this.isSpectatorMode = spectate || false;

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
    await this.joinZone(zoneId, inviteCode, this.isSpectatorMode);
    if (this.accessToken) {
      await this.linkWallet();
    }
  }

  async transferToZone(targetZone: string): Promise<void> {
    if (!this.client) return;
    this.isTransferring = true;
    try {
      await this.leaveCurrentRoom();
      this.currentZoneId = targetZone;
      await this.joinZone(targetZone, undefined, this.isSpectatorMode);
      if (this.accessToken) {
        await this.linkWallet();
      }
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

  sendGuildChat(body: string) {
    this.room?.send("guildChat", { body });
  }

  sendInteract(npcId: string) {
    this.room?.send("interact", { npcId });
  }

  sendAttack(npcId: string) {
    this.room?.send("attack", { npcId });
  }

  sendAbility(abilityId: string, npcId: string) {
    this.room?.send("ability", { abilityId, npcId });
  }

  sendAttackPlayer(targetName: string) {
    this.room?.send("attackPlayer", { targetName });
  }

  sendTogglePvpFlag(on: boolean) {
    this.room?.send("togglePvpFlag", { on });
  }

  sendLootPickup(bagId: string) {
    this.room?.send("lootPickup", { bagId });
  }

  sendPlaceBounty(targetName: string, gold: number) {
    this.room?.send("placeBounty", { targetName, gold });
  }

  sendBurnForBlackPass(signature: string) {
    this.room?.send("burnForBlackPass", { signature });
  }

  sendBuyVipPass(signature: string) {
    this.room?.send("buyVipPass", { signature });
  }

  sendBuyVipPassGold() {
    this.room?.send("buyVipPassGold", {});
  }

  sendToggleLamp(on: boolean) {
    this.room?.send("toggleLamp", { on });
  }

  sendChop(resourceId: string) {
    this.room?.send("chop", { resourceId });
  }

  sendShopBuy(shopId: string, itemId: string) {
    this.room?.send("shopBuy", { shopId, itemId });
  }

  sendShopSell(shopId: string, itemId: string, quantity = 1) {
    this.room?.send("shopSell", { shopId, itemId, quantity });
  }

  sendMarketPlace(side: "bid" | "ask", goldAmount: number, tokenPrice: number, currency: string) {
    this.room?.send("marketPlace", { side, goldAmount, tokenPrice, currency });
  }

  sendMarketCancel(orderId: string) {
    this.room?.send("marketCancel", { orderId });
  }

  sendMarketFillAsk(orderId: string, signature: string) {
    this.room?.send("marketFillAsk", { orderId, signature });
  }

  sendMarketAcceptBid(orderId: string) {
    this.room?.send("marketAcceptBid", { orderId });
  }

  sendMarketPayBid(orderId: string, signature: string) {
    this.room?.send("marketPayBid", { orderId, signature });
  }

  sendMarketRefresh(currency?: string) {
    this.room?.send("marketRefresh", currency ? { currency } : {});
  }

  sendUseItem(itemId: string) {
    this.room?.send("useItem", { itemId });
  }

  sendEquipItem(itemId: string | null, slot?: string) {
    this.room?.send("equipItem", { itemId, slot });
  }

  sendRepairGear() {
    this.room?.send("repairGear", {});
  }

  sendCraft(recipeId: string) {
    this.room?.send("craft", { recipeId });
  }

  sendFarmInteract(plotId: string) {
    this.room?.send("farmInteract", { plotId });
  }

  getFarmState(): FarmStatePayload {
    return this.latestFarmState;
  }

  sendHousingBuy(plotId: string, structure: "house" | "shop") {
    this.room?.send("housingBuy", { plotId, structure });
  }

  sendHousingCustomize(plotId: string, roof: string | null) {
    this.room?.send("housingCustomize", { plotId, roof });
  }

  sendHousingSign(plotId: string, sign: string | null) {
    this.room?.send("housingCustomize", { plotId, sign });
  }

  sendHousingDecorate(plotId: string, slot: number, propId: string | null) {
    this.room?.send("housingDecorate", { plotId, slot, propId });
  }

  sendHousingLight(plotId: string, on: boolean) {
    this.room?.send("housingLight", { plotId, on });
  }

  sendHousingRefuel(plotId: string) {
    this.room?.send("housingRefuel", { plotId });
  }

  sendHousingRest(plotId: string) {
    this.room?.send("housingRest", { plotId });
  }

  sendGuildCreate(name: string, tag: string) {
    this.room?.send("guildCreate", { name, tag });
  }

  sendGuildJoin(guildId: string) {
    this.room?.send("guildJoin", { guildId });
  }

  sendGuildLeave() {
    this.room?.send("guildLeave", {});
  }

  sendGuildCancelRequest() {
    this.room?.send("guildCancelRequest", {});
  }

  sendGuildApprove(applicant: string) {
    this.room?.send("guildApprove", { applicant });
  }

  sendGuildDeny(applicant: string) {
    this.room?.send("guildDeny", { applicant });
  }

  sendGuildPromote(target: string) {
    this.room?.send("guildPromote", { target });
  }

  sendGuildDemote(target: string) {
    this.room?.send("guildDemote", { target });
  }

  sendGuildKick(target: string) {
    this.room?.send("guildKick", { target });
  }

  sendGuildSetTax(rate: number) {
    this.room?.send("guildSetTax", { rate });
  }

  sendGuildDeposit(amount: number) {
    this.room?.send("guildDeposit", { amount });
  }

  sendGuildWithdraw(amount: number) {
    this.room?.send("guildWithdraw", { amount });
  }

  sendGuildDeclareWar(guildId: string) {
    this.room?.send("guildDeclareWar", { guildId });
  }

  sendGuildEndWar(guildId: string) {
    this.room?.send("guildEndWar", { guildId });
  }

  requestGuilds() {
    this.room?.send("requestGuilds", {});
  }

  getGuildState(): GuildStatePayload {
    return this.latestGuildState;
  }

  sendPartyInvite(targetName: string) {
    this.room?.send("partyInvite", { targetName });
  }

  sendPartyAccept() {
    this.room?.send("partyAccept", {});
  }

  sendPartyDecline() {
    this.room?.send("partyDecline", {});
  }

  sendPartyLeave() {
    this.room?.send("partyLeave", {});
  }

  sendPartyChat(body: string) {
    this.room?.send("partyChat", { body });
  }

  requestParty() {
    this.room?.send("requestParty", {});
  }

  getPartyState(): PartyStatePayload {
    return this.latestPartyState;
  }

  sendEmote(emoteId: string) {
    this.room?.send("emote", { emoteId });
  }

  sendShopStock(plotId: string, itemId: string, quantity: number, price: number) {
    this.room?.send("shopStock", { plotId, itemId, quantity, price });
  }

  sendShopUnstock(plotId: string, itemId: string) {
    this.room?.send("shopUnstock", { plotId, itemId });
  }

  sendShopBuyListing(plotId: string, itemId: string, quantity: number) {
    this.room?.send("shopBuyListing", { plotId, itemId, quantity });
  }

  sendShopCollect(plotId: string) {
    this.room?.send("shopCollect", { plotId });
  }

  onPlayerShopResult(listener: PlayerShopResultListener) {
    this.playerShopResultListeners.add(listener);
    return () => this.playerShopResultListeners.delete(listener);
  }

  onGuildState(listener: GuildStateListener) {
    this.guildStateListeners.add(listener);
    listener(this.latestGuildState);
    return () => this.guildStateListeners.delete(listener);
  }

  onGuildResult(listener: GuildResultListener) {
    this.guildResultListeners.add(listener);
    return () => this.guildResultListeners.delete(listener);
  }

  onPartyState(listener: PartyStateListener) {
    this.partyStateListeners.add(listener);
    listener(this.latestPartyState);
    return () => this.partyStateListeners.delete(listener);
  }

  onPartyResult(listener: PartyResultListener) {
    this.partyResultListeners.add(listener);
    return () => this.partyResultListeners.delete(listener);
  }

  onPartyInvite(listener: PartyInviteListener) {
    this.partyInviteListeners.add(listener);
    return () => this.partyInviteListeners.delete(listener);
  }

  requestLeaderboard() {
    this.room?.send("requestLeaderboard", {});
  }

  onLeaderboard(listener: LeaderboardListener) {
    this.leaderboardListeners.add(listener);
    return () => this.leaderboardListeners.delete(listener);
  }

  getHousingState(): HousingStatePayload {
    return this.latestHousingState;
  }

  sendRequestRespawn(payGold: boolean) {
    this.room?.send("requestRespawn", { payGold });
  }

  setAccessToken(accessToken: string | null) {
    this.accessToken = accessToken;
  }

  async linkWallet(): Promise<boolean> {
    const result = await this.linkWalletDetailed();
    return result.ok;
  }

  async linkWalletDetailed(): Promise<{ ok: boolean; wallet?: string; error?: string }> {
    if (!this.accessToken || !this.room) {
      return { ok: false, error: "Not connected to a game zone." };
    }

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        unsubscribe();
        resolve({ ok: false, error: "Wallet sync timed out. Click Reconnect Wallet." });
      }, 8000);

      const unsubscribe = this.onWalletLinked((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });

      this.room?.send("linkWallet", { accessToken: this.accessToken });
    });
  }

  async ensureWalletLinked(): Promise<{ ok: boolean; wallet?: string; error?: string }> {
    if (!this.accessToken) {
      const session = await getValidWalletSession();
      if (session) {
        this.accessToken = session.accessToken;
      }
    }

    if (!this.accessToken) {
      return { ok: false, error: "Connect your wallet to use the gold market." };
    }

    return this.linkWalletDetailed();
  }

  getMobHealth(npcId: string): MobHealthPayload | undefined {
    return this.mobHealth.get(npcId);
  }

  getResourceHealth(resourceId: string): ResourceHealthPayload | undefined {
    return this.resourceHealth.get(resourceId);
  }

  async disconnect() {
    await this.leaveCurrentRoom();
    this.clearPlayerTracking();
    this.client = null;
    this.accessToken = null;
    this.appearance = null;
    this.latestQuestState = { active: [], completed: [] };
    this.latestInventory = { items: [], capacity: 16 };
    this.mobHealth.clear();
    this.resourceHealth.clear();
    this.latestSkillState = { woodcutting: { level: 1, xp: 0 } };
    this.lastPlayerSnapshot = "";
    this.emitConnection(false, 0);
    this.emitPlayers(true);
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

  onArcade(listener: ArcadeListener) {
    this.arcadeListeners.add(listener);
    return () => this.arcadeListeners.delete(listener);
  }

  onLootBags(listener: LootBagsListener) {
    this.lootBagsListeners.add(listener);
    listener(this.latestLootBags);
    return () => this.lootBagsListeners.delete(listener);
  }

  onPvpHit(listener: PvpHitListener) {
    this.pvpHitListeners.add(listener);
    return () => this.pvpHitListeners.delete(listener);
  }

  onTerritoryState(listener: TerritoryStateListener) {
    this.territoryStateListeners.add(listener);
    listener(this.latestTerritory);
    return () => this.territoryStateListeners.delete(listener);
  }

  onSiegeState(listener: SiegeStateListener) {
    this.siegeStateListeners.add(listener);
    if (this.latestSiege) listener(this.latestSiege);
    return () => this.siegeStateListeners.delete(listener);
  }

  sendAttackCrystal() {
    this.room?.send("attackCrystal", {});
  }

  sendDuelChallenge(targetName: string) {
    this.room?.send("duelChallenge", { targetName });
  }

  sendDuelRespond(fromName: string, accept: boolean) {
    this.room?.send("duelRespond", { fromName, accept });
  }

  onDuelInvite(listener: DuelInviteListener) {
    this.duelInviteListeners.add(listener);
    return () => this.duelInviteListeners.delete(listener);
  }

  onDuelStart(listener: DuelStartListener) {
    this.duelStartListeners.add(listener);
    return () => this.duelStartListeners.delete(listener);
  }

  onDuelEnd(listener: DuelEndListener) {
    this.duelEndListeners.add(listener);
    return () => this.duelEndListeners.delete(listener);
  }

  onBlackZoneLocked(listener: BlackZoneLockedListener) {
    this.blackZoneLockedListeners.add(listener);
    return () => this.blackZoneLockedListeners.delete(listener);
  }

  onBlackPassResult(listener: BlackPassResultListener) {
    this.blackPassResultListeners.add(listener);
    return () => this.blackPassResultListeners.delete(listener);
  }

  onVipLodgeLocked(listener: VipLodgeLockedListener) {
    this.vipLodgeLockedListeners.add(listener);
    return () => this.vipLodgeLockedListeners.delete(listener);
  }

  onVipPassResult(listener: VipPassResultListener) {
    this.vipPassResultListeners.add(listener);
    return () => this.vipPassResultListeners.delete(listener);
  }

  onNpcPositions(listener: NpcPositionsListener) {
    this.npcPositionsListeners.add(listener);
    return () => this.npcPositionsListeners.delete(listener);
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

  onEquipmentState(listener: EquipmentStateListener) {
    this.equipmentStateListeners.add(listener);
    if (this.latestEquipmentState) listener(this.latestEquipmentState);
    return () => this.equipmentStateListeners.delete(listener);
  }

  onInventoryResult(listener: InventoryResultListener) {
    this.inventoryResultListeners.add(listener);
    return () => this.inventoryResultListeners.delete(listener);
  }

  onCraftResult(listener: CraftResultListener) {
    this.craftResultListeners.add(listener);
    return () => this.craftResultListeners.delete(listener);
  }

  onFarmState(listener: FarmStateListener) {
    this.farmStateListeners.add(listener);
    listener(this.latestFarmState);
    return () => this.farmStateListeners.delete(listener);
  }

  onFarmResult(listener: FarmResultListener) {
    this.farmResultListeners.add(listener);
    return () => this.farmResultListeners.delete(listener);
  }

  onHousingState(listener: HousingStateListener) {
    this.housingStateListeners.add(listener);
    listener(this.latestHousingState);
    return () => this.housingStateListeners.delete(listener);
  }

  onHousingResult(listener: HousingResultListener) {
    this.housingResultListeners.add(listener);
    return () => this.housingResultListeners.delete(listener);
  }

  onEmote(listener: EmoteListener) {
    this.emoteListeners.add(listener);
    return () => this.emoteListeners.delete(listener);
  }

  onWorldStats(listener: WorldStatsListener) {
    this.worldStatsListeners.add(listener);
    return () => this.worldStatsListeners.delete(listener);
  }

  getWorldStats(): WorldStatsPayload {
    return this.latestWorldStats;
  }

  onShopOpen(listener: ShopOpenListener) {
    this.shopOpenListeners.add(listener);
    return () => this.shopOpenListeners.delete(listener);
  }

  onShopResult(listener: ShopResultListener) {
    this.shopResultListeners.add(listener);
    return () => this.shopResultListeners.delete(listener);
  }

  onMarketResult(listener: MarketResultListener) {
    this.marketResultListeners.add(listener);
    return () => this.marketResultListeners.delete(listener);
  }

  onWalletLinked(listener: WalletLinkedListener) {
    this.walletLinkedListeners.add(listener);
    return () => this.walletLinkedListeners.delete(listener);
  }

  onRespawnResult(listener: RespawnResultListener) {
    this.respawnResultListeners.add(listener);
    return () => this.respawnResultListeners.delete(listener);
  }

  onPlayerDamage(listener: PlayerDamageListener) {
    this.playerDamageListeners.add(listener);
    return () => this.playerDamageListeners.delete(listener);
  }

  onResourceHealth(listener: ResourceHealthListener) {
    this.resourceHealthListeners.add(listener);
    for (const payload of this.resourceHealth.values()) {
      listener(payload);
    }
    return () => this.resourceHealthListeners.delete(listener);
  }

  onChopResult(listener: ChopResultListener) {
    this.chopResultListeners.add(listener);
    return () => this.chopResultListeners.delete(listener);
  }

  onChopStart(listener: ChopStartListener) {
    this.chopStartListeners.add(listener);
    return () => this.chopStartListeners.delete(listener);
  }

  onChopCancel(listener: ChopCancelListener) {
    this.chopCancelListeners.add(listener);
    return () => this.chopCancelListeners.delete(listener);
  }

  onSkillState(listener: SkillStateListener) {
    this.skillStateListeners.add(listener);
    listener(this.latestSkillState);
    return () => this.skillStateListeners.delete(listener);
  }

  private async joinZone(zoneId: string, inviteCode?: string, spectate?: boolean) {
    if (!this.client) {
      this.client = new Client(getWebSocketUrl());
    }

    const config = getZoneConfig(zoneId);
    const options: JoinOptions = {
      name: this.playerName,
      zoneId,
      ...(this.accessToken ? { accessToken: this.accessToken } : {}),
      ...(this.appearance ? { appearance: this.appearance } : {}),
      ...(inviteCode ? { inviteCode } : {}),
      ...(spectate !== undefined ? { spectate } : {}),
    };
    try {
      this.room = await this.client.joinOrCreate(config.roomName, options, ZoneState);
    } catch (error) {
      throw new Error(formatJoinError(error));
    }
    this.currentZoneId = zoneId;
    this.mobHealth.clear();
    this.resourceHealth.clear();
    this.lastPlayerSnapshot = "";
    this.bindPlayerStateCallbacks();

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
    this.room.onMessage("openArcade", (payload: { name: string; url: string }) => {
      for (const listener of this.arcadeListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("lootBags", (payload: LootBagsPayload) => {
      this.latestLootBags = payload;
      for (const listener of this.lootBagsListeners) listener(payload);
    });
    this.room.onMessage("pvpHit", (payload: PvpHitPayload) => {
      for (const listener of this.pvpHitListeners) listener(payload);
    });
    this.room.onMessage("territoryState", (payload: TerritoryStatePayload) => {
      this.latestTerritory = payload;
      for (const listener of this.territoryStateListeners) listener(payload);
    });
    this.room.onMessage("siegeState", (payload: SiegeStatePayload) => {
      this.latestSiege = payload;
      for (const listener of this.siegeStateListeners) listener(payload);
    });
    this.room.onMessage("duelInvite", (payload: DuelInvitePayload) => {
      for (const listener of this.duelInviteListeners) listener(payload);
    });
    this.room.onMessage("duelStart", (payload: DuelStartPayload) => {
      for (const listener of this.duelStartListeners) listener(payload);
    });
    this.room.onMessage("duelEnd", (payload: DuelEndPayload) => {
      for (const listener of this.duelEndListeners) listener(payload);
    });
    this.room.onMessage("blackZoneLocked", (payload: { mint: string; amount: number; rpcUrl: string }) => {
      for (const listener of this.blackZoneLockedListeners) listener(payload);
    });
    this.room.onMessage("blackPassResult", (payload: { ok: boolean; error?: string }) => {
      for (const listener of this.blackPassResultListeners) listener(payload);
    });
    this.room.onMessage("vipLodgeLocked", (payload: VipLodgeLockedPayload) => {
      for (const listener of this.vipLodgeLockedListeners) listener(payload);
    });
    this.room.onMessage("vipPassResult", (payload: { ok: boolean; error?: string; days?: number }) => {
      for (const listener of this.vipPassResultListeners) listener(payload);
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
    this.room.onMessage("resourceHealth", (payload: ResourceHealthPayload) => {
      this.resourceHealth.set(payload.resourceId, payload);
      for (const listener of this.resourceHealthListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("chopStart", (payload: ChopStartPayload) => {
      this.resourceHealth.set(payload.resourceId, {
        resourceId: payload.resourceId,
        available: true,
        chopperName: payload.playerName,
        chopStartedAt: payload.startedAt,
        chopEndsAt: payload.endsAt,
        chopDurationMs: payload.durationMs,
      });
      for (const listener of this.chopStartListeners) {
        listener(payload);
      }
      for (const listener of this.resourceHealthListeners) {
        listener(this.resourceHealth.get(payload.resourceId)!);
      }
    });
    this.room.onMessage("chopCancel", (payload: ChopCancelPayload) => {
      const existing = this.resourceHealth.get(payload.resourceId);
      this.resourceHealth.set(payload.resourceId, {
        resourceId: payload.resourceId,
        available: existing?.available ?? true,
        chopperName: undefined,
        chopStartedAt: undefined,
        chopEndsAt: undefined,
        chopDurationMs: undefined,
      });
      for (const listener of this.chopCancelListeners) {
        listener(payload);
      }
      for (const listener of this.resourceHealthListeners) {
        listener(this.resourceHealth.get(payload.resourceId)!);
      }
    });
    this.room.onMessage("chopResult", (payload: ChopResultPayload) => {
      this.resourceHealth.set(payload.resourceId, {
        resourceId: payload.resourceId,
        available: payload.available,
      });
      for (const listener of this.chopResultListeners) {
        listener(payload);
      }
      for (const listener of this.resourceHealthListeners) {
        listener(this.resourceHealth.get(payload.resourceId)!);
      }
    });
    this.room.onMessage("skillState", (payload: SkillStatePayload) => {
      this.latestSkillState = payload;
      for (const listener of this.skillStateListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("inventory", (payload: InventoryStatePayload) => {
      this.latestInventory = payload;
      for (const listener of this.inventoryListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("equipmentState", (payload: EquipmentStatePayload) => {
      this.latestEquipmentState = payload;
      for (const listener of this.equipmentStateListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("inventoryResult", (payload: InventoryResultPayload) => {
      if (payload.inventory) {
        this.latestInventory = payload.inventory;
        for (const listener of this.inventoryListeners) {
          listener(payload.inventory);
        }
      }
      for (const listener of this.inventoryResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("craftResult", (payload: CraftResultPayload) => {
      if (payload.inventory) {
        this.latestInventory = payload.inventory;
        for (const listener of this.inventoryListeners) {
          listener(payload.inventory);
        }
      }
      for (const listener of this.craftResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("farmState", (payload: FarmStatePayload) => {
      this.latestFarmState = payload;
      for (const listener of this.farmStateListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("farmResult", (payload: FarmResultPayload) => {
      if (payload.inventory) {
        this.latestInventory = payload.inventory;
        for (const listener of this.inventoryListeners) {
          listener(payload.inventory);
        }
      }
      for (const listener of this.farmResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("housingState", (payload: HousingStatePayload) => {
      this.latestHousingState = payload;
      for (const listener of this.housingStateListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("housingResult", (payload: HousingResultPayload) => {
      for (const listener of this.housingResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("emote", (payload: EmotePayload) => {
      for (const listener of this.emoteListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("worldStats", (payload: WorldStatsPayload) => {
      this.latestWorldStats = payload;
      for (const listener of this.worldStatsListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("playerShopResult", (payload: PlayerShopResultPayload) => {
      for (const listener of this.playerShopResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("leaderboard", (payload: LeaderboardPayload) => {
      for (const listener of this.leaderboardListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("guildState", (payload: GuildStatePayload) => {
      this.latestGuildState = payload;
      for (const listener of this.guildStateListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("guildResult", (payload: GuildResultPayload) => {
      for (const listener of this.guildResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("partyState", (payload: PartyStatePayload) => {
      this.latestPartyState = payload;
      for (const listener of this.partyStateListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("partyResult", (payload: PartyResultPayload) => {
      for (const listener of this.partyResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("partyInvite", (payload: PartyInvitePayload) => {
      for (const listener of this.partyInviteListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("shopOpen", (payload: ShopOpenPayload) => {
      for (const listener of this.shopOpenListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("walletLinked", (payload: { ok: boolean; wallet?: string; error?: string }) => {
      for (const listener of this.walletLinkedListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("respawnResult", (payload: RespawnResultPayload) => {
      for (const listener of this.respawnResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("playerDamage", (payload: PlayerDamagePayload) => {
      for (const listener of this.playerDamageListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("marketResult", (payload: MarketResultPayload) => {
      for (const listener of this.marketResultListeners) {
        listener(payload);
      }
    });
    this.room.onMessage("shopResult", (payload: ShopResultPayload) => {
      if (payload.inventory) {
        this.latestInventory = payload.inventory;
        for (const listener of this.inventoryListeners) {
          listener(payload.inventory);
        }
      }
      for (const listener of this.shopResultListeners) {
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
    this.room.onMessage("npcPositions", (payload: NpcPositionsPayload) => {
      for (const listener of this.npcPositionsListeners) {
        listener(payload);
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
    this.emitPlayers(true);
    this.emitLocalProfile();
  }

  private async leaveCurrentRoom() {
    this.clearPlayerTracking();
    if (!this.room) return;
    await this.room.leave();
    this.room = null;
  }

  private clearPlayerTracking() {
    this.playerCallbacksCleanup?.();
    this.playerCallbacksCleanup = null;
    for (const cleanup of this.playerListenCleanup.values()) {
      cleanup();
    }
    this.playerListenCleanup.clear();
    this.playerCache.clear();
  }

  private bindPlayerStateCallbacks() {
    if (!this.room) return;

    this.clearPlayerTracking();

    const $ = getStateCallbacks(this.room);
    const unbindAdd = $(this.room.state).players.onAdd((player, sessionId) => {
      this.attachPlayer(sessionId, player);
      this.emitPlayers(true);
    }, true);
    const unbindRemove = $(this.room.state).players.onRemove((_player, sessionId) => {
      this.detachPlayer(sessionId);
      this.emitPlayers(true);
    });

    this.playerCallbacksCleanup = () => {
      unbindAdd();
      unbindRemove();
      for (const cleanup of this.playerListenCleanup.values()) {
        cleanup();
      }
      this.playerListenCleanup.clear();
      this.playerCache.clear();
    };
  }

  private attachPlayer(sessionId: string, player: Player) {
    this.refreshCachedPlayer(sessionId, player);
    if (!this.room) return;

    this.playerListenCleanup.get(sessionId)?.();
    const $ = getStateCallbacks(this.room);
    const cleanups = [
      $(player).onChange(() => this.refreshCachedPlayer(sessionId, player)),
    ];
    this.playerListenCleanup.set(sessionId, () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    });
  }

  private detachPlayer(sessionId: string) {
    this.playerListenCleanup.get(sessionId)?.();
    this.playerListenCleanup.delete(sessionId);
    this.playerCache.delete(sessionId);
  }

  private refreshCachedPlayer(sessionId: string, player: Player) {
    const remote = this.toRemotePlayer(sessionId, player);
    if (!remote) return;

    for (const [cachedId, cached] of this.playerCache.entries()) {
      if (cachedId === remote.sessionId) continue;
      if (cached.name === remote.name && cached.name === this.playerName) {
        this.playerCache.delete(cachedId);
      }
    }

    this.playerCache.set(remote.sessionId, remote);
    this.emitPlayers();
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

  private emitPlayers(force = false) {
    const players = this.getPlayers();
    const snapshot = JSON.stringify(
      players.map((player) => ({
        sessionId: player.sessionId,
        name: player.name,
        x: Math.round(player.x),
        y: Math.round(player.y),
        level: player.level,
        xp: player.xp,
        guildTag: player.guildTag,
        lampOn: player.lampOn,
        appearance: player.appearance,
      })),
    );
    if (!force && snapshot === this.lastPlayerSnapshot) {
      return;
    }
    this.lastPlayerSnapshot = snapshot;

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

  private resolvePlayerSessionId(sessionId: string, player: Player): string | null {
    if (typeof sessionId === "string" && sessionId.length > 0) {
      return sessionId;
    }
    if (typeof player.sessionId === "string" && player.sessionId.length > 0) {
      return player.sessionId;
    }
    if (typeof this.sessionId === "string" && this.sessionId.length > 0) {
      return this.sessionId;
    }
    return null;
  }

  private toRemotePlayer(sessionId: string, player: Player): RemotePlayer | null {
    const id = this.resolvePlayerSessionId(sessionId, player);
    if (!id) return null;
    return {
      sessionId: id,
      name: player.name,
      x: player.x,
      y: player.y,
      level: player.level,
      xp: player.xp ?? 0,
      guildTag: player.guildTag ?? "",
      lampOn: Boolean(player.lampOn),
      spectator: Boolean((player as any).spectator),
      pvpFlagged: Boolean((player as any).pvpFlagged),
      criminal: Boolean((player as any).criminal),
      speedMult: Number((player as any).speedMult) || 1,
      appearance: normalizeCharacterAppearance({
        bodyColor: player.bodyColor,
        hairColor: player.hairColor,
        outfitColor: player.outfitColor,
        hairStyle: player.hairStyle as CharacterAppearance["hairStyle"],
        outfitStyle: player.outfitStyle as CharacterAppearance["outfitStyle"],
        weaponId: player.weaponId,
        toolId: player.toolId,
      }),
    };
  }

  private getPlayers(): RemotePlayer[] {
    if (this.playerCache.size > 0) {
      return Array.from(this.playerCache.values());
    }

    if (!this.room?.state?.players) return [];

    const map = this.room.state.players;
    if (map.size === 0) return [];

    const players: RemotePlayer[] = [];
    const seen = new Set<string>();

    const pushPlayer = (sessionId: string, player: Player | undefined) => {
      if (!player) return;
      const remote = this.toRemotePlayer(sessionId, player);
      if (!remote || seen.has(remote.sessionId)) return;
      seen.add(remote.sessionId);
      players.push(remote);
      this.playerCache.set(remote.sessionId, remote);
    };

    if (this.sessionId) {
      pushPlayer(this.sessionId, map.get(this.sessionId));
    }

    if (typeof map.forEach === "function") {
      map.forEach((player: Player, sessionId: string) => {
        pushPlayer(sessionId, player);
      });
    }

    if (players.length > 0) {
      return players;
    }

    const items = (map as { $items?: Map<string, Player> }).$items;
    if (items && items.size > 0) {
      for (const [sessionId, player] of items) {
        pushPlayer(sessionId, player);
      }
    }

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