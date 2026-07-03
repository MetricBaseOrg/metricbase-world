import Phaser from "phaser";
import {
  ATTACK_RANGE,
  CHOP_RANGE,
  directionFromDelta,
  directionFromInput,
  directionTowardTarget,
  SLIME_BRUTE_NPC_ID,
  WILD_SLIME_NPC_ID,
  type AvatarAction,
  type AvatarDirection,
  type CharacterAppearance,
  normalizeCharacterAppearance,
  MAP_HEIGHT,
  MAP_WIDTH,
  NPC_INTERACT_RANGE,
  FARM_RANGE,
  farmGrowthProgress,
  HOUSE_RANGE,
  PLOT_DECOR_SLOTS,
  isValidDecorId,
  structureLabel,
  getEmote,
  getWorldTime,
  getWeather,
  LAMP_GLOW_DIAMETER,
  ZONE_INTERIOR,
  TILE_GRASS,
  TILE_WATER,
  tileToWorld,
  worldToTile,
  type FarmStatePayload,
  type HousingStatePayload,
  type LootBagState,
  type TerritoryPointState,
  type SiegeStatePayload,
  ZONE_BLACK,
  KING_CRYSTAL_TILE,
  SIEGE_ATTACK_RANGE,
  AD_SLOTS,
  billboardSlotForZone,
  type AdServedCreative,
} from "@metricbase/shared";
import {
  getAnimFrame,
  getAvatarTextureKey,
  setAvatarPose,
} from "../character/avatarAnimations";
import { AVATAR_LOGICAL_HEIGHT, AVATAR_LOGICAL_WIDTH } from "../character/avatarPose";
import { notifyGameSceneReady } from "./gameSceneReady";
import {
  consumeMobileAttack,
  consumeMobileInteract,
  getMobileAxis,
  isUiTypingActive,
} from "./inputControl";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";
import { networkManager, RemotePlayer } from "./network";
import { isPlayerZoneId, resolveZoneConfig, setPlayerZoneConfig } from "./playerZoneConfig";
import { ensureZoneAssetLoaded, getZoneAsset, zoneAssetScale, zoneAssetTextureKey } from "./zoneAssets";
import type { EditTool } from "./inputControl";
import {
  emptyPlayerZoneBuild,
  makePlayerZoneResource,
  PLAYER_ZONE_GRID,
  type PlayerZoneBuild,
} from "@metricbase/shared";
import { buildZoneMap } from "./mapData";
import { PredictedPosition, reconcilePrediction, stepPrediction } from "./prediction";
import { buildCollisionGrid, collisionStep, findPath, type CollisionGrid } from "./pathfind";

interface RenderedPlayer {
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  appearance: CharacterAppearance;
  direction: AvatarDirection;
  action: AvatarAction;
  actionUntil: number;
  actionDirection: AvatarDirection;
  targetX: number;
  targetY: number;
  lastTargetX: number;
  lastTargetY: number;
  predicted: PredictedPosition;
  displayDirection: AvatarDirection;
  displayAction: AvatarAction;
  poseStartedAt: number;
  lastTextureKey: string;
  remoteMoving: boolean;
  prevSpriteX: number;
  prevSpriteY: number;
  lampOn: boolean;
  glow: Phaser.GameObjects.Image | null;
  /** Soft contact shadow that tracks the feet (does not bob with the sprite). */
  shadow: Phaser.GameObjects.Image;
  /** True ground-Y of the feet, before any idle-bob offset is applied. */
  baseY: number;
  /** Per-avatar phase so idle bobbing isn't synchronised across players. */
  bobPhase: number;
  /** Cosmetic companion that trails the player (null when no pet equipped). */
  pet: Phaser.GameObjects.Text | null;
  petId: string;
  petX: number;
  petY: number;
}

/** Emoji companion per pet item. */
const PET_EMOJI: Record<string, string> = {
  item_pet_cat: "🐱",
  item_pet_slime: "🫧",
  item_pet_owl: "🦉",
};

interface RenderedFarmPlot {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Graphics;
  barFill: Phaser.GameObjects.Graphics;
  worldX: number;
  worldY: number;
  stage: "empty" | "growing" | "ready";
  plantedAt?: number;
  readyAt?: number;
}

interface RenderedLandPlot {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  worldX: number;
  worldY: number;
  /** World position of each corner decoration slot. */
  slotPositions: { x: number; y: number }[];
  /** Currently-rendered prop id per slot (parallel to slotPositions). */
  decorIds: (string | null)[];
  decorSprites: (Phaser.GameObjects.Sprite | null)[];
  lightOn: boolean;
  glow: Phaser.GameObjects.Image | null;
}

interface RenderedNpc {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  worldX: number;
  worldY: number;
  combat: boolean;
  hpBarBg: Phaser.GameObjects.Graphics;
  hpBarFill: Phaser.GameObjects.Graphics;
  maxHp: number;
  currentHp: number;
  headTopY: number;
  headTopOffset: number;
  shadow: Phaser.GameObjects.Image;
  targetX?: number;
  targetY?: number;
}

interface RenderedResource {
  id: string;
  kind: "tree" | "rock" | "fish";
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  worldX: number;
  worldY: number;
  chopBarBg: Phaser.GameObjects.Graphics;
  chopBarFill: Phaser.GameObjects.Graphics;
  available: boolean;
  chopperName?: string;
  chopStartedAt?: number;
  chopEndsAt?: number;
  chopDurationMs?: number;
}

/** Nameplate text — prefixes the guild tag when the player is in a guild. */
function nameplateText(player: RemotePlayer): string {
  if (player.spectator) {
    return `[SPECTATOR] ${player.name}`;
  }
  return player.guildTag ? `[${player.guildTag}] ${player.name}` : player.name;
}

// Camera zoom limits + persistence (mouse wheel on desktop, pinch on touch).
const MIN_ZOOM = 0.9;
const MAX_ZOOM = 2.8;
const DEFAULT_ZOOM = 1.5;
const ZOOM_STORAGE_KEY = "metricbase-zoom";

function readStoredZoom(): number {
  if (typeof window === "undefined") return DEFAULT_ZOOM;
  const raw = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY));
  return Number.isFinite(raw) && raw >= MIN_ZOOM && raw <= MAX_ZOOM ? raw : DEFAULT_ZOOM;
}

