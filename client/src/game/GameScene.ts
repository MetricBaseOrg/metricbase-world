import Phaser from "phaser";
import {
  ATTACK_RANGE,
  AVATAR_ACTION_DURATIONS_MS,
  avatarAnimKey,
  avatarFrameTextureKey,
  appearanceTextureKey,
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
  MAP_HEIGHT,
  MAP_WIDTH,
  NPC_INTERACT_RANGE,
  TILE_HEIGHT,
  TILE_WIDTH,
  tileToWorld,
} from "@metricbase/shared";
import { playAvatarAnimation, preloadAvatarAnimations } from "../character/avatarAnimations";
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
  lastAnimKey: string;
  remoteMoving: boolean;
  prevSpriteX: number;
  prevSpriteY: number;
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
}

interface RenderedResource {
  id: string;
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
  private localSessionId: string | null = null;
  private mapTiles: Phaser.GameObjects.Image[] = [];
  private renderedNpcs: RenderedNpc[] = [];
  private renderedResources: RenderedResource[] = [];
  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private attackKey: Phaser.Input.Keyboard.Key | null = null;
  private chopKey: Phaser.Input.Keyboard.Key | null = null;
  private fishKey: Phaser.Input.Keyboard.Key | null = null;
  private lastSentInput = { dx: 0, dy: 0 };
  private currentZoneId: string | null = null;
  private localChoppingUntil = 0;

  constructor() {
    super("GameScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#b8e8fc");
    this.cameras.main.setZoom(2);
    this.setupCamera();

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D") as GameScene["wasd"];
      this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.chopKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.fishKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    }

    const unsubscribePlayers = networkManager.onPlayersChange((players, sessionId) => {
      this.localSessionId = sessionId;
      this.syncPlayers(players);
    });

    const unsubscribeZone = networkManager.onZoneChange((zoneId) => {
      this.lastSentInput = { dx: 0, dy: 0 };
      networkManager.sendInput(0, 0);
      this.localSessionId = null;
      this.localChoppingUntil = 0;
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
      playSfx("chop_swing");
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
        const local = this.localSessionId
          ? this.renderedPlayers.get(this.localSessionId)
          : undefined;
        if (local) {
          local.actionUntil = 0;
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
      if (payload.playerName === useGameStore.getState().playerName) {
        this.localChoppingUntil = 0;
      }
      if (payload.depleted) {
        playSfx("chop_fell");
      }
    });

    this.renderZone(networkManager.zoneId);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribePlayers();
      unsubscribeZone();
      unsubscribeMobHealth();
      unsubscribeAttackResult();
      unsubscribePlayerDamage();
      unsubscribeResourceHealth();
      unsubscribeChopStart();
      unsubscribeChopCancel();
      unsubscribeChopResult();
      this.clearMap();
      this.clearNpcs();
      this.clearResources();
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
      this.interpolateRemotePlayers();
      this.tryInteract();
      this.tryAttack();
      this.tryChop();
      this.tryFish();
    }

