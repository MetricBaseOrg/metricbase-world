import Phaser from "phaser";
import {
  ATTACK_RANGE,
  CHOP_RANGE,
  directionFromDelta,
  directionFromInput,
  directionTowardTarget,
  SLIME_BRUTE_NPC_ID,
  WILD_SLIME_NPC_ID,
  PZ_MOB_PREFIX,
  type AvatarAction,
  type AvatarDirection,
  type CharacterAppearance,
  normalizeCharacterAppearance,
  MAP_HEIGHT,
  MAP_WIDTH,
  NPC_INTERACT_RANGE,
  FARM_RANGE,
  farmPlotSpan,
  farmPlotCenterOffset,
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
  TILE_WIDTH,
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
import { ITEM_ICONS } from "../ui/InventoryPanel";
import { networkManager, RemotePlayer } from "./network";
import { isPlayerZoneId, resolveZoneConfig, setPlayerZoneConfig } from "./playerZoneConfig";
import { ensureZoneAssetLoaded, getZoneAsset, zoneAssetScale, zoneAssetTextureKey } from "./zoneAssets";
import type { EditTool } from "./inputControl";
import {
  emptyPlayerZoneBuild,
  getCropMarket,
  isBuildTileBlocked,
  isGroundPaintBlocking,
  isResourceNodeBlocking,
  isZonePropSolid,
  makePlayerZoneResource,
  PLAYER_ZONE_GRID,
  WALKWAY_ZONE_PROPS,
  zoneGroundFootprint,
  zonePropFootprint,
  type PlayerZoneBuild,
} from "@metricbase/shared";
import { buildZoneMap } from "./mapData";
import { PredictedPosition, reconcilePrediction, stepPrediction } from "./prediction";
import { buildCollisionGrid, collisionStep, findPath, isWorldWalkable, type CollisionGrid } from "./pathfind";

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
  /** Overhead HP bar (shown for hurt or PvP-flagged remote players). */
  hpBar: Phaser.GameObjects.Graphics;
  /** Last drawn "hp/max/flag" key — redraw only when it changes. */
  hpBarKey: string;
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
  item_pet_penguin: "🐧",
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
  /** Item id of the planted crop (drives the hand-drawn crop art). */
  cropId?: string;
  plantedAt?: number;
  readyAt?: number;
  /** Soil-paint plots: the painted soil art IS the empty state, so the plot
   *  sprite only shows once something is growing. */
  hideWhenEmpty?: boolean;
  /** Persistent soil PNG tile drawn under built-in plots in re-skinned base
   *  zones so the tilled ground uses the new hand-drawn soil art. */
  soilBase?: Phaser.GameObjects.Sprite;
  /** Tile footprint (2 = classic 2×2 patch, 1 = single-tile plot). */
  span: number;
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
  /** Prop id of the currently-shown PNG structure (house/shop-blue), or null
   *  when the plot shows the procedural For-Sale marker. Guards async art loads
   *  against a structure change firing a stale texture swap. */
  structureProp: string | null;
  /** "x,y" keys of the 3×3 footprint tiles, so a built structure can hide the
   *  skinned grass under it (which would draw over the building's front edge). */
  footprintKeys: string[];
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

/** Nameplate text — prefixes the guild tag when the player is in a guild, and
 * appends a 📦 badge for caravan haulers in PvP zones (where cargo drops on
 * death), so they can be escorted or intercepted. */
function nameplateText(player: RemotePlayer): string {
  if (player.spectator) {
    return `[SPECTATOR] ${player.name}`;
  }
  const base = player.guildTag ? `[${player.guildTag}] ${player.name}` : player.name;
  const tier = useGameStore.getState().zoneDangerTier;
  const showCargo = player.hauling && (tier === "red" || tier === "black");
  return showCargo ? `${base} 📦` : base;
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

/**
 * Per-zone flat-tile re-skin of base zones, keyed by GroundLayer index
 * (0 grass · 1 stone · 2 water · 3 wall · 4 portal) → ground-tile asset id.
 * Rendered at worldY-2 depth so the ground occludes resource/prop bases in front
 * (embedded look). Grass stays green so node grass bases blend, as in Worlds.
 */
const ZONE_TILE_SKIN: Record<string, Record<number, string>> = {
  zone_hub: { 0: "grass", 1: "stone-path", 2: "water", 3: "grass", 4: "stone-path" },
  zone_wilderness: { 0: "grass2", 1: "stone-path", 2: "water", 3: "grass2", 4: "stone-path" },
  zone_grotto: { 0: "grass2", 1: "cave-floor", 2: "water2", 3: "cave-floor", 4: "cave-floor" },
  // Obsidian Reach: scorched arena — obsidian floor everywhere, lava pools for the water hazard.
  zone_black: { 0: "cave-floor", 1: "cave-floor", 2: "lava", 3: "cave-floor", 4: "cave-floor" },
};

/**
 * Maps a zone scenery prop id to the hand-drawn asset id that should render it,
 * where the two differ. Lets built-in zones keep their existing prop names (and
 * light/interact behaviour) while adopting the new PNG art.
 */
const SCENERY_ART_ALIAS: Record<string, string> = {
  crate: "crates",
  lamppost: "lamp",
  // lantern now has its own hand-drawn art (scenery_lantern), so it is no longer
  // aliased to the torch prop; its prop-driven light still fires via node.prop.
};

// Build-mode preview art for virtual mob dens (they render as live NPCs at play
// time). Keyed by prop id; uses the same baked mob textures as renderNpcs so the
// owner sees the actual slime while placing a den, not a blank tile.
const MOB_DEN_PREVIEW: Record<string, { key: string; size: number; originY: number }> = {
  "slime-den": { key: "mob-slime", size: 48, originY: 0.82 },
  "brute-den": { key: "mob-slime-brute", size: 80, originY: 0.86 },
};

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
  /** Skinned base-zone ground tiles indexed by "x,y", so owned land plots can
   *  hide the grass under their footprint (which would otherwise draw over the
   *  building's front edge). Only populated for re-skinned base zones. */
  private skinGroundTiles = new Map<string, Phaser.GameObjects.Image>();
  /** Ground-tile keys currently hidden under a built structure. Consulted by the
   *  async tile-load callback so a late texture-ready doesn't re-show a tile the
   *  housing state has hidden. */
  private hiddenGroundKeys = new Set<string>();
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
  /** Red tint over tiles that block movement, shown while editing (walk guide). */
  private walkGuide?: Phaser.GameObjects.Graphics;
  /** An object picked up with the Move tool, following the cursor until dropped. */
  private editHeld:
    | {
        kind: "scenery" | "resource";
        node: { tileX: number; tileY: number; prop?: string };
        origin: { x: number; y: number };
        ghost?: Phaser.GameObjects.Sprite;
      }
    | null = null;
  private editPickupTile: { x: number; y: number } | null = null;
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
  private movePathGfx?: Phaser.GameObjects.Graphics;
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
  private crystalSprite: Phaser.GameObjects.Sprite | null = null;
  private crystalLabel: Phaser.GameObjects.Text | null = null;
  private siegeState: SiegeStatePayload | null = null;
  /** Local player's mount speed multiplier, mirrored for client prediction. */
  private localSpeedMult = 1;
  private chopKey: Phaser.Input.Keyboard.Key | null = null;
  private fishKey: Phaser.Input.Keyboard.Key | null = null;
  private lastSentInput = { dx: 0, dy: 0 };
  /**
   * Last frame's delta (ms), clamped so tab-refocus spikes don't teleport
   * smoothed values. All interpolation uses dt-corrected alphas via
   * smoothAlpha() — fixed per-frame lerp factors made remote players crawl
   * and rubber-band at 30fps and snap at 120–165Hz.
   */
  private frameDelta = 16.7;
  /** Click-to-move stuck guard: last sampled position + timestamp. */
  private moveStuckPos = { x: 0, y: 0 };
  private moveStuckAt = 0;
  /** Portal name labels (proximity-shown), tracked apart from the aura/sprite. */
  private portalLabels: Array<{ text: Phaser.GameObjects.Text; x: number; y: number }> = [];
  /** Last wall-clock time movement input was non-zero (for reconcile grace). */
  private lastMovingAt = 0;
  private currentZoneId: string | null = null;
  private localChoppingUntil = 0;
  private lastFootstepAt = 0;
  private chopHitTimer: Phaser.Time.TimerEvent | null = null;
  /**
   * Invisible camera anchor tracking the predicted position. The camera
   * follows this instead of the avatar sprite so idle bob, pose swaps and
   * reconcile corrections never feed into the viewport (the "shaky screen").
   */
  private cameraTarget: Phaser.GameObjects.Rectangle | null = null;
  private cameraFollowing = false;
  private lastCameraShakeAt = 0;
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

    this.cameraTarget = this.add.rectangle(0, 0, 2, 2, 0x000000, 0).setVisible(false);

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
      // In build-edit mode, taps place/paint/erase/move instead of moving.
      if (this.worldEditing) {
        this.handleEditPointerDown(pointer);
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
          // Targeted a player for PvP; the target action bar (DuelControls)
          // offers Duel + Stats buttons for the selection.
        } else if (this.tryClickCrystal(pointer)) {
          // Struck the King Crystal during a siege.
        } else {
          this.setMoveTarget(pointer.worldX, pointer.worldY);
        }
      }
    });

    // Releasing the pointer over the map drops a Move-tool object at that tile
    // (drag-and-drop). A release on the same tile it was picked up from keeps it
    // held, so a plain click-then-click also works.
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.worldEditing) return;
      if (this.worldEditTool?.type !== "move" || !this.editHeld || !this.editPickupTile) return;
      const { tileX, tileY } = worldToTile(pointer.worldX, pointer.worldY);
      if (tileX !== this.editPickupTile.x || tileY !== this.editPickupTile.y) {
        this.dropHeldAt(tileX, tileY);
      }
    });

    // Targeting reticle drawn over the currently selected / engaged hostile.
    this.targetReticle = this.add.graphics().setDepth(120).setVisible(false);
    // Click-to-move destination marker + the faint routed path.
    this.moveMarker = this.add.graphics().setDepth(119).setVisible(false);
    this.movePathGfx = this.add.graphics().setDepth(118);

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
        entry.hpBar.destroy();
      });
      this.renderedPlayers.clear();
      // The server resets each player's lamp to off on (re)join, so mirror that.
      useGameStore.getState().setLampOn(false);
      this.localLampGlow?.setVisible(false);
      this.renderZone(zoneId);
      playSfx("zone_enter");
      // Arrival swirl at the zone's spawn tile (where the player materialises),
      // delayed so it plays just as the travel overlay fades out.
      const spawnCfg = resolveZoneConfig(zoneId);
      if (spawnCfg.spawnTile) {
        const { x: ax, y: ay } = tileToWorld(spawnCfg.spawnTile.x, spawnCfg.spawnTile.y);
        this.time.delayedCall(420, () => this.spawnPortalFx(ax, ay));
      }
    });

    // Portal departure sequence: swirl at the player's feet → magenta flash →
    // the character fades/shrinks INTO the portal and disappears. The travel
    // overlay (ZoneTransitionOverlay) covers the room switch on top of this;
    // the "portal" sfx already plays in App.tsx.
    const unsubscribeTransfer = networkManager.onTransfer(() => {
      const avatar = this.localAvatar;
      if (avatar) {
        this.spawnPortalFx(avatar.sprite.x, avatar.sprite.y);
        // Vanish: shrink + fade + a small rise, like being pulled through.
        const parts = [avatar.sprite, avatar.label, avatar.shadow, avatar.glow, avatar.pet].filter(
          (p): p is NonNullable<typeof p> => Boolean(p),
        );
        this.tweens.add({
          targets: avatar.sprite,
          scaleX: avatar.sprite.scaleX * 0.1,
          scaleY: avatar.sprite.scaleY * 0.1,
          y: avatar.sprite.y - 18,
          angle: 25,
          duration: 320,
          ease: "Back.easeIn",
        });
        this.tweens.add({
          targets: parts,
          alpha: 0,
          duration: 300,
          delay: 60,
          onComplete: () => parts.forEach((p) => p.setVisible(false)),
        });
      }
      this.time.delayedCall(150, () => this.cameras.main.flash(380, 190, 90, 235));
    });

    const unsubscribeZoneConfig = networkManager.onZoneConfigUpdate((zoneId) => {
      // Don't clobber an in-progress local edit with the server's echo.
      if (!this.worldEditing) this.refreshZoneContent(zoneId);
      // Keep the danger-tier pill in sync when a World's config is pushed
      // (including a live owner tier change: safe → red etc.).
      if (zoneId === useGameStore.getState().zoneId) {
        useGameStore.getState().setZoneDangerTier(resolveZoneConfig(zoneId).dangerTier ?? "safe");
      }
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
        if (localAttacker) this.shakeCamera(140, 0.005);
      } else {
        playSfx("attack_hit");
        if (localAttacker && payload.crit) this.shakeCamera(90, 0.004);
      }

      // Red damage flash on Mob
      const npc = this.renderedNpcs.find((entry) => entry.id === payload.npcId);
      if (npc) {
        npc.sprite.setTint(0xff4444);
        this.time.delayedCall(150, () => npc.sprite.clearTint());
      }

      // Kill juice: a smoke poof everyone sees; the killer also gets a coin
      // burst flying into them plus "+gold / +XP" floats with the real spoils.
      if (payload.defeated && npc) {
        this.spawnMobDeathFx(npc.worldX, npc.worldY - 8);
        if (localAttacker) {
          const gold = payload.goldReward ?? 0;
          const xp = payload.xpReward ?? 0;
          if (gold > 0) {
            this.spawnCoinBurstFx(npc.worldX, npc.worldY, Math.min(6, 1 + Math.ceil(gold / 5)));
            this.showFloatingLabel(npc.worldX, npc.worldY - 58, `+${gold} gold`, "#ffd75e");
          }
          if (xp > 0) {
            this.showFloatingLabel(npc.worldX + 16, npc.worldY - 42, `+${xp} XP`, "#7fd4ff", { size: 12 });
          }
        }
      }

      // Trigger attack action on remote attacker (renderedPlayers is keyed by
      // sessionId — look the attacker up by name).
      if (payload.attackerName && payload.attackerName !== useGameStore.getState().playerName) {
        const remote = this.findRenderedPlayerByName(payload.attackerName);
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
        const remote = this.findRenderedPlayerByName(payload.attackerName);
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
      // Spark burst on the mob itself — gold + ring when it's a crit.
      if (npc) {
        this.spawnImpactBurst(npc.worldX, npc.worldY - 14, payload.crit ?? false);
      }
    });

    const unsubscribePlayerDamage = networkManager.onPlayerDamage((payload) => {
      this.showPlayerDamageNumber(payload.amount);
      playSfx("player_hurt");
      // Camera shake scales with the size of the hit taken.
      this.shakeCamera(110, Math.min(0.008, 0.002 + payload.amount * 0.00012));

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
        this.spawnImpactBurst(victim.sprite.x, victim.sprite.y - 16, payload.crit ?? false);
      }
      const attacker = this.findRenderedPlayerByName(payload.attackerName);
      if (attacker && victim) {
        const angle = Phaser.Math.Angle.Between(attacker.sprite.x, attacker.sprite.y, victim.sprite.x, victim.sprite.y);
        this.spawnSlashArc((attacker.sprite.x + victim.sprite.x) / 2, (attacker.sprite.y + victim.sprite.y) / 2 - 10, angle);
      }
      const localName = useGameStore.getState().playerName;
      if (payload.attackerName === localName && payload.knockedOut) {
        this.shakeCamera(140, 0.005);
      }
      // Track my current opponent for the PvP target frame (duels manage
      // their own frame lifetime; hits keep it alive ~8s past the last blow).
      if (payload.attackerName === localName || payload.victimName === localName) {
        const opponentName = payload.attackerName === localName ? payload.victimName : payload.attackerName;
        const store = useGameStore.getState();
        if (!store.pvpOpponent?.duel || store.pvpOpponent.name === opponentName) {
          store.setPvpOpponent({
            name: opponentName,
            until: Date.now() + 8000,
            duel: store.pvpOpponent?.duel ?? false,
          });
        }
      }
    });

    // Item consumption is public: a bubble over whoever ate/drank, so PvP
    // opponents can see mid-fight potions and food.
    const unsubscribeItemUsed = networkManager.onItemUsed((payload) => {
      this.showEmote(payload.playerName, ITEM_ICONS[payload.itemId] ?? "🧪");
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

    // Fishing minigame moments (from the React card): ❗ bubble on the bite,
    // splash ripples at the spot on reel hits, a big splash + 🎉 on the catch.
    let lastFishingFxAt = 0;
    const unsubscribeFishingFx = useGameStore.subscribe((state) => {
      const fx = state.fishingFx;
      if (!fx || fx.at === lastFishingFxAt) return;
      lastFishingFxAt = fx.at;
      this.playFishingFx(fx.type);
    });

    // In-world celebration juice over the local avatar: LEVEL UP banner,
    // skill-up labels, quest-complete stars. Prev values seed from the current
    // store so logging in never fires a stale celebration.
    let prevLevel = useGameStore.getState().playerLevel;
    const unsubscribeLevelFx = useGameStore.subscribe((state) => {
      if (state.playerLevel > prevLevel && this.localAvatar) {
        const { x, y } = this.localAvatar.sprite;
        this.spawnCelebrationFx(x, y, 0xffd75e);
        this.showFloatingLabel(x, y - 62, "LEVEL UP!", "#ffd75e", { size: 20, rise: 46, duration: 1400 });
      }
      prevLevel = state.playerLevel;
    });

    const skillSnapshot = (s = useGameStore.getState()) => ({
      woodcutting: s.woodcuttingLevel,
      mining: s.miningLevel,
      fishing: s.fishingLevel,
      farming: s.farmingLevel,
    });
    const SKILL_TAGS: Record<keyof ReturnType<typeof skillSnapshot>, string> = {
      woodcutting: "🪓 Woodcutting",
      mining: "⛏️ Mining",
      fishing: "🎣 Fishing",
      farming: "🌾 Farming",
    };
    let prevSkills = skillSnapshot();
    const unsubscribeSkillFx = useGameStore.subscribe((state) => {
      const next = skillSnapshot(state);
      for (const key of Object.keys(next) as (keyof typeof next)[]) {
        if (next[key] > prevSkills[key] && this.localAvatar) {
          const { x, y } = this.localAvatar.sprite;
          this.spawnCelebrationFx(x, y, 0x69d97e);
          this.showFloatingLabel(x, y - 58, `${SKILL_TAGS[key]} Lv ${next[key]}!`, "#8ef2a0", { size: 15, rise: 40, duration: 1200 });
        }
      }
      prevSkills = next;
    });

    let prevQuestsDone = useGameStore.getState().questState.completed.length;
    const unsubscribeQuestFx = useGameStore.subscribe((state) => {
      const done = state.questState.completed.length;
      if (done > prevQuestsDone && this.localAvatar) {
        const { x, y } = this.localAvatar.sprite;
        this.spawnCelebrationFx(x, y, 0xf7c948);
        this.showFloatingLabel(x, y - 58, "Quest complete!", "#ffe08a", { size: 16, rise: 42, duration: 1300 });
      }
      prevQuestsDone = done;
    });

    // One-shot FX requested by UI panels (craft sparks over the avatar).
    let lastWorldFxAt = 0;
    const unsubscribeWorldFx = useGameStore.subscribe((state) => {
      const fx = state.worldFx;
      if (!fx || fx.at === lastWorldFxAt) return;
      lastWorldFxAt = fx.at;
      if (!this.localAvatar) return;
      const { x, y } = this.localAvatar.sprite;
      if (fx.type === "craft") {
        this.spawnCraftSparksFx(x, y);
        if (fx.label) {
          this.showFloatingLabel(x, y - 54, fx.label, "#ffc46b", { size: 14, rise: 36, duration: 1100 });
        }
      }
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
        // Same drop-and-collect juice on harvest: the crop pops from the plot,
        // lands, then flies into the player (shows the crop's hand-drawn art).
        if (payload.action === "harvest" && payload.plotId) {
          const plot = this.renderedFarmPlots.get(payload.plotId);
          if (plot) this.spawnLootDropFx(plot.worldX, plot.worldY, payload.cropId, "tree");
        }
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
        // A leftover click-to-move path would read as movement next frame and
        // instantly cancel the gather we just started.
        this.clearMoveTarget();
        this.startLocalChopHits(payload.endsAt, kind, payload.resourceId);
        if (kind === "fish") {
          useGameStore.getState().setFishing({ resourceId: payload.resourceId, endsAt: payload.endsAt });
        }
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
      // Release the chopper's pose (local or remote) — cancels arrive before
      // the session's endsAt, and the pose lock would otherwise hold till then.
      const cancelled = this.findRenderedPlayerByName(payload.playerName);
      if (cancelled) {
        cancelled.actionUntil = 0;
        cancelled.displayAction = "idle";
        cancelled.poseStartedAt = Date.now();
      }
      if (payload.playerName === useGameStore.getState().playerName) {
        this.localChoppingUntil = 0;
        this.stopLocalChopHits();
        useGameStore.getState().setFishing(null);
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
      // Release the chopper's locked gather pose NOW: it was set to hold until
      // the session's endsAt, but the fishing minigame resolves EARLY — without
      // this the character stayed frozen in the fishing stance (locked action +
      // direction) until the stale deadline passed. Covers local AND remote.
      const chopper = payload.playerName ? this.findRenderedPlayerByName(payload.playerName) : null;
      if (chopper) {
        chopper.actionUntil = 0;
        chopper.displayAction = "idle";
        chopper.poseStartedAt = Date.now();
      }
      const isLocalChopper = payload.playerName === useGameStore.getState().playerName;
      if (isLocalChopper) {
        this.localChoppingUntil = 0;
        this.stopLocalChopHits();
        useGameStore.getState().setFishing(null);
        // Fishing: the server tells us WHICH fish it was — trigger the catch
        // celebration overlay (species art + rarity burst).
        if (payload.skill === "fishing" && payload.caughtItemId) {
          useGameStore.getState().setLastCatch({
            itemId: payload.caughtItemId,
            rarity: payload.caughtRarity ?? "common",
            quantity: payload.caughtQuantity ?? 1,
            at: Date.now(),
          });
        }
        playSfx(
          payload.skill === "mining"
            ? "ore_gather"
            : payload.skill === "fishing"
              ? "fish_catch"
              : "wood_gather",
        );
        // Drop-and-collect juice for woodcutting/mining (fishing has its own
        // catch celebration). Shows the real banked item's art — crop fields
        // drop the rolled seed, trees drop wood, rocks drop ore.
        if (payload.skill !== "fishing") {
          const node = this.renderedResources.find((entry) => entry.id === payload.resourceId);
          if (node) {
            const fallbackKind = node.kind === "rock" ? "rock" : "tree";
            this.spawnLootDropFx(node.worldX, node.worldY, payload.lootItemId, fallbackKind);
          }
        }
      }
      if (payload.depleted) {
        playSfx("chop_fell");
        // Node breaks: a bigger chip burst everyone in the zone can see.
        const resource = this.renderedResources.find((entry) => entry.id === payload.resourceId);
        if (resource) {
          this.spawnGatherHitFx(resource.worldX, resource.worldY, resource.kind, true);
        }
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
      unsubscribeTransfer();
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
      unsubscribeFishingFx();
      unsubscribeLevelFx();
      unsubscribeSkillFx();
      unsubscribeQuestFx();
      unsubscribeWorldFx();
      unsubscribeWorldStats();
      unsubscribeLootBags();
      unsubscribeAdServing();
      unsubscribePvpHit();
      unsubscribeItemUsed();
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
        entry.hpBar.destroy();
      });
      this.renderedPlayers.clear();
    });
  }

  update(_time: number, delta: number) {
    this.frameDelta = Math.min(Math.max(delta, 1), 100);
    // While an object is held with the Move tool, its ghost snaps to the tile
    // under the cursor and turns red where it can't be dropped.
    const heldGhost = this.editHeld?.ghost;
    if (this.worldEditing && this.editHeld && heldGhost) {
      const held = this.editHeld;
      const ghost = heldGhost;
      const p = this.input.activePointer;
      const { tileX, tileY } = worldToTile(p.worldX, p.worldY);
      const { x, y } = tileToWorld(tileX, tileY);
      // Multi-tile buildings render at their footprint centre, so preview there.
      const n = held.kind === "scenery" ? zonePropFootprint(held.node.prop ?? "") : 1;
      const asset = held.node.prop ? getZoneAsset(held.node.prop) : undefined;
      let py = y;
      if (asset && asset.category === "structure" && asset.clearsGround && n > 1) {
        py = (y + tileToWorld(tileX + n - 1, tileY + n - 1).y) / 2;
      }
      ghost.setPosition(x, py);
      ghost.setTint(this.canDropHeldAt(tileX, tileY) ? 0xffffff : 0xff6b6b);
    }

    const chopping = Date.now() < this.localChoppingUntil;
    const blocked = isUiTypingActive() || useGameStore.getState().knockedOut;

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

      // Walking off mid-gather cancels it. The server cancels on any movement
      // input (reason "moved", no energy cost); clear the local lock right away
      // so the character responds instantly instead of waiting for chopCancel.
      // (Suppressing movement input while chopping made gathering un-cancelable.)
      if (chopping && (dx !== 0 || dy !== 0)) {
        this.localChoppingUntil = 0;
        this.stopLocalChopHits();
        useGameStore.getState().setFishing(null);
        const local = this.findLocalPlayer();
        if (local) {
          local.actionUntil = 0;
          local.displayAction = "idle";
          local.poseStartedAt = Date.now();
        }
      }

      // Epsilon compare: click-to-move produces a float unit vector that
      // wiggles a hair every frame, which used to re-send input 60×/second
      // for the whole walk. ~1° of drift is invisible; start/stop always
      // differ by far more than the epsilon so they always send.
      const inputChanged =
        Math.abs(dx - this.lastSentInput.dx) > 0.015 || Math.abs(dy - this.lastSentInput.dy) > 0.015;
      if (inputChanged) {
        networkManager.sendInput(dx, dy);
        this.lastSentInput = { dx, dy };
      }

      if (dx !== 0 || dy !== 0) this.lastMovingAt = Date.now();

      this.applyLocalPrediction(dx, dy, delta);

      if (dx !== 0 || dy !== 0) {
        const now = Date.now();
        if (now - this.lastFootstepAt > 330) {
          this.lastFootstepAt = now;
          playSfx("footstep");
        }
      }

      this.tryInteract();
      this.tryAttack();
      this.tryChop();
      this.tryFish();
    }

    // Always interpolate remote players — inside the !blocked branch they froze
    // mid-step whenever the local player typed in chat (or was knocked out),
    // then teleported to their live position when the input unblocked.
    this.interpolateRemotePlayers();

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
    this.updateWorldLabelVisibility();
    this.updatePinchZoom();
  }

  /**
   * Name tags are reserved for PLAYER characters and for things you can act
   * on: world labels (resources, NPCs, portals, plot signs) only show within
   * action distance of the character — or while that entity is mid-action
   * (being gathered, in combat, or targeted). Keeps the map free of the
   * wall-to-wall label clutter every zone used to render.
   */
  private updateWorldLabelVisibility() {
    // Reference point: the local character; camera focus while spectating.
    const local = this.findLocalPlayer();
    const cam = this.cameras.main;
    const refX = local ? local.predicted.x : cam.midPoint.x;
    const refY = local ? local.predicted.y : cam.midPoint.y;
    // ~5 tiles — names appear just before the interact prompt would.
    const NEAR = 170;
    const near = (x: number, y: number) => Math.hypot(x - refX, y - refY) <= NEAR;
    const now = Date.now();

    for (const resource of this.renderedResources) {
      const gathering = (resource.chopEndsAt ?? 0) > now;
      resource.label.setVisible(gathering || near(resource.worldX, resource.worldY));
    }
    for (const npc of this.renderedNpcs) {
      const inCombat = npc.combat && npc.currentHp > 0 && npc.currentHp < npc.maxHp;
      const targeted = this.selectedNpcId === npc.id;
      npc.label.setVisible(inCombat || targeted || near(npc.worldX, npc.worldY));
    }
    for (const portal of this.portalLabels) {
      portal.text.setVisible(near(portal.x, portal.y));
    }
    for (const plot of this.renderedLandPlots.values()) {
      plot.label.setVisible(near(plot.worldX, plot.worldY));
    }
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

    // Loot bags first — interact grabs them before anything else, but the
    // hint never said so (mobile players had no idea ✨ picks up loot).
    let bestBag: { x: number; y: number } | null = null;
    let bestBagD = CHOP_RANGE;
    for (const bag of this.renderedLootBags.values()) {
      const d = Math.hypot(px - bag.x, py - bag.y);
      if (d <= bestBagD) {
        bestBag = bag;
        bestBagD = d;
      }
    }
    if (bestBag) target = { x: bestBag.x, y: bestBag.y - 34, label: "Grab loot" };

    // Farm plots next (plant/harvest).
    let bestFarm: RenderedFarmPlot | null = null;
    let bestFarmD = FARM_RANGE;
    for (const plot of this.renderedFarmPlots.values()) {
      const d = Math.hypot(px - plot.worldX, py - plot.worldY);
      if (d <= bestFarmD) {
        bestFarm = plot;
        bestFarmD = d;
      }
    }
    if (!target && bestFarm) {
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
    if (this.cameraFollowing) {
      this.cameras.main.stopFollow();
      this.cameraFollowing = false;
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

    if (local && this.cameraTarget) {
      // Follow the invisible camera anchor (kept on the predicted position),
      // not the avatar sprite — sprite-level bob and pose changes must never
      // move the viewport. Offset lifts the focus to the torso (origin is at
      // the feet).
      if (!this.cameraFollowing) {
        this.cameraFollowing = true;
        this.cameraTarget.setPosition(local.predicted.x, local.predicted.y);
        cam.startFollow(this.cameraTarget, true, 0.18, 0.18);
        cam.setFollowOffset(0, 18);
      }
      return;
    }

    if (this.cameraFollowing) {
      cam.stopFollow();
      this.cameraFollowing = false;
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
      hp: 0,
      maxHp: 0,
      stamina: 0,
      hauling: false,
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

      // Keep a grace window after input stops: server patches in flight still
      // show the position from ~latency ago, and snapping to them is what
      // knocked the character backward on every stop. 700ms covers mobile
      // round-trips — with 400ms the server hadn't always settled before the
      // idle pull kicked in, shoving the character at the end of a click-walk.
      const moving =
        this.lastSentInput.dx !== 0 ||
        this.lastSentInput.dy !== 0 ||
        Date.now() - this.lastMovingAt < 700;
      existing.predicted = reconcilePrediction(
        existing.predicted,
        { x: player.x, y: player.y },
        moving,
      );
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
    rendered.hpBar.destroy();
    this.renderedPlayers.delete(sessionId);
  }

  /**
   * Overhead HP bar for remote players: visible while they're hurt or
   * PvP-flagged so opponents can read the fight. Local player uses the HUD.
   */
  private updatePlayerHpBar(entry: RenderedPlayer, player: RemotePlayer, isLocal: boolean) {
    const show =
      !isLocal && !player.spectator && player.maxHp > 0 && (player.hp < player.maxHp || player.pvpFlagged);
    const key = show ? `${player.hp}/${player.maxHp}/${player.pvpFlagged ? 1 : 0}` : "hidden";
    if (key === entry.hpBarKey) return;
    entry.hpBarKey = key;
    entry.hpBar.clear();
    entry.hpBar.setVisible(show);
    if (!show) return;
    const w = 34;
    const h = 4.5;
    const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    const color = pct > 0.5 ? 0x4bc07f : pct > 0.25 ? 0xe0a92e : 0xd85f4f;
    entry.hpBar.fillStyle(0x2a1d12, 0.85).fillRoundedRect(-w / 2 - 1, -1, w + 2, h + 2, 3);
    entry.hpBar.fillStyle(0x554433, 0.9).fillRoundedRect(-w / 2, 0, w, h, 2);
    if (pct > 0) entry.hpBar.fillStyle(color, 1).fillRoundedRect(-w / 2, 0, Math.max(2.5, w * pct), h, 2);
  }

  private destroyAllLocalPlayerEntries() {
    this.destroyLocalAvatar();
    const playerName = useGameStore.getState().playerName;
    for (const [sessionId, rendered] of [...this.renderedPlayers.entries()]) {
      // Match raw name too — the label carries a [GUILD] tag for guild members.
      if (rendered.name === playerName || rendered.label.text === playerName || sessionId === networkManager.sessionId) {
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

  /** Distance above the feet to place the nameplate, so it always clears the
   *  head of whatever sprite is showing — the HD frames are taller than the
   *  procedural doll, so a fixed offset would let the art cover the name. */
  private nameplateOffset(rendered: RenderedPlayer): number {
    return rendered.sprite.displayHeight * rendered.sprite.originY + 4;
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

    const hpBar = this.add.graphics().setDepth(1001).setVisible(false);

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
      hpBar,
      hpBarKey: "",
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
    const petAlpha = this.smoothAlpha(0.18);
    const targetX = entry.sprite.x - 16;
    const targetY = entry.sprite.y - 6;
    entry.petX = Phaser.Math.Linear(entry.petX, targetX, petAlpha);
    entry.petY = Phaser.Math.Linear(entry.petY, targetY, petAlpha);
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
    const skin = playerZone ? undefined : ZONE_TILE_SKIN[zoneId];

    // Flat re-skin: render this base zone's ground with hand-drawn tile art
    // (like a player World) instead of the iso-cube tileset. Depth = worldY - 2
    // (same as placeGroundTile) so ground tiles IN FRONT of a resource/prop
    // occlude its base — the "embedded in the terrain" look that keeps nodes
    // sitting flush instead of perched on a raised pedestal.
    if (skin) {
      const config = resolveZoneConfig(zoneId);
      // Built-in farm plots draw their own 2×2 soil PNG base, so hide the grass
      // under their footprint (otherwise the front grass tile occludes the soil
      // edge, the same way it would a building base).
      const covered = new Set<string>();
      for (const f of config.farmPlots ?? []) {
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) covered.add(`${f.tileX + dx},${f.tileY + dy}`);
      }
      // Multi-tile building props (e.g. Rudi's stall) bake their own ground base,
      // so hide the grass under their footprint too — otherwise the front grass
      // tile occludes the building's base edge (same reason as farm plots above).
      for (const s of config.scenery ?? []) {
        const art = getZoneAsset(SCENERY_ART_ALIAS[s.prop] ?? s.prop);
        if (!art?.clearsGround || art.footprint < 2) continue;
        for (let dy = 0; dy < art.footprint; dy++)
          for (let dx = 0; dx < art.footprint; dx++) covered.add(`${s.tileX + dx},${s.tileY + dy}`);
      }
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (covered.has(`${x},${y}`)) continue;
          const type = skin[ground[y][x]] ?? skin[0];
          const asset = getZoneAsset(type);
          if (!asset) continue;
          const { x: worldX, y: worldY } = tileToWorld(x, y);
          const key = zoneAssetTextureKey(type);
          const tileKey = `${x},${y}`;
          const img = this.add.image(worldX, worldY, key).setOrigin(0.5, asset.anchorY).setDepth(worldY - 2);
          const applyReady = () => {
            // Don't re-show a tile the housing state has hidden under a building.
            if (img.active)
              img
                .setTexture(key)
                .setScale(zoneAssetScale(this, type))
                .setOrigin(0.5, asset.anchorY)
                .setVisible(!this.hiddenGroundKeys.has(tileKey));
          };
          if (this.textures.exists(key)) applyReady();
          else {
            img.setVisible(false);
            ensureZoneAssetLoaded(this, type, applyReady);
          }
          this.mapTiles.push(img);
          this.skinGroundTiles.set(tileKey, img);
        }
      }
    }

    for (let y = 0; !playerZone && !skin && y < MAP_HEIGHT; y++) {
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

    if (!playerZone && !skin) this.renderGroundDetails(zoneId, ground);
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

  /** Scale a sprite so its texture renders at `targetWidth` world px, whatever
   *  the source size is. Keeps the small procedural textures AND the 512px
   *  hand-drawn art (which would otherwise render ~9× too big) at the intended
   *  world scale. */
  private scaleSpriteToWidth(sprite: Phaser.GameObjects.Sprite, targetWidth: number) {
    const w = sprite.width || targetWidth;
    sprite.setScale(targetWidth / w);
  }

  private renderPortals(zoneId: string) {
    const config = resolveZoneConfig(zoneId);
    for (const portal of config.portals) {
      const { x, y } = tileToWorld(portal.tileX, portal.tileY);

      // Pulsing magenta aura behind the gate (reuses the soft glow texture).
      const aura = this.add
        .image(x, y - 12, "lamp-glow")
        .setTint(0xc14fe0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(64, 64)
        .setDepth(y - 1)
        .setAlpha(0.5);
      this.tweens.add({ targets: aura, alpha: 0.85, scale: aura.scale * 1.12, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

      // 1×1-tile gate, mirrored so the arch faces into the isometric world.
      // Depth is lifted past the next ground row so front-edge grass tiles
      // (drawn at their own row depth) can never cover the gate's base.
      const sprite = this.add.sprite(x, y, "portal_gate").setOrigin(0.5, 0.84).setDepth(y + 14);
      this.scaleSpriteToWidth(sprite, TILE_WIDTH);
      sprite.setFlipX(true);
      this.tweens.add({ targets: sprite, y: y - 3, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

      const label = this.add
        .text(x, y - 56, portal.label, {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "12px",
          fontStyle: "bold",
          color: "#f3d0ff",
          stroke: "#3a1148",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 15);

      this.renderedPortals.push(aura, sprite, label);
      this.portalLabels.push({ text: label, x, y });
    }
  }

  private clearPortals() {
    this.renderedPortals.forEach((obj) => obj.destroy());
    this.renderedPortals = [];
    this.portalLabels = [];
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
    for (const f of config.farmPlots ?? []) { const span = farmPlotSpan(f); for (let dy = 0; dy < span; dy++) for (let dx = 0; dx < span; dx++) mark(f.tileX + dx, f.tileY + dy); }
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
      // Player-zone props render from lazily-loaded PNG art. Re-skinned base
      // zones also use the hand-drawn PNG art wherever a prop has one (e.g.
      // hedge/bench/signpost); props with no PNG match (lamppost, lantern,
      // plant, crate, blackjack…) return undefined and fall through to the
      // procedural scenery_<prop> textures, keeping their lights + interacts.
      const useArt = isPlayerZoneId(zoneId) || Boolean(ZONE_TILE_SKIN[zoneId]);
      // Some props render under a different art id (e.g. crate→crates,
      // lamppost→lamp, lantern→torch) while keeping their prop-driven lights.
      const artProp = SCENERY_ART_ALIAS[node.prop] ?? node.prop;
      const asset = useArt ? getZoneAsset(artProp) : undefined;
      // Virtual assets (mob dens) also spawn a live combat NPC (the server derives
      // an npc `pzmob_<prop>_<id>` from the same scenery node, but leaves the node
      // IN scenery). That live NPC — drawn by renderNpcs — is the real slime, so
      // we must NOT also draw a preview here or it double-renders on top of it.
      // Only a freshly-placed, unsaved den (no derived npc yet) needs a preview so
      // the owner can see what they just dropped while editing.
      if (asset?.virtual) {
        const hasLiveNpc = (config.npcs ?? []).some(
          (n) => n.id === `${PZ_MOB_PREFIX}${node.prop}_${node.id}`,
        );
        const denKey = MOB_DEN_PREVIEW[node.prop];
        if (!hasLiveNpc && denKey && this.textures.exists(denKey.key)) {
          const den = this.add
            .sprite(x, y, denKey.key)
            .setOrigin(0.5, denKey.originY)
            .setDepth(y);
          den.setDisplaySize(denKey.size, denKey.size);
          this.renderedScenery.push(den);
        }
        continue;
      }
      if (asset) {
        const key = zoneAssetTextureKey(artProp);
        const N = asset.footprint;
        // Multi-tile buildings carry a baked N×N ground base. The placed tile is
        // the back corner; anchor the base by its centre at the footprint's
        // centre so it sits FLUSH with the ground (not raised on a pedestal), and
        // depth-sort by the front tile's world Y so the player passes behind/in
        // front correctly.
        // Any multi-tile structure (incl. the bridge, which doesn't clear the
        // ground under it) is anchored on its footprint centre.
        const isBuilding = asset.category === "structure" && N > 1;
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
          sprite.setTexture(key).setScale(zoneAssetScale(this, artProp)).setOrigin(0.5, originY).setVisible(true);
        };
        if (this.textures.exists(key)) applyReady();
        else {
          sprite.setVisible(false);
          ensureZoneAssetLoaded(this, artProp, applyReady);
        }
        this.renderedScenery.push(sprite);
        // Keep prop-driven lights (lamppost/lantern/…) even on the PNG path.
        this.addSceneryLight(node.prop, px, py);
        // Placed crop markets + Shop buildings are functional: walk up + interact.
        const market = getCropMarket(node.prop);
        if (market) {
          this.interactableScenery.push({
            id: node.id,
            worldX: px,
            worldY: py,
            label: `Trade at ${market.label}`,
          });
        } else if (node.prop === "shop-blue") {
          this.interactableScenery.push({ id: node.id, worldX: px, worldY: py, label: "Shop with Rudi" });
        }
        continue;
      }
      const sprite = this.add.sprite(x, y, `scenery_${node.prop}`).setOrigin(0.5, flat ? 0.5 : 0.92);
      // Hand-drawn scenery art is 512px — scale it to a 1×1 tile. Procedural
      // textures (crate/lamppost/hedge/bench, which have no art yet) are
      // authored at display size, so only hi-res textures are rescaled.
      if (sprite.width > TILE_WIDTH * 2) this.scaleSpriteToWidth(sprite, TILE_WIDTH);
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

      this.addSceneryLight(node.prop, x, y);
    }
  }

  /** Cast a warm, night-flickering glow for a light-emitting prop. Shared by the
   *  procedural and PNG scenery paths so aliased art (lamppost→lamp,
   *  lantern→torch) keeps its light. */
  private addSceneryLight(prop: string, x: number, y: number) {
    const lightSpec: Record<string, { dy: number; size: number; type: "lamp" | "fire"; tint?: number }> = {
      // Stone-lantern art — the lit bulb sits ~16px above the base. Same art (and
      // glow) whether placed as a base-zone "lamppost" or a Worlds "lamp".
      lamp: { dy: -16, size: LAMP_GLOW_DIAMETER * 0.85, type: "lamp" },
      lamppost: { dy: -16, size: LAMP_GLOW_DIAMETER * 0.85, type: "lamp" },
      // Fire-brazier art — flame near the top. Placed as base-zone "lantern" or
      // Worlds "torch"; a warm, flickering fire light.
      torch: { dy: -40, size: LAMP_GLOW_DIAMETER * 0.72, type: "fire", tint: 0xff8a36 },
      lantern: { dy: -40, size: LAMP_GLOW_DIAMETER * 0.72, type: "fire", tint: 0xff8a36 },
      fireplace: { dy: -10, size: LAMP_GLOW_DIAMETER * 0.95, type: "fire", tint: 0xff8a36 },
    };
    const spec = lightSpec[prop];
    if (!spec) return;
    const glow = this.makeGlow()
      .setPosition(x, y + spec.dy)
      .setDisplaySize(spec.size, spec.size)
      .setVisible(true);
    if (spec.tint) glow.setTint(spec.tint);
    this.sceneryLights.push({ glow, type: spec.type, phase: Math.random() * Math.PI * 2 });
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
      // Multi-tile ground paint (e.g. the 2×2 river): the painted tile is the
      // back corner; its art covers the whole footprint, so hide the default
      // ground beneath it and render it once, separately from the tile loop.
      const multi: { x: number; y: number; type: string }[] = [];
      for (const [key, type] of painted) {
        const n = getZoneAsset(type)?.footprint ?? 1;
        if (n <= 1) continue;
        const [x, y] = key.split(",").map(Number);
        multi.push({ x, y, type });
        for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) covered.add(`${x + dx},${y + dy}`);
      }
      const gridSize = config.gridSize ?? PLAYER_ZONE_GRID;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (covered.has(`${x},${y}`)) continue;
          this.placeGroundTile(x, y, painted.get(`${x},${y}`) ?? "grass");
        }
      }
      for (const m of multi) this.placeGroundTile(m.x, m.y, m.type);
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
    // Multi-tile ground art (2×2 river) is anchored on its footprint centre.
    const n = asset.footprint;
    const { x, y } = tileToWorld(tileX + (n - 1) / 2, tileY + (n - 1) / 2);
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
    this.clearFarmPlots();
    this.clearPortals();
    this.clearNpcs();
    this.renderGroundPaint(zoneId);
    this.renderResources(zoneId);
    this.renderLandPlots(zoneId);
    this.renderFarmPlots(zoneId);
    this.renderScenery(zoneId);
    this.renderPortals(zoneId);
    // NPCs (e.g. player-World slime dens) are config-driven too. Without this,
    // a direct login to a World renders the placeholder config (no NPCs) and the
    // slimes never appear until a gate round-trip re-caches the config.
    this.renderNpcs(zoneId);
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
    this.drawWalkGuide();
  }

  endWorldEdit() {
    this.worldEditing = false;
    this.worldEditTool = null;
    this.editGrid?.destroy();
    this.editGrid = undefined;
    this.spawnMarker?.destroy();
    this.spawnMarker = undefined;
    this.walkGuide?.destroy();
    this.walkGuide = undefined;
    this.editHeld?.ghost?.destroy();
    this.editHeld = null;
    this.editPickupTile = null;
    // Re-render from the latest saved config: content derived server-side
    // (soil farm plots, moved exit portal after an expand) appears immediately
    // instead of waiting for a zone re-enter — config pushes are skipped while
    // editing, so this catches the scene up.
    if (this.currentZoneId) this.refreshZoneContent(this.currentZoneId);
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

  private handleEditPointerDown(pointer: Phaser.Input.Pointer) {
    const { tileX, tileY } = worldToTile(pointer.worldX, pointer.worldY);
    if (this.worldEditTool?.type === "move") {
      if (this.editHeld) {
        // Second tap of a click-to-move: drop the held object here.
        this.dropHeldAt(tileX, tileY);
      } else {
        // Pick up whatever object sits on this tile and carry it.
        this.pickUpAt(tileX, tileY);
        this.editPickupTile = this.editHeld ? { x: tileX, y: tileY } : null;
      }
      return;
    }
    this.applyEditAtTile(tileX, tileY);
  }

  /** Grab the topmost scenery/resource whose footprint covers this tile. */
  private pickUpAt(tileX: number, tileY: number) {
    const draft = this.worldEditDraft;
    if (!draft) return;
    for (let i = draft.scenery.length - 1; i >= 0; i--) {
      const s = draft.scenery[i];
      const n = zonePropFootprint(s.prop);
      if (tileX >= s.tileX && tileX < s.tileX + n && tileY >= s.tileY && tileY < s.tileY + n) {
        const [node] = draft.scenery.splice(i, 1);
        this.editHeld = { kind: "scenery", node, origin: { x: node.tileX, y: node.tileY }, ghost: this.makeGhost(node.prop) };
        this.applyDraftLive(false);
        return;
      }
    }
    for (let i = draft.resources.length - 1; i >= 0; i--) {
      const r = draft.resources[i];
      if (r.tileX === tileX && r.tileY === tileY) {
        const [node] = draft.resources.splice(i, 1);
        this.editHeld = { kind: "resource", node, origin: { x: node.tileX, y: node.tileY }, ghost: this.makeGhost(node.prop) };
        this.applyDraftLive(false);
        return;
      }
    }
  }

  /** A translucent sprite that follows the cursor while an object is held. */
  private makeGhost(prop?: string): Phaser.GameObjects.Sprite | undefined {
    if (!prop || !getZoneAsset(prop)?.file) return undefined;
    const key = zoneAssetTextureKey(prop);
    const asset = getZoneAsset(prop);
    const originY = asset?.anchorY ?? 0.9;
    const ghost = this.add.sprite(0, 0, key).setOrigin(0.5, originY).setDepth(1_000_001).setAlpha(0.7);
    const applyReady = () => {
      if (ghost.active) ghost.setTexture(key).setScale(zoneAssetScale(this, prop)).setVisible(true);
    };
    if (this.textures.exists(key)) applyReady();
    else {
      ghost.setVisible(false);
      ensureZoneAssetLoaded(this, prop, applyReady);
    }
    return ghost;
  }

  /** True if the held object fits on the grid here without trapping the spawn. */
  private canDropHeldAt(tileX: number, tileY: number): boolean {
    if (!this.editHeld) return false;
    const n = this.editHeld.kind === "scenery" ? zonePropFootprint(this.editHeld.node.prop ?? "") : 1;
    const gridSize = this.editGridSize();
    if (tileX < 0 || tileY < 0 || tileX + n > gridSize || tileY + n > gridSize) return false;
    // Keep the visitor spawn tile walkable: a solid prop can't cover it.
    const prop = this.editHeld.node.prop;
    const spawn = this.worldEditDraft?.spawnTile;
    if (prop && isZonePropSolid(prop) && spawn) {
      for (let dy = 0; dy < n; dy++)
        for (let dx = 0; dx < n; dx++)
          if (tileX + dx === spawn.x && tileY + dy === spawn.y) return false;
    }
    return true;
  }

  /** Place the held object at a tile (or back at its origin if it doesn't fit). */
  private dropHeldAt(tileX: number, tileY: number) {
    const held = this.editHeld;
    const draft = this.worldEditDraft;
    if (!held || !draft) return;
    let tx = tileX;
    let ty = tileY;
    if (!this.canDropHeldAt(tileX, tileY)) {
      // Doesn't fit / would trap the spawn — snap it back where it came from.
      tx = held.origin.x;
      ty = held.origin.y;
    }
    held.node.tileX = tx;
    held.node.tileY = ty;
    if (held.kind === "scenery") draft.scenery.push(held.node as (typeof draft.scenery)[number]);
    else draft.resources.push(held.node as (typeof draft.resources)[number]);
    held.ghost?.destroy();
    this.editHeld = null;
    this.editPickupTile = null;
    this.applyDraftLive(false);
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
    const gridSize = this.editGridSize();
    if (tileX < 0 || tileY < 0 || tileX >= gridSize || tileY >= gridSize) return;
    // Multi-tile assets (2×2 river/bridge, 3×3 homes) must fit inside the grid.
    if (tool.type === "prop" || tool.type === "ground") {
      const fp = getZoneAsset(tool.value)?.footprint ?? 1;
      if (tileX + fp > gridSize || tileY + fp > gridSize) return;
    }

    let groundChanged = false;
    if (tool.type === "spawn") {
      // Visitors arrive here — refuse tiles inside a building footprint or an
      // unbridged river (the server rejects such saves too).
      if (isBuildTileBlocked(draft, tileX, tileY)) return;
      draft.spawnTile = { x: tileX, y: tileY };
      this.drawSpawnMarker(tileX, tileY);
      this.drawWalkGuide();
      return;
    } else if (tool.type === "prop") {
      const id = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const asset = getZoneAsset(tool.value);
      // Safety: don't let a solid prop cover the visitor spawn (would trap it).
      if (isZonePropSolid(tool.value) && this.footprintCoversSpawn(tool.value, tileX, tileY)) return;
      if (asset?.category === "resource" && asset.resourceKind) {
        // Resource assets become functional gather nodes visitors can harvest.
        draft.resources.push(makePlayerZoneResource(id, tool.value, asset.resourceKind, asset.label, tileX, tileY));
      } else {
        draft.scenery.push({ id, tileX, tileY, prop: tool.value });
      }
    } else if (tool.type === "ground") {
      // Safety: blocking paint (river) can't cover the visitor spawn tile.
      if (isGroundPaintBlocking(tool.value)) {
        const n = zoneGroundFootprint(tool.value);
        const spawn = draft.spawnTile;
        if (spawn.x >= tileX && spawn.x < tileX + n && spawn.y >= tileY && spawn.y < tileY + n) return;
      }
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
        // Painted ground may span multiple tiles (2×2 river): erase the paint
        // whose footprint covers the tapped tile, not just an exact match.
        const ti = draft.tiles.findIndex((t) => {
          const n = getZoneAsset(t.type)?.footprint ?? 1;
          return tileX >= t.x && tileX < t.x + n && tileY >= t.y && tileY < t.y + n;
        });
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
    // Keep local collision in sync while editing (rivers/buildings block live).
    this.rebuildCollisionGrid(zoneId);
    this.drawWalkGuide();
  }

  /** Does the prop's footprint, placed here, cover the visitor spawn tile? */
  private footprintCoversSpawn(prop: string, tileX: number, tileY: number): boolean {
    const spawn = this.worldEditDraft?.spawnTile;
    if (!spawn) return false;
    const n = zonePropFootprint(prop);
    for (let dy = 0; dy < n; dy++)
      for (let dx = 0; dx < n; dx++)
        if (tileX + dx === spawn.x && tileY + dy === spawn.y) return true;
    return false;
  }

  /**
   * Walkability guide shown while editing: tiles that block movement (solid
   * props and their footprints) are tinted red, and the visitor spawn tile is
   * tinted green, so the owner can see the zone stays walkable as they build.
   */
  private drawWalkGuide() {
    const draft = this.worldEditDraft;
    if (!draft) return;
    if (!this.walkGuide) this.walkGuide = this.add.graphics().setDepth(100_500);
    const g = this.walkGuide;
    g.clear();
    const fillTile = (tx: number, ty: number, color: number) => {
      const a = tileToWorld(tx, ty);
      const b = tileToWorld(tx + 1, ty);
      const c = tileToWorld(tx + 1, ty + 1);
      const d = tileToWorld(tx, ty + 1);
      g.fillStyle(color, 0.3);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.lineTo(c.x, c.y);
      g.lineTo(d.x, d.y);
      g.closePath();
      g.fillPath();
    };
    // Walkways (bridges) open their tiles even over a river.
    const bridged = new Set<string>();
    for (const s of draft.scenery) {
      if (!WALKWAY_ZONE_PROPS.has(s.prop)) continue;
      const n = zonePropFootprint(s.prop);
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) bridged.add(`${s.tileX + dx},${s.tileY + dy}`);
    }
    // Blocking ground paint (rivers) is impassable unless bridged.
    for (const t of draft.tiles) {
      if (!isGroundPaintBlocking(t.type)) continue;
      const n = zoneGroundFootprint(t.type);
      for (let dy = 0; dy < n; dy++)
        for (let dx = 0; dx < n; dx++)
          if (!bridged.has(`${t.x + dx},${t.y + dy}`)) fillTile(t.x + dx, t.y + dy, 0x5a97e0);
    }
    for (const s of draft.scenery) {
      if (!isZonePropSolid(s.prop)) continue;
      const n = zonePropFootprint(s.prop);
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) fillTile(s.tileX + dx, s.tileY + dy, 0xff5a5a);
    }
    // Fishing nodes (ponds/pools) block their tile like water.
    for (const r of draft.resources) {
      if (isResourceNodeBlocking(r)) fillTile(r.tileX, r.tileY, 0x5a97e0);
    }
    fillTile(draft.spawnTile.x, draft.spawnTile.y, 0x4be08a);
  }

  /** A subtle iso grid so the owner can see where taps land while editing. */
  private drawEditGrid() {
    this.editGrid?.destroy();
    const size = this.editGridSize();
    const g = this.add.graphics().setDepth(118).setAlpha(0.35);
    g.lineStyle(1, 0xffffff, 0.5);
    for (let i = 0; i <= size; i++) {
      const a = tileToWorld(i, 0);
      const b = tileToWorld(i, size);
      g.lineBetween(a.x, a.y, b.x, b.y);
      const c = tileToWorld(0, i);
      const d = tileToWorld(size, i);
      g.lineBetween(c.x, c.y, d.x, d.y);
    }
    this.editGrid = g;
  }

  /** Grid size of the zone being edited (expanded Worlds are bigger than 24). */
  private editGridSize(): number {
    const zoneId = this.worldEditZoneId ?? this.currentZoneId ?? "";
    return resolveZoneConfig(zoneId)?.gridSize ?? PLAYER_ZONE_GRID;
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
      const sprite = this.add.sprite(x, y, "billboard").setOrigin(0.5, 0.92).setDepth(y).setDisplaySize(150, 124);
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
      const sprite = this.add.sprite(x, y, "billboard").setOrigin(0.5, 0.92).setDepth(y).setDisplaySize(150, 124);
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
    // Re-skinned base zones render built-in tilled plots on the hand-drawn soil
    // PNG (a persistent 2×2 base tile) instead of the old procedural patch.
    const skinned = Boolean(ZONE_TILE_SKIN[zoneId]);
    for (const plot of config.farmPlots ?? []) {
      // Soil-paint plots (player zones) are single tiles whose painted soil art
      // is the empty state; built-in plots use the 2×2 procedural patch (or 1×1
      // when the plot declares size:1).
      const soilPlot = plot.id.startsWith("soil_");
      const span = farmPlotSpan(plot);
      const centerOffset = farmPlotCenterOffset(plot);
      const { x, y } = tileToWorld(plot.tileX + centerOffset, plot.tileY + centerOffset);
      // Built-in plots in a re-skinned zone: lay a soil PNG base under the plot
      // and hide the (procedural) crop sprite while empty, so the tilled ground
      // shows the new soil art rather than the old brown patch.
      const useSoilArt = skinned && !soilPlot;
      let soilBase: Phaser.GameObjects.Sprite | undefined;
      if (useSoilArt) {
        const key = zoneAssetTextureKey("soil");
        const asset = getZoneAsset("soil");
        soilBase = this.add.sprite(x, y, key).setOrigin(0.5, asset?.anchorY ?? 0.387).setDepth(y - 2);
        const applySoil = () => {
          if (!soilBase?.active) return;
          // Scale one soil tile to cover the plot's span×span footprint. The
          // soil art is a chunky 3D block (raised top + side walls), so abutting
          // single-tile plots leave grass showing through at the seams; overlap
          // them ~30% so adjacent beds merge into one solid field.
          const soilMul = span === 1 ? 1.3 : span;
          soilBase.setTexture(key).setScale(zoneAssetScale(this, "soil") * soilMul).setVisible(true);
        };
        if (this.textures.exists(key)) applySoil();
        else {
          soilBase.setVisible(false);
          ensureZoneAssetLoaded(this, "soil", applySoil);
        }
      }
      const sprite = this.add.sprite(x, y, "plot_empty");
      sprite.setOrigin(0.5, 0.526);
      sprite.setDepth(y);
      if (soilPlot || useSoilArt) {
        sprite.setVisible(false);
      }
      if (soilPlot) {
        sprite.setScale(0.62);
      }
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
        hideWhenEmpty: soilPlot || useSoilArt,
        soilBase,
        span,
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
      plot.soilBase?.destroy();
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
      const footprintKeys: string[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) footprintKeys.push(`${plot.tileX + dx},${plot.tileY + dy}`);
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
        structureProp: null,
        footprintKeys,
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
      // Hide the skinned grass under a built structure's 3×3 footprint so the
      // front-row ground tiles don't draw over the building's base (they render
      // at worldY-2, ahead of the building's centre depth). For-sale plots keep
      // their grass. No-op in non-skinned zones (map is empty there).
      for (const key of plot.footprintKeys) {
        if (owned) this.hiddenGroundKeys.add(key);
        else this.hiddenGroundKeys.delete(key);
        this.skinGroundTiles.get(key)?.setVisible(!owned);
      }
      if (owned) {
        // Owned plots render the hand-drawn PNG house/shop (3×3, footprint-centred
        // on the plot's centre tile) so player structures match the new art in the
        // re-skinned base zones. The single-look PNGs supersede the old procedural
        // roof-colour variants.
        const prop = state.structure === "shop" ? "shop-blue" : "house";
        plot.structureProp = prop;
        const asset = getZoneAsset(prop);
        const key = zoneAssetTextureKey(prop);
        const applyArt = () => {
          // A later state change may have re-pointed this plot; bail if so.
          if (!plot.sprite.active || plot.structureProp !== prop || !asset) return;
          plot.sprite
            .setTexture(key)
            .setOrigin(0.5, asset.anchorY)
            .setScale(zoneAssetScale(this, prop))
            .setDepth(plot.worldY);
        };
        if (this.textures.exists(key)) applyArt();
        else ensureZoneAssetLoaded(this, prop, applyArt);
      } else {
        plot.structureProp = null;
        plot.sprite.setTexture("plot_marker").setOrigin(0.5, 0.667).setScale(1).setDepth(plot.worldY);
      }
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
      plot.cropId = state.cropId;
      plot.plantedAt = state.plantedAt;
      plot.readyAt = state.readyAt;
      this.applyPlotVisual(plot);
      plot.label.setText(state.stage === "ready" ? "Ready!" : "Plot");
      plot.label.setVisible(state.stage === "ready");
      if (state.stage !== "growing") {
        plot.barBg.clear();
        plot.barFill.clear();
      }
    }
  }

  /** Hand-drawn crop art per planted crop id; null falls back to procedural. */
  private plotCropAssetId(cropId?: string): string | null {
    if (cropId === "item_carrot") return "crop-carrot";
    if (cropId === "item_wheat") return "crop-wheat";
    return null;
  }

  /**
   * Point the plot sprite at the right visual for its stage. Growing plots
   * keep the procedural sprout art (seeds must LOOK like seeds — showing the
   * ripe crop art early made plots read as harvestable at planting). Only a
   * READY plot swaps to the hand-drawn crop art (wheat/carrot). Works for both
   * built-in 2×2 plots (base zones) and soil-paint plots (player Worlds).
   */
  private applyPlotVisual(plot: RenderedFarmPlot) {
    const { sprite } = plot;
    // Single-tile plots (soil paint or size:1 built-ins) draw at the smaller
    // footprint; classic 2×2 plots keep the full-size art.
    const singleTile = plot.span === 1;
    // Soil-paint plots show the sprite only once something is planted.
    if (plot.hideWhenEmpty) sprite.setVisible(plot.stage !== "empty");

    const assetId = plot.stage === "ready" ? this.plotCropAssetId(plot.cropId) : null;
    if (!assetId) {
      const texture =
        plot.stage === "ready" ? "plot_ready" : plot.stage === "growing" ? "plot_growing" : "plot_empty";
      sprite.setTexture(texture).setOrigin(0.5, 0.526);
      // Target width scales procedural stages (128px: growing/ready) and the
      // 512px plot_empty art to the same footprint. 80px matches the classic
      // 0.62×128 single-tile look; 2×2 built-in plots span their real 128px.
      this.scaleSpriteToWidth(sprite, singleTile ? 80 : 128);
      return;
    }

    const key = zoneAssetTextureKey(assetId);
    const apply = () => {
      if (!sprite.active || plot.stage !== "ready") return;
      const asset = getZoneAsset(assetId);
      sprite
        .setTexture(key)
        .setOrigin(0.5, asset?.anchorY ?? 0.5)
        // 2×2 plots span the full footprint (like their soil base); single-tile
        // plots (soil paint or size:1) draw at 1×.
        .setScale(zoneAssetScale(this, assetId) * (singleTile ? 1 : 2))
        .setVisible(true);
    };
    if (this.textures.exists(key)) {
      apply();
    } else {
      if (plot.hideWhenEmpty) sprite.setVisible(false);
      ensureZoneAssetLoaded(this, assetId, apply);
    }
  }

  private updateFarmPlots() {
    const now = Date.now();
    for (const plot of this.renderedFarmPlots.values()) {
      if (plot.stage !== "growing" || !plot.plantedAt || !plot.readyAt) continue;
      // Client-side flip to ready if the broadcast hasn't arrived yet.
      if (now >= plot.readyAt) {
        plot.stage = "ready";
        this.applyPlotVisual(plot);
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
    this.skinGroundTiles.clear();
    this.hiddenGroundKeys.clear();
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

    // Hand-drawn configurations for NPCs and mobs
    const HD_CONFIGS: Record<string, { size: number; originY: number; shadowW: number; headOffset: number }> = {
      "npc-pip": { size: 64, originY: 0.9, shadowW: 26, headOffset: 58 },
      "npc-guide": { size: 64, originY: 0.9, shadowW: 26, headOffset: 58 },
      "npc-smith": { size: 64, originY: 0.9, shadowW: 26, headOffset: 58 },
      "npc-warden": { size: 64, originY: 0.9, shadowW: 26, headOffset: 58 },
      "npc-rook": { size: 64, originY: 0.9, shadowW: 26, headOffset: 58 },
      "mob-slime": { size: 48, originY: 0.82, shadowW: 24, headOffset: 38 },
      "mob-slime-brute": { size: 80, originY: 0.86, shadowW: 36, headOffset: 68 },
      "mob-ember-slime": { size: 48, originY: 0.82, shadowW: 24, headOffset: 38 },
      "mob-void-brute": { size: 80, originY: 0.86, shadowW: 36, headOffset: 68 },
      "mob-charred-sentinel": { size: 64, originY: 0.9, shadowW: 26, headOffset: 58 },
      "mob-training-dummy": { size: 64, originY: 0.9, shadowW: 24, headOffset: 58 },
    };

    for (const npc of config.npcs) {
      const { x, y } = tileToWorld(npc.tileX, npc.tileY);
      const isCombat = Boolean(npc.combat);

      let npcTextureKey = "npc";
      if (!isCombat) {
        const npcKeyMap: Record<string, string> = {
          hub_merchant: "npc-pip",
          wilderness_merchant: "npc-pip",
          grotto_merchant: "npc-pip",
          hub_guide: "npc-guide",
          hub_smith: "npc-smith",
          jail_guard: "npc-warden",
          wilderness_scout: "npc-rook",
        };
        const mappedKey = npcKeyMap[npc.id];
        if (mappedKey && this.textures.exists(mappedKey)) {
          npcTextureKey = mappedKey;
        }
      }

      let mobTexture =
        npc.id === SLIME_BRUTE_NPC_ID || npc.name === "Slime Brute"
          ? "brute"
          : npc.id === WILD_SLIME_NPC_ID || npc.id.startsWith("wild_slime") || npc.name === "Wild Slime"
            ? "slime"
            : isCombat
              ? "dummy"
              : npcTextureKey;

      // Overrides for hand-drawn mob assets if they are loaded
      let mobKey = null;
      if (npc.id === SLIME_BRUTE_NPC_ID || npc.name === "Slime Brute") {
        mobKey = "mob-slime-brute";
      } else if (npc.id === WILD_SLIME_NPC_ID || npc.id.startsWith("wild_slime") || npc.name === "Wild Slime") {
        mobKey = "mob-slime";
      } else if (npc.id === "training_dummy" || npc.name === "Training Dummy") {
        mobKey = "mob-training-dummy";
      } else if (npc.id.startsWith("ember_slime") || npc.name === "Ember Slime") {
        mobKey = "mob-ember-slime";
      } else if (npc.id.startsWith("void_brute") || npc.name === "Void Brute") {
        mobKey = "mob-void-brute";
      } else if (npc.id === "black_warden" || npc.name === "Charred Sentinel") {
        mobKey = "mob-charred-sentinel";
      }

      if (mobKey && this.textures.exists(mobKey)) {
        mobTexture = mobKey;
      }

      const hdConfig = HD_CONFIGS[mobTexture];
      const isHandDrawn = Boolean(hdConfig);

      this.ensureContactShadowTexture();
      const shadowW: Record<string, number> = { slime: 24, brute: 32, dummy: 24, npc: 26 };
      const shadowWidth = isHandDrawn ? hdConfig.shadowW : (shadowW[mobTexture] ?? 26);
      const shadow = this.add
        .image(x, y + 2, "contact_shadow")
        .setDisplaySize(shadowWidth, shadowWidth * 0.46)
        .setDepth(y - 0.5);

      const sprite = this.add.sprite(x, y, mobTexture);
      // Anchor each sprite so its feet/base plant on the tile.
      if (isHandDrawn) {
        sprite.setDisplaySize(hdConfig.size, hdConfig.size);
        sprite.setOrigin(0.5, hdConfig.originY);
      } else {
        const originY: Record<string, number> = {
          slime: 0.82,
          brute: 0.86,
          dummy: 0.91,
          npc: 0.91,
        };
        sprite.setOrigin(0.5, originY[mobTexture] ?? 0.9);
      }
      sprite.setDepth(y);
      // Living NPCs gently bob in place; the training dummy stays rigid.
      // Wild slimes have active moving/bobbing/hopping handled in the update loop.
      if (mobTexture !== "dummy" && mobTexture !== "mob-training-dummy" && !npc.id.startsWith("wild_slime")) {
        this.tweens.add({
          targets: sprite,
          y: y - (mobTexture === "slime" || mobTexture === "mob-slime" || mobTexture === "mob-ember-slime" ? 3 : 2),
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
      const offsetValue = isHandDrawn ? hdConfig.headOffset : (headTopOffset[mobTexture] ?? 34);
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

      // Map built-in resource types to hand-drawn zone asset props
      let resourceProp = resource.prop;
      if (!resourceProp) {
        if (resource.kind === "tree") {
          // Match on the display name FIRST — it's the most specific descriptor.
          // The loot item is only a fallback: several trees (Wilderness "Ironwood",
          // Black-zone "Ancient Hardwood") loot plain item_wood/item_hardwood, so a
          // loot-first check would mis-map them (e.g. Ancient Hardwood → hardwood).
          const lname = resource.name.toLowerCase();
          if (lname.includes("cavern")) {
            resourceProp = "cavern-hardwood";
          } else if (lname.includes("ancient")) {
            resourceProp = "ancient-hardwood";
          } else if (lname.includes("ironwood")) {
            resourceProp = "ironwood";
          } else if (lname.includes("hardwood")) {
            resourceProp = "hardwood";
          } else if (lname.includes("sakura")) {
            resourceProp = "sakura-tree";
          } else if (lname.includes("pine")) {
            resourceProp = lname.includes("small") ? "pine-small" : "pine";
          } else if (lname.includes("oak")) {
            resourceProp = lname.includes("young") ? "young-oak" : "wild-oak";
          } else if (lname.includes("sapling")) {
            resourceProp = "sapling";
          } else if (resource.woodcutting?.lootItemId === "item_ancient_hardwood") {
            resourceProp = "ancient-hardwood";
          } else if (resource.woodcutting?.lootItemId === "item_ironwood") {
            resourceProp = "ironwood";
          } else if (resource.woodcutting?.lootItemId === "item_hardwood") {
            resourceProp = "hardwood";
          }
        } else if (resource.kind === "rock") {
          if (resource.mining?.lootItemId === "item_iron_ore") {
            resourceProp = "iron-deposit";
          } else if (resource.mining?.lootItemId === "item_gemstone") {
            resourceProp = "gem-studded";
          } else if (resource.name.toLowerCase().includes("copper")) {
            resourceProp = "copper-rock";
          } else {
            resourceProp = "rock";
          }
        } else if (resource.kind === "fish") {
          if (resource.name.toLowerCase().includes("grotto") || resource.fishing?.lootItemId === "item_salmon") {
            resourceProp = "deep-pool";
          } else {
            resourceProp = "fish-pond";
          }
        }
      }

      const asset = resourceProp ? getZoneAsset(resourceProp) : undefined;
      let sprite: Phaser.GameObjects.Sprite;
      if (asset) {
        const key = zoneAssetTextureKey(resourceProp!);
        sprite = this.add.sprite(x, y, key).setOrigin(0.5, asset.anchorY).setDepth(y);
        const applyReady = () => {
          if (!sprite.active) return;
          sprite.setTexture(key).setScale(zoneAssetScale(this, resourceProp!)).setOrigin(0.5, asset.anchorY).setVisible(true);
          sprite.setAlpha(available ? 1 : 0.35);
        };
        if (this.textures.exists(key)) applyReady();
        else {
          sprite.setVisible(false);
          ensureZoneAssetLoaded(this, resourceProp!, applyReady);
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

  /** Animate a fishing-minigame moment for the local player. */
  private playFishingFx(type: "bite" | "hit" | "catch" | "escape") {
    const store = useGameStore.getState();
    const localName = store.playerName;
    if (!localName) return;
    if (type === "bite") this.showEmote(localName, "❗");
    if (type === "catch") this.showEmote(localName, "🎉");
    if (type === "escape") this.showEmote(localName, "💨");
    const resourceId = store.fishing?.resourceId;
    const spot = resourceId ? this.renderedResources.find((entry) => entry.id === resourceId) : undefined;
    if (spot) this.splashAt(spot.worldX, spot.worldY, type === "catch" ? "big" : type === "escape" ? "big" : "small");
  }

  /** Water splash at a fishing spot: an expanding ripple ring + droplets. */
  private splashAt(x: number, y: number, size: "small" | "big") {
    const big = size === "big";
    const ring = this.add
      .circle(x, y, big ? 8 : 5)
      .setStrokeStyle(2, 0x9bd4f5, 0.9)
      .setFillStyle(0x9bd4f5, 0.12)
      .setDepth(y + 12);
    this.tweens.add({
      targets: ring,
      scale: big ? 3.2 : 2.1,
      alpha: 0,
      duration: big ? 520 : 380,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    const drops = big ? 8 : 4;
    for (let i = 0; i < drops; i++) {
      const drop = this.add.circle(x, y - 2, big ? 3 : 2.2, 0x9bd4f5, 0.95).setDepth(y + 12);
      this.tweens.add({
        targets: drop,
        x: x + (Math.random() * 44 - 22),
        y: y - 16 - Math.random() * (big ? 30 : 18),
        alpha: 0,
        scale: 0.5,
        duration: 340 + Math.random() * 200,
        ease: "Cubic.easeOut",
        onComplete: () => drop.destroy(),
      });
    }
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

  /**
   * Combat camera shake, rate-limited: rapid hits (auto-attack, a slime pack
   * piling on) each triggered a full shake, stacking into a constant tremor.
   * One shake per 450ms is plenty to sell the impact.
   */
  private shakeCamera(duration: number, intensity: number) {
    const now = Date.now();
    if (now - this.lastCameraShakeAt < 450) return;
    this.lastCameraShakeAt = now;
    this.cameras.main.shake(duration, intensity);
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

  /**
   * Wood chips / rock shards flying off a gathered node — one burst per hit,
   * a bigger one on depletion. Fishing has its own splash FX, so skip it.
   */
  private spawnGatherHitFx(x: number, y: number, kind: "tree" | "rock" | "fish", big = false) {
    if (kind === "fish") return;
    const palette =
      kind === "tree"
        ? [0x8b5a2b, 0xa9713a, 0xc9955c, 0x4bc07f]
        : [0x9a9a9a, 0x7c7c7c, 0xbfbfbf, 0xffffff];
    const count = big ? 14 : 7;
    for (let i = 0; i < count; i++) {
      const chip = this.add.rectangle(
        x + (Math.random() - 0.5) * 10,
        y - 20 + (Math.random() - 0.5) * 10,
        big ? 4 : 3,
        big ? 3 : 2,
        palette[i % palette.length],
        0.95,
      );
      chip.setDepth(y + 12);
      const ang = Math.random() * Math.PI * 2;
      const dist = (big ? 26 : 16) + Math.random() * 14;
      this.tweens.add({
        targets: chip,
        x: chip.x + Math.cos(ang) * dist,
        // Horizontal spread squashed to the iso plane, plus a slight fall.
        y: chip.y + Math.sin(ang) * dist * 0.6 + (big ? 14 : 10),
        angle: (Math.random() - 0.5) * 240,
        alpha: 0,
        duration: (big ? 420 : 300) + Math.random() * 120,
        ease: "Cubic.easeOut",
        onComplete: () => chip.destroy(),
      });
    }
  }

  /** Draw a small gathered-item token (log for wood, ore chunk for rock) into
   * a graphics object at its own origin. */
  private drawLootToken(g: Phaser.GameObjects.Graphics, kind: "tree" | "rock") {
    // Dark outline first (drawn as a slightly larger silhouette) so the token
    // reads clearly against grass/dirt.
    if (kind === "tree") {
      g.fillStyle(0x3b2611, 1);
      g.fillRoundedRect(-12, -7, 24, 14, 5);
      g.fillStyle(0x8b5a2b, 1);
      g.fillRoundedRect(-10, -5, 20, 10, 4);
      g.fillStyle(0xc9955c, 1);
      g.fillCircle(-10, 0, 5);
      g.fillCircle(10, 0, 5);
      g.fillStyle(0x6b4420, 1);
      g.fillCircle(-10, 0, 2);
      g.fillCircle(10, 0, 2);
      g.fillStyle(0xe0b380, 1); // top highlight
      g.fillRoundedRect(-9, -5, 18, 3, 2);
    } else {
      g.fillStyle(0x333333, 1);
      g.fillRoundedRect(-10, -9, 20, 18, 6);
      g.fillStyle(0x8a8a8a, 1);
      g.fillRoundedRect(-8, -7, 16, 14, 5);
      g.fillStyle(0xc4c4c4, 1);
      g.fillTriangle(-7, -6, 3, -6, -3, 3);
      g.fillStyle(0xe8d27a, 1); // ore flecks
      g.fillCircle(4, -1, 2);
      g.fillCircle(-1, 4, 1.8);
    }
  }

  /** Loaded Phaser texture key for a gathered item's hand-drawn art, or null
   * if it has no PNG (falls back to a procedural token). */
  private lootTextureKey(itemId: string | undefined): string | null {
    if (!itemId) return null;
    const key = `loot-${itemId.replace(/^item_/, "").replace(/_/g, "-")}`;
    return this.textures.exists(key) ? key : null;
  }

  /**
   * "Item drops, then you pick it up" juice: the gathered item pops out of the
   * node, arcs to the ground with a bounce + thud, sits a beat, then magnetizes
   * into the local player with a sparkle + pickup chime. Shows the item's
   * hand-drawn art when available (wood/ore/seed/crop), else a procedural token
   * themed by `fallbackKind`. Purely cosmetic — already banked server-side.
   */
  private spawnLootDropFx(
    originX: number,
    originY: number,
    itemId: string | undefined,
    fallbackKind: "tree" | "rock",
  ) {
    const texKey = this.lootTextureKey(itemId);
    let token: Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics;
    let baseScale = 1;
    if (texKey) {
      const sprite = this.add.sprite(0, 0, texKey);
      // Hand-drawn item art is ~256px; normalise to a ~26px world token.
      baseScale = 26 / Math.max(1, sprite.width);
      token = sprite;
    } else {
      const g = this.add.graphics();
      this.drawLootToken(g, fallbackKind);
      token = g;
    }
    const side = (Math.random() - 0.5) * 30;
    const groundX = originX + side;
    const groundY = originY + 6 + Math.random() * 4;
    token.setPosition(originX, originY - 24);
    token.setDepth(groundY + 13);
    token.setScale(baseScale * 0.4);
    // 1) Pop out of the node.
    this.tweens.add({
      targets: token,
      x: groundX,
      y: originY - 34,
      scale: baseScale,
      angle: (Math.random() - 0.5) * 40,
      duration: 190,
      ease: "Back.easeOut",
      onComplete: () => {
        // 2) Fall to the ground with a bounce.
        this.tweens.add({
          targets: token,
          y: groundY,
          duration: 300,
          ease: "Bounce.easeOut",
          onComplete: () => {
            playSfx("loot_drop");
            this.spawnDustPuff(groundX, groundY);
            // 3) Rest a beat, then fly to the player and get collected.
            this.time.delayedCall(220, () => {
              const local = this.findLocalPlayer();
              const targetX = local ? local.predicted.x : groundX;
              const targetY = local ? local.predicted.y - 14 : groundY;
              this.tweens.add({
                targets: token,
                x: targetX,
                y: targetY,
                scale: baseScale * 0.35,
                alpha: 0.85,
                duration: 260,
                ease: "Cubic.easeIn",
                onComplete: () => {
                  this.spawnImpactBurst(targetX, targetY, false);
                  playSfx("item_pickup");
                  token.destroy();
                },
              });
            });
          },
        });
      },
    });
  }

  /** Brief wobble on the node being worked so hits feel like they connect. */
  private wobbleResource(resourceId: string) {
    const resource = this.renderedResources.find((entry) => entry.id === resourceId);
    const sprite = resource?.sprite;
    if (!sprite?.active) return;
    this.tweens.add({
      targets: sprite,
      angle: { from: -1.6, to: 1.6 },
      duration: 55,
      yoyo: true,
      repeat: 1,
      onComplete: () => sprite.setAngle(0),
    });
  }

  /** Radiating spark burst at an impact point; gold + ring on crits. */
  private spawnImpactBurst(x: number, y: number, crit = false) {
    const g = this.add.graphics();
    g.setDepth(y + 11);
    const color = crit ? 0xffd75e : 0xffffff;
    const rays = crit ? 8 : 5;
    g.lineStyle(2, color, 0.9);
    for (let i = 0; i < rays; i++) {
      const a = (Math.PI * 2 * i) / rays + Math.random() * 0.5;
      g.beginPath();
      g.moveTo(Math.cos(a) * 4, Math.sin(a) * 3);
      g.lineTo(Math.cos(a) * (crit ? 14 : 10), Math.sin(a) * (crit ? 11 : 8));
      g.strokePath();
    }
    if (crit) {
      g.lineStyle(2, color, 0.7);
      g.strokeCircle(0, 0, 7);
    }
    g.setPosition(x, y);
    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: crit ? 1.9 : 1.5,
      scaleY: crit ? 1.9 : 1.5,
      duration: crit ? 220 : 170,
      ease: "Cubic.easeOut",
      onComplete: () => g.destroy(),
    });
  }

  /** Magenta portal swirl: expanding rings + orbiting sparks, self-destroying.
   *  Played at the player's feet on portal departure and at the spawn tile on
   *  arrival in the new zone. */
  private spawnPortalFx(x: number, y: number) {
    // Two expanding rings, staggered.
    for (let i = 0; i < 2; i++) {
      const ring = this.add.graphics().setDepth(y + 20);
      ring.lineStyle(3, i === 0 ? 0xd06bf0 : 0x8b3fd9, 0.9);
      ring.strokeEllipse(0, 0, 26, 13); // iso-squashed ring
      ring.setPosition(x, y - 6);
      ring.setScale(0.3);
      this.tweens.add({
        targets: ring,
        scaleX: 2.4,
        scaleY: 2.4,
        alpha: 0,
        duration: 520,
        delay: i * 130,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy(),
      });
    }
    // A soft rising glow column.
    const glow = this.add
      .image(x, y - 14, "lamp-glow")
      .setTint(0xc14fe0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(56, 84)
      .setDepth(y + 19)
      .setAlpha(0.75);
    this.tweens.add({
      targets: glow,
      alpha: 0,
      y: y - 44,
      scaleX: glow.scaleX * 0.5,
      duration: 560,
      ease: "Sine.easeOut",
      onComplete: () => glow.destroy(),
    });
    // Sparkles spiralling upward.
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const spark = this.add
        .rectangle(x + Math.cos(angle) * 12, y - 4 + Math.sin(angle) * 6, 3, 3, i % 2 ? 0xf3d0ff : 0xe7a6f7)
        .setDepth(y + 21)
        .setAlpha(0.95);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle + 2.2) * 26,
        y: y - 36 - Math.random() * 22,
        alpha: 0,
        angle: 180,
        duration: 480 + Math.random() * 160,
        ease: "Sine.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
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

  /** Generic floating world-space label (level-ups, spoils, skill gains). */
  private showFloatingLabel(
    x: number,
    y: number,
    message: string,
    color: string,
    opts: { size?: number; rise?: number; duration?: number } = {},
  ) {
    const text = this.add
      .text(x, y, message, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: `${opts.size ?? 14}px`,
        color,
        fontStyle: "bold",
        stroke: "#2d1b2e",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(220)
      .setScale(0.6);
    this.tweens.add({ targets: text, scale: 1, duration: 140, ease: "Back.easeOut" });
    this.tweens.add({
      targets: text,
      y: y - (opts.rise ?? 34),
      alpha: 0,
      duration: opts.duration ?? 950,
      delay: 140,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  /** Smoke poof where a mob keels over: gray puffs + a fading ground ring. */
  private spawnMobDeathFx(x: number, y: number) {
    playSfx("mob_die");
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
      const puff = this.add.circle(x, y, 4 + Math.random() * 3, 0xcfcfd6, 0.55).setDepth(y + 14);
      this.tweens.add({
        targets: puff,
        x: x + Math.cos(a) * (14 + Math.random() * 10),
        y: y - 8 + Math.sin(a) * 8 - Math.random() * 12,
        scale: 2.1,
        alpha: 0,
        duration: 420 + Math.random() * 160,
        ease: "Sine.easeOut",
        onComplete: () => puff.destroy(),
      });
    }
    const ring = this.add.graphics().setDepth(y + 13);
    ring.lineStyle(2, 0xffffff, 0.7);
    ring.strokeEllipse(0, 0, 24, 12);
    ring.setPosition(x, y + 6);
    ring.setScale(0.4);
    this.tweens.add({
      targets: ring,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: 380,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /** Gold coins burst from a kill, scatter, then fly into the local player. */
  private spawnCoinBurstFx(x: number, y: number, count: number) {
    const coins = Math.max(1, Math.min(6, count));
    for (let i = 0; i < coins; i++) {
      const g = this.add.graphics().setDepth(y + 15);
      g.fillStyle(0xf5c542, 1);
      g.fillCircle(0, 0, 4);
      g.lineStyle(1, 0xa87b1c, 1);
      g.strokeCircle(0, 0, 4);
      g.fillStyle(0xffe28a, 0.9);
      g.fillCircle(-1, -1, 1.4);
      g.setPosition(x, y - 10);
      const scatterX = x + (Math.random() - 0.5) * 44;
      const scatterY = y + 2 + Math.random() * 8;
      this.tweens.add({
        targets: g,
        x: scatterX,
        y: scatterY,
        angle: (Math.random() - 0.5) * 180,
        duration: 240 + Math.random() * 120,
        ease: "Back.easeOut",
        onComplete: () => {
          // Stagger the pickups so the coins stream into the player.
          this.time.delayedCall(160 + i * 70, () => {
            const local = this.findLocalPlayer();
            const targetX = local ? local.predicted.x : scatterX;
            const targetY = local ? local.predicted.y - 14 : scatterY;
            this.tweens.add({
              targets: g,
              x: targetX,
              y: targetY,
              scale: 0.5,
              alpha: 0.9,
              duration: 230,
              ease: "Cubic.easeIn",
              onComplete: () => {
                if (i === coins - 1) playSfx("coin");
                g.destroy();
              },
            });
          });
        },
      });
    }
  }

  /** Expanding ring + rising sparkles for big personal moments (level-up,
   *  skill-up, quest complete). Color sets the mood: gold XP, green skills. */
  private spawnCelebrationFx(x: number, y: number, color: number) {
    for (let i = 0; i < 2; i++) {
      const ring = this.add.graphics().setDepth(y + 22);
      ring.lineStyle(3, color, 0.9);
      ring.strokeEllipse(0, 0, 30, 15);
      ring.setPosition(x, y - 4);
      ring.setScale(0.3);
      this.tweens.add({
        targets: ring,
        scaleX: 2.2,
        scaleY: 2.2,
        alpha: 0,
        duration: 520,
        delay: i * 140,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy(),
      });
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const spark = this.add
        .rectangle(x + Math.cos(a) * 10, y - 6 + Math.sin(a) * 5, 3, 3, i % 2 ? 0xfff3c4 : color)
        .setDepth(y + 23)
        .setAlpha(0.95);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(a + 1.6) * 24,
        y: y - 46 - Math.random() * 26,
        alpha: 0,
        angle: 180,
        duration: 560 + Math.random() * 200,
        ease: "Sine.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  /** Orange anvil sparks fanning up over the player when a craft lands. */
  private spawnCraftSparksFx(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      // Fan the embers upward and outward from chest height.
      const a = -Math.PI / 2 + (i / 7 - 0.5) * 1.8;
      const spark = this.add
        .rectangle(x, y - 16, 2, 5, i % 2 ? 0xffb347 : 0xfff1b8)
        .setDepth(y + 20)
        .setAlpha(0.95)
        .setAngle((a * 180) / Math.PI + 90);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * (16 + Math.random() * 14),
        y: y - 16 + Math.sin(a) * (18 + Math.random() * 12),
        alpha: 0,
        duration: 320 + Math.random() * 140,
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
    // A brief hot glow at the anvil point.
    const flash = this.add.circle(x, y - 14, 7, 0xffdf9e, 0.8).setDepth(y + 19);
    this.tweens.add({
      targets: flash,
      scale: 1.9,
      alpha: 0,
      duration: 220,
      ease: "Cubic.easeOut",
      onComplete: () => flash.destroy(),
    });
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
      return;
    }

    // Nothing to talk to — gather instead. Makes ✨ the universal mobile
    // action: fishing spots, trees, and rocks all respond to interact.
    if (Date.now() >= this.localChoppingUntil) {
      let node: RenderedResource | null = null;
      let nodeDistance = CHOP_RANGE;
      for (const resource of this.renderedResources) {
        if (!resource.available || resource.chopperName) continue;
        const distance = Math.hypot(local.predicted.x - resource.worldX, local.predicted.y - resource.worldY);
        if (distance <= nodeDistance) {
          node = resource;
          nodeDistance = distance;
        }
      }
      if (node) networkManager.sendChop(node.id, node.kind === "fish");
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
    this.moveStuckAt = 0;
    // Route around obstacles with A* over the collision grid; fall back to a
    // straight line if there's no grid or no path.
    const local = this.findLocalPlayer();
    const clickWalkable = !this.collisionGrid || isWorldWalkable(this.collisionGrid, worldX, worldY);
    if (this.collisionGrid && local) {
      const path = findPath(this.collisionGrid, local.predicted, { x: worldX, y: worldY });
      if (path.length) {
        if (clickWalkable) {
          // Steer the final leg to the exact click point for a precise stop.
          path[path.length - 1] = { x: worldX, y: worldY };
        } else {
          // Clicked water/a prop: A* already routed to the nearest walkable
          // tile — stop THERE. Aiming the last leg at the blocked click point
          // left the character grinding against the obstacle forever.
          const last = path[path.length - 1];
          this.moveTarget = { x: last.x, y: last.y };
        }
        this.movePath = path;
      } else {
        this.movePath = [];
        // No route (same tile, or unreachable). A straight line toward a
        // blocked point would grind against the obstacle — don't start.
        if (!clickWalkable) {
          this.clearMoveTarget();
          return;
        }
      }
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
    // The marker sits on the actual destination (redirected off blocked tiles).
    marker.setPosition(this.moveTarget.x, this.moveTarget.y);
    marker.setAlpha(1);
    marker.setScale(1);
    marker.setVisible(true);
    this.tweens.killTweensOf(marker);
    this.tweens.add({ targets: marker, alpha: 0.2, scale: 0.7, duration: 600, ease: "Sine.easeOut", yoyo: true, repeat: -1 });
  }

  private clearMoveTarget() {
    this.moveTarget = null;
    this.movePath = [];
    this.movePathGfx?.clear();
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
    if (!this.crystalSprite) {
      // Hand-drawn crystal monument art; the graphics layer keeps the HP bar.
      const asset = getZoneAsset("king-crystal");
      const key = zoneAssetTextureKey("king-crystal");
      this.crystalSprite = this.add.sprite(x, y, key).setOrigin(0.5, asset?.anchorY ?? 0.519).setDepth(y);
      const applyArt = () => {
        if (!this.crystalSprite?.active) return;
        this.crystalSprite.setTexture(key).setScale(zoneAssetScale(this, "king-crystal")).setOrigin(0.5, asset?.anchorY ?? 0.519).setVisible(true);
      };
      if (this.textures.exists(key)) applyArt();
      else {
        this.crystalSprite.setVisible(false);
        ensureZoneAssetLoaded(this, "king-crystal", applyArt);
      }
    }
    if (!this.crystalGfx) {
      this.crystalGfx = this.add.graphics().setDepth(y + 1);
      this.crystalLabel = this.add
        .text(x, y - 56, "", {
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
    // Sealed crystal reads dim/grey; an active siege lights it up.
    this.crystalSprite?.setTint(state.active ? 0xffffff : 0x8a8f99).setAlpha(state.active ? 1 : 0.75);
    // HP bar (just above the monument's crown).
    g.fillStyle(0x2b1d12, 0.8);
    g.fillRect(-18, -48, 36, 5);
    g.fillStyle(pct > 0.3 ? 0x6ad27e : 0xff5a5a, 1);
    g.fillRect(-18, -48, 36 * pct, 5);

    this.crystalLabel?.setText(
      state.active
        ? `King Crystal — ${Math.ceil(pct * 100)}%\n⚔️ SIEGE OPEN`
        : `King Crystal (sealed)${state.sovereignTag ? `\n👑 [${state.sovereignTag}]` : ""}`,
    );
  }

  private clearCrystal() {
    this.crystalGfx?.destroy();
    this.crystalSprite?.destroy();
    this.crystalLabel?.destroy();
    this.crystalGfx = null;
    this.crystalSprite = null;
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
    // Stuck guard: if we've made no real progress for ~600ms (server collision
    // disagreeing with the client grid, a mob body-block, a moved prop), give
    // up instead of walking against the obstacle forever.
    const nowMs = Date.now();
    if (this.moveStuckAt === 0) {
      this.moveStuckAt = nowMs;
      this.moveStuckPos = { x: local.predicted.x, y: local.predicted.y };
    } else if (nowMs - this.moveStuckAt >= 600) {
      const progressed =
        Math.hypot(local.predicted.x - this.moveStuckPos.x, local.predicted.y - this.moveStuckPos.y) > 4;
      if (!progressed) {
        this.clearMoveTarget();
        return null;
      }
      this.moveStuckAt = nowMs;
      this.moveStuckPos = { x: local.predicted.x, y: local.predicted.y };
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
      // Fishing runs the catch minigame (server keeps a timed fallback).
      networkManager.sendChop(nearest.id, nearest.kind === "fish");
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
      // Fishing runs the catch minigame (server keeps a timed fallback).
      networkManager.sendChop(nearest.id, nearest.kind === "fish");
    }
  }

  private resourceKind(resourceId: string): "tree" | "rock" | "fish" {
    return this.renderedResources.find((entry) => entry.id === resourceId)?.kind ?? "tree";
  }

  private startLocalChopHits(endsAt: number, kind: "tree" | "rock" | "fish" = "tree", resourceId?: string) {
    this.stopLocalChopHits();
    const hitSound = kind === "rock" ? "mine_hit" : kind === "fish" ? "fish_splash" : "chop_hit";
    const interval = kind === "fish" ? 900 : 360;
    // Rhythmic impact sounds + chip burst for the duration of the gather.
    this.chopHitTimer = this.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => {
        if (Date.now() >= endsAt) {
          this.stopLocalChopHits();
          return;
        }
        playSfx(hitSound);
        const resource = resourceId
          ? this.renderedResources.find((entry) => entry.id === resourceId)
          : undefined;
        if (resource) {
          this.spawnGatherHitFx(resource.worldX, resource.worldY, kind);
          this.wobbleResource(resource.id);
        }
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

    // Match by raw name — the nameplate label carries a [GUILD] tag, so
    // comparing label.text left guild members stuck in the idle pose.
    const rendered = this.findRenderedPlayerByName(playerName);
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
        // px/second, not px/frame: per-frame thresholds tuned at 60fps kept
        // remote players stuck in idle on 120–165Hz displays (a walking
        // player moves <1px per frame there) and flickered walk/idle at 90Hz.
        const speed = Math.hypot(vx, vy) / (this.frameDelta / 1000);
        if (speed > 45) {
          rendered.remoteMoving = true;
        } else if (speed < 9) {
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
        this.updatePlayerHpBar(entry, player, false);
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
        this.updatePlayerHpBar(existing, player, false);
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

    // Sub-pixel positions: the camera has roundPixels, so rendering stays
    // crisp while diagonal movement no longer staircases at high zoom.
    const x = local.predicted.x;
    const y = local.predicted.y;
    local.baseY = y;
    local.sprite.setPosition(x, y);
    local.sprite.setDepth(y + this.playerDepthLift());
    local.label.setPosition(x, y - this.nameplateOffset(local));
    local.label.setDepth(y + 1);
    local.shadow.setPosition(x, y + 4);
    local.shadow.setDepth(y - 0.5);
    this.cameraTarget?.setPosition(x, y);
    this.positionPet(local);
    this.drawMovePath(local.predicted);
  }

  /** Faint dotted trail from the player along the remaining routed path. */
  private drawMovePath(from: { x: number; y: number }) {
    const g = this.movePathGfx;
    if (!g) return;
    g.clear();
    if (!this.moveTarget || this.movePath.length === 0) return;
    const pts = [from, ...this.movePath];
    g.lineStyle(2, 0x9ad7ff, 0.35);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokePath();
    for (let i = 1; i < pts.length; i++) {
      g.fillStyle(0xffffff, 0.5).fillCircle(pts[i].x, pts[i].y, 2.5);
    }
  }

  /**
   * In player zones the ground is depth-sorted by world Y (so ground in front of
   * a prop occludes its base). Lift the player one half-tile above that so the
   * tile directly in front never draws over the character's feet.
   */
  private playerDepthLift(): number {
    const zone = this.currentZoneId ?? "";
    // Re-skinned base zones render ground at worldY-2 (like player Worlds) so
    // node bases embed. That same ground would clip the character's feet unless
    // we lift the player above it, exactly as player zones do.
    return isPlayerZoneId(zone) || ZONE_TILE_SKIN[zone] ? 16 : 0;
  }

  /**
   * Frame-rate-corrected lerp factor: `base` is the per-frame alpha the game
   * was tuned at (60fps); this converts it to the equivalent strength for the
   * actual frame time so smoothing feels identical at 30, 60, or 165Hz.
   */
  private smoothAlpha(base: number): number {
    return 1 - Math.pow(1 - base, this.frameDelta / 16.667);
  }

  private interpolateRemotePlayers() {
    const alpha = this.smoothAlpha(0.25);
    for (const [, rendered] of this.renderedPlayers) {
      const x = Phaser.Math.Linear(rendered.sprite.x, rendered.targetX, alpha);
      // Lerp from the bob-free baseY so the idle bob never feeds back into motion.
      const y = Phaser.Math.Linear(rendered.baseY, rendered.targetY, alpha);
      rendered.baseY = y;
      rendered.sprite.setPosition(x, y);
      rendered.hpBar.setPosition(x, y - 40);
      rendered.hpBar.setDepth(y + 1);
      rendered.sprite.setDepth(y + this.playerDepthLift());
      rendered.label.setPosition(x, y - this.nameplateOffset(rendered));
      rendered.label.setDepth(y + 1);
      rendered.shadow.setPosition(x, y + 4);
      rendered.shadow.setDepth(y - 0.5);
      this.positionPet(rendered);
    }
  }

  private updateNpcMovement() {
    const alpha = this.smoothAlpha(0.22);
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