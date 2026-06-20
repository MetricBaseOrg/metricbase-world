import Phaser from "phaser";
import { TILE_HEIGHT, TILE_WIDTH } from "@metricbase/shared";
import { TILESET_COLUMNS } from "./mapData";

const TILE_COLORS = {
  grass: { top: 0x9be870, left: 0x7ed957, right: 0x5fbf42 },
  stone: { top: 0xd7ccc8, left: 0xbca59f, right: 0xa1887f },
  water: { top: 0x7dd3fc, left: 0x5ec8f2, right: 0x38bdf8 },
  wall: { top: 0xc49a6c, left: 0xa67c52, right: 0x8d6e63 },
  portal: { top: 0xf0abfc, left: 0xe879f9, right: 0xd946ef },
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.createTilesetTexture();
    this.createPlayerTexture();
    this.createNpcTexture();
    this.createDummyTexture();
    this.createSlimeTexture();
    this.createBruteTexture();
  }

  create() {
    this.scene.start("GameScene");
  }

  private createTilesetTexture() {
    const tileCount = TILESET_COLUMNS;
    const width = TILE_WIDTH * tileCount;
    const height = TILE_HEIGHT;
    const graphics = this.make.graphics({ x: 0, y: 0 });

    const palettes = [
      TILE_COLORS.grass,
      TILE_COLORS.stone,
      TILE_COLORS.water,
      TILE_COLORS.wall,
      TILE_COLORS.portal,
    ];

    palettes.forEach((palette, index) => {
      this.drawIsoTile(graphics, index * TILE_WIDTH, 0, palette);
    });

    graphics.generateTexture("tileset-source", width, height);
    graphics.clear();
    graphics.destroy();

    const source = this.textures.get("tileset-source").getSourceImage() as HTMLImageElement;
    this.textures.addSpriteSheet("tileset", source, {
      frameWidth: TILE_WIDTH,
      frameHeight: TILE_HEIGHT,
    });
    this.textures.remove("tileset-source");
    this.textures.get("tileset").setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private createNpcTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const cx = 16;
    const cy = 30;
    const headY = cy - 20;

    graphics.fillStyle(0x4a3728, 0.25);
    graphics.fillEllipse(cx, cy + 2, 16, 7);
    graphics.fillStyle(0xb794f6, 1);
    graphics.fillRoundedRect(cx - 7, cy - 4, 14, 10, 4);
    graphics.fillStyle(0xffd5c8, 1);
    graphics.fillCircle(cx, headY, 12);
    graphics.lineStyle(2, 0x4a3728, 1);
    graphics.strokeCircle(cx, headY, 12);
    graphics.fillStyle(0x7c3aed, 1);
    graphics.fillCircle(cx, headY - 1, 12);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(cx - 4, headY + 2, 2.5);
    graphics.fillCircle(cx + 4, headY + 2, 2.5);
    graphics.fillStyle(0x2d3436, 1);
    graphics.fillCircle(cx - 4, headY + 2.5, 1.2);
    graphics.fillCircle(cx + 4, headY + 2.5, 1.2);

    graphics.generateTexture("npc", 36, 44);
    graphics.destroy();
  }

  private createDummyTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const cx = 16;
    const cy = 30;

    graphics.fillStyle(0x4a3728, 0.25);
    graphics.fillEllipse(cx, cy + 2, 18, 8);
    graphics.fillStyle(0xffb4a2, 1);
    graphics.fillRoundedRect(cx - 9, cy - 18, 18, 22, 6);
    graphics.lineStyle(2, 0x4a3728, 1);
    graphics.strokeRoundedRect(cx - 9, cy - 18, 18, 22, 6);
    graphics.fillStyle(0x8d6e63, 1);
    graphics.fillRect(cx - 7, cy - 14, 14, 6);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(cx - 3, cy - 8, 2);
    graphics.fillCircle(cx + 3, cy - 8, 2);

    graphics.generateTexture("dummy", 36, 44);
    graphics.destroy();
  }

  private createSlimeTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const cx = 16;
    const cy = 30;

    graphics.fillStyle(0x1b5e20, 0.25);
    graphics.fillEllipse(cx, cy + 2, 20, 8);
    graphics.fillStyle(0x4ade80, 1);
    graphics.fillEllipse(cx, cy - 6, 20, 24);
    graphics.fillStyle(0x22c55e, 1);
    graphics.fillEllipse(cx - 2, cy - 4, 16, 18);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(cx - 4, cy - 10, 3);
    graphics.fillCircle(cx + 5, cy - 8, 2.5);
    graphics.fillStyle(0x14532d, 1);
    graphics.fillCircle(cx - 4, cy - 10, 1.5);
    graphics.fillCircle(cx + 5, cy - 8, 1.2);

    graphics.generateTexture("slime", 36, 44);
    graphics.destroy();
  }

  private createBruteTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const cx = 18;
    const cy = 34;

    graphics.fillStyle(0x14532d, 0.3);
    graphics.fillEllipse(cx, cy + 2, 26, 10);
    graphics.fillStyle(0x166534, 1);
    graphics.fillEllipse(cx, cy - 10, 28, 32);
    graphics.fillStyle(0x15803d, 1);
    graphics.fillEllipse(cx - 2, cy - 6, 22, 24);
    graphics.fillStyle(0x4ade80, 0.5);
    graphics.fillEllipse(cx + 4, cy - 2, 10, 14);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(cx - 5, cy - 14, 4);
    graphics.fillCircle(cx + 6, cy - 12, 3.5);
    graphics.fillStyle(0x052e16, 1);
    graphics.fillCircle(cx - 5, cy - 14, 2);
    graphics.fillCircle(cx + 6, cy - 12, 1.8);

    graphics.generateTexture("brute", 40, 50);
    graphics.destroy();
  }

  private createPlayerTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const cx = 16;
    const cy = 30;
    const headY = cy - 20;

    graphics.fillStyle(0x4a3728, 0.25);
    graphics.fillEllipse(cx, cy + 2, 16, 7);
    graphics.fillStyle(0x4ecdc4, 1);
    graphics.fillRoundedRect(cx - 7, cy - 4, 14, 10, 4);
    graphics.fillStyle(0xffd5c8, 1);
    graphics.fillCircle(cx, headY, 12);
    graphics.lineStyle(2, 0x4a3728, 1);
    graphics.strokeCircle(cx, headY, 12);
    graphics.fillStyle(0xffc857, 1);
    graphics.fillCircle(cx, headY - 1, 11);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(cx - 4, headY + 2, 2.5);
    graphics.fillCircle(cx + 4, headY + 2, 2.5);

    graphics.generateTexture("player", 36, 44);
    graphics.destroy();
  }

  private drawIsoTile(
    graphics: Phaser.GameObjects.Graphics,
    offsetX: number,
    offsetY: number,
    palette: { top: number; left: number; right: number },
  ) {
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const cx = offsetX + hw;
    const cy = offsetY + hh;

    graphics.fillStyle(palette.left, 1);
    graphics.beginPath();
    graphics.moveTo(cx, cy);
    graphics.lineTo(cx - hw, cy + hh);
    graphics.lineTo(cx, cy + TILE_HEIGHT);
    graphics.lineTo(cx, cy);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(palette.right, 1);
    graphics.beginPath();
    graphics.moveTo(cx, cy);
    graphics.lineTo(cx + hw, cy + hh);
    graphics.lineTo(cx, cy + TILE_HEIGHT);
    graphics.lineTo(cx, cy);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(palette.top, 1);
    graphics.beginPath();
    graphics.moveTo(cx, cy - hh);
    graphics.lineTo(cx + hw, cy);
    graphics.lineTo(cx, cy + hh);
    graphics.lineTo(cx - hw, cy);
    graphics.lineTo(cx, cy - hh);
    graphics.closePath();
    graphics.fillPath();
  }
}