    this.updateCamera();
    this.applyKnockedOutVisuals();
    this.redrawActiveChopBars();
    this.updatePlayerAnimations();
  }

  private setupCamera() {
    const corner = tileToWorld(0, 0);
    const opposite = tileToWorld(MAP_WIDTH - 1, MAP_HEIGHT - 1);
    const minX = Math.min(corner.x, opposite.x) - TILE_WIDTH;
    const maxX = Math.max(corner.x, opposite.x) + TILE_WIDTH;
    const minY = Math.min(corner.y, opposite.y) - TILE_HEIGHT * 2;
    const maxY = Math.max(corner.y, opposite.y) + TILE_HEIGHT * 2;
    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
  }

  private updateCamera() {
    if (!this.localSessionId) return;
    const local = this.renderedPlayers.get(this.localSessionId);
    if (!local) return;

    const cam = this.cameras.main;
    const viewWidth = cam.width / cam.zoom;
    const viewHeight = cam.height / cam.zoom;
    const targetScrollX = local.sprite.x - viewWidth / 2;
    const targetScrollY = local.sprite.y - viewHeight / 2;
    cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetScrollX, 0.15);
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, targetScrollY, 0.15);
  }

  private renderZone(zoneId: string) {
    if (this.currentZoneId === zoneId) return;
    this.currentZoneId = zoneId;
    this.setupCamera();
    this.clearMap();
    this.clearNpcs();
    this.clearResources();

    const ground = buildZoneMap(zoneId);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tileIndex = ground[y][x];
        const { x: worldX, y: worldY } = tileToWorld(x, y);
        const tile = this.add.image(worldX, worldY, "tileset");
        tile.setOrigin(0.5, 0.75);
        tile.setDepth(x + y);
        tile.setFrame(tileIndex);
        this.mapTiles.push(tile);
      }
    }

    this.renderNpcs(zoneId);
    this.renderResources(zoneId);
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
      if (npc.id === SLIME_BRUTE_NPC_ID) {
        sprite.setScale(1.15);
      }
      sprite.setDepth(900);
      if (isCombat && npc.combat) {
        const saved = networkManager.getMobHealth(npc.id);
        const currentHp = saved?.currentHp ?? npc.combat.maxHp;
        sprite.setAlpha(currentHp > 0 ? 1 : 0.35);
      }

      const label = this.add
        .text(x, y - 32, npc.name, {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "12px",
          fontStyle: "bold",
          color:
            npc.id === SLIME_BRUTE_NPC_ID
              ? "#15803d"
              : npc.id === WILD_SLIME_NPC_ID
                ? "#16a34a"
                : isCombat
                  ? "#e67e22"
                  : "#7c3aed",
          stroke: "#fff9f0",
          strokeThickness: 4,
          backgroundColor:
            npc.id === SLIME_BRUTE_NPC_ID
              ? "#bbf7d0"
              : npc.id === WILD_SLIME_NPC_ID
                ? "#dcfce7"
                : isCombat
                  ? "#fff3d6"
                  : "#f3ebff",
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5, 1)
        .setDepth(901);

      const hpBarBg = this.add.graphics().setDepth(902);
      const hpBarFill = this.add.graphics().setDepth(903);
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

      const sprite = this.add.sprite(x, y, "tree");
      sprite.setDepth(850);
      sprite.setAlpha(available ? 1 : 0.35);

      const label = this.add
        .text(x, y - 40, resource.name, {
          fontFamily: '"Fredoka", "Nunito", sans-serif',
          fontSize: "11px",
          fontStyle: "bold",
          color: "#2e7d32",
          stroke: "#fff9f0",
          strokeThickness: 4,
          backgroundColor: "#dcfce7",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setDepth(851);

      const chopBarBg = this.add.graphics().setDepth(852);
      const chopBarFill = this.add.graphics().setDepth(853);

      const rendered: RenderedResource = {
        id: resource.id,
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
    const y = resource.worldY - 52;

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
    const y = npc.worldY - 46;
    const fillWidth = Math.max(0, (npc.currentHp / npc.maxHp) * (width - 4));

    npc.hpBarBg.fillStyle(0xfff9f0, 1);
    npc.hpBarBg.fillRoundedRect(x, y, width, height, 4);
    npc.hpBarBg.lineStyle(2, 0x4a3728, 1);
    npc.hpBarBg.strokeRoundedRect(x, y, width, height, 4);
    npc.hpBarFill.fillStyle(npc.currentHp > 0 ? 0xff6b9d : 0xc9b8a8, 1);
    npc.hpBarFill.fillRoundedRect(x + 2, y + 2, fillWidth, height - 4, 3);
  }

  private applyKnockedOutVisuals() {
    if (!this.localSessionId) return;

    const local = this.renderedPlayers.get(this.localSessionId);
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

    const local = this.renderedPlayers.get(this.localSessionId);
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

    const local = this.renderedPlayers.get(this.localSessionId);
    if (!local) return;

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

    const local = this.renderedPlayers.get(this.localSessionId);
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

    const local = this.renderedPlayers.get(this.localSessionId);
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

    const local = this.renderedPlayers.get(this.localSessionId);
    if (!local) return;

    this.setPlayerAction(local, "fish", local.direction, AVATAR_ACTION_DURATIONS_MS.fish);
  }

  private startChopAnimation(playerName: string, resourceId: string, endsAt: number) {
    const resource = this.renderedResources.find((entry) => entry.id === resourceId);
    const durationMs = Math.max(0, endsAt - Date.now());
    for (const [, rendered] of this.renderedPlayers) {
      if (rendered.label.text !== playerName) continue;
      const direction = resource
        ? directionTowardTarget(
            rendered.sprite.x,
            rendered.sprite.y,
            resource.worldX,
            resource.worldY,
            rendered.direction,
          )
        : rendered.direction;
      this.setPlayerAction(rendered, "chop", direction, durationMs);
      if (playerName === useGameStore.getState().playerName) {
        this.localChoppingUntil = endsAt;
      }
      break;
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
    const animKey = playAvatarAnimation(this, player.sprite, player.appearance, direction, action);
    player.lastAnimKey = animKey;
  }

  private updatePlayerAnimations() {
    const now = Date.now();

    for (const [sessionId, rendered] of this.renderedPlayers) {
      const isLocal = sessionId === this.localSessionId;
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
      const animKey = avatarAnimKey(
        appearanceTextureKey(rendered.appearance),
        playDirection,
        playAction,
      );
      if (rendered.lastAnimKey !== animKey) {
        playAvatarAnimation(this, rendered.sprite, rendered.appearance, playDirection, playAction);
        rendered.lastAnimKey = animKey;
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
    const seen = new Set<string>();

    for (const player of players) {
      seen.add(player.sessionId);
      const existing = this.renderedPlayers.get(player.sessionId);
      const isLocal = player.sessionId === this.localSessionId;

      if (!existing) {
        preloadAvatarAnimations(this, player.appearance);
        const frameKey = avatarFrameTextureKey(
          appearanceTextureKey(player.appearance),
          "front",
          "idle",
          0,
        );
        const sprite = this.add.sprite(player.x, player.y, frameKey);
        sprite.setOrigin(0.5, 0.93);
        sprite.setDepth(1000);
        playAvatarAnimation(this, sprite, player.appearance, "front", "idle");
        const label = this.add
          .text(player.x, player.y - 42, player.name, {
            fontFamily: '"Fredoka", "Nunito", sans-serif',
            fontSize: "12px",
            fontStyle: "bold",
            color: isLocal ? "#e6a800" : "#3d2b1f",
            stroke: "#fff9f0",
            strokeThickness: 4,
            backgroundColor: isLocal ? "#fff3d6" : "#ffffff",
            padding: { x: 6, y: 3 },
          })
          .setOrigin(0.5, 1)
          .setDepth(1001);

        this.renderedPlayers.set(player.sessionId, {
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
          lastAnimKey: avatarAnimKey(appearanceTextureKey(player.appearance), "front", "idle"),
          remoteMoving: false,
          prevSpriteX: player.x,
          prevSpriteY: player.y,
        });

        if (isLocal) {
          this.updateCamera();
        }
      } else {
        existing.lastTargetX = existing.targetX;
        existing.lastTargetY = existing.targetY;
        existing.targetX = player.x;
        existing.targetY = player.y;

        if (isLocal) {
          const moving = this.lastSentInput.dx !== 0 || this.lastSentInput.dy !== 0;
          existing.predicted = moving
            ? reconcilePrediction(existing.predicted, { x: player.x, y: player.y })
            : { x: player.x, y: player.y };
        }

        existing.label.setText(player.name);
      }
    }

    for (const [sessionId, rendered] of this.renderedPlayers) {
      if (!seen.has(sessionId)) {
        rendered.sprite.destroy();
        rendered.label.destroy();
        this.renderedPlayers.delete(sessionId);
      }
    }
  }

  private applyLocalPrediction(dx: number, dy: number, delta: number) {
    if (!this.localSessionId) return;
    const local = this.renderedPlayers.get(this.localSessionId);
    if (!local) return;

    if (dx !== 0 || dy !== 0) {
      local.predicted = stepPrediction(local.predicted, dx, dy, delta);
    }

    const x = Math.round(local.predicted.x);
    const y = Math.round(local.predicted.y);
    local.sprite.setPosition(x, y);
    local.label.setPosition(x, y - 42);
  }

  private interpolateRemotePlayers() {
    const alpha = 0.25;

    for (const [sessionId, rendered] of this.renderedPlayers) {
      if (sessionId === this.localSessionId) continue;

      const x = Math.round(Phaser.Math.Linear(rendered.sprite.x, rendered.targetX, alpha));
      const y = Math.round(Phaser.Math.Linear(rendered.sprite.y, rendered.targetY, alpha));
      rendered.sprite.setPosition(x, y);
      rendered.label.setPosition(x, y - 42);
    }
  }

}