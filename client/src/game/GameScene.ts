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
  getZoneConfig,
  normalizeCharacterAppearance,
  MAP_HEIGHT,
  MAP_WIDTH,
  NPC_INTERACT_RANGE,
  FARM_RANGE,
  farmGrowthProgress,
  HOUSE_RANGE,
  structureLabel,
  getEmote,
  tileToWorld,
  type FarmStatePayload,
  type HousingStatePayload,
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
import { buildZoneMap } from "./mapData";
import { PredictedPosition, reconcilePrediction, stepPrediction } from "./prediction";

interface RenderedPlayer {
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
}

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
  private renderedNpcs: RenderedNpc[] = [];
  private renderedResources: RenderedResource[] = [];
  private renderedFarmPlots = new Map<string, RenderedFarmPlot>();
  private renderedLandPlots = new Map<string, RenderedLandPlot>();
  private billboardTexts: Phaser.GameObjects.GameObject[] = [];
  private billboardHoldersText: Phaser.GameObjects.Text | null = null;
  private billboardOnlineText: Phaser.GameObjects.Text | null = null;
  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private attackKey: Phaser.Input.Keyboard.Key | null = null;
  private chopKey: Phaser.Input.Keyboard.Key | null = null;
  private fishKey: Phaser.Input.Keyboard.Key | null = null;
  private lastSentInput = { dx: 0, dy: 0 };
  private currentZoneId: string | null = null;
  private localChoppingUntil = 0;
  private lastFootstepAt = 0;
  private chopHitTimer: Phaser.Time.TimerEvent | null = null;
  private cameraFollowSprite: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super("GameScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#b8e8fc");
    this.cameras.main.setZoom(1.5);
    this.cameras.main.roundPixels = true;
    this.cameras.main.useBounds = false;
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
      this.stopLocalChopHits();
      this.destroyLocalAvatar();
      this.renderedPlayers.forEach((entry) => {
        entry.sprite.destroy();
        entry.label.destroy();
      });
      this.renderedPlayers.clear();
      this.renderZone(zoneId);
      playSfx("zone_enter");
    });

    const unsubscribeMobHealth = networkManager.onMobHealth((payload) => {
      this.updateNpcHealth(payload.npcId, payload.currentHp, payload.maxHp);
    });

    const unsubscribeAttackResult = networkManager.onAttackResult((payload) => {
      this.showMobDamageNumber(payload.npcId, payload.damage);
      if (payload.defeated) {
        playSfx("attack_defeat");
      } else {
        playSfx("attack_hit");
      }
    });

    const unsubscribePlayerDamage = networkManager.onPlayerDamage((payload) => {
      this.showPlayerDamageNumber(payload.amount);
      playSfx("player_hurt");
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
      unsubscribeMobHealth();
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
      this.stopLocalChopHits();
      this.clearMap();
      this.clearNpcs();
      this.clearResources();
      this.clearFarmPlots();
      this.clearLandPlots();
      this.clearBillboards();
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
      const dx = this.getAxisInput();
      const dy = this.getAxisInputY();

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

    this.bindCameraToLocalPlayer();
    this.applyKnockedOutVisuals();
    this.redrawActiveChopBars();
    this.updateFarmPlots();
    this.updatePlayerAnimations();
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

    const config = getZoneConfig(zoneId);
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
    const config = getZoneConfig(zoneId);
    const spawn = tileToWorld(config.spawnTile.x, config.spawnTile.y);

    this.upsertLocalPlayer({
      sessionId,
      name: playerName,
      x: spawn.x,
      y: spawn.y,
      level: useGameStore.getState().playerLevel,
      xp: useGameStore.getState().playerXp,
      appearance: normalizeCharacterAppearance(appearance),
    });
  }

  private upsertLocalPlayer(player: RemotePlayer) {
    const sessionId = networkManager.sessionId ?? player.sessionId;
    this.localSessionId = sessionId;

    if (this.localAvatar) {
      const existing = this.localAvatar;
      existing.lastTargetX = existing.targetX;
      existing.lastTargetY = existing.targetY;
      existing.targetX = player.x;
      existing.targetY = player.y;
      existing.appearance = player.appearance;
      existing.label.setText(player.name);

      const moving = this.lastSentInput.dx !== 0 || this.lastSentInput.dy !== 0;
      existing.predicted = moving
        ? reconcilePrediction(existing.predicted, { x: player.x, y: player.y })
        : { x: player.x, y: player.y };
      return;
    }

    this.destroyAllLocalPlayerEntries();
    this.localAvatar = this.createRenderedPlayerEntry(player, true);
  }

  private destroyRenderedPlayer(sessionId: string, rendered: RenderedPlayer) {
    rendered.sprite.destroy();
    rendered.label.destroy();
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
    const sprite = this.add.sprite(player.x, player.y, "player");
    sprite.setOrigin(0.5, 0.93);
    sprite.setDisplaySize(AVATAR_LOGICAL_WIDTH, AVATAR_LOGICAL_HEIGHT);
    sprite.setDepth(1000);

    const label = this.add
      .text(player.x, player.y - 42, player.name, {
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

    return {
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
    };
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

    const ground = buildZoneMap(zoneId);

    for (let y = 0; y < MAP_HEIGHT; y++) {
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
        this.mapTiles.push(tile);
      }
    }

    this.renderNpcs(zoneId);
    this.renderResources(zoneId);
    this.renderFarmPlots(zoneId);
    this.renderLandPlots(zoneId);
    this.renderBillboards(zoneId);
  }

  private renderBillboards(zoneId: string) {
    const config = getZoneConfig(zoneId);
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

  private applyWorldStats(payload: { baseHolders: number | null; online: number }) {
    this.billboardHoldersText?.setText(
      payload.baseHolders === null ? "—" : payload.baseHolders.toLocaleString(),
    );
    this.billboardOnlineText?.setText(payload.online.toLocaleString());
  }

  private renderFarmPlots(zoneId: string) {
    const config = getZoneConfig(zoneId);
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
    const config = getZoneConfig(zoneId);
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
      this.renderedLandPlots.set(plot.id, { id: plot.id, sprite, label, worldX: x, worldY: y });
    }
    this.applyHousingState(networkManager.getHousingState());
  }

  private clearLandPlots() {
    this.renderedLandPlots.forEach((plot) => {
      plot.sprite.destroy();
      plot.label.destroy();
    });
    this.renderedLandPlots.clear();
  }

  private applyHousingState(payload: HousingStatePayload) {
    for (const state of payload.plots) {
      const plot = this.renderedLandPlots.get(state.plotId);
      if (!plot) continue;
      const owned = state.structure !== "none";
      plot.sprite.setTexture(owned ? (state.structure === "shop" ? "shop" : "house") : "plot_marker");
      plot.sprite.setDepth(plot.worldY);
      if (owned && state.ownerName) {
        plot.label.setText(`${state.ownerName}'s ${structureLabel(state.structure)}`);
        plot.label.setColor("#ffffff");
      } else {
        plot.label.setText("For Sale");
        plot.label.setColor("#ffd24a");
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
  }

  private clearNpcs() {
    this.renderedNpcs.forEach((npc) => {
      npc.sprite.destroy();
      npc.label.destroy();
      npc.hpBarBg.destroy();
      npc.hpBarFill.destroy();
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
    const config = getZoneConfig(zoneId);

    for (const npc of config.npcs) {
      const { x, y } = tileToWorld(npc.tileX, npc.tileY);
      const isCombat = Boolean(npc.combat);
      const mobTexture =
        npc.id === WILD_SLIME_NPC_ID
          ? "slime"
          : npc.id === SLIME_BRUTE_NPC_ID
            ? "brute"
            : isCombat
              ? "dummy"
              : "npc";
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
      // World-Y of the visible head/top, used to place label + HP bar.
      const headTopOffset: Record<string, number> = {
        slime: 25,
        brute: 33,
        dummy: 36,
        npc: 43,
      };
      const headTopY = y - (headTopOffset[mobTexture] ?? 34);
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
              : npc.id === WILD_SLIME_NPC_ID
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
      };

      this.renderedNpcs.push(rendered);
      if (isCombat) {
        this.drawNpcHealthBar(rendered);
      }
    }
  }

  private renderResources(zoneId: string) {
    const config = getZoneConfig(zoneId);

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

      const sprite = this.add.sprite(x, y, texture);
      sprite.setOrigin(0.5, originY);
      // Fish ripples lie flat on the water; everything else sorts by position.
      sprite.setDepth(kind === "fish" ? y - 4 : y);
      sprite.setAlpha(available ? 1 : 0.35);
      // Iron deposits read as a colder, steel-blue rock to distinguish them
      // from the copper-toned starter rocks.
      if (kind === "rock" && resource.mining?.lootItemId === "item_iron_ore") {
        sprite.setTint(0x9fb6c8);
      }

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
    if (this.localAvatar?.label.text === playerName) return this.localAvatar;
    for (const rendered of this.renderedPlayers.values()) {
      if (rendered.label.text === playerName) return rendered;
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

  private showMobDamageNumber(npcId: string, damage: number) {
    const npc = this.renderedNpcs.find((entry) => entry.id === npcId);
    if (!npc || damage <= 0) return;

    const text = this.add
      .text(npc.worldX, npc.worldY - 44, `-${damage}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "15px",
        color: "#ff4466",
        fontStyle: "bold",
        stroke: "#2d1b2e",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(200);

    this.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 750,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
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

  private tryAttack() {
    const mobileAttack = consumeMobileAttack();
    const keyboardAttack =
      this.attackKey !== null && Phaser.Input.Keyboard.JustDown(this.attackKey);
    if (!mobileAttack && !keyboardAttack) return;
    if (!this.localSessionId) return;

    const local = this.findLocalPlayer();
    if (!local) return;

    let nearest: RenderedNpc | null = null;
    let nearestDistance = ATTACK_RANGE;

    for (const npc of this.renderedNpcs) {
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
        const vy = rendered.sprite.y - rendered.prevSpriteY;
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
      rendered.prevSpriteY = rendered.sprite.y;
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
        this.renderedPlayers.set(player.sessionId, entry);
      } else {
        existing.sprite.setDisplaySize(AVATAR_LOGICAL_WIDTH, AVATAR_LOGICAL_HEIGHT);
        existing.lastTargetX = existing.targetX;
        existing.lastTargetY = existing.targetY;
        existing.targetX = player.x;
        existing.targetY = player.y;
        existing.label.setText(player.name);
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
      local.predicted = stepPrediction(local.predicted, dx, dy, delta);
    }

    const x = Math.round(local.predicted.x);
    const y = Math.round(local.predicted.y);
    local.sprite.setPosition(x, y);
    local.sprite.setDepth(y);
    local.label.setPosition(x, y - 42);
    local.label.setDepth(y + 1);
  }

  private interpolateRemotePlayers() {
    const alpha = 0.25;
    for (const [, rendered] of this.renderedPlayers) {
      const x = Math.round(Phaser.Math.Linear(rendered.sprite.x, rendered.targetX, alpha));
      const y = Math.round(Phaser.Math.Linear(rendered.sprite.y, rendered.targetY, alpha));
      rendered.sprite.setPosition(x, y);
      rendered.sprite.setDepth(y);
      rendered.label.setPosition(x, y - 42);
      rendered.label.setDepth(y + 1);
    }
  }

}