import Phaser from "phaser";
import { TILE_HEIGHT, TILE_WIDTH } from "@metricbase/shared";
import { TILESET_COLUMNS } from "./mapData";

const TILE_COLORS = {
  grass: { top: 0x5cb85c, left: 0x449d44, right: 0x3d8b3d },
  stone: { top: 0x9e9e9e, left: 0x757575, right: 0x616161 },
  water: { top: 0x4aa3df, left: 0x2f7fbf, right: 0x256ba3 },
  wall: { top: 0x6d4c41, left: 0x4e342e, right: 0x3e2723 },
  portal: { top: 0xb388ff, left: 0x7e57c2, right: 0x5e35b1 },
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.createTilesetTexture();
    this.createPlayerTexture();
    this.createNpcTexture();
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
    const cy = 28;

    graphics.fillStyle(0x2d3436, 1);
    graphics.fillEllipse(cx, cy, 20, 10);
    graphics.fillStyle(0xb388ff, 1);
    graphics.fillCircle(cx, cy - 14, 10);
    graphics.fillStyle(0x4a148c, 1);
    graphics.fillRoundedRect(cx - 8, cy - 8, 16, 14, 3);

    graphics.generateTexture("npc", 32, 40);
    graphics.destroy();
  }

  private createPlayerTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const cx = 16;
    const cy = 28;

    graphics.fillStyle(0x2d3436, 1);
    graphics.fillEllipse(cx, cy, 20, 10);
    graphics.fillStyle(0xffc857, 1);
    graphics.fillCircle(cx, cy - 14, 10);
    graphics.fillStyle(0x355070, 1);
    graphics.fillRoundedRect(cx - 8, cy - 8, 16, 14, 3);

    graphics.generateTexture("player", 32, 40);
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