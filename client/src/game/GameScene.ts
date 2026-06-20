import Phaser from "phaser";
import {
  getZoneConfig,
  MAP_HEIGHT,
  MAP_WIDTH,
  NPC_INTERACT_RANGE,
  tileToWorld,
} from "@metricbase/shared";
import { networkManager, RemotePlayer } from "./network";
import { buildZoneMap } from "./mapData";
import { PredictedPosition, reconcilePrediction, stepPrediction } from "./prediction";

interface RenderedPlayer {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
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
  private lastSentInput = { dx: 0, dy: 0 };
  private currentZoneId: string | null = null;

  constructor() {
    super("GameScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#87ceeb");
    this.cameras.main.setZoom(1);

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D") as GameScene["wasd"];
      this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    }

    const unsubscribePlayers = networkManager.onPlayersChange((players, sessionId) => {
      this.localSessionId = sessionId;
      this.syncPlayers(players);
    });

    const unsubscribeZone = networkManager.onZoneChange((zoneId) => {
      this.renderZone(zoneId);
    });

    this.renderZone(networkManager.zoneId);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribePlayers();
      unsubscribeZone();
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
    const dx = this.getAxisInput();
    const dy = this.getAxisInputY();

    if (dx !== this.lastSentInput.dx || dy !== this.lastSentInput.dy) {
      networkManager.sendInput(dx, dy);
      this.lastSentInput = { dx, dy };
    }

    this.applyLocalPrediction(dx, dy, delta);
    this.interpolateRemotePlayers();
    this.followLocalPlayer();
    this.tryInteract();
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
    });
    this.renderedNpcs = [];
  }

  private renderNpcs(zoneId: string) {
    const config = getZoneConfig(zoneId);

    for (const npc of config.npcs) {
      const { x, y } = tileToWorld(npc.tileX, npc.tileY);
      const sprite = this.add.sprite(x, y, "npc");
      sprite.setDepth(900);
      const label = this.add
        .text(x, y - 28, npc.name, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: "#e1bee7",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 1)
        .setDepth(901);

      this.renderedNpcs.push({
        id: npc.id,
        sprite,
        label,
        worldX: x,
        worldY: y,
      });
    }
  }

  private tryInteract() {
    if (!this.interactKey || !Phaser.Input.Keyboard.JustDown(this.interactKey)) return;
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
      networkManager.sendInteract(nearest.id);
    }
  }

  private getAxisInput(): number {
    const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
    if (left && right) return 0;
    if (left) return -1;
    if (right) return 1;
    return 0;
  }

  private getAxisInputY(): number {
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
        const sprite = this.add.sprite(player.x, player.y, "player");
        sprite.setDepth(1000);
        const label = this.add
          .text(player.x, player.y - 28, player.name, {
            fontFamily: "system-ui, sans-serif",
            fontSize: "11px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1)
          .setDepth(1001);

        if (isLocal) {
          sprite.setTint(0xffd27f);
          this.cameras.main.centerOn(player.x, player.y);
        }

        this.renderedPlayers.set(player.sessionId, {
          sprite,
          label,
          targetX: player.x,
          targetY: player.y,
          predicted: { x: player.x, y: player.y },
        });
      } else {
        existing.targetX = player.x;
        existing.targetY = player.y;

        if (isLocal) {
          const moving = this.lastSentInput.dx !== 0 || this.lastSentInput.dy !== 0;
          existing.predicted = moving
            ? reconcilePrediction(existing.predicted, { x: player.x, y: player.y })
            : { x: player.x, y: player.y };
          existing.sprite.setPosition(existing.predicted.x, existing.predicted.y);
          existing.label.setPosition(existing.predicted.x, existing.predicted.y - 28);
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
    local.label.setPosition(local.predicted.x, local.predicted.y - 28);
  }

  private interpolateRemotePlayers() {
    const alpha = 0.25;

    for (const [sessionId, rendered] of this.renderedPlayers) {
      if (sessionId === this.localSessionId) continue;

      rendered.sprite.x = Phaser.Math.Linear(rendered.sprite.x, rendered.targetX, alpha);
      rendered.sprite.y = Phaser.Math.Linear(rendered.sprite.y, rendered.targetY, alpha);
      rendered.label.setPosition(rendered.sprite.x, rendered.sprite.y - 28);
    }
  }

  private followLocalPlayer() {
    if (!this.localSessionId) return;
    const local = this.renderedPlayers.get(this.localSessionId);
    if (!local) return;

    this.cameras.main.centerOn(local.sprite.x, local.sprite.y);
  }
}