// Deterministic 0..1 hash so the cosmetic ground scatter is identical for every
// player (no networking) and stable across renders.
function hash01(n: number): number {
  let x = Math.floor(n) >>> 0;
  x = (Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0) >>> 0;
  x = (Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 0x100000000;
}

/** Near-white tints that nudge grass tiles warmer for cozy variety. */
const GRASS_TINTS = [0xffffff, 0xf6f8e8, 0xeef3da, 0xfff3dc, 0xf2f3e0];
const GROUND_DETAILS = ["detail_flowers", "detail_mushroom", "detail_pebbles", "detail_tuft", "detail_leaf"];

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private renderedPlayers = new Map<string, RenderedPlayer>();
  private localAvatar: RenderedPlayer | null = null;
  private localSessionId: string | null = null;
  private mapTiles: Phaser.GameObjects.Image[] = [];
  /** Animated glints drifting over water tiles. */
  private waterShimmers: { img: Phaser.GameObjects.Image; baseX: number; baseY: number; phase: number; speed: number }[] = [];
  private renderedPortals: Phaser.GameObjects.GameObject[] = [];
  private groundDetails: Phaser.GameObjects.Image[] = [];
  private renderedNpcs: RenderedNpc[] = [];
  private renderedResources: RenderedResource[] = [];
  private renderedFarmPlots = new Map<string, RenderedFarmPlot>();
  private renderedLandPlots = new Map<string, RenderedLandPlot>();
  private renderedScenery: Phaser.GameObjects.Sprite[] = [];
  /** Ground-paint overlay sprites for player zones (below props/players). */
  private groundPaintSprites: Phaser.GameObjects.Image[] = [];
  // --- Build editor (player-owned zones) ---
  private worldEditing = false;
  private worldEditZoneId: string | null = null;
  private worldEditTool: EditTool | null = null;
  private worldEditDraft: PlayerZoneBuild | null = null;
  private editGrid?: Phaser.GameObjects.Graphics;
  private spawnMarker?: Phaser.GameObjects.Text;
  /** Walk-up-and-interact scenery props (arcade cabinet, blackjack table). */
  private interactableScenery: { id: string; worldX: number; worldY: number; label: string }[] = [];
  /** Warm light pools cast by lamp/lantern/fire scenery; brighten + flicker at night. */
  private sceneryLights: {
    glow: Phaser.GameObjects.Image;
    type: "lamp" | "fire";
    phase: number;
  }[] = [];
  private billboardTexts: Phaser.GameObjects.GameObject[] = [];
  private adBillboards: Phaser.GameObjects.GameObject[] = [];
  private latestAdServing: AdServedCreative[] = [];
  private billboardHoldersText: Phaser.GameObjects.Text | null = null;
  private billboardOnlineText: Phaser.GameObjects.Text | null = null;
  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private attackKey: Phaser.Input.Keyboard.Key | null = null;
  /** Right-click attack queued from the pointer; consumed by tryAttack(). */
  private pointerAttackQueued = false;
  /** Left-click selected hostile NPC id; drives the target reticle + attack priority. */
  private selectedNpcId: string | null = null;
  private targetReticle: Phaser.GameObjects.Graphics | null = null;
  /** Click/tap-to-move destination in world coords; cleared on arrival or keyboard input. */
  private moveTarget: { x: number; y: number } | null = null;
  /** Waypoints (world-space tile centres) the click-to-move path follows. */
  private movePath: { x: number; y: number }[] = [];
  /** Client collision grid for the current zone (walls + solid props). */
  private collisionGrid: CollisionGrid | null = null;
  private moveMarker: Phaser.GameObjects.Graphics | null = null;
  /** Left-click selected hostile player (PvP target). */
  private selectedPlayerName: string | null = null;
  /** Rendered loot bags by id. */
  private renderedLootBags = new Map<
    string,
    { graphics: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; x: number; y: number }
  >();
  /** Rendered territory capture flags by point id. */
  private renderedTerritory = new Map<
    string,
    { flag: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }
  >();
  /** Castle Siege King Crystal (Black zone). */
  private crystalGfx: Phaser.GameObjects.Graphics | null = null;
  private crystalLabel: Phaser.GameObjects.Text | null = null;
  private siegeState: SiegeStatePayload | null = null;
  /** Local player's mount speed multiplier, mirrored for client prediction. */
  private localSpeedMult = 1;
  private chopKey: Phaser.Input.Keyboard.Key | null = null;
  private fishKey: Phaser.Input.Keyboard.Key | null = null;
  private lastSentInput = { dx: 0, dy: 0 };
  private currentZoneId: string | null = null;
  private localChoppingUntil = 0;
  private lastFootstepAt = 0;
  private chopHitTimer: Phaser.Time.TimerEvent | null = null;
  private cameraFollowSprite: Phaser.GameObjects.Sprite | null = null;
  private dayNightOverlay: Phaser.GameObjects.Rectangle | null = null;
  private lampKey: Phaser.Input.Keyboard.Key | null = null;
  private localLampGlow: Phaser.GameObjects.Image | null = null;
  private interactHint: Phaser.GameObjects.Text | null = null;
  private cameraZoom = readStoredZoom();
  private lastPinchDist = 0;
  private weatherOverlay: Phaser.GameObjects.Rectangle | null = null;
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private rainZone = new Phaser.Geom.Rectangle(0, 0, 100, 8);
  private weatherRain = 0; // eased current rain density
  private weatherAlpha = 0; // eased current overlay opacity
  private nextLightningAt = 0;

  constructor() {
    super("GameScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#b8e8fc");
    this.cameras.main.setZoom(this.cameraZoom);
    this.cameras.main.roundPixels = true;
    this.cameras.main.useBounds = false;

    // Camera zoom: mouse wheel (desktop) + two-finger pinch (touch). Pinch is
    // handled in update(); a second pointer must be enabled for it.
    this.input.addPointer(1);
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.adjustZoom(dy < 0 ? 0.15 : -0.15);
    });

    // Mouse combat: left-click selects the hostile under the cursor (target
    // reticle), right-click attacks. WASD movement is unchanged. Suppress the
    // browser context menu so right-click reads as an attack.
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // In build-edit mode, taps place/paint/erase instead of moving.
      if (this.worldEditing) {
        this.handleEditTap(pointer);
        return;
      }
      if (pointer.rightButtonDown()) {
        this.pointerAttackQueued = true;
        return;
      }
      // Primary button / touch: select a hostile (mob or player) under the
      // cursor, else walk there.
      if (pointer.leftButtonDown() || pointer.wasTouch) {
        const hitHostile = this.selectNpcAtPointer(pointer);
        if (hitHostile) {
          this.selectedPlayerName = null;
          useGameStore.getState().setSelectedPlayer(null);
        } else if (this.selectPlayerAtPointer(pointer)) {
          // Targeted a player for PvP.
        } else if (this.tryClickCrystal(pointer)) {
          // Struck the King Crystal during a siege.
        } else {
          this.setMoveTarget(pointer.worldX, pointer.worldY);
        }
      }
    });

    // Targeting reticle drawn over the currently selected / engaged hostile.
    this.targetReticle = this.add.graphics().setDepth(120).setVisible(false);
    // Click-to-move destination marker.
    this.moveMarker = this.add.graphics().setDepth(119).setVisible(false);

    // Day/night lighting tint. A rectangle pinned over the visible world each
    // frame (origin top-left); colour + opacity come from the shared clock.
    this.dayNightOverlay = this.add
      .rectangle(0, 0, 10, 10, 0x0a1538, 0)
      .setOrigin(0, 0)
      .setDepth(99_999);

    // Soft radial texture used for hand-lamp glows (drawn additively over night).
    this.ensureGlowTexture();

    // Contextual "press E to ..." prompt floating over the nearest interactable.
    this.interactHint = this.add
      .text(0, 0, "", {
        fontFamily: "Nunito, sans-serif",
        fontSize: "13px",
        fontStyle: "700",
        color: "#fff7ea",
        // Transparent background — use a dark outline + shadow for legibility.
        stroke: "#3b2c1e",
        strokeThickness: 4,
      })
      .setShadow(0, 2, "#000000", 3, true, true)
      .setOrigin(0.5, 1)
      .setDepth(101_000)
      .setVisible(false);

    // Weather: a tint overlay (fog/cloud/rain darkening) plus a rain emitter.
    this.weatherOverlay = this.add
      .rectangle(0, 0, 10, 10, 0x5a6b85, 0)
      .setOrigin(0, 0)
      .setDepth(99_998);
    this.ensureRaindropTexture();
    this.rainEmitter = this.add
      .particles(0, 0, "raindrop", {
        lifespan: 950,
        speedY: { min: 720, max: 980 },
        speedX: { min: -130, max: -70 },
        scaleY: { min: 0.7, max: 1.35 },
        scaleX: 1,
        alpha: { min: 0.22, max: 0.5 },
        quantity: 2,
        frequency: 26,
        emitZone: { type: "random", source: this.rainZone, quantity: 1 },
      })
      .setDepth(100_002);
    this.rainEmitter.stop();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleViewportResize, this);
    this.scale.refresh();
    this.handleViewportResize();
    // Re-sync once layout has settled, in case the canvas mounted before the
    // container reached its final size.
    this.time.delayedCall(60, () => this.handleViewportResize());

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D") as GameScene["wasd"];
      this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.chopKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.fishKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
      this.lampKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    }

    const unsubscribePlayers = networkManager.onPlayersChange((players, sessionId) => {
      this.localSessionId = sessionId ?? networkManager.sessionId;
      this.syncPlayers(players);
      this.bindCameraToLocalPlayer();
    });

    const unsubscribeZone = networkManager.onZoneChange((zoneId) => {
      this.lastSentInput = { dx: 0, dy: 0 };
      networkManager.sendInput(0, 0);
      this.localSessionId = null;
      this.localChoppingUntil = 0;
      this.selectedNpcId = null;
      this.selectedPlayerName = null;
      useGameStore.getState().setSelectedPlayer(null);
      this.targetReticle?.setVisible(false);
      this.clearMoveTarget();
      this.clearLootBags();
      this.clearTerritory();
      this.clearCrystal();
      this.siegeState = null;
      this.stopLocalChopHits();
      this.destroyLocalAvatar();
      this.renderedPlayers.forEach((entry) => {
        entry.sprite.destroy();
        entry.label.destroy();
        entry.glow?.destroy();
      });
      this.renderedPlayers.clear();
      // The server resets each player's lamp to off on (re)join, so mirror that.
      useGameStore.getState().setLampOn(false);
      this.localLampGlow?.setVisible(false);
      this.renderZone(zoneId);
      playSfx("zone_enter");
    });

    const unsubscribeZoneConfig = networkManager.onZoneConfigUpdate((zoneId) => {
      // Don't clobber an in-progress local edit with the server's echo.
      if (!this.worldEditing) this.refreshZoneContent(zoneId);
    });

    const unsubscribeMobHealth = networkManager.onMobHealth((payload) => {
      this.updateNpcHealth(payload.npcId, payload.currentHp, payload.maxHp);
    });

    const unsubscribeNpcPositions = networkManager.onNpcPositions((payload) => {
      for (const update of payload) {
        const npc = this.renderedNpcs.find((n) => n.id === update.npcId);
        if (npc) {
          npc.targetX = update.x;
          npc.targetY = update.y;
        }
      }
    });

    const unsubscribeAttackResult = networkManager.onAttackResult((payload) => {
      this.showMobDamageNumber(payload.npcId, payload.damage, payload.crit ?? false);
      const localAttacker = payload.attackerName === useGameStore.getState().playerName;
      if (payload.defeated) {
        playSfx("attack_defeat");
        // Satisfying punch on a kill landed by the local player.
        if (localAttacker) this.cameras.main.shake(140, 0.005);
      } else {
        playSfx("attack_hit");
        if (localAttacker && payload.crit) this.cameras.main.shake(90, 0.004);
      }

      // Red damage flash on Mob
      const npc = this.renderedNpcs.find((entry) => entry.id === payload.npcId);
      if (npc) {
        npc.sprite.setTint(0xff4444);
        this.time.delayedCall(150, () => npc.sprite.clearTint());
      }

      // Trigger attack action on remote attacker
      if (payload.attackerName && payload.attackerName !== useGameStore.getState().playerName) {
        const remote = this.renderedPlayers.get(payload.attackerName);
        if (remote && npc) {
          const direction = directionTowardTarget(
            remote.sprite.x,
            remote.sprite.y,
            npc.worldX,
            npc.worldY,
            remote.direction,
          );
          this.setPlayerAction(remote, "attack", direction, 350);
        }
      }

      // Spawn slash arc VFX
      let attackerX = 0;
      let attackerY = 0;
      if (payload.attackerName === useGameStore.getState().playerName) {
        if (this.localAvatar) {
          attackerX = this.localAvatar.sprite.x;
          attackerY = this.localAvatar.sprite.y;
        }
      } else if (payload.attackerName) {
        const remote = this.renderedPlayers.get(payload.attackerName);
        if (remote) {
          attackerX = remote.sprite.x;
          attackerY = remote.sprite.y;
        }
      }

      if (npc && attackerX && attackerY) {
        const angle = Phaser.Math.Angle.Between(attackerX, attackerY, npc.worldX, npc.worldY);
        const midX = (attackerX + npc.worldX) / 2;
        const midY = (attackerY + npc.worldY) / 2 - 10;
        this.spawnSlashArc(midX, midY, angle);
      }
    });

    const unsubscribePlayerDamage = networkManager.onPlayerDamage((payload) => {
      this.showPlayerDamageNumber(payload.amount);
      playSfx("player_hurt");
      // Camera shake scales with the size of the hit taken.
      this.cameras.main.shake(110, Math.min(0.008, 0.002 + payload.amount * 0.00012));

      // Red damage flash on local player
      if (this.localAvatar) {
        this.localAvatar.sprite.setTint(0xff4444);
        this.time.delayedCall(150, () => {
          this.applyKnockedOutVisuals();
        });
      }
    });

    const unsubscribeLootBags = networkManager.onLootBags((payload) => {
      this.syncLootBags(payload.bags);
    });

    const unsubscribeAdServing = networkManager.onAdServing((payload) => {
      this.latestAdServing = payload.creatives;
      if (this.currentZoneId) this.renderAdBillboards(this.currentZoneId);
    });
    networkManager.requestAdServing();

    const unsubscribeTerritory = networkManager.onTerritoryState((payload) => {
      this.syncTerritory(payload.points);
    });

    const unsubscribeSiege = networkManager.onSiegeState((payload) => {
      this.syncCrystal(payload);
    });

    const unsubscribePvpHit = networkManager.onPvpHit((payload) => {
      // Floating damage number over the victim + slash FX between the fighters.
      const victim = this.findRenderedPlayerByName(payload.victimName);
      if (victim) {
        this.showWorldDamageNumber(victim.sprite.x, victim.sprite.y - 44, payload.damage, payload.crit);
        victim.sprite.setTint(0xff4444);
        this.time.delayedCall(150, () => victim.sprite.clearTint());
      }
      const attacker = this.findRenderedPlayerByName(payload.attackerName);
      if (attacker && victim) {
        const angle = Phaser.Math.Angle.Between(attacker.sprite.x, attacker.sprite.y, victim.sprite.x, victim.sprite.y);
        this.spawnSlashArc((attacker.sprite.x + victim.sprite.x) / 2, (attacker.sprite.y + victim.sprite.y) / 2 - 10, angle);
      }
      const localName = useGameStore.getState().playerName;
      if (payload.attackerName === localName && payload.knockedOut) {
        this.cameras.main.shake(140, 0.005);
      }
    });

    const unsubscribeFarmState = networkManager.onFarmState((payload) => {
      this.applyFarmState(payload);
    });

    const unsubscribeHousingState = networkManager.onHousingState((payload) => {
      this.applyHousingState(payload);
    });

    const unsubscribeEmote = networkManager.onEmote((payload) => {
      const emote = getEmote(payload.emoteId);
      if (emote) this.showEmote(payload.playerName, emote.emoji);
    });

    const unsubscribeWorldStats = networkManager.onWorldStats((payload) => {
      this.applyWorldStats(payload);
    });

    const unsubscribeFarmResult = networkManager.onFarmResult((payload) => {
      const isLocal = payload.playerName === useGameStore.getState().playerName;
      if (!payload.ok) {
        if (isLocal) playSfx("shop_fail");
        return;
      }
      if (isLocal) {
        playSfx(payload.action === "harvest" ? "harvest" : "plant");
      }
    });

    const unsubscribeResourceHealth = networkManager.onResourceHealth((payload) => {
      this.applyResourceState(payload);
    });

    const unsubscribeChopStart = networkManager.onChopStart((payload) => {
      this.applyResourceState({
        resourceId: payload.resourceId,
        available: true,
        chopperName: payload.playerName,
        chopStartedAt: payload.startedAt,
        chopEndsAt: payload.endsAt,
        chopDurationMs: payload.durationMs,
      });
      this.startChopAnimation(payload.playerName, payload.resourceId, payload.endsAt);
      const kind = this.resourceKind(payload.resourceId);
      playSfx(kind === "rock" ? "mine_hit" : kind === "fish" ? "fish_cast" : "chop_swing");
      if (payload.playerName === useGameStore.getState().playerName) {
        this.startLocalChopHits(payload.endsAt, kind);
      }
    });

    const unsubscribeChopCancel = networkManager.onChopCancel((payload) => {
      const resource = this.renderedResources.find((entry) => entry.id === payload.resourceId);
      this.applyResourceState({
        resourceId: payload.resourceId,
        available: resource?.available ?? true,
        chopperName: undefined,
        chopStartedAt: undefined,
        chopEndsAt: undefined,
        chopDurationMs: undefined,
      });
      if (payload.playerName === useGameStore.getState().playerName) {
        this.localChoppingUntil = 0;
        this.stopLocalChopHits();
        const local = this.findLocalPlayer();
        if (local) {
          local.actionUntil = 0;
          local.displayAction = "idle";
          local.poseStartedAt = Date.now();
        }
        playSfx("shop_fail");
      }
    });

    const unsubscribeChopResult = networkManager.onChopResult((payload) => {
      this.applyResourceState({
        resourceId: payload.resourceId,
        available: payload.available,
        chopperName: undefined,
        chopStartedAt: undefined,
        chopEndsAt: undefined,
        chopDurationMs: undefined,
      });
      if (payload.ok === false) {
        playSfx("shop_fail");
        return;
      }
      const isLocalChopper = payload.playerName === useGameStore.getState().playerName;
      if (isLocalChopper) {
        this.localChoppingUntil = 0;
        this.stopLocalChopHits();
        playSfx(
          payload.skill === "mining"
            ? "ore_gather"
            : payload.skill === "fishing"
              ? "fish_catch"
              : "wood_gather",
        );
      }
      if (payload.depleted) {
        playSfx("chop_fell");
      }
    });

    this.renderZone(networkManager.zoneId);
    this.bootstrapFromNetwork();
    notifyGameSceneReady();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleViewportResize, this);
      unsubscribePlayers();
      unsubscribeZone();
      unsubscribeZoneConfig();
      unsubscribeMobHealth();
      unsubscribeNpcPositions();
      unsubscribeAttackResult();
      unsubscribePlayerDamage();
      unsubscribeResourceHealth();
      unsubscribeChopStart();
      unsubscribeChopCancel();
      unsubscribeChopResult();
      unsubscribeFarmState();
      unsubscribeFarmResult();
      unsubscribeHousingState();
      unsubscribeEmote();
      unsubscribeWorldStats();
      unsubscribeLootBags();
      unsubscribeAdServing();
      unsubscribePvpHit();
      unsubscribeTerritory();
      unsubscribeSiege();
      this.stopLocalChopHits();
      this.clearLootBags();
      this.clearTerritory();
      this.clearCrystal();
      this.clearMap();
      this.clearNpcs();
      this.clearResources();
      this.clearFarmPlots();
      this.clearLandPlots();
      this.clearBillboards();
      this.clearAdBillboards();
      this.clearScenery();
      this.destroyLocalAvatar();
      this.renderedPlayers.forEach((entry) => {
        entry.sprite.destroy();
        entry.label.destroy();
      });
      this.renderedPlayers.clear();
    });
  }

  update(_time: number, delta: number) {
    const chopping = Date.now() < this.localChoppingUntil;
    const blocked = isUiTypingActive() || useGameStore.getState().knockedOut || chopping;

    if (blocked && (this.lastSentInput.dx !== 0 || this.lastSentInput.dy !== 0)) {
      networkManager.sendInput(0, 0);
      this.lastSentInput = { dx: 0, dy: 0 };
    }

    if (!blocked) {
      let dx = this.getAxisInput();
      let dy = this.getAxisInputY();

      if (dx !== 0 || dy !== 0) {
        // Manual movement (WASD / arrows / touch D-pad) cancels click-to-move.
        this.clearMoveTarget();
      } else {
        const moveAxis = this.getMoveTargetAxis();
        if (moveAxis) {
          dx = moveAxis.dx;
          dy = moveAxis.dy;
        }
      }

      if (dx !== this.lastSentInput.dx || dy !== this.lastSentInput.dy) {
        networkManager.sendInput(dx, dy);
        this.lastSentInput = { dx, dy };
      }

      this.applyLocalPrediction(dx, dy, delta);

      if (dx !== 0 || dy !== 0) {
        const now = Date.now();
        if (now - this.lastFootstepAt > 330) {
          this.lastFootstepAt = now;
          playSfx("footstep");
        }
      }

      this.interpolateRemotePlayers();
      this.tryInteract();
      this.tryAttack();
      this.tryChop();
      this.tryFish();
    }

    if (!this.localSessionId && networkManager.sessionId) {
      this.localSessionId = networkManager.sessionId;
    }

    if (networkManager.isConnected) {
      this.syncLocalPlayerFromNetwork();
      this.sweepStrayAvatarSprites();
    }

    if (
      this.lampKey &&
      Phaser.Input.Keyboard.JustDown(this.lampKey) &&
      !isUiTypingActive()
    ) {
      this.toggleLamp();
    }

    this.bindCameraToLocalPlayer();
    this.applyKnockedOutVisuals();
    this.redrawActiveChopBars();
    this.updateFarmPlots();
    this.updatePlayerAnimations();
    this.updateDayNight();
    this.updateLamps();
    this.updateSceneryLights();
    this.updateWaterShimmer();
    this.updateWeather();
    this.updateInteractHint();
    this.updateTargetReticle();
    this.updateNpcMovement();
    this.updatePinchZoom();
  }

  /** Two-finger pinch zoom for touch devices. */
  private updatePinchZoom() {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1?.isDown && p2?.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.lastPinchDist > 0) {
        this.adjustZoom((dist - this.lastPinchDist) * 0.004);
      }
      this.lastPinchDist = dist;
    } else {
      this.lastPinchDist = 0;
    }
  }

  /** Nudge the camera zoom within bounds and remember the choice. */
  private adjustZoom(delta: number) {
    const next = Phaser.Math.Clamp(this.cameraZoom + delta, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(next - this.cameraZoom) < 0.001) return;
    this.cameraZoom = next;
    this.cameras.main.setZoom(next);
    try {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, next.toFixed(2));
    } catch {
      /* ignore storage errors */
    }
  }

  /** Set an absolute zoom level (used by the HUD zoom buttons). */
  setZoomLevel(zoom: number) {
    this.adjustZoom(zoom - this.cameraZoom);
  }

  getZoomLevel(): number {
    return this.cameraZoom;
  }

  /** Float a "press E to …" prompt over the nearest interactable (matches tryInteract's priority). */
  private updateInteractHint() {
    const hint = this.interactHint;
    if (!hint) return;

    const store = useGameStore.getState();
    const local = this.findLocalPlayer();
    const panelOpen =
      store.shopOpen || store.housingOpen || store.playerShopOpen || store.inventoryOpen || store.craftOpen;
    if (!local || store.knockedOut || isUiTypingActive() || panelOpen) {
      hint.setVisible(false);
      return;
    }

    const px = local.predicted.x;
    const py = local.predicted.y;
    let target: { x: number; y: number; label: string } | null = null;

    // Farm plots take priority (plant/harvest).
    let bestFarm: RenderedFarmPlot | null = null;
    let bestFarmD = FARM_RANGE;
    for (const plot of this.renderedFarmPlots.values()) {
      const d = Math.hypot(px - plot.worldX, py - plot.worldY);
      if (d <= bestFarmD) {
        bestFarm = plot;
        bestFarmD = d;
      }
    }
    if (bestFarm) {
      const verb = bestFarm.stage === "ready" ? "Harvest" : bestFarm.stage === "growing" ? null : "Plant seed";
      if (verb) target = { x: bestFarm.worldX, y: bestFarm.worldY - 36, label: verb };
    }

    // Then land plots (buy / manage / visit).
    if (!target) {
      let bestLand: RenderedLandPlot | null = null;
      let bestLandD = HOUSE_RANGE;
      for (const land of this.renderedLandPlots.values()) {
        const d = Math.hypot(px - land.worldX, py - land.worldY);
        if (d <= bestLandD) {
          bestLand = land;
          bestLandD = d;
        }
      }
      if (bestLand) {
        const state = networkManager.getHousingState().plots.find((p) => p.plotId === bestLand!.id);
        const mine = state?.ownerName === store.playerName;
        let label = "Buy this plot";
        if (state && state.structure === "shop") label = mine ? "Manage your shop" : "Browse shop";
        else if (state && state.structure === "house") label = mine ? "Manage your house" : `${state.ownerName}'s house`;
        target = { x: bestLand.worldX, y: bestLand.worldY - 52, label };
      }
    }

    // Interactable scenery (arcade / blackjack).
    if (!target) {
      let bestProp: { worldX: number; worldY: number; label: string } | null = null;
      let bestPropD = NPC_INTERACT_RANGE;
      for (const prop of this.interactableScenery) {
        const d = Math.hypot(px - prop.worldX, py - prop.worldY);
        if (d <= bestPropD) {
          bestProp = prop;
          bestPropD = d;
        }
      }
      if (bestProp) target = { x: bestProp.worldX, y: bestProp.worldY - 44, label: bestProp.label };
    }

    // Finally talkable NPCs (skip mobs — those are attacked, not interacted).
    if (!target) {
      let bestNpc: RenderedNpc | null = null;
      let bestNpcD = NPC_INTERACT_RANGE;
      for (const npc of this.renderedNpcs) {
        if (npc.combat) continue;
        const d = Math.hypot(px - npc.worldX, py - npc.worldY);
        if (d <= bestNpcD) {
          bestNpc = npc;
          bestNpcD = d;
        }
      }
      if (bestNpc) {
        const config = resolveZoneConfig(this.currentZoneId ?? networkManager.zoneId);
        const npcDef = config.npcs.find((n) => n.id === bestNpc!.id);
        const name = bestNpc.label.text || "them";
        const label = npcDef?.shopId ? `Shop with ${name}` : `Talk to ${name}`;
        target = { x: bestNpc.worldX, y: bestNpc.headTopY - 8, label };
      }
    }

    if (!target) {
      hint.setVisible(false);
      return;
    }

    const cue = this.sys.game.device.input.touch ? "✨" : "E";
    hint.setText(`${cue} · ${target.label}`);
    hint.setPosition(Math.round(target.x), Math.round(target.y));
    hint.setVisible(true);
  }

  /** A soft elliptical contact shadow, drawn once and reused under entities. */
  private ensureContactShadowTexture() {
    if (this.textures.exists("contact_shadow")) return;
    const w = 64;
    const h = 30;
    const tex = this.textures.createCanvas("contact_shadow", w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w); // squash the circle into a ground ellipse
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    grad.addColorStop(0, "rgba(18,11,6,0.42)");
    grad.addColorStop(0.55, "rgba(18,11,6,0.26)");
    grad.addColorStop(1, "rgba(18,11,6,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    tex.refresh();
  }

  /** A soft cyan-white glint reused as drifting highlights on water. */
  private ensureWaterShimmerTexture() {
    if (this.textures.exists("water_shimmer")) return;
    const w = 32;
    const h = 14;
    const tex = this.textures.createCanvas("water_shimmer", w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    grad.addColorStop(0, "rgba(226, 246, 255, 0.9)");
    grad.addColorStop(0.5, "rgba(190, 232, 255, 0.4)");
    grad.addColorStop(1, "rgba(190, 232, 255, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    tex.refresh();
  }

  private ensureRaindropTexture() {
    if (this.textures.exists("raindrop")) return;
    const w = 3;
    const h = 18;
    const tex = this.textures.createCanvas("raindrop", w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(200, 222, 255, 0)");
    grad.addColorStop(0.5, "rgba(200, 222, 255, 0.85)");
    grad.addColorStop(1, "rgba(225, 240, 255, 0.95)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  }

  /** Drive the weather tint + rain emitter from the shared deterministic clock. */
  private updateWeather() {
    const overlay = this.weatherOverlay;
    const emitter = this.rainEmitter;
    if (!overlay || !emitter) return;

    const indoors = this.currentZoneId === ZONE_INTERIOR;
    const weather = getWeather();
    const targetRain = indoors ? 0 : weather.rain;
    const targetAlpha = indoors ? 0 : weather.overlayAlpha;

    // Ease toward targets so weather fades in/out instead of popping.
    this.weatherRain += (targetRain - this.weatherRain) * 0.05;
    this.weatherAlpha += (targetAlpha - this.weatherAlpha) * 0.05;

    const view = this.cameras.main.worldView;
    overlay.setPosition(view.x, view.y);
    overlay.setSize(view.width, view.height);
    overlay.setFillStyle(weather.overlayColor, this.weatherAlpha);

    // Rain emitter: cover the top of the visible world and scale density.
    this.rainZone.setTo(view.x - 40, view.y - 50, view.width + 120, 8);
    if (this.weatherRain > 0.04) {
      emitter.setFrequency(
        Phaser.Math.Linear(70, 8, this.weatherRain),
        Math.round(Phaser.Math.Linear(1, 4, this.weatherRain)),
      );
      if (!emitter.emitting) emitter.start();
    } else if (emitter.emitting) {
      emitter.stop();
    }

    // Lightning during storms — an occasional full-screen flash.
    if (!indoors && weather.lightning && this.weatherRain > 0.5) {
      const now = Date.now();
      if (now >= this.nextLightningAt) {
        this.nextLightningAt = now + 4000 + Math.random() * 8000;
        this.cameras.main.flash(140, 210, 224, 255);
      }
    }
  }

  /** Flip the local player's lamp, sync it, and reflect it in the HUD store. */
  toggleLamp() {
    const on = !useGameStore.getState().lampOn;
    useGameStore.getState().setLampOn(on);
    networkManager.sendToggleLamp(on);
    playSfx("ui_open");
  }

  private ensureGlowTexture() {
    if (this.textures.exists("lamp-glow")) return;
    const size = 256;
    const tex = this.textures.createCanvas("lamp-glow", size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const r = size / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(255, 244, 214, 0.95)");
    grad.addColorStop(0.45, "rgba(255, 232, 170, 0.45)");
    grad.addColorStop(1, "rgba(255, 230, 160, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  private makeGlow(): Phaser.GameObjects.Image {
    const glow = this.add
      .image(0, 0, "lamp-glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(100_000)
      .setDisplaySize(LAMP_GLOW_DIAMETER, LAMP_GLOW_DIAMETER)
      .setVisible(false);
    return glow;
  }

  /**
   * Draw a warm glow under every player whose lamp is on. The glow is additive,
   * so it brightens the night overlay; its strength scales with how dark it is,
   * so a lamp is most useful at night and barely shows in daylight.
   */
  private updateLamps() {
    const darkness = getWorldTime().overlayAlpha;
    const intensity = Math.min(1, 0.14 + darkness * 1.7);

    // Local player — driven by the store for instant on/off feedback.
    const localOn = useGameStore.getState().lampOn;
    const local = this.localAvatar;
    if (localOn && local) {
      if (!this.localLampGlow) this.localLampGlow = this.makeGlow();
      this.localLampGlow.setPosition(local.sprite.x, local.sprite.y - 12).setVisible(true).setAlpha(intensity);
    } else if (this.localLampGlow) {
      this.localLampGlow.setVisible(false);
    }

    // Remote players — driven by their synced lampOn state.
    for (const rendered of this.renderedPlayers.values()) {
      if (rendered.lampOn) {
        if (!rendered.glow) rendered.glow = this.makeGlow();
        rendered.glow.setPosition(rendered.sprite.x, rendered.sprite.y - 12).setVisible(true).setAlpha(intensity);
      } else if (rendered.glow) {
        rendered.glow.setVisible(false);
      }
    }

    // Building lights — a warm window glow on plots whose light is on.
    for (const plot of this.renderedLandPlots.values()) {
      if (plot.lightOn) {
        if (!plot.glow) plot.glow = this.makeGlow().setDisplaySize(LAMP_GLOW_DIAMETER * 1.25, LAMP_GLOW_DIAMETER * 1.25);
        plot.glow.setPosition(plot.worldX, plot.worldY - 28).setVisible(true).setAlpha(Math.min(1, 0.18 + darkness * 1.6));
      } else if (plot.glow) {
        plot.glow.setVisible(false);
      }
    }
  }

  /** Pin the lighting overlay over the visible world and tint it for the time of day. */
  private updateDayNight() {
    const overlay = this.dayNightOverlay;
    if (!overlay) return;

    const view = this.cameras.main.worldView;
    overlay.setPosition(view.x, view.y);
    overlay.setSize(view.width, view.height);

    const time = getWorldTime();
    overlay.setFillStyle(time.overlayColor, time.overlayAlpha);
  }

  private findLocalPlayer(): RenderedPlayer | null {
    return this.localAvatar;
  }

  private destroyLocalAvatar() {
    if (!this.localAvatar) return;
    if (this.cameraFollowSprite === this.localAvatar.sprite) {
      this.cameras.main.stopFollow();
      this.cameraFollowSprite = null;
    }
    this.localAvatar.sprite.destroy();
    this.localAvatar.label.destroy();
    this.localAvatar.glow?.destroy();
    this.localAvatar.shadow.destroy();
    this.localAvatar.pet?.destroy();
    this.localAvatar = null;
  }

  private bootstrapFromNetwork() {
    if (!networkManager.isConnected) return;

    this.localSessionId = networkManager.sessionId;
    this.syncPlayers(networkManager.getRemotePlayers());
    this.bindCameraToLocalPlayer();
  }

  private handleViewportResize(gameSize?: Phaser.Structs.Size) {
    const cam = this.cameras.main;
    // Use the size carried by the RESIZE event — this.scale.width can lag
    // behind during the event, leaving the camera viewport too small and
    // throwing off the centering math.
    const width = gameSize?.width ?? this.scale.width;
    const height = gameSize?.height ?? this.scale.height;
    if (width > 0 && height > 0) {
      cam.setSize(width, height);
    }
    this.bindCameraToLocalPlayer();
  }

  private bindCameraToLocalPlayer() {
    const cam = this.cameras.main;

    // Keep the camera viewport matched to the live canvas size every frame so
    // the follow/centering math can never use a stale (too-small) width/height,
    // which is what pushed the player into a corner.
    const gw = this.scale.gameSize.width;
    const gh = this.scale.gameSize.height;
    if (gw > 0 && gh > 0 && (cam.width !== gw || cam.height !== gh)) {
      cam.setSize(gw, gh);
    }

    const local = this.findLocalPlayer();

    if (local) {
      // Use Phaser's built-in follow — it recenters every render with the
      // current viewport, so the player stays centered through resizes and
      // movement. Offset lifts the focus to the torso (origin is at the feet).
      if (this.cameraFollowSprite !== local.sprite) {
        this.cameraFollowSprite = local.sprite;
        cam.startFollow(local.sprite, true, 0.25, 0.25);
        cam.setFollowOffset(0, 18);
      }
      return;
    }

    if (this.cameraFollowSprite) {
      cam.stopFollow();
      this.cameraFollowSprite = null;
    }

    const zoneId = this.currentZoneId ?? networkManager.zoneId;
    if (!zoneId) return;

    const config = resolveZoneConfig(zoneId);
    const spawn = tileToWorld(config.spawnTile.x, config.spawnTile.y);
    this.centerCameraOn(spawn.x, spawn.y);
  }

  private centerCameraOn(worldX: number, worldY: number) {
    const cam = this.cameras.main;
    if (cam.width <= 0 || cam.height <= 0) return;

    const halfW = cam.width / cam.zoom / 2;
    const halfH = cam.height / cam.zoom / 2;
    cam.setScroll(Math.round(worldX - halfW), Math.round(worldY - halfH));
  }

  private syncLocalPlayerFromNetwork() {
    const localFromState = networkManager.getLocalPlayerFromState();
    if (localFromState) {
      this.upsertLocalPlayer(localFromState);
      return;
    }

    const sessionId = networkManager.sessionId;
    const playerName = useGameStore.getState().playerName;
    const appearance = useGameStore.getState().characterAppearance;
    if (!sessionId || !playerName || !appearance || this.findLocalPlayer()) return;

    const zoneId = this.currentZoneId ?? networkManager.zoneId;
    const config = resolveZoneConfig(zoneId);
    const spawn = tileToWorld(config.spawnTile.x, config.spawnTile.y);

    this.upsertLocalPlayer({
      sessionId,
      name: playerName,
      x: spawn.x,
      y: spawn.y,
      level: useGameStore.getState().playerLevel,
      xp: useGameStore.getState().playerXp,
      guildTag: "",
      lampOn: useGameStore.getState().lampOn,
      appearance: normalizeCharacterAppearance(appearance),
      spectator: useGameStore.getState().spectator,
      pvpFlagged: false,
      criminal: false,
      speedMult: 1,
      petId: useGameStore.getState().equipment?.slots.find((s) => s.slot === "pet")?.itemId ?? "",
    });
  }

  private upsertLocalPlayer(player: RemotePlayer) {
    const sessionId = networkManager.sessionId ?? player.sessionId;
    this.localSessionId = sessionId;
    this.localSpeedMult = player.speedMult || 1;

    if (this.localAvatar) {
      const existing = this.localAvatar;
      existing.name = player.name;
      existing.lastTargetX = existing.targetX;
      existing.lastTargetY = existing.targetY;
      existing.targetX = player.x;
      existing.targetY = player.y;
      existing.appearance = player.appearance;
      existing.label.setText(nameplateText(player));

      const moving = this.lastSentInput.dx !== 0 || this.lastSentInput.dy !== 0;
      existing.predicted = moving
        ? reconcilePrediction(existing.predicted, { x: player.x, y: player.y })
        : { x: player.x, y: player.y };
      this.applyPet(existing, player.petId);
      return;
    }

    this.destroyAllLocalPlayerEntries();
    this.localAvatar = this.createRenderedPlayerEntry(player, true);
    this.applyPet(this.localAvatar, player.petId);
  }

  private destroyRenderedPlayer(sessionId: string, rendered: RenderedPlayer) {
    rendered.sprite.destroy();
    rendered.label.destroy();
    rendered.glow?.destroy();
    rendered.shadow.destroy();
    rendered.pet?.destroy();
    this.renderedPlayers.delete(sessionId);
  }

  private destroyAllLocalPlayerEntries() {
    this.destroyLocalAvatar();
    const playerName = useGameStore.getState().playerName;
    for (const [sessionId, rendered] of [...this.renderedPlayers.entries()]) {
      if (rendered.label.text === playerName || sessionId === networkManager.sessionId) {
        this.destroyRenderedPlayer(sessionId, rendered);
      }
    }
  }

  private isPlayerAvatarSprite(sprite: Phaser.GameObjects.Sprite): boolean {
    const key = sprite.texture.key;
    return key === "player" || key.startsWith("player-v");
  }

  private sweepStrayAvatarSprites() {
    const trackedSprites = new Set<Phaser.GameObjects.Sprite>();
    const trackedLabels = new Set<Phaser.GameObjects.Text>();

    if (this.localAvatar?.sprite.active) {
      trackedSprites.add(this.localAvatar.sprite);
      trackedLabels.add(this.localAvatar.label);
    }

    for (const rendered of this.renderedPlayers.values()) {
      if (!rendered.sprite.active) continue;
      trackedSprites.add(rendered.sprite);
      trackedLabels.add(rendered.label);
    }

    for (const child of this.children.list) {
      if (
        child instanceof Phaser.GameObjects.Sprite &&
        child.depth === 1000 &&
        !trackedSprites.has(child) &&
        this.isPlayerAvatarSprite(child)
      ) {
        child.destroy();
      }

      if (child instanceof Phaser.GameObjects.Text && child.depth === 1001 && !trackedLabels.has(child)) {
        child.destroy();
      }
    }
  }

  private createRenderedPlayerEntry(player: RemotePlayer, isLocal: boolean): RenderedPlayer {
    this.ensureContactShadowTexture();
    const shadow = this.add
      .image(player.x, player.y + 4, "contact_shadow")
      .setDisplaySize(30, 14)
      .setDepth(player.y - 0.5);

    const sprite = this.add.sprite(player.x, player.y, "player");
    sprite.setOrigin(0.5, 0.93);
    sprite.setDisplaySize(AVATAR_LOGICAL_WIDTH, AVATAR_LOGICAL_HEIGHT);
    sprite.setDepth(1000);

    const label = this.add
      .text(player.x, player.y - 42, nameplateText(player), {
        fontFamily: '"Fredoka", "Nunito", sans-serif',
        fontSize: "12px",
        fontStyle: "bold",
        color: isLocal ? "#ffd24a" : "#ffffff",
        stroke: "#2a1d12",
        strokeThickness: 4.5,
      })
      .setOrigin(0.5, 1)
      .setDepth(1001);

    let lastTextureKey = "player";
    try {
      lastTextureKey = setAvatarPose(this, sprite, player.appearance, "front", "idle", 0);
    } catch (error) {
      console.warn("Failed to apply avatar pose, using fallback sprite.", error);
      sprite.setTexture("player");
    }

    if (player.spectator) {
      sprite.setAlpha(0.5);
      shadow.setAlpha(0.2);
      label.setAlpha(0.7);
    }

    return {
      name: player.name,
      sprite,
      label,
      appearance: player.appearance,
      direction: "front",
      action: "idle",
      actionUntil: 0,
      actionDirection: "front",
      targetX: player.x,
      targetY: player.y,
      lastTargetX: player.x,
      lastTargetY: player.y,
      predicted: { x: player.x, y: player.y },
      displayDirection: "front",
      displayAction: "idle",
      poseStartedAt: Date.now(),
      lastTextureKey,
      remoteMoving: false,
      prevSpriteX: player.x,
      prevSpriteY: player.y,
      lampOn: player.lampOn,
      glow: null,
      shadow,
      baseY: player.y,
      bobPhase: Math.random() * Math.PI * 2,
      pet: null,
      petId: "",
      petX: player.x,
      petY: player.y,
    };
  }

  /** Create/replace/remove a player's companion sprite to match their petId. */
  private applyPet(entry: RenderedPlayer, petId: string) {
    if (entry.petId === petId) return;
    entry.petId = petId;
    entry.pet?.destroy();
    entry.pet = null;
    const emoji = PET_EMOJI[petId];
    if (!emoji) return;
    entry.pet = this.add
      .text(entry.petX, entry.petY, emoji, { fontSize: "18px" })
      .setOrigin(0.5, 0.9)
      .setDepth(entry.sprite.depth - 1);
  }

  /** Trail the companion a little behind/beside its owner each frame. */
  private positionPet(entry: RenderedPlayer) {
    if (!entry.pet) return;
    const targetX = entry.sprite.x - 16;
    const targetY = entry.sprite.y - 6;
    entry.petX = Phaser.Math.Linear(entry.petX, targetX, 0.18);
    entry.petY = Phaser.Math.Linear(entry.petY, targetY, 0.18);
    entry.pet.setPosition(Math.round(entry.petX), Math.round(entry.petY));
    entry.pet.setDepth(entry.sprite.depth - 1);
  }

  private renderZone(zoneId: string) {
    if (this.currentZoneId === zoneId) return;
    this.currentZoneId = zoneId;
    this.clearMap();
    this.clearNpcs();
    this.clearResources();
    this.clearFarmPlots();
    this.clearLandPlots();
    this.clearBillboards();
    this.clearAdBillboards();
    this.clearScenery();
    this.clearGroundPaint();
    this.clearPortals();
    this.clearGroundDetails();

    const ground = buildZoneMap(zoneId);
    // Player-owned zones render their whole ground from the hand-drawn PNG art
    // (grass by default + painted overrides); the built-in zones keep the crisp
    // procedural tileset untouched.
    const playerZone = isPlayerZoneId(zoneId);

    for (let y = 0; !playerZone && y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tileIndex = ground[y][x];
        const { x: worldX, y: worldY } = tileToWorld(x, y);
        const tile = this.add.image(worldX, worldY, "tileset");
        // Anchor the tile's top-face CENTER on the world point so entities
        // (placed at tileToWorld) stand centered on the tile rather than at
        // its front edge. The top face sits in the upper third of the cube
        // frame (TILE_HEIGHT/2 over TILE_HEIGHT*1.5 = 1/3).
        tile.setOrigin(0.5, 1 / 3);
        tile.setDepth(x + y);
        tile.setFrame(tileIndex);
        // Subtle per-tile grass tint variation so the ground isn't flat.
        if (tileIndex === TILE_GRASS) {
          tile.setTint(GRASS_TINTS[hash01(x * 23 + y * 71 + 7) * GRASS_TINTS.length | 0]);
        } else if (tileIndex === TILE_WATER && hash01(x * 41 + y * 17 + 3) > 0.42) {
          // Scatter drifting glints over ~half the water tiles for a live shimmer.
          this.ensureWaterShimmerTexture();
          const ox = (hash01(x * 7 + y * 13) - 0.5) * 20;
          const oy = (hash01(x * 19 + y * 5) - 0.5) * 8;
          const img = this.add
            .image(worldX + ox, worldY + oy, "water_shimmer")
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(x + y + 0.3)
            .setAlpha(0);
          this.waterShimmers.push({
            img,
            baseX: worldX + ox,
            baseY: worldY + oy,
            phase: hash01(x * 3 + y * 29) * Math.PI * 2,
            speed: 0.0014 + hash01(x * 11 + y * 7) * 0.0010,
          });
        }
        this.mapTiles.push(tile);
      }
    }

    if (!playerZone) this.renderGroundDetails(zoneId, ground);
    this.renderGroundPaint(zoneId);
    this.renderNpcs(zoneId);
    this.renderResources(zoneId);
    this.renderFarmPlots(zoneId);
    this.renderLandPlots(zoneId);
    this.renderBillboards(zoneId);
    this.renderAdBillboards(zoneId);
    networkManager.requestAdServing(); // refresh served ads for this zone
    this.renderScenery(zoneId);
    this.renderPortals(zoneId);
    this.rebuildCollisionGrid(zoneId);
  }

  private renderPortals(zoneId: string) {
    const config = resolveZoneConfig(zoneId);
    for (const portal of config.portals) {
      const { x, y } = tileToWorld(portal.tileX, portal.tileY);

      // Pulsing magenta aura behind the gate (reuses the soft glow texture).
      const aura = this.add
        .image(x, y - 18, "lamp-glow")
        .setTint(0xc14fe0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(96, 96)
        .setDepth(y - 1)
        .setAlpha(0.5);
      this.tweens.add({ targets: aura, alpha: 0.85, scale: aura.scale * 1.12, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

      const sprite = this.add.sprite(x, y, "portal_gate").setOrigin(0.5, 0.84).setDepth(y);
      this.tweens.add({ targets: sprite, y: y - 3, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

      const label = this.add
        .text(x, y - 64, portal.label, {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "12px",
          fontStyle: "bold",
          color: "#f3d0ff",
          stroke: "#3a1148",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 1);

      this.renderedPortals.push(aura, sprite, label);
    }
  }

  private clearPortals() {
    this.renderedPortals.forEach((obj) => obj.destroy());
    this.renderedPortals = [];
  }

  /**
   * Scatter cosmetic props (flowers, mushrooms, pebbles…) over open grass for a
   * lusher, cozier world. Deterministic per tile, skips occupied tiles, and is
   * purely decorative (non-collidable).
   */
  private renderGroundDetails(zoneId: string, ground: number[][]) {
    const config = resolveZoneConfig(zoneId);
    const occupied = new Set<string>();
    const mark = (x: number, y: number) => occupied.add(`${x},${y}`);
    for (const n of config.npcs) mark(n.tileX, n.tileY);
    for (const r of config.resources ?? []) mark(r.tileX, r.tileY);
    for (const p of config.portals) mark(p.tileX, p.tileY);
    for (const b of config.billboards ?? []) mark(b.tileX, b.tileY);
    for (const s of config.scenery ?? []) mark(s.tileX, s.tileY);
    for (const f of config.farmPlots ?? []) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) mark(f.tileX + dx, f.tileY + dy);
    for (const l of config.landPlots ?? []) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(l.tileX + dx, l.tileY + dy);
    mark(config.spawnTile.x, config.spawnTile.y);

    const salt = zoneId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 131;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (ground[y][x] !== TILE_GRASS || occupied.has(`${x},${y}`)) continue;
        const h = hash01(salt + x * 73856 + y * 19349);
        if (h >= 0.18) continue;
        const key = GROUND_DETAILS[Math.floor(hash01(salt + x * 13 + y * 991) * GROUND_DETAILS.length)];
        const { x: wx, y: wy } = tileToWorld(x, y);
        const ox = (hash01(salt + x * 7 + y * 3) - 0.5) * 18;
        const oy = (hash01(salt + x * 5 + y * 11) - 0.5) * 10;
        const detail = this.add
          .image(Math.round(wx + ox), Math.round(wy + oy), key)
          .setOrigin(0.5, 0.86)
          .setDepth(wy + oy - 1);
        this.groundDetails.push(detail);
      }
    }
  }

  private clearGroundDetails() {
    this.groundDetails.forEach((d) => d.destroy());
    this.groundDetails = [];
  }

  private renderScenery(zoneId: string) {
    const config = resolveZoneConfig(zoneId);
    for (const node of config.scenery ?? []) {
      const { x, y } = tileToWorld(node.tileX, node.tileY);
      const flat = node.flat ?? false;
      // Player-zone props render from lazily-loaded PNG art; built-in props use
      // the procedurally-baked scenery_<prop> textures.
      // PNG art is only used in player-owned zones; built-in zones keep their
      // procedurally-baked scenery_<prop> textures untouched.
      const asset = isPlayerZoneId(zoneId) ? getZoneAsset(node.prop) : undefined;
      if (asset) {
        const key = zoneAssetTextureKey(node.prop);
        const N = asset.footprint;
        // Multi-tile buildings carry a baked N×N ground base. The placed tile is
        // the back corner; anchor the base by its centre at the footprint's
        // centre so it sits FLUSH with the ground (not raised on a pedestal), and
        // depth-sort by the front tile's world Y so the player passes behind/in
        // front correctly.
        const isBuilding = asset.category === "structure" && asset.clearsGround && N > 1;
        // Everything is anchored by its measured surface line at the tile centre
        // so it sits flush with the ground. Buildings use the footprint centre.
        let px = x;
        let py = y;
        let depth = y; // 1×1 props occlude/sort by world Y (walk behind & in front)
        if (isBuilding) {
          const front = tileToWorld(node.tileX + N - 1, node.tileY + N - 1);
          px = x; // footprint centre-x equals the back-corner tile's x in iso
          py = (y + front.y) / 2; // footprint centre
          // Sort like a prop at the footprint centre so ground in front occludes
          // the base the same way it does for a 1×1 node.
          depth = py;
        }
        const originY = asset.anchorY;
        const sprite = this.add.sprite(px, py, key).setOrigin(0.5, originY).setDepth(depth);
        const applyReady = () => {
          if (!sprite.active) return;
          sprite.setTexture(key).setScale(zoneAssetScale(this, node.prop)).setOrigin(0.5, originY).setVisible(true);
        };
        if (this.textures.exists(key)) applyReady();
        else {
          sprite.setVisible(false);
          ensureZoneAssetLoaded(this, node.prop, applyReady);
        }
        this.renderedScenery.push(sprite);
        continue;
      }
      const sprite = this.add.sprite(x, y, `scenery_${node.prop}`).setOrigin(0.5, flat ? 0.5 : 0.92);
      // Flat props (rugs) sit just above the floor tile but beneath players;
      // upright furniture depth-sorts by world Y so the player can pass in
      // front of / behind it.
      sprite.setDepth(flat ? node.tileX + node.tileY + 0.5 : y);
      this.renderedScenery.push(sprite);

      if (node.interact) {
        this.interactableScenery.push({
          id: node.id,
          worldX: x,
          worldY: y,
          label: node.interact === "blackjack" ? "Play Blackjack" : "Play Base Rush",
        });
      }

      // Light-emitting props cast a warm pool that brightens + flickers at night.
      const lightSpec: Record<string, { dy: number; size: number; type: "lamp" | "fire"; tint?: number }> = {
        lamppost: { dy: -56, size: LAMP_GLOW_DIAMETER * 0.95, type: "lamp" },
        lantern: { dy: -33, size: LAMP_GLOW_DIAMETER * 0.7, type: "lamp" },
        fireplace: { dy: -10, size: LAMP_GLOW_DIAMETER * 0.95, type: "fire", tint: 0xff8a36 },
      };
      const spec = lightSpec[node.prop];
      if (spec) {
        const glow = this.makeGlow()
          .setPosition(x, y + spec.dy)
          .setDisplaySize(spec.size, spec.size)
          .setVisible(true);
        if (spec.tint) glow.setTint(spec.tint);
        this.sceneryLights.push({ glow, type: spec.type, phase: Math.random() * Math.PI * 2 });
      }
    }
  }

  private clearScenery() {
    this.renderedScenery.forEach((sprite) => sprite.destroy());
    this.renderedScenery = [];
    this.interactableScenery = [];
    this.sceneryLights.forEach((l) => l.glow.destroy());
    this.sceneryLights = [];
  }

  /**
   * Ground for player zones: the whole floor is PNG art (grass by default, plus
   * the owner's painted overrides). For built-in zones this only paints the
   * (normally empty) tiles list, leaving the procedural tileset in charge.
   */
  private renderGroundPaint(zoneId: string) {
    this.clearGroundPaint();
    const config = resolveZoneConfig(zoneId);
    if (isPlayerZoneId(zoneId)) {
      const painted = new Map<string, string>();
      for (const t of config.tiles ?? []) painted.set(`${t.x},${t.y}`, t.type);
      // Buildings carry their own ground base — hide the default ground under
      // their footprint so a building's grass base doesn't stack on grass.
      const covered = new Set<string>();
      for (const node of config.scenery ?? []) {
        const asset = getZoneAsset(node.prop);
        if (!asset?.clearsGround) continue;
        // The placed tile is the footprint's back corner; it extends south-east.
        for (let dy = 0; dy < asset.footprint; dy++) {
          for (let dx = 0; dx < asset.footprint; dx++) covered.add(`${node.tileX + dx},${node.tileY + dy}`);
        }
      }
      for (let y = 0; y < PLAYER_ZONE_GRID; y++) {
        for (let x = 0; x < PLAYER_ZONE_GRID; x++) {
          if (covered.has(`${x},${y}`)) continue;
          this.placeGroundTile(x, y, painted.get(`${x},${y}`) ?? "grass");
        }
      }
    } else {
      for (const t of config.tiles ?? []) this.placeGroundTile(t.x, t.y, t.type);
    }
  }

  /** Place a single hand-drawn ground tile sprite at a tile coordinate. The
   *  block's top-face centre (its measured anchor) sits on the tile centre so
   *  the tiles tessellate into a clean, level floor. */
  private placeGroundTile(tileX: number, tileY: number, type: string) {
    const asset = getZoneAsset(type);
    if (!asset) return;
    const { x, y } = tileToWorld(tileX, tileY);
    const key = zoneAssetTextureKey(type);
    // Depth by world Y so the ground in FRONT of a prop/building occludes its
    // base (embedded look). The player is lifted above the ground in player
    // zones (see localPlayerDepth) so this never clips the character.
    const img = this.add.image(x, y, key).setOrigin(0.5, asset.anchorY).setDepth(y - 2);
    const applyReady = () => {
      if (!img.active) return;
      img.setTexture(key).setScale(zoneAssetScale(this, type)).setOrigin(0.5, asset.anchorY).setVisible(true);
    };
    if (this.textures.exists(key)) applyReady();
    else {
      img.setVisible(false);
      ensureZoneAssetLoaded(this, type, applyReady);
    }
    this.groundPaintSprites.push(img);
  }

  private clearGroundPaint() {
    this.groundPaintSprites.forEach((s) => s.destroy());
    this.groundPaintSprites = [];
  }

  // === Build editor (player-owned zones) ===

  /** Re-render just the config-driven layers after a server config push. */
  refreshZoneContent(zoneId: string) {
    if (this.currentZoneId !== zoneId) return;
    this.clearScenery();
    this.clearGroundPaint();
    this.clearResources();
    this.clearLandPlots();
    this.clearPortals();
    this.renderGroundPaint(zoneId);
    this.renderResources(zoneId);
    this.renderLandPlots(zoneId);
    this.renderScenery(zoneId);
    this.renderPortals(zoneId);
    this.rebuildCollisionGrid(zoneId);
  }

  beginWorldEdit(zoneId: string) {
    const cfg = resolveZoneConfig(zoneId);
    this.worldEditDraft = {
      spawnTile: { ...cfg.spawnTile },
      scenery: (cfg.scenery ?? []).map((n) => ({ ...n })),
      landPlots: (cfg.landPlots ?? []).map((n) => ({ ...n })),
      farmPlots: (cfg.farmPlots ?? []).map((n) => ({ ...n })),
      resources: (cfg.resources ?? []).map((n) => ({ ...n })),
      tiles: (cfg.tiles ?? []).map((t) => ({ ...t })),
    };
    this.worldEditing = true;
    this.worldEditZoneId = zoneId;
    this.drawEditGrid();
    this.drawSpawnMarker(this.worldEditDraft.spawnTile.x, this.worldEditDraft.spawnTile.y);
  }

  endWorldEdit() {
    this.worldEditing = false;
    this.worldEditTool = null;
    this.editGrid?.destroy();
    this.editGrid = undefined;
    this.spawnMarker?.destroy();
    this.spawnMarker = undefined;
  }

  /** Show where visitors will spawn while editing (a pin the owner can move). */
  private drawSpawnMarker(tileX: number, tileY: number) {
    const { x, y } = tileToWorld(tileX, tileY);
    if (!this.spawnMarker) {
      this.spawnMarker = this.add
        .text(x, y, "📍", { fontSize: "28px" })
        .setOrigin(0.5, 0.9)
        .setDepth(1_000_000);
    } else {
      this.spawnMarker.setPosition(x, y);
    }
  }

  setWorldEditTool(tool: EditTool | null) {
    this.worldEditTool = tool;
  }

  getWorldEditDraft(): PlayerZoneBuild {
    return this.worldEditDraft ?? emptyPlayerZoneBuild();
  }

  private handleEditTap(pointer: Phaser.Input.Pointer) {
    const { tileX, tileY } = worldToTile(pointer.worldX, pointer.worldY);
    this.applyEditAtTile(tileX, tileY);
  }

  /**
   * Place the current tool at a browser client coordinate — used when a palette
   * item is dragged out of the DOM and dropped onto the game canvas.
   */
  placeToolAtClient(clientX: number, clientY: number) {
    if (!this.worldEditing) return;
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const gx = ((clientX - rect.left) / rect.width) * this.scale.gameSize.width;
    const gy = ((clientY - rect.top) / rect.height) * this.scale.gameSize.height;
    const wp = this.cameras.main.getWorldPoint(gx, gy);
    const { tileX, tileY } = worldToTile(wp.x, wp.y);
    this.applyEditAtTile(tileX, tileY);
  }

  private applyEditAtTile(tileX: number, tileY: number) {
    const draft = this.worldEditDraft;
    const tool = this.worldEditTool;
    const zoneId = this.worldEditZoneId;
    if (!draft || !tool || !zoneId) return;
    if (tileX < 0 || tileY < 0 || tileX >= PLAYER_ZONE_GRID || tileY >= PLAYER_ZONE_GRID) return;

    let groundChanged = false;
    if (tool.type === "spawn") {
      draft.spawnTile = { x: tileX, y: tileY };
      this.drawSpawnMarker(tileX, tileY);
      return;
    } else if (tool.type === "prop") {
      const id = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const asset = getZoneAsset(tool.value);
      if (asset?.category === "resource" && asset.resourceKind) {
        // Resource assets become functional gather nodes visitors can harvest.
        draft.resources.push(makePlayerZoneResource(id, tool.value, asset.resourceKind, asset.label, tileX, tileY));
      } else {
        draft.scenery.push({ id, tileX, tileY, prop: tool.value });
      }
    } else if (tool.type === "ground") {
      const existing = draft.tiles.find((t) => t.x === tileX && t.y === tileY);
      if (existing) existing.type = tool.value;
      else draft.tiles.push({ x: tileX, y: tileY, type: tool.value });
      groundChanged = true;
    } else {
      // Erase: remove the topmost prop/resource on the tile, else clear paint.
      let removed = false;
      for (let i = draft.scenery.length - 1; i >= 0; i--) {
        if (draft.scenery[i].tileX === tileX && draft.scenery[i].tileY === tileY) {
          draft.scenery.splice(i, 1);
          removed = true;
          break;
        }
      }
      if (!removed) {
        for (let i = draft.resources.length - 1; i >= 0; i--) {
          if (draft.resources[i].tileX === tileX && draft.resources[i].tileY === tileY) {
            draft.resources.splice(i, 1);
            removed = true;
            break;
          }
        }
      }
      if (!removed) {
        const ti = draft.tiles.findIndex((t) => t.x === tileX && t.y === tileY);
        if (ti >= 0) {
          draft.tiles.splice(ti, 1);
          groundChanged = true;
        }
      }
    }
    this.applyDraftLive(groundChanged);
  }

  /** Reflect the working draft into the cached config and re-render live. */
  private applyDraftLive(groundChanged: boolean) {
    const zoneId = this.worldEditZoneId;
    const draft = this.worldEditDraft;
    if (!zoneId || !draft) return;
    const cfg = resolveZoneConfig(zoneId);
    setPlayerZoneConfig({
      ...cfg,
      scenery: draft.scenery,
      resources: draft.resources,
      landPlots: draft.landPlots,
      farmPlots: draft.farmPlots,
      tiles: draft.tiles,
    });
    this.clearScenery();
    this.renderScenery(zoneId);
    this.clearResources();
    this.renderResources(zoneId);
    // Rebuilding the full PNG ground (24x24 sprites) is only needed when a
    // ground tile actually changed — placing props leaves the floor alone.
    if (groundChanged) this.renderGroundPaint(zoneId);
  }

  /** A subtle iso grid so the owner can see where taps land while editing. */
  private drawEditGrid() {
    this.editGrid?.destroy();
    const g = this.add.graphics().setDepth(118).setAlpha(0.35);
    g.lineStyle(1, 0xffffff, 0.5);
    for (let i = 0; i <= PLAYER_ZONE_GRID; i++) {
      const a = tileToWorld(i, 0);
      const b = tileToWorld(i, PLAYER_ZONE_GRID);
      g.lineBetween(a.x, a.y, b.x, b.y);
      const c = tileToWorld(0, i);
      const d = tileToWorld(PLAYER_ZONE_GRID, i);
      g.lineBetween(c.x, c.y, d.x, d.y);
    }
    this.editGrid = g;
  }

  /**
   * Brighten the lamp/lantern/fire light pools as night falls, with a gentle
   * pulse for lamps and a livelier flicker for fire (which stays lit by day).
   */
  private updateSceneryLights() {
    if (this.sceneryLights.length === 0) return;
    const darkness = getWorldTime().overlayAlpha;
    const now = Date.now();
    for (const light of this.sceneryLights) {
      let alpha: number;
      if (light.type === "fire") {
        const flick = 0.85 + 0.15 * Math.sin(now / 90 + light.phase) + (Math.random() - 0.5) * 0.12;
        alpha = (0.32 + darkness * 1.3) * flick;
      } else {
        const flick = 0.92 + 0.08 * Math.sin(now / 420 + light.phase);
        alpha = (0.12 + darkness * 1.7) * flick;
      }
      light.glow.setAlpha(Math.max(0, Math.min(1.1, alpha)));
    }
  }

  private renderBillboards(zoneId: string) {
    const config = resolveZoneConfig(zoneId);
    for (const node of config.billboards ?? []) {
      const { x, y } = tileToWorld(node.tileX, node.tileY);
      const sprite = this.add.sprite(x, y, "billboard").setOrigin(0.5, 0.92).setDepth(y);
      const top = y - 124 * 0.92;
      const header = this.add
        .text(x, top + 24, "METRICBASE WORLD", {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "11px",
          fontStyle: "bold",
          color: "#ffffff",
          stroke: "#23456e",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(y + 1);
      const holdersLabel = this.add
        .text(x, top + 44, "$BASE HOLDERS", {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "9px",
          fontStyle: "bold",
          color: "#8a6d3b",
        })
        .setOrigin(0.5)
        .setDepth(y + 1);
      const holdersValue = this.add
        .text(x, top + 56, "—", {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "15px",
          fontStyle: "bold",
          color: "#2a1d12",
        })
        .setOrigin(0.5)
        .setDepth(y + 1);
      const onlineLabel = this.add
        .text(x, top + 72, "PLAYERS ONLINE", {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "9px",
          fontStyle: "bold",
          color: "#3f7a4a",
        })
        .setOrigin(0.5)
        .setDepth(y + 1);
      const onlineValue = this.add
        .text(x, top + 84, "—", {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "15px",
          fontStyle: "bold",
          color: "#2a1d12",
        })
        .setOrigin(0.5)
        .setDepth(y + 1);
      this.billboardHoldersText = holdersValue;
      this.billboardOnlineText = onlineValue;
      this.billboardTexts.push(sprite, header, holdersLabel, holdersValue, onlineLabel, onlineValue);
    }
    this.applyWorldStats(networkManager.getWorldStats());
  }

  private clearBillboards() {
    for (const obj of this.billboardTexts) obj.destroy();
    this.billboardTexts = [];
    this.billboardHoldersText = null;
    this.billboardOnlineText = null;
  }

  private clearAdBillboards() {
    for (const obj of this.adBillboards) obj.destroy();
    this.adBillboards = [];
  }

  /** In-world ad billboards: two signs per zone showing the current served ad. */
  private renderAdBillboards(zoneId: string) {
    this.clearAdBillboards();
    const slotId = billboardSlotForZone(zoneId);
    if (!slotId) return;
    const slot = AD_SLOTS.find((s) => s.id === slotId);
    if (!slot?.tiles) return;
    // Show this zone's own ranked ad, or fall back to the top-ranked ad so every
    // zone's billboard displays an ad whenever any campaign is serving.
    const creative =
      this.latestAdServing.find((c) => c.slotId === slotId) ?? this.latestAdServing[0] ?? null;

    for (const t of slot.tiles) {
      const { x, y } = tileToWorld(t.x, t.y);
      const sprite = this.add.sprite(x, y, "billboard").setOrigin(0.5, 0.92).setDepth(y);
      this.adBillboards.push(sprite);
      const faceY = y - 124 * 0.92 + 50; // centre of the sign board

      // "AD" tag in the corner of the frame.
      const tag = this.add
        .text(x - 52, y - 124 * 0.92 + 8, "AD", {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "9px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: "#3a2a1e",
        })
        .setPadding(3, 1, 3, 1)
        .setDepth(y + 2);
      this.adBillboards.push(tag);

      if (creative?.imageUrl) {
        this.loadAdImage(
          creative.imageUrl,
          (key) => {
            if (!sprite.active) return;
            const img = this.add.image(x, faceY, key).setDepth(y + 1);
            const scale = Math.min(118 / img.width, 64 / img.height);
            img.setScale(scale > 0 ? scale : 1);
            this.adBillboards.push(img);
          },
          () => this.addAdHeadline(x, faceY, creative.headline || "Sponsored", y),
        );
        this.makeAdClickable(sprite, creative.clickUrl);
      } else if (creative) {
        this.addAdHeadline(x, faceY, creative.headline || "Sponsored", y);
        this.makeAdClickable(sprite, creative.clickUrl);
      } else {
        this.addAdHeadline(x, faceY, "Ads here", y);
      }
    }
  }

  private addAdHeadline(x: number, y: number, text: string, depth: number) {
    const label = this.add
      .text(x, y, text, {
        fontFamily: '"Fredoka", "Nunito", sans-serif',
        fontSize: "12px",
        fontStyle: "bold",
        color: "#2a1d12",
        align: "center",
        wordWrap: { width: 120 },
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.adBillboards.push(label);
  }

  /** Load a brand image as a Phaser texture (cached), with an error fallback. */
  private loadAdImage(url: string, onLoad: (key: string) => void, onError: () => void) {
    const key = `ad_${this.hashUrl(url)}`;
    if (this.textures.exists(key)) {
      onLoad(key);
      return;
    }
    const completeEvent = `filecomplete-image-${key}`;
    const onFail = (file: Phaser.Loader.File) => {
      if (file.key !== key) return;
      this.load.off(completeEvent, onComplete);
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFail);
      onError();
    };
    const onComplete = () => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFail);
      onLoad(key);
    };
    this.load.once(completeEvent, onComplete);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFail);
    this.load.image(key, url);
    this.load.start();
  }

  private hashUrl(url: string): string {
    let h = 0;
    for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  private makeAdClickable(obj: Phaser.GameObjects.Sprite, clickUrl: string) {
    obj.setInteractive({ useHandCursor: true });
    obj.on("pointerup", () => {
      if (/^https?:\/\//i.test(clickUrl)) window.open(clickUrl, "_blank", "noopener,noreferrer");
    });
  }

  private applyWorldStats(payload: { baseHolders: number | null; online: number }) {
    this.billboardHoldersText?.setText(
      payload.baseHolders === null ? "—" : payload.baseHolders.toLocaleString(),
    );
    this.billboardOnlineText?.setText(payload.online.toLocaleString());
  }

  private renderFarmPlots(zoneId: string) {
    const config = resolveZoneConfig(zoneId);
    for (const plot of config.farmPlots ?? []) {
      // Anchor at the centre of the 2x2 footprint.
      const { x, y } = tileToWorld(plot.tileX + 0.5, plot.tileY + 0.5);
      const sprite = this.add.sprite(x, y, "plot_empty");
      sprite.setOrigin(0.5, 0.526);
      sprite.setDepth(y);
      const label = this.add
        .text(x, y - 44, "Plot", {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "10px",
          fontStyle: "bold",
          color: "#e6d6b8",
          stroke: "#2a1d12",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 3)
        .setVisible(false);
      const barBg = this.add.graphics().setDepth(y + 1);
      const barFill = this.add.graphics().setDepth(y + 2);
      this.renderedFarmPlots.set(plot.id, {
        id: plot.id,
        sprite,
        label,
        barBg,
        barFill,
        worldX: x,
        worldY: y,
        stage: "empty",
      });
    }
    this.applyFarmState(networkManager.getFarmState());
  }

  private clearFarmPlots() {
    this.renderedFarmPlots.forEach((plot) => {
      plot.sprite.destroy();
      plot.label.destroy();
      plot.barBg.destroy();
      plot.barFill.destroy();
    });
    this.renderedFarmPlots.clear();
  }

  private renderLandPlots(zoneId: string) {
    const config = resolveZoneConfig(zoneId);
    for (const plot of config.landPlots ?? []) {
      // tileX/tileY is the centre tile of the 3x3 footprint.
      const { x, y } = tileToWorld(plot.tileX, plot.tileY);
      const sprite = this.add.sprite(x, y, "plot_marker");
      sprite.setOrigin(0.5, 0.667);
      sprite.setDepth(y);
      const label = this.add
        .text(x, y - 108, "For Sale", {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "10px",
          fontStyle: "bold",
          color: "#ffd24a",
          stroke: "#2a1d12",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 1);
      // Decoration slots sit on the four corners of the 3x3 footprint.
      const corners: Array<[number, number]> = [
        [plot.tileX - 1, plot.tileY - 1],
        [plot.tileX + 1, plot.tileY - 1],
        [plot.tileX - 1, plot.tileY + 1],
        [plot.tileX + 1, plot.tileY + 1],
      ];
      const slotPositions = corners.map(([tx, ty]) => tileToWorld(tx, ty));
      this.renderedLandPlots.set(plot.id, {
        id: plot.id,
        sprite,
        label,
        worldX: x,
        worldY: y,
        slotPositions,
        decorIds: new Array(PLOT_DECOR_SLOTS).fill(null),
        decorSprites: new Array(PLOT_DECOR_SLOTS).fill(null),
        lightOn: false,
        glow: null,
      });
    }
    this.applyHousingState(networkManager.getHousingState());
  }

  private clearLandPlots() {
    this.renderedLandPlots.forEach((plot) => {
      plot.sprite.destroy();
      plot.label.destroy();
      plot.decorSprites.forEach((sprite) => sprite?.destroy());
      plot.glow?.destroy();
    });
    this.renderedLandPlots.clear();
  }

  private applyHousingState(payload: HousingStatePayload) {
    for (const state of payload.plots) {
      const plot = this.renderedLandPlots.get(state.plotId);
      if (!plot) continue;
      const owned = state.structure !== "none";
      plot.lightOn = owned && Boolean(state.lightOn);
      const base = owned ? (state.structure === "shop" ? "shop" : "house") : "plot_marker";
      // Use the painted roof variant when the owner has chosen one.
      const variant = owned && state.roof ? `${base}_${state.roof}` : base;
      plot.sprite.setTexture(this.textures.exists(variant) ? variant : base);
      plot.sprite.setDepth(plot.worldY);
      if (owned && state.ownerName) {
        // Owner-set sign takes precedence over the default "X's House" label.
        plot.label.setText(state.sign || `${state.ownerName}'s ${structureLabel(state.structure)}`);
        plot.label.setColor("#ffffff");
      } else {
        plot.label.setText("For Sale");
        plot.label.setColor("#ffd24a");
      }

      // Reconcile the four corner decorations (only built plots show props).
      const decor = state.decor ?? [];
      for (let slot = 0; slot < PLOT_DECOR_SLOTS; slot++) {
        const raw = decor[slot];
        const want = owned && isValidDecorId(raw) ? raw : null;
        if (plot.decorIds[slot] === want) continue;
        plot.decorSprites[slot]?.destroy();
        plot.decorSprites[slot] = null;
        plot.decorIds[slot] = want;
        if (want) {
          const pos = plot.slotPositions[slot];
          plot.decorSprites[slot] = this.add
            .sprite(pos.x, pos.y, `decor_${want}`)
            .setOrigin(0.5, 1)
            .setDepth(pos.y);
        }
      }
    }
  }

  private applyFarmState(payload: FarmStatePayload) {
    for (const state of payload.plots) {
      const plot = this.renderedFarmPlots.get(state.plotId);
      if (!plot) continue;
      plot.stage = state.stage;
      plot.plantedAt = state.plantedAt;
      plot.readyAt = state.readyAt;
      const texture =
        state.stage === "ready" ? "plot_ready" : state.stage === "growing" ? "plot_growing" : "plot_empty";
      plot.sprite.setTexture(texture);
      plot.label.setText(state.stage === "ready" ? "Ready!" : "Plot");
      plot.label.setVisible(state.stage === "ready");
      if (state.stage !== "growing") {
        plot.barBg.clear();
        plot.barFill.clear();
      }
    }
  }

  private updateFarmPlots() {
    const now = Date.now();
    for (const plot of this.renderedFarmPlots.values()) {
      if (plot.stage !== "growing" || !plot.plantedAt || !plot.readyAt) continue;
      // Client-side flip to ready if the broadcast hasn't arrived yet.
      if (now >= plot.readyAt) {
        plot.stage = "ready";
        plot.sprite.setTexture("plot_ready");
        plot.label.setText("Ready!").setVisible(true);
        plot.barBg.clear();
        plot.barFill.clear();
        continue;
      }
      const progress = farmGrowthProgress(plot.plantedAt, plot.readyAt, now);
      const width = 44;
      const height = 5;
      const x = plot.worldX - width / 2;
      const y = plot.worldY - 44;
      plot.barBg.clear();
      plot.barFill.clear();
      plot.barBg.fillStyle(0xfff9f0, 1).fillRoundedRect(x, y, width, height, 2);
      plot.barBg.lineStyle(1.5, 0x4a3728, 1).strokeRoundedRect(x, y, width, height, 2);
      plot.barFill.fillStyle(0x66bb6a, 1).fillRoundedRect(x + 1.5, y + 1.5, (width - 3) * progress, height - 3, 1.5);
    }
  }

  private clearMap() {
    this.mapTiles.forEach((tile) => tile.destroy());
    this.mapTiles = [];
    this.waterShimmers.forEach((s) => s.img.destroy());
    this.waterShimmers = [];
  }

  /** Drift the water glints with a slow sine so the surface gently ripples. */
  private updateWaterShimmer() {
    if (this.waterShimmers.length === 0) return;
    const now = Date.now();
    for (const s of this.waterShimmers) {
      const t = now * s.speed + s.phase;
      // Fade in/out (offset so they don't all peak together) and drift sideways.
      s.img.setAlpha(0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t)));
      s.img.x = s.baseX + Math.sin(t * 0.7) * 4;
      s.img.y = s.baseY + Math.sin(t * 1.3 + 1.1) * 1.5;
    }
  }

  private clearNpcs() {
    this.renderedNpcs.forEach((npc) => {
      this.tweens.killTweensOf(npc.sprite);
      npc.sprite.destroy();
      npc.label.destroy();
      npc.hpBarBg.destroy();
      npc.hpBarFill.destroy();
      npc.shadow.destroy();
    });
    this.renderedNpcs = [];
  }

  private clearResources() {
    this.renderedResources.forEach((resource) => {
      resource.sprite.destroy();
      resource.label.destroy();
      resource.chopBarBg.destroy();
      resource.chopBarFill.destroy();
    });
    this.renderedResources = [];
  }

  private renderNpcs(zoneId: string) {
    const config = resolveZoneConfig(zoneId);

    for (const npc of config.npcs) {
      const { x, y } = tileToWorld(npc.tileX, npc.tileY);
      const isCombat = Boolean(npc.combat);
      const mobTexture =
        npc.id === SLIME_BRUTE_NPC_ID
          ? "brute"
          : npc.id === WILD_SLIME_NPC_ID || npc.id.startsWith("wild_slime")
            ? "slime"
            : isCombat
              ? "dummy"
              : "npc";
      this.ensureContactShadowTexture();
      const shadowW: Record<string, number> = { slime: 24, brute: 32, dummy: 24, npc: 26 };
      const shadow = this.add
        .image(x, y + 2, "contact_shadow")
        .setDisplaySize(shadowW[mobTexture] ?? 26, (shadowW[mobTexture] ?? 26) * 0.46)
        .setDepth(y - 0.5);

      const sprite = this.add.sprite(x, y, mobTexture);
      // Anchor each sprite so its feet/base plant on the tile.
      const originY: Record<string, number> = {
        slime: 0.82,
        brute: 0.86,
        dummy: 0.91,
        npc: 0.91,
      };
      sprite.setOrigin(0.5, originY[mobTexture] ?? 0.9);
      sprite.setDepth(y);
      // Living NPCs gently bob in place; the training dummy stays rigid.
      // Wild slimes have active moving/bobbing/hopping handled in the update loop.
      if (mobTexture !== "dummy" && !npc.id.startsWith("wild_slime")) {
        this.tweens.add({
          targets: sprite,
          y: y - (mobTexture === "slime" ? 3 : 2),
          duration: 1100 + Math.random() * 500,
          delay: Math.random() * 800,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
      // World-Y of the visible head/top, used to place label + HP bar.
      const headTopOffset: Record<string, number> = {
        slime: 25,
        brute: 33,
        dummy: 36,
        npc: 43,
      };
      const offsetValue = headTopOffset[mobTexture] ?? 34;
      const headTopY = y - offsetValue;
      const labelY = isCombat ? headTopY - 12 : headTopY - 4;
      if (isCombat && npc.combat) {
        const saved = networkManager.getMobHealth(npc.id);
        const currentHp = saved?.currentHp ?? npc.combat.maxHp;
        sprite.setAlpha(currentHp > 0 ? 1 : 0.35);
      }

      const label = this.add
        .text(x, labelY, npc.name, {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "12px",
          fontStyle: "bold",
          color:
            npc.id === SLIME_BRUTE_NPC_ID
              ? "#4ade80"
              : npc.id === WILD_SLIME_NPC_ID || npc.id.startsWith("wild_slime")
                ? "#86efac"
                : isCombat
                  ? "#fbbf24"
                  : "#c4b5fd",
          stroke: "#2a1d12",
          strokeThickness: 4.5,
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 1);

      const hpBarBg = this.add.graphics().setDepth(y + 2);
      const hpBarFill = this.add.graphics().setDepth(y + 3);
      const maxHp = npc.combat?.maxHp ?? 0;
      const currentHp = networkManager.getMobHealth(npc.id)?.currentHp ?? maxHp;

      const rendered: RenderedNpc = {
        id: npc.id,
        sprite,
        label,
        worldX: x,
        worldY: y,
        combat: isCombat,
        hpBarBg,
        hpBarFill,
        maxHp,
        currentHp,
        headTopY,
        headTopOffset: offsetValue,
        shadow,
      };

      this.renderedNpcs.push(rendered);
      if (isCombat) {
        this.drawNpcHealthBar(rendered);
      }
    }
  }

  private renderResources(zoneId: string) {
    const config = resolveZoneConfig(zoneId);

    for (const resource of config.resources ?? []) {
      const { x, y } = tileToWorld(resource.tileX, resource.tileY);
      const saved = networkManager.getResourceHealth(resource.id);
      const available = saved?.available ?? true;
      const kind: "tree" | "rock" | "fish" =
        resource.kind === "rock" ? "rock" : resource.kind === "fish" ? "fish" : "tree";
      const texture = kind === "rock" ? "rock" : kind === "fish" ? "fishspot" : "tree";
      const originY = kind === "rock" ? 0.86 : kind === "fish" ? 0.82 : 0.94;
      const labelOffset = kind === "rock" ? 34 : kind === "fish" ? 30 : 54;
      const labelColor = kind === "rock" ? "#e6d6b8" : kind === "fish" ? "#a7dcff" : "#9be870";

      // Player-zone nodes render their hand-drawn PNG art; built-in zones use
      // the procedurally-baked tree/rock/fishspot textures.
      const asset = resource.prop ? getZoneAsset(resource.prop) : undefined;
      let sprite: Phaser.GameObjects.Sprite;
      if (asset) {
        const key = zoneAssetTextureKey(resource.prop!);
        sprite = this.add.sprite(x, y, key).setOrigin(0.5, asset.anchorY).setDepth(y);
        const applyReady = () => {
          if (!sprite.active) return;
          sprite.setTexture(key).setScale(zoneAssetScale(this, resource.prop!)).setOrigin(0.5, asset.anchorY).setVisible(true);
          sprite.setAlpha(available ? 1 : 0.35);
        };
        if (this.textures.exists(key)) applyReady();
        else {
          sprite.setVisible(false);
          ensureZoneAssetLoaded(this, resource.prop!, applyReady);
        }
      } else {
        sprite = this.add.sprite(x, y, texture);
        sprite.setOrigin(0.5, originY);
        // Fish ripples lie flat on the water; everything else sorts by position.
        sprite.setDepth(kind === "fish" ? y - 4 : y);
        // Tier-2 nodes get a distinct tint so they read apart from starter nodes.
        if (kind === "rock" && resource.mining?.lootItemId === "item_iron_ore") {
          sprite.setTint(0x9fb6c8);
        } else if (kind === "tree" && resource.woodcutting?.lootItemId === "item_hardwood") {
          sprite.setTint(0x8aa55a);
        } else if (kind === "fish" && resource.fishing?.lootItemId === "item_salmon") {
          sprite.setTint(0xffb0c0);
        }
      }
      sprite.setAlpha(available ? 1 : 0.35);

      const label = this.add
        .text(x, y - labelOffset, resource.name, {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "11px",
          fontStyle: "bold",
          color: labelColor,
          stroke: "#2a1d12",
          strokeThickness: 4.5,
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 1);

      const chopBarBg = this.add.graphics().setDepth(y + 2);
      const chopBarFill = this.add.graphics().setDepth(y + 3);

      const rendered: RenderedResource = {
        id: resource.id,
        kind,
        sprite,
        label,
        worldX: x,
        worldY: y,
        chopBarBg,
        chopBarFill,
        available,
        chopperName: saved?.chopperName,
        chopStartedAt: saved?.chopStartedAt,
        chopEndsAt: saved?.chopEndsAt,
        chopDurationMs: saved?.chopDurationMs,
      };

      this.renderedResources.push(rendered);
      this.drawResourceChopBar(rendered);
    }
  }

  private applyResourceState(payload: {
    resourceId: string;
    available: boolean;
    chopperName?: string;
    chopStartedAt?: number;
    chopEndsAt?: number;
    chopDurationMs?: number;
  }) {
    const resource = this.renderedResources.find((entry) => entry.id === payload.resourceId);
    if (!resource) return;

    resource.available = payload.available;
    resource.chopperName = payload.chopperName;
    resource.chopStartedAt = payload.chopStartedAt;
    resource.chopEndsAt = payload.chopEndsAt;
    resource.chopDurationMs = payload.chopDurationMs;
    resource.sprite.setAlpha(payload.available ? 1 : 0.35);
    this.drawResourceChopBar(resource);
  }

  private redrawActiveChopBars() {
    const now = Date.now();
    for (const resource of this.renderedResources) {
      if (resource.chopEndsAt && resource.chopEndsAt > now) {
        this.drawResourceChopBar(resource);
      }
    }
  }

  private drawResourceChopBar(resource: RenderedResource) {
    resource.chopBarBg.clear();
    resource.chopBarFill.clear();

    const width = 40;
    const height = 6;
    const x = resource.worldX - width / 2;
    const y = resource.worldY - 50;

    if (resource.chopEndsAt && resource.chopDurationMs) {
      const now = Date.now();
      const elapsed = Math.max(0, now - (resource.chopStartedAt ?? now));
      const progress = Math.min(1, elapsed / resource.chopDurationMs);
      const fillWidth = Math.max(0, progress * (width - 4));

      resource.chopBarBg.fillStyle(0xfff9f0, 1);
      resource.chopBarBg.fillRoundedRect(x, y, width, height, 3);
      resource.chopBarBg.lineStyle(1.5, 0x4a3728, 1);
      resource.chopBarBg.strokeRoundedRect(x, y, width, height, 3);
      resource.chopBarFill.fillStyle(0xffa726, 1);
      resource.chopBarFill.fillRoundedRect(x + 2, y + 2, fillWidth, height - 4, 2);
      return;
    }

    if (!resource.available) {
      resource.chopBarBg.fillStyle(0xfff9f0, 1);
      resource.chopBarBg.fillRoundedRect(x, y, width, height, 3);
      resource.chopBarBg.lineStyle(1.5, 0x4a3728, 1);
      resource.chopBarBg.strokeRoundedRect(x, y, width, height, 3);
      resource.chopBarFill.fillStyle(0xc9b8a8, 1);
      resource.chopBarFill.fillRoundedRect(x + 2, y + 2, 0, height - 4, 2);
    }
  }

  private drawNpcHealthBar(npc: RenderedNpc) {
    npc.hpBarBg.clear();
    npc.hpBarFill.clear();

    if (!npc.combat || npc.maxHp <= 0) return;

    const width = 40;
    const height = 8;
    const x = npc.worldX - width / 2;
    const y = npc.headTopY - 9;
    const fillWidth = Math.max(0, (npc.currentHp / npc.maxHp) * (width - 4));

    npc.hpBarBg.fillStyle(0xfff9f0, 1);
    npc.hpBarBg.fillRoundedRect(x, y, width, height, 4);
    npc.hpBarBg.lineStyle(2, 0x4a3728, 1);
    npc.hpBarBg.strokeRoundedRect(x, y, width, height, 4);
    npc.hpBarFill.fillStyle(npc.currentHp > 0 ? 0xff6b9d : 0xc9b8a8, 1);
    npc.hpBarFill.fillRoundedRect(x + 2, y + 2, fillWidth, height - 4, 3);
  }

  private applyKnockedOutVisuals() {
    const local = this.findLocalPlayer();
    if (!local) return;

    const knockedOut = useGameStore.getState().knockedOut;
    if (knockedOut) {
      local.sprite.setAlpha(0.42);
      local.sprite.setTint(0x9ca3af);
      local.label.setAlpha(0.55);
      return;
    }

    local.sprite.setAlpha(1);
    local.sprite.clearTint();
    local.label.setAlpha(1);
  }

  private showPlayerDamageNumber(damage: number) {
    if (!this.localSessionId || damage <= 0) return;

    const local = this.findLocalPlayer();
    if (!local) return;

    const text = this.add
      .text(local.predicted.x, local.predicted.y - 50, `-${damage}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "16px",
        color: "#ff2244",
        fontStyle: "bold",
        stroke: "#2d1b2e",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(210);

    this.tweens.add({
      targets: text,
      y: text.y - 32,
      alpha: 0,
      duration: 800,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  private findRenderedPlayerByName(playerName: string): RenderedPlayer | null {
    // Match the raw name, not the nameplate label (which carries a [GUILD] tag).
    if (this.localAvatar?.name === playerName) return this.localAvatar;
    for (const rendered of this.renderedPlayers.values()) {
      if (rendered.name === playerName) return rendered;
    }
    return null;
  }

  private showEmote(playerName: string, emoji: string) {
    const rendered = this.findRenderedPlayerByName(playerName);
    if (!rendered) return;

    const x = rendered.sprite.x;
    const y = rendered.sprite.y - 58;
    const bubble = this.add
      .text(x, y, emoji, { fontFamily: '"Noto Color Emoji", "Segoe UI Emoji", sans-serif', fontSize: "26px" })
      .setOrigin(0.5, 1)
      .setDepth(1002)
      .setScale(0.4);

    this.tweens.add({
      targets: bubble,
      scale: 1,
      y: y - 8,
      duration: 220,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: bubble,
      alpha: 0,
      y: y - 22,
      delay: 1500,
      duration: 600,
      ease: "Cubic.easeIn",
      onComplete: () => bubble.destroy(),
    });
  }

  private showMobDamageNumber(npcId: string, damage: number, crit = false) {
    const npc = this.renderedNpcs.find((entry) => entry.id === npcId);
    if (!npc || damage <= 0) return;

    const text = this.add
      .text(npc.worldX, npc.worldY - 44, crit ? `${damage}!` : `-${damage}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: crit ? "21px" : "15px",
        color: crit ? "#ffcf33" : "#ff4466",
        fontStyle: "bold",
        stroke: crit ? "#7a4a00" : "#2d1b2e",
        strokeThickness: crit ? 4 : 3,
      })
      .setOrigin(0.5)
      .setDepth(200);

    if (crit) {
      // Crit pop: a quick scale punch before the float-up.
      text.setScale(0.5);
      this.tweens.add({ targets: text, scale: 1, duration: 130, ease: "Back.easeOut" });
    }

    this.tweens.add({
      targets: text,
      y: text.y - (crit ? 40 : 30),
      alpha: 0,
      duration: crit ? 900 : 750,
      delay: crit ? 110 : 0,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  /** Floating damage number at an arbitrary world point (used for PvP hits). */
  private showWorldDamageNumber(x: number, y: number, damage: number, crit = false) {
    if (damage <= 0) return;
    const text = this.add
      .text(x, y, crit ? `${damage}!` : `-${damage}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: crit ? "21px" : "15px",
        color: crit ? "#ffcf33" : "#ff4466",
        fontStyle: "bold",
        stroke: crit ? "#7a4a00" : "#2d1b2e",
        strokeThickness: crit ? 4 : 3,
      })
      .setOrigin(0.5)
      .setDepth(210);
    this.tweens.add({
      targets: text,
      y: y - (crit ? 40 : 30),
      alpha: 0,
      duration: crit ? 900 : 750,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  private spawnSlashArc(x: number, y: number, angle: number) {
    const graphics = this.add.graphics();
    graphics.setDepth(y + 10);
    graphics.lineStyle(3, 0xffffff, 0.85);
    graphics.beginPath();
    // Draw a curved sweep arc
    graphics.arc(0, 0, 16, angle - 0.7, angle + 0.7, false);
    graphics.strokePath();

    this.tweens.add({
      targets: graphics,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 160,
      onComplete: () => {
        graphics.destroy();
      }
    });
    graphics.setPosition(x, y);
  }

  private spawnDustPuff(x: number, y: number) {
    const graphics = this.add.graphics();
    graphics.setDepth(y - 0.2); // draw just above shadow, below feet
    graphics.fillStyle(0xffffff, 0.45);
    graphics.beginPath();
    graphics.arc(0, 0, 3, 0, Math.PI * 2);
    graphics.fillPath();

    this.tweens.add({
      targets: graphics,
      alpha: 0,
      y: y - 8,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 250,
      onComplete: () => {
        graphics.destroy();
      }
    });
    graphics.setPosition(x + (Math.random() - 0.5) * 4, y);
  }

  private updateNpcHealth(npcId: string, currentHp: number, maxHp: number) {
    const npc = this.renderedNpcs.find((entry) => entry.id === npcId);
    if (!npc) return;

    npc.currentHp = currentHp;
    npc.maxHp = maxHp;
    npc.sprite.setAlpha(currentHp > 0 ? 1 : 0.35);
    this.drawNpcHealthBar(npc);
  }

  private tryInteract() {
    const mobileInteract = consumeMobileInteract();
    const keyboardInteract =
      this.interactKey !== null && Phaser.Input.Keyboard.JustDown(this.interactKey);
    if (!mobileInteract && !keyboardInteract) return;
    if (!this.localSessionId) return;

    const local = this.findLocalPlayer();
    if (!local) return;

    // A loot bag in reach is grabbed first (also the mobile path, since there's
    // no F key on touch).
    if (this.tryLootPickup(local)) return;

    // A nearby farm plot takes priority — plant on an empty plot or harvest a
    // ready one. The same key/button (E / ✨) drives plots and NPCs.
    let nearestPlot: RenderedFarmPlot | null = null;
    let nearestPlotDistance = FARM_RANGE;
    for (const plot of this.renderedFarmPlots.values()) {
      const distance = Math.hypot(local.predicted.x - plot.worldX, local.predicted.y - plot.worldY);
      if (distance <= nearestPlotDistance) {
        nearestPlot = plot;
        nearestPlotDistance = distance;
      }
    }
    if (nearestPlot) {
      networkManager.sendFarmInteract(nearestPlot.id);
      return;
    }

    // A nearby land plot opens the housing panel (buy / view owner).
    let nearestLand: RenderedLandPlot | null = null;
    let nearestLandDistance = HOUSE_RANGE;
    for (const land of this.renderedLandPlots.values()) {
      const distance = Math.hypot(local.predicted.x - land.worldX, local.predicted.y - land.worldY);
      if (distance <= nearestLandDistance) {
        nearestLand = land;
        nearestLandDistance = distance;
      }
    }
    if (nearestLand) {
      playSfx("ui_open");
      // A built shop opens the player-run shop; anything else opens housing.
      const state = networkManager
        .getHousingState()
        .plots.find((p) => p.plotId === nearestLand.id);
      if (state?.structure === "shop") {
        useGameStore.getState().openPlayerShop(nearestLand.id);
      } else {
        useGameStore.getState().openHousing(nearestLand.id);
      }
      return;
    }

    // Interactable scenery (arcade cabinet / blackjack table).
    let nearestProp: { id: string; worldX: number; worldY: number } | null = null;
    let nearestPropD = NPC_INTERACT_RANGE;
    for (const prop of this.interactableScenery) {
      const d = Math.hypot(local.predicted.x - prop.worldX, local.predicted.y - prop.worldY);
      if (d <= nearestPropD) {
        nearestProp = prop;
        nearestPropD = d;
      }
    }
    if (nearestProp) {
      playSfx("interact");
      networkManager.sendInteract(nearestProp.id);
      return;
    }

    let nearest: RenderedNpc | null = null;
    let nearestDistance = NPC_INTERACT_RANGE;

    for (const npc of this.renderedNpcs) {
      const distance = Math.hypot(local.predicted.x - npc.worldX, local.predicted.y - npc.worldY);
      if (distance <= nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }

    if (nearest) {
      playSfx("interact");
      networkManager.sendInteract(nearest.id);
    }
  }

  /**
   * Fire a weapon ability at the current target (selected hostile, else nearest
   * in range). Called from the React hotbar via inputControl. Returns true if a
   * target was found and the ability was sent.
   */
  useAbility(abilityId: string): boolean {
    if (!this.localSessionId) return false;
    const local = this.findLocalPlayer();
    if (!local) return false;

    let target: RenderedNpc | null = null;
    if (this.selectedNpcId) {
      const selected = this.renderedNpcs.find((npc) => npc.id === this.selectedNpcId);
      if (selected && selected.combat && selected.currentHp > 0) {
        const distance = Math.hypot(local.predicted.x - selected.worldX, local.predicted.y - selected.worldY);
        if (distance <= ATTACK_RANGE) target = selected;
      }
    }
    if (!target) {
      let nearestDistance = ATTACK_RANGE;
      for (const npc of this.renderedNpcs) {
        if (!npc.combat || npc.currentHp <= 0) continue;
        const distance = Math.hypot(local.predicted.x - npc.worldX, local.predicted.y - npc.worldY);
        if (distance <= nearestDistance) {
          target = npc;
          nearestDistance = distance;
        }
      }
    }
    if (!target) return false;

    networkManager.sendAbility(abilityId, target.id);
    if (this.localAvatar) {
      const direction = directionTowardTarget(
        this.localAvatar.sprite.x,
        this.localAvatar.sprite.y,
        target.worldX,
        target.worldY,
        this.localAvatar.direction,
      );
      this.setPlayerAction(this.localAvatar, "attack", direction, 350);
    }
    return true;
  }

  /** Left-click target selection: pick the hostile NPC nearest the cursor.
   *  Returns true if a hostile was selected (so the click isn't also a move). */
  private selectNpcAtPointer(pointer: Phaser.Input.Pointer): boolean {
    const SELECT_PIXEL_RANGE = 52;
    let picked: RenderedNpc | null = null;
    let pickedDistance = SELECT_PIXEL_RANGE;
    for (const npc of this.renderedNpcs) {
      if (!npc.combat || npc.currentHp <= 0) continue;
      const distance = Math.hypot(pointer.worldX - npc.worldX, pointer.worldY - npc.worldY);
      if (distance <= pickedDistance) {
        picked = npc;
        pickedDistance = distance;
      }
    }
    if (picked) {
      this.selectedNpcId = picked.id;
      playSfx("hover");
      return true;
    }
    this.selectedNpcId = null;
    return false;
  }

  /** (Re)build the collision grid used for pathfinding + prediction sliding. */
  private rebuildCollisionGrid(zoneId: string) {
    const built = new Set<string>();
    for (const plot of networkManager.getHousingState().plots) {
      if (plot.structure && plot.structure !== "none") built.add(plot.plotId);
    }
    this.collisionGrid = buildCollisionGrid(zoneId, built);
  }

  /** Set a click/tap-to-move destination and pop a marker there. */
  private setMoveTarget(worldX: number, worldY: number) {
    this.moveTarget = { x: worldX, y: worldY };
    // Route around obstacles with A* over the collision grid; fall back to a
    // straight line if there's no grid or no path.
    const local = this.findLocalPlayer();
    if (this.collisionGrid && local) {
      const path = findPath(this.collisionGrid, local.predicted, { x: worldX, y: worldY });
      // Replace the final waypoint with the exact click point for a precise stop.
      if (path.length) path[path.length - 1] = { x: worldX, y: worldY };
      this.movePath = path;
    } else {
      this.movePath = [];
    }
    const marker = this.moveMarker;
    if (!marker) return;
    marker.clear();
    marker.lineStyle(2, 0x9ad7ff, 0.95);
    marker.strokeCircle(0, 0, 9);
    marker.lineStyle(2, 0xffffff, 0.8);
    marker.strokeCircle(0, 0, 4);
    marker.setPosition(worldX, worldY);
    marker.setAlpha(1);
    marker.setScale(1);
    marker.setVisible(true);
    this.tweens.killTweensOf(marker);
    this.tweens.add({ targets: marker, alpha: 0.2, scale: 0.7, duration: 600, ease: "Sine.easeOut", yoyo: true, repeat: -1 });
  }

  private clearMoveTarget() {
    this.moveTarget = null;
    this.movePath = [];
    if (this.moveMarker) {
      this.tweens.killTweensOf(this.moveMarker);
      this.moveMarker.setVisible(false);
    }
  }

  /** Left-click PvP target selection: pick a remote player near the cursor. */
  private selectPlayerAtPointer(pointer: Phaser.Input.Pointer): boolean {
    const SELECT_PIXEL_RANGE = 40;
    let picked: RenderedPlayer | null = null;
    let pickedDistance = SELECT_PIXEL_RANGE;
    for (const rendered of this.renderedPlayers.values()) {
      const distance = Math.hypot(pointer.worldX - rendered.sprite.x, pointer.worldY - rendered.sprite.y);
      if (distance <= pickedDistance) {
        picked = rendered;
        pickedDistance = distance;
      }
    }
    if (picked) {
      this.selectedPlayerName = picked.name;
      this.selectedNpcId = null;
      useGameStore.getState().setSelectedPlayer(picked.name);
      playSfx("hover");
      return true;
    }
    return false;
  }

  /** Colour a player's nameplate red when criminal, with a ⚔ marker when flagged. */
  private applyNameplateStatus(entry: RenderedPlayer, player: RemotePlayer) {
    const base = nameplateText(player);
    entry.label.setText(player.pvpFlagged ? `⚔ ${base}` : base);
    entry.label.setColor(player.criminal ? "#ff5a5a" : "#fff7ea");
  }

  /** Reconcile rendered loot bags with the server's bag list. */
  private syncLootBags(bags: LootBagState[]) {
    const seen = new Set<string>();
    for (const bag of bags) {
      seen.add(bag.id);
      if (this.renderedLootBags.has(bag.id)) continue;
      const graphics = this.add.graphics().setDepth(bag.y);
      // A little sack: brown body + tied neck.
      graphics.fillStyle(0x7a4a2b, 1);
      graphics.fillRoundedRect(-9, -10, 18, 16, 5);
      graphics.fillStyle(0x5c3720, 1);
      graphics.fillRect(-6, -13, 12, 4);
      graphics.fillStyle(0xffd24a, 1);
      graphics.fillCircle(0, -2, 3);
      graphics.setPosition(bag.x, bag.y);
      const label = this.add
        .text(bag.x, bag.y - 20, "Loot (F)", {
          fontFamily: "Nunito, sans-serif",
          fontSize: "11px",
          color: "#ffe9b0",
          stroke: "#3b2c1e",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(bag.y + 1);
      this.tweens.add({ targets: graphics, y: bag.y - 3, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.renderedLootBags.set(bag.id, { graphics, label, x: bag.x, y: bag.y });
    }
    for (const [id, rendered] of this.renderedLootBags) {
      if (!seen.has(id)) {
        rendered.graphics.destroy();
        rendered.label.destroy();
        this.renderedLootBags.delete(id);
      }
    }
  }

  private clearLootBags() {
    for (const rendered of this.renderedLootBags.values()) {
      rendered.graphics.destroy();
      rendered.label.destroy();
    }
    this.renderedLootBags.clear();
  }

  /** Draw/update the territory capture flags from server state. */
  private syncTerritory(points: TerritoryPointState[]) {
    const config = resolveZoneConfig(this.currentZoneId ?? networkManager.zoneId);
    const tiles = new Map((config.capturePoints ?? []).map((p) => [p.id, p]));

    for (const point of points) {
      const def = tiles.get(point.id);
      if (!def) continue;
      const { x, y } = tileToWorld(def.tileX, def.tileY);

      let entry = this.renderedTerritory.get(point.id);
      if (!entry) {
        const flag = this.add.graphics().setDepth(y);
        const label = this.add
          .text(x, y - 40, "", {
            fontFamily: "Nunito, sans-serif",
            fontSize: "12px",
            fontStyle: "700",
            color: "#fff7ea",
            stroke: "#2b1d12",
            strokeThickness: 3,
            align: "center",
          })
          .setOrigin(0.5, 1)
          .setDepth(y + 1);
        entry = { flag, label };
        this.renderedTerritory.set(point.id, entry);
      }

      const color = point.contested
        ? 0xff5a5a
        : point.ownerTag
          ? 0x6ad27e
          : point.capturingTag
            ? 0xffce4d
            : 0xb7c3cc;

      // Flag: a pole with a triangular banner, tinted by control state.
      const g = entry.flag;
      g.clear();
      g.setPosition(x, y);
      g.fillStyle(0x4a3728, 1);
      g.fillRect(-1.5, -34, 3, 34); // pole
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(2, -34);
      g.lineTo(20, -28);
      g.lineTo(2, -22);
      g.closePath();
      g.fillPath();
      // Capture progress arc at the base while a capture is underway.
      if (point.progress > 0 && point.progress < 1) {
        g.lineStyle(3, 0xffce4d, 0.95);
        g.beginPath();
        g.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + point.progress * Math.PI * 2, false);
        g.strokePath();
      }

      entry.label.setText(
        point.contested
          ? `⚔ ${def.name} — contested!`
          : point.ownerTag
            ? `🏴 [${point.ownerTag}] ${def.name}`
            : point.capturingTag
              ? `[${point.capturingTag}] capturing ${Math.round(point.progress * 100)}%`
              : `⚐ ${def.name} (neutral)`,
      );
      entry.label.setColor(point.contested ? "#ffb3b3" : "#fff7ea");
    }

    // Remove flags no longer reported.
    const live = new Set(points.map((p) => p.id));
    for (const [id, entry] of this.renderedTerritory) {
      if (!live.has(id)) {
        entry.flag.destroy();
        entry.label.destroy();
        this.renderedTerritory.delete(id);
      }
    }
  }

  private clearTerritory() {
    for (const entry of this.renderedTerritory.values()) {
      entry.flag.destroy();
      entry.label.destroy();
    }
    this.renderedTerritory.clear();
  }

  /** Draw/update the King Crystal siege objective (Black zone only). */
  private syncCrystal(state: SiegeStatePayload) {
    this.siegeState = state;
    if ((this.currentZoneId ?? networkManager.zoneId) !== ZONE_BLACK) return;

    const { x, y } = tileToWorld(KING_CRYSTAL_TILE.x, KING_CRYSTAL_TILE.y);
    if (!this.crystalGfx) {
      this.crystalGfx = this.add.graphics().setDepth(y);
      this.crystalLabel = this.add
        .text(x, y - 46, "", {
          fontFamily: "Nunito, sans-serif",
          fontSize: "12px",
          fontStyle: "700",
          color: "#fff7ea",
          stroke: "#2b1d12",
          strokeThickness: 3,
          align: "center",
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 1);
    }

    const g = this.crystalGfx;
    g.clear();
    g.setPosition(x, y);
    const pct = state.maxHp > 0 ? Math.max(0, state.hp / state.maxHp) : 0;
    const color = state.active ? 0xb15cff : 0x6b7280;
    // Diamond crystal.
    g.fillStyle(color, state.active ? 1 : 0.6);
    g.beginPath();
    g.moveTo(0, -34);
    g.lineTo(14, -18);
    g.lineTo(0, -2);
    g.lineTo(-14, -18);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xffffff, state.active ? 0.9 : 0.4);
    g.strokePath();
    // HP bar.
    g.fillStyle(0x2b1d12, 0.8);
    g.fillRect(-18, -46, 36, 5);
    g.fillStyle(pct > 0.3 ? 0x6ad27e : 0xff5a5a, 1);
    g.fillRect(-18, -46, 36 * pct, 5);

    this.crystalLabel?.setText(
      state.active
        ? `King Crystal — ${Math.ceil(pct * 100)}%\n⚔️ SIEGE OPEN`
        : `King Crystal (sealed)${state.sovereignTag ? `\n👑 [${state.sovereignTag}]` : ""}`,
    );
  }

  private clearCrystal() {
    this.crystalGfx?.destroy();
    this.crystalLabel?.destroy();
    this.crystalGfx = null;
    this.crystalLabel = null;
  }

  /** Click the King Crystal during an open siege to strike it. */
  private tryClickCrystal(pointer: Phaser.Input.Pointer): boolean {
    if ((this.currentZoneId ?? networkManager.zoneId) !== ZONE_BLACK) return false;
    if (!this.siegeState?.active) return false;
    const { x, y } = tileToWorld(KING_CRYSTAL_TILE.x, KING_CRYSTAL_TILE.y);
    if (Math.hypot(pointer.worldX - x, pointer.worldY - (y - 18)) > SIEGE_ATTACK_RANGE) return false;
    networkManager.sendAttackCrystal();
    playSfx("attack_swing");
    if (this.localAvatar) {
      const direction = directionTowardTarget(this.localAvatar.sprite.x, this.localAvatar.sprite.y, x, y, this.localAvatar.direction);
      this.setPlayerAction(this.localAvatar, "attack", direction, 350);
    }
    return true;
  }

  /** Pick up the nearest loot bag in range (called on F). */
  private tryLootPickup(local: RenderedPlayer): boolean {
    let nearestId: string | null = null;
    let nearestDistance = CHOP_RANGE;
    for (const [id, bag] of this.renderedLootBags) {
      const distance = Math.hypot(local.predicted.x - bag.x, local.predicted.y - bag.y);
      if (distance <= nearestDistance) {
        nearestId = id;
        nearestDistance = distance;
      }
    }
    if (nearestId) {
      networkManager.sendLootPickup(nearestId);
      playSfx("item_pickup");
      return true;
    }
    return false;
  }

  /** Click-to-move axis toward the next path waypoint (or the target), or null. */
  private getMoveTargetAxis(): { dx: number; dy: number } | null {
    if (!this.moveTarget) return null;
    const local = this.findLocalPlayer();
    if (!local) {
      this.clearMoveTarget();
      return null;
    }
    // Advance past any path waypoints we've reached.
    while (this.movePath.length) {
      const wp = this.movePath[0];
      if (Math.hypot(wp.x - local.predicted.x, wp.y - local.predicted.y) <= 8) this.movePath.shift();
      else break;
    }
    const aim = this.movePath[0] ?? this.moveTarget;
    const dx = aim.x - local.predicted.x;
    const dy = aim.y - local.predicted.y;
    const distance = Math.hypot(dx, dy);
    // Arrived at the final destination — stop and clear.
    if (this.movePath.length === 0 && distance <= 6) {
      this.clearMoveTarget();
      return null;
    }
    if (distance === 0) return null;
    return { dx: dx / distance, dy: dy / distance };
  }

  /** Draw the reticle over the selected hostile (clears it when the target dies). */
  private updateTargetReticle() {
    const reticle = this.targetReticle;
    if (!reticle) return;

    // Resolve the active target's world position (NPC takes priority over player).
    let tx = 0;
    let ty = 0;
    let found = false;

    if (this.selectedNpcId) {
      const npc = this.renderedNpcs.find((entry) => entry.id === this.selectedNpcId);
      if (!npc || npc.currentHp <= 0) {
        this.selectedNpcId = null;
      } else {
        tx = npc.worldX;
        ty = npc.worldY;
        found = true;
      }
    }

    if (!found && this.selectedPlayerName) {
      const target = [...this.renderedPlayers.values()].find((p) => p.name === this.selectedPlayerName);
      if (!target) {
        this.selectedPlayerName = null;
        useGameStore.getState().setSelectedPlayer(null);
      } else {
        tx = target.sprite.x;
        ty = target.sprite.y;
        found = true;
      }
    }

    if (!found) {
      reticle.setVisible(false);
      return;
    }

    const local = this.findLocalPlayer();
    const inRange = local ? Math.hypot(local.predicted.x - tx, local.predicted.y - ty) <= ATTACK_RANGE : false;
    const color = inRange ? 0xff5a5a : 0xffd45a;
    const pulse = 1 + Math.sin(this.time.now / 180) * 0.08;
    const radius = 20 * pulse;

    reticle.clear();
    reticle.lineStyle(2, color, 0.95);
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -1 : 1;
      const sy = i < 2 ? -1 : 1;
      const cx = tx + sx * radius;
      const cy = ty - 6 + sy * radius;
      reticle.beginPath();
      reticle.moveTo(cx - sx * 7, cy);
      reticle.lineTo(cx, cy);
      reticle.lineTo(cx, cy - sy * 7);
      reticle.strokePath();
    }
    reticle.setDepth(ty + 1);
    reticle.setVisible(true);
  }

  private tryAttack() {
    const mobileAttack = consumeMobileAttack();
    const keyboardAttack =
      this.attackKey !== null && Phaser.Input.Keyboard.JustDown(this.attackKey);
    const pointerAttack = this.pointerAttackQueued;
    this.pointerAttackQueued = false;
    if (!mobileAttack && !keyboardAttack && !pointerAttack) return;
    if (!this.localSessionId) return;

    const local = this.findLocalPlayer();
    if (!local) return;

    // PvP: a selected player in range takes priority (server enforces the rules).
    if (this.selectedPlayerName) {
      const target = this.renderedPlayers.get(
        [...this.renderedPlayers.entries()].find(([, p]) => p.name === this.selectedPlayerName)?.[0] ?? "",
      );
      if (target) {
        const distance = Math.hypot(local.predicted.x - target.sprite.x, local.predicted.y - target.sprite.y);
        if (distance <= ATTACK_RANGE) {
          playSfx("attack_swing");
          networkManager.sendAttackPlayer(this.selectedPlayerName);
          if (this.localAvatar) {
            const direction = directionTowardTarget(
              this.localAvatar.sprite.x,
              this.localAvatar.sprite.y,
              target.sprite.x,
              target.sprite.y,
              this.localAvatar.direction,
            );
            this.setPlayerAction(this.localAvatar, "attack", direction, 350);
          }
          return;
        }
      } else {
        this.selectedPlayerName = null;
      }
    }

    let nearest: RenderedNpc | null = null;
    let nearestDistance = ATTACK_RANGE;

    // Prefer the explicitly selected target when it's alive and in range.
    if (this.selectedNpcId) {
      const selected = this.renderedNpcs.find((npc) => npc.id === this.selectedNpcId);
      if (selected && selected.combat && selected.currentHp > 0) {
        const distance = Math.hypot(
          local.predicted.x - selected.worldX,
          local.predicted.y - selected.worldY,
        );
        if (distance <= ATTACK_RANGE) {
          nearest = selected;
          nearestDistance = distance;
        }
      }
    }

    for (const npc of this.renderedNpcs) {
      if (nearest) break;
      if (!npc.combat || npc.currentHp <= 0) continue;
      const distance = Math.hypot(local.predicted.x - npc.worldX, local.predicted.y - npc.worldY);
      if (distance <= nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }

    if (nearest) {
      playSfx("attack_swing");
      networkManager.sendAttack(nearest.id);
      if (this.localAvatar) {
        const direction = directionTowardTarget(
          this.localAvatar.sprite.x,
          this.localAvatar.sprite.y,
          nearest.worldX,
          nearest.worldY,
          this.localAvatar.direction,
        );
        this.setPlayerAction(this.localAvatar, "attack", direction, 350);
      }
      return;
    }

    if (mobileAttack || keyboardAttack) {
      this.chopNearestTree(local);
    }
  }

  private tryChop() {
    const keyboardChop = this.chopKey !== null && Phaser.Input.Keyboard.JustDown(this.chopKey);
    if (!keyboardChop) return;
    if (!this.localSessionId) return;

    const local = this.findLocalPlayer();
    if (!local) return;

    // F grabs a loot bag if one is in reach, otherwise falls back to gathering.
    if (this.tryLootPickup(local)) return;

    this.chopNearestTree(local);
  }

  private chopNearestTree(local: RenderedPlayer) {
    let nearest: RenderedResource | null = null;
    let nearestDistance = CHOP_RANGE;

    if (Date.now() < this.localChoppingUntil) return;

    for (const resource of this.renderedResources) {
      if (!resource.available || resource.chopperName) continue;
      const distance = Math.hypot(
        local.predicted.x - resource.worldX,
        local.predicted.y - resource.worldY,
      );
      if (distance <= nearestDistance) {
        nearest = resource;
        nearestDistance = distance;
      }
    }

    if (nearest) {
      networkManager.sendChop(nearest.id);
    }
  }

  private tryFish() {
    const keyboardFish = this.fishKey !== null && Phaser.Input.Keyboard.JustDown(this.fishKey);
    if (!keyboardFish || !this.localSessionId) return;

    const local = this.findLocalPlayer();
    if (!local) return;
    if (Date.now() < this.localChoppingUntil) return;

    // Cast at the nearest available fishing spot — the server runs the gather
    // session and broadcasts the cast animation + catch back to everyone.
    let nearest: RenderedResource | null = null;
    let nearestDistance = CHOP_RANGE;
    for (const resource of this.renderedResources) {
      if (resource.kind !== "fish" || !resource.available || resource.chopperName) continue;
      const distance = Math.hypot(
        local.predicted.x - resource.worldX,
        local.predicted.y - resource.worldY,
      );
      if (distance <= nearestDistance) {
        nearest = resource;
        nearestDistance = distance;
      }
    }

    if (nearest) {
      networkManager.sendChop(nearest.id);
    }
  }

  private resourceKind(resourceId: string): "tree" | "rock" | "fish" {
    return this.renderedResources.find((entry) => entry.id === resourceId)?.kind ?? "tree";
  }

  private startLocalChopHits(endsAt: number, kind: "tree" | "rock" | "fish" = "tree") {
    this.stopLocalChopHits();
    const hitSound = kind === "rock" ? "mine_hit" : kind === "fish" ? "fish_splash" : "chop_hit";
    const interval = kind === "fish" ? 900 : 360;
    // Rhythmic impact sounds for the duration of the gather.
    this.chopHitTimer = this.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => {
        if (Date.now() >= endsAt) {
          this.stopLocalChopHits();
          return;
        }
        playSfx(hitSound);
      },
    });
  }

  private stopLocalChopHits() {
    this.chopHitTimer?.remove(false);
    this.chopHitTimer = null;
  }

  private startChopAnimation(playerName: string, resourceId: string, endsAt: number) {
    const resource = this.renderedResources.find((entry) => entry.id === resourceId);
    const durationMs = Math.max(0, endsAt - Date.now());

    let rendered: RenderedPlayer | null = null;
    if (this.localAvatar?.label.text === playerName) {
      rendered = this.localAvatar;
    } else {
      for (const [, r] of this.renderedPlayers) {
        if (r.label.text === playerName) {
          rendered = r;
          break;
        }
      }
    }

    if (!rendered) return;

    const direction = resource
      ? directionTowardTarget(
          rendered.sprite.x,
          rendered.sprite.y,
          resource.worldX,
          resource.worldY,
          rendered.direction,
        )
      : rendered.direction;
    const action = resource?.kind === "fish" ? "fish" : "chop";
    this.setPlayerAction(rendered, action, direction, durationMs);
    if (playerName === useGameStore.getState().playerName) {
      this.localChoppingUntil = endsAt;
    }
  }

  private setPlayerAction(
    player: RenderedPlayer,
    action: AvatarAction,
    direction: AvatarDirection,
    durationMs: number,
  ) {
    player.action = action;
    player.actionDirection = direction;
    player.actionUntil = Date.now() + durationMs;
    player.displayDirection = direction;
    player.displayAction = action;
    player.poseStartedAt = Date.now();
    const textureKey = setAvatarPose(this, player.sprite, player.appearance, direction, action, 0);
    player.lastTextureKey = textureKey;
  }

  private updatePlayerAnimations() {
    const now = Date.now();
    const entries: RenderedPlayer[] = [];
    if (this.localAvatar) entries.push(this.localAvatar);
    for (const rendered of this.renderedPlayers.values()) entries.push(rendered);

    for (const rendered of entries) {
      const isLocal = rendered === this.localAvatar;
      let direction = rendered.direction;
      let action: AvatarAction = "idle";

      if (rendered.actionUntil > now) {
        direction = rendered.actionDirection;
        action = rendered.action;
      } else if (isLocal) {
        const moving = this.lastSentInput.dx !== 0 || this.lastSentInput.dy !== 0;
        if (moving) {
          direction = directionFromInput(this.lastSentInput.dx, this.lastSentInput.dy);
        }
        action = moving ? "walk" : "idle";
      } else {
        const vx = rendered.sprite.x - rendered.prevSpriteX;
        const vy = rendered.baseY - rendered.prevSpriteY;
        const speed = Math.hypot(vx, vy);
        if (speed > 0.8) {
          rendered.remoteMoving = true;
        } else if (speed < 0.15) {
          rendered.remoteMoving = false;
        }

        if (rendered.remoteMoving) {
          direction = directionFromDelta(vx, vy, rendered.direction);
          action = "walk";
        }
      }

      rendered.prevSpriteX = rendered.sprite.x;
      rendered.prevSpriteY = rendered.baseY;
      rendered.direction = direction;
      if (rendered.actionUntil <= now) {
        rendered.action = action;
      }

      const playDirection = rendered.actionUntil > now ? rendered.actionDirection : direction;
      const playAction = rendered.actionUntil > now ? rendered.action : action;
      if (
        playDirection !== rendered.displayDirection ||
        playAction !== rendered.displayAction
      ) {
        rendered.displayDirection = playDirection;
        rendered.displayAction = playAction;
        rendered.poseStartedAt = now;
      }

      const frame = getAnimFrame(playAction, now - rendered.poseStartedAt);
      const textureKey = getAvatarTextureKey(
        rendered.appearance,
        playDirection,
        playAction,
        frame,
      );
      if (textureKey !== rendered.lastTextureKey) {
        rendered.lastTextureKey = setAvatarPose(
          this,
          rendered.sprite,
          rendered.appearance,
          playDirection,
          playAction,
          frame,
        );
      }

      if (playAction === "walk") {
        if (now - ((rendered as any).lastDustAt || 0) > 180) {
          (rendered as any).lastDustAt = now;
          this.spawnDustPuff(rendered.sprite.x, rendered.baseY);
        }
      }

      // Gentle idle bob — the avatar breathes/hovers a hair above its shadow
      // when standing still; the shadow stays put on the ground.
      const bobY = playAction === "idle" ? Math.sin(now / 520 + rendered.bobPhase) * 1.6 : 0;
      rendered.sprite.y = rendered.baseY + bobY;
    }
  }

  private getAxisInput(): number {
    const mobile = getMobileAxis();
    if (mobile.dx !== 0) return mobile.dx;

    const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
    if (left && right) return 0;
    if (left) return -1;
    if (right) return 1;
    return 0;
  }

  private getAxisInputY(): number {
    const mobile = getMobileAxis();
    if (mobile.dy !== 0) return mobile.dy;

    const up = this.cursors?.up.isDown || this.wasd?.W.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.S.isDown;
    if (up && down) return 0;
    if (up) return -1;
    if (down) return 1;
    return 0;
  }

  private syncPlayers(players: RemotePlayer[]) {
    if (players.length === 0) {
      return;
    }

    const localName = useGameStore.getState().playerName;
    const seen = new Set<string>();

    for (const player of players) {
      const isLocal =
        player.sessionId === this.localSessionId ||
        player.sessionId === networkManager.sessionId ||
        player.name === localName;

      if (isLocal) {
        this.upsertLocalPlayer(player);
        continue;
      }

      seen.add(player.sessionId);
      let existing = this.renderedPlayers.get(player.sessionId);

      if (!existing) {
        const entry = this.createRenderedPlayerEntry(player, false);
        this.applyNameplateStatus(entry, player);
        this.applyPet(entry, player.petId);
        this.renderedPlayers.set(player.sessionId, entry);
      } else {
        existing.sprite.setDisplaySize(AVATAR_LOGICAL_WIDTH, AVATAR_LOGICAL_HEIGHT);
        existing.lastTargetX = existing.targetX;
        existing.lastTargetY = existing.targetY;
        existing.targetX = player.x;
        existing.targetY = player.y;
        existing.lampOn = player.lampOn;
        existing.name = player.name;
        existing.label.setText(nameplateText(player));
        this.applyNameplateStatus(existing, player);
        this.applyPet(existing, player.petId);
      }
    }

    for (const [sessionId, rendered] of this.renderedPlayers) {
      if (!seen.has(sessionId)) {
        this.destroyRenderedPlayer(sessionId, rendered);
      }
    }

    this.sweepStrayAvatarSprites();
    this.bindCameraToLocalPlayer();
  }

  private applyLocalPrediction(dx: number, dy: number, delta: number) {
    const local = this.findLocalPlayer();
    if (!local) return;

    if (dx !== 0 || dy !== 0) {
      // Predict with the same wall-sliding the server uses so the character
      // doesn't drift into buildings and get snapped back (the "bump").
      local.predicted = this.collisionGrid
        ? collisionStep(this.collisionGrid, local.predicted, dx, dy, delta, this.localSpeedMult)
        : stepPrediction(local.predicted, dx, dy, delta, this.localSpeedMult);
    }

    const x = Math.round(local.predicted.x);
    const y = Math.round(local.predicted.y);
    local.baseY = y;
    local.sprite.setPosition(x, y);
    local.sprite.setDepth(y + this.playerDepthLift());
    local.label.setPosition(x, y - 42);
    local.label.setDepth(y + 1);
    local.shadow.setPosition(x, y + 4);
    local.shadow.setDepth(y - 0.5);
    this.positionPet(local);
  }

  /**
   * In player zones the ground is depth-sorted by world Y (so ground in front of
   * a prop occludes its base). Lift the player one half-tile above that so the
   * tile directly in front never draws over the character's feet.
   */
  private playerDepthLift(): number {
    return isPlayerZoneId(this.currentZoneId ?? "") ? 16 : 0;
  }

  private interpolateRemotePlayers() {
    const alpha = 0.25;
    for (const [, rendered] of this.renderedPlayers) {
      const x = Math.round(Phaser.Math.Linear(rendered.sprite.x, rendered.targetX, alpha));
      // Lerp from the bob-free baseY so the idle bob never feeds back into motion.
      const y = Math.round(Phaser.Math.Linear(rendered.baseY, rendered.targetY, alpha));
      rendered.baseY = y;
      rendered.sprite.setPosition(x, y);
      rendered.sprite.setDepth(y + this.playerDepthLift());
      rendered.label.setPosition(x, y - 42);
      rendered.label.setDepth(y + 1);
      rendered.shadow.setPosition(x, y + 4);
      rendered.shadow.setDepth(y - 0.5);
      this.positionPet(rendered);
    }
  }

  private updateNpcMovement() {
    const alpha = 0.22;
    for (const npc of this.renderedNpcs) {
      if (npc.targetX === undefined || npc.targetY === undefined) {
        continue;
      }
      // Interpolate position
      npc.worldX = Phaser.Math.Linear(npc.worldX, npc.targetX, alpha);
      npc.worldY = Phaser.Math.Linear(npc.worldY, npc.targetY, alpha);

      // Determine movement and offsets
      const distToTarget = Math.hypot(npc.targetX - npc.worldX, npc.targetY - npc.worldY);
      const isMoving = distToTarget > 1.0;

      let bobY = 0;
      if (npc.id.startsWith("wild_slime")) {
        if (isMoving) {
          bobY = Math.abs(Math.sin(this.time.now / 150)) * -6;
        } else {
          bobY = Math.sin(this.time.now / 300) * 1.5;
        }
      }

      const x = Math.round(npc.worldX);
      const y = Math.round(npc.worldY);

      npc.sprite.setPosition(x, y + bobY);
      npc.sprite.setDepth(y);

      npc.headTopY = y - npc.headTopOffset;
      const labelY = npc.combat ? npc.headTopY - 12 : npc.headTopY - 4;
      npc.label.setPosition(x, labelY);
      npc.label.setDepth(y + 1);

      npc.shadow.setPosition(x, y + 2);
      npc.shadow.setDepth(y - 0.5);

      if (npc.combat) {
        this.drawNpcHealthBar(npc);
        npc.hpBarBg.setDepth(y + 2);
        npc.hpBarFill.setDepth(y + 3);
      }
    }
  }

}