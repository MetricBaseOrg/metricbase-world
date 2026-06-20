import Phaser from "phaser";
import {
  ATTACK_RANGE,
  WILD_SLIME_NPC_ID,
  getZoneConfig,
  MAP_HEIGHT,
  MAP_WIDTH,
  NPC_INTERACT_RANGE,
  tileToWorld,
} from "@metricbase/shared";
import { ensurePhaserCharacterTexture } from "../character/characterArt";
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
  textureKey: string;
  targetX: number;
  targetY: number;
  predicted: PredictedPosition;
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
  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private attackKey: Phaser.Input.Keyboard.Key | null = null;
  private lastSentInput = { dx: 0, dy: 0 };
  private currentZoneId: string | null = null;

  constructor() {
    super("GameScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#b8e8fc");
    this.cameras.main.setZoom(1);

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D") as GameScene["wasd"];
      this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    const unsubscribePlayers = networkManager.onPlayersChange((players, sessionId) => {
      this.localSessionId = sessionId;
      this.syncPlayers(players);
    });

    const unsubscribeZone = networkManager.onZoneChange((zoneId) => {
      this.lastSentInput = { dx: 0, dy: 0 };
      networkManager.sendInput(0, 0);
      this.localSessionId = null;
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

    this.renderZone(networkManager.zoneId);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribePlayers();
      unsubscribeZone();
      unsubscribeMobHealth();
      unsubscribeAttackResult();
      unsubscribePlayerDamage();
      this.clearMap();
      this.clearNpcs();
      this.renderedPlayers.forEach((entry) => {
        entry.sprite.destroy();
        entry.label.destroy();
      });
      this.renderedPlayers.clear();
    });
  }

  update(_time: number, delta: number) {
    if (isUiTypingActive() || useGameStore.getState().knockedOut) {
      if (this.lastSentInput.dx !== 0 || this.lastSentInput.dy !== 0) {
        networkManager.sendInput(0, 0);
        this.lastSentInput = { dx: 0, dy: 0 };
      }
      return;
    }

    const dx = this.getAxisInput();
    const dy = this.getAxisInputY();

    if (dx !== this.lastSentInput.dx || dy !== this.lastSentInput.dy) {
      networkManager.sendInput(dx, dy);
      this.lastSentInput = { dx, dy };
    }

    this.applyLocalPrediction(dx, dy, delta);
    this.interpolateRemotePlayers();
    this.followLocalPlayer();
    this.applyKnockedOutVisuals();
    this.tryInteract();
    this.tryAttack();
  }

  private renderZone(zoneId: string) {
    if (this.currentZoneId === zoneId) return;
    this.currentZoneId = zoneId;
    this.clearMap();
    this.clearNpcs();

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

  private renderNpcs(zoneId: string) {
    const config = getZoneConfig(zoneId);

    for (const npc of config.npcs) {
      const { x, y } = tileToWorld(npc.tileX, npc.tileY);
      const isCombat = Boolean(npc.combat);
      const mobTexture =
        npc.id === WILD_SLIME_NPC_ID ? "slime" : isCombat ? "dummy" : "npc";
      const sprite = this.add.sprite(x, y, mobTexture);
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
            npc.id === WILD_SLIME_NPC_ID ? "#16a34a" : isCombat ? "#e67e22" : "#7c3aed",
          stroke: "#fff9f0",
          strokeThickness: 4,
          backgroundColor:
            npc.id === WILD_SLIME_NPC_ID ? "#dcfce7" : isCombat ? "#fff3d6" : "#f3ebff",
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
        const textureKey = ensurePhaserCharacterTexture(this, player.appearance);
        const sprite = this.add.sprite(player.x, player.y, textureKey);
        sprite.setDepth(1000);
        const label = this.add
          .text(player.x, player.y - 34, player.name, {
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

        if (isLocal) {
          this.cameras.main.centerOn(player.x, player.y);
        }

        this.renderedPlayers.set(player.sessionId, {
          sprite,
          label,
          textureKey,
          targetX: player.x,
          targetY: player.y,
          predicted: { x: player.x, y: player.y },
        });
      } else {
        const textureKey = ensurePhaserCharacterTexture(this, player.appearance);
        if (existing.textureKey !== textureKey) {
          existing.sprite.setTexture(textureKey);
          existing.textureKey = textureKey;
        }
        existing.targetX = player.x;
        existing.targetY = player.y;

        if (isLocal) {
          const moving = this.lastSentInput.dx !== 0 || this.lastSentInput.dy !== 0;
          existing.predicted = moving
            ? reconcilePrediction(existing.predicted, { x: player.x, y: player.y })
            : { x: player.x, y: player.y };
          existing.sprite.setPosition(existing.predicted.x, existing.predicted.y);
          existing.label.setPosition(existing.predicted.x, existing.predicted.y - 34);
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

    if (dx === 0 && dy === 0) return;

    local.predicted = stepPrediction(local.predicted, dx, dy, delta);
    local.sprite.setPosition(local.predicted.x, local.predicted.y);
    local.label.setPosition(local.predicted.x, local.predicted.y - 34);
  }

  private interpolateRemotePlayers() {
    const alpha = 0.25;

    for (const [sessionId, rendered] of this.renderedPlayers) {
      if (sessionId === this.localSessionId) continue;

      rendered.sprite.x = Phaser.Math.Linear(rendered.sprite.x, rendered.targetX, alpha);
      rendered.sprite.y = Phaser.Math.Linear(rendered.sprite.y, rendered.targetY, alpha);
      rendered.label.setPosition(rendered.sprite.x, rendered.sprite.y - 34);
    }
  }

  private followLocalPlayer() {
    if (!this.localSessionId) return;
    const local = this.renderedPlayers.get(this.localSessionId);
    if (!local) return;

    this.cameras.main.centerOn(local.sprite.x, local.sprite.y);
  }
}