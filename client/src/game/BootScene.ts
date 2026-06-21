import Phaser from "phaser";
import { TILE_HEIGHT, TILE_WIDTH } from "@metricbase/shared";
import { TILESET_COLUMNS } from "./mapData";

const OUTLINE = 0x3a2a1e;

// Iso-cube tile palettes: top face, two side faces, dark edge, light accent.
const TILE_PALETTES = [
  { top: 0x8ed666, left: 0x68b84a, right: 0x57a33d, edge: 0x4f7a2f, accent: 0xa9e87f, type: "grass" },
  { top: 0xcfc6bf, left: 0xa99e95, right: 0x95897f, edge: 0x6f655c, accent: 0xe6ddd4, type: "stone" },
  { top: 0x6cc6f5, left: 0x49a7e0, right: 0x3690cf, edge: 0x2f74a8, accent: 0xb8e9ff, type: "water" },
  { top: 0xc79a66, left: 0xa67c4f, right: 0x8d6a42, edge: 0x5f4126, accent: 0xe0bd8c, type: "wall" },
  { top: 0xe7a6f7, left: 0xcf73e8, right: 0xb84fd6, edge: 0x7d2f99, accent: 0xfbe2ff, type: "portal" },
] as const;

type TilePalette = (typeof TILE_PALETTES)[number];

/** Tileset frame height — fits the iso top face (TILE_HEIGHT) plus side walls. */
const TILE_FRAME_HEIGHT = TILE_HEIGHT * 1.5;

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
    this.createTreeTexture();
    this.createRockTexture();
    this.createFishSpotTexture();
    this.createFarmPlotTextures();
  }

  create() {
    this.scene.start("GameScene");
  }

  private createTilesetTexture() {
    const width = TILE_WIDTH * TILESET_COLUMNS;
    const height = TILE_FRAME_HEIGHT;
    const graphics = this.make.graphics({ x: 0, y: 0 });

    TILE_PALETTES.forEach((palette, index) => {
      this.drawIsoCube(graphics, index * TILE_WIDTH, palette);
    });

    graphics.generateTexture("tileset-source", width, height);
    graphics.clear();
    graphics.destroy();

    const source = this.textures.get("tileset-source").getSourceImage() as HTMLImageElement;
    this.textures.addSpriteSheet("tileset", source, {
      frameWidth: TILE_WIDTH,
      frameHeight: TILE_FRAME_HEIGHT,
    });
    this.textures.remove("tileset-source");
    this.textures.get("tileset").setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private drawIsoCube(
    g: Phaser.GameObjects.Graphics,
    offsetX: number,
    palette: TilePalette,
  ) {
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const cx = offsetX + hw;
    const cy = hh; // top-face center
    const top = cy - hh;
    const bot = cy + hh;
    const sideBot = cy + TILE_HEIGHT;

    // left face
    g.fillStyle(palette.left, 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx - hw, cy + hh);
    g.lineTo(cx - hw, sideBot - hh);
    g.lineTo(cx, sideBot);
    g.closePath();
    g.fillPath();

    // right face
    g.fillStyle(palette.right, 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + hw, cy + hh);
    g.lineTo(cx + hw, sideBot - hh);
    g.lineTo(cx, sideBot);
    g.closePath();
    g.fillPath();

    // vertical seam between the two side faces
    g.lineStyle(1, palette.edge, 0.5);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx, sideBot);
    g.strokePath();

    // top face
    g.fillStyle(palette.top, 1);
    g.beginPath();
    g.moveTo(cx, top);
    g.lineTo(cx + hw, cy);
    g.lineTo(cx, bot);
    g.lineTo(cx - hw, cy);
    g.closePath();
    g.fillPath();

    // highlight band along the upper edges of the top face
    g.lineStyle(2, palette.accent, 0.6);
    g.beginPath();
    g.moveTo(cx - hw + 3, cy - 1.5);
    g.lineTo(cx, top + 1.5);
    g.lineTo(cx + hw - 3, cy - 1.5);
    g.strokePath();

    this.drawTileDetail(g, cx, cy, palette);

    // top diamond outline
    g.lineStyle(1.5, OUTLINE, 0.85);
    g.beginPath();
    g.moveTo(cx, top);
    g.lineTo(cx + hw, cy);
    g.lineTo(cx, bot);
    g.lineTo(cx - hw, cy);
    g.closePath();
    g.strokePath();

    // cube silhouette outline (front-facing walls)
    g.beginPath();
    g.moveTo(cx - hw, cy);
    g.lineTo(cx - hw, sideBot - hh);
    g.lineTo(cx, sideBot);
    g.lineTo(cx + hw, sideBot - hh);
    g.lineTo(cx + hw, cy);
    g.strokePath();
  }

  private drawTileDetail(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    palette: TilePalette,
  ) {
    switch (palette.type) {
      case "grass": {
        g.lineStyle(1.4, palette.edge, 0.8);
        const blades = [
          [cx - 12, cy + 2],
          [cx + 10, cy - 2],
          [cx + 2, cy + 6],
          [cx - 4, cy - 4],
          [cx + 16, cy + 4],
        ];
        for (const [bx, by] of blades) {
          g.beginPath();
          g.moveTo(bx, by);
          g.lineTo(bx - 1.5, by - 4);
          g.strokePath();
          g.beginPath();
          g.moveTo(bx, by);
          g.lineTo(bx + 1.5, by - 4);
          g.strokePath();
        }
        break;
      }
      case "water": {
        g.lineStyle(1.4, palette.accent, 0.9);
        g.beginPath();
        g.moveTo(cx - 12, cy - 1);
        g.lineTo(cx - 6, cy - 3);
        g.lineTo(cx, cy - 1);
        g.strokePath();
        g.beginPath();
        g.moveTo(cx + 2, cy + 4);
        g.lineTo(cx + 8, cy + 2);
        g.lineTo(cx + 14, cy + 4);
        g.strokePath();
        break;
      }
      case "stone": {
        g.fillStyle(palette.accent, 0.7);
        g.fillCircle(cx - 8, cy, 1.6);
        g.fillCircle(cx + 6, cy - 3, 1.3);
        g.fillCircle(cx + 4, cy + 5, 1.1);
        g.fillStyle(palette.edge, 0.5);
        g.fillCircle(cx - 2, cy + 3, 1.2);
        g.fillCircle(cx + 12, cy + 1, 1);
        break;
      }
      case "wall": {
        g.lineStyle(1.2, palette.edge, 0.7);
        g.beginPath();
        g.moveTo(cx - TILE_WIDTH / 2 + 6, cy);
        g.lineTo(cx + TILE_WIDTH / 2 - 6, cy);
        g.strokePath();
        break;
      }
      case "portal": {
        g.fillStyle(palette.accent, 0.85);
        g.fillCircle(cx, cy, 5);
        g.fillStyle(palette.edge, 0.7);
        g.fillCircle(cx, cy, 2.4);
        g.fillStyle(palette.accent, 0.9);
        g.fillCircle(cx - 2, cy - 2, 1.1);
        break;
      }
    }
  }

  private createTreeTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const cx = 22;
    const baseY = 46;

    g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + 3, 28, 9);
    g.fillStyle(0x7a5236, 1).fillRoundedRect(cx - 4, baseY - 14, 8, 16, 3);
    g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 4, baseY - 14, 8, 16, 3);

    const blobs: [number, number, number][] = [
      [cx - 9, baseY - 22, 11],
      [cx + 9, baseY - 22, 11],
      [cx, baseY - 31, 13],
      [cx - 4, baseY - 15, 9],
      [cx + 5, baseY - 16, 9],
    ];
    g.lineStyle(2, OUTLINE, 1);
    for (const [x, y, r] of blobs) g.fillStyle(0x2e7d32, 1).fillCircle(x, y, r);
    for (const [x, y, r] of blobs) g.strokeCircle(x, y, r);
    for (const [x, y, r] of blobs) g.fillStyle(0x2e7d32, 1).fillCircle(x, y, r - 2);

    g.fillStyle(0x4caf50, 1)
      .fillCircle(cx - 3, baseY - 33, 6)
      .fillCircle(cx + 6, baseY - 26, 5)
      .fillCircle(cx - 9, baseY - 24, 4);
    g.fillStyle(0x81c784, 0.8).fillCircle(cx - 4, baseY - 35, 3);

    g.generateTexture("tree", 44, 52);
    g.destroy();
  }

  private createSlimeTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const cx = 20;
    const cy = 24;

    g.fillStyle(0x14532d, 0.22).fillEllipse(cx, cy + 12, 26, 8);
    g.fillStyle(0x43d17a, 1).fillEllipse(cx, cy, 30, 26);
    g.lineStyle(2, OUTLINE, 1).strokeEllipse(cx, cy, 30, 26);
    g.fillStyle(0x2fb863, 1).fillEllipse(cx, cy + 5, 20, 12);
    g.fillStyle(0xb6f5cf, 0.7).fillEllipse(cx - 5, cy - 8, 12, 6);

    g.fillStyle(0xffffff, 1).fillCircle(cx - 6, cy - 2, 4).fillCircle(cx + 6, cy - 2, 4);
    g.lineStyle(1, OUTLINE, 0.5).strokeCircle(cx - 6, cy - 2, 4).strokeCircle(cx + 6, cy - 2, 4);
    g.fillStyle(0x22343a, 1).fillCircle(cx - 5, cy - 1, 2).fillCircle(cx + 7, cy - 1, 2);
    g.fillStyle(0xffffff, 1).fillCircle(cx - 4.4, cy - 1.8, 0.9).fillCircle(cx + 7.6, cy - 1.8, 0.9);

    g.lineStyle(1.4, 0x14532d, 1);
    g.beginPath();
    g.moveTo(cx - 3, cy + 4);
    g.lineTo(cx, cy + 6);
    g.lineTo(cx + 3, cy + 4);
    g.strokePath();

    g.generateTexture("slime", 40, 44);
    g.destroy();
  }

  private createBruteTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const cx = 24;
    const cy = 28;

    g.fillStyle(0x0a3d1a, 0.28).fillEllipse(cx, cy + 15, 36, 11);
    g.fillStyle(0x2e9e57, 1).fillEllipse(cx, cy, 40, 36);
    g.lineStyle(2.4, OUTLINE, 1).strokeEllipse(cx, cy, 40, 36);
    g.fillStyle(0x238047, 1).fillEllipse(cx, cy + 7, 28, 16);
    g.fillStyle(0x7fe3a3, 0.55).fillEllipse(cx - 7, cy - 11, 14, 7);

    g.fillStyle(0x1c6e3b, 1)
      .fillCircle(cx + 11, cy + 2, 3)
      .fillCircle(cx - 12, cy + 5, 2.4)
      .fillCircle(cx + 4, cy + 9, 2);

    g.fillStyle(0xffffff, 1).fillEllipse(cx - 8, cy - 2, 9, 8).fillEllipse(cx + 8, cy - 2, 9, 8);
    g.fillStyle(0xb91c1c, 1).fillCircle(cx - 7, cy - 1, 2.6).fillCircle(cx + 9, cy - 1, 2.6);

    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(cx - 13, cy - 8, cx - 3, cy - 4, cx - 13, cy - 4);
    g.fillTriangle(cx + 13, cy - 8, cx + 3, cy - 4, cx + 13, cy - 4);

    g.lineStyle(1.8, 0x0a3d1a, 1);
    g.beginPath();
    g.moveTo(cx - 6, cy + 8);
    g.lineTo(cx, cy + 6);
    g.lineTo(cx + 6, cy + 8);
    g.strokePath();
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(cx - 3, cy + 6.5, cx - 1, cy + 6.5, cx - 2, cy + 9.5);
    g.fillTriangle(cx + 3, cy + 6.5, cx + 1, cy + 6.5, cx + 2, cy + 9.5);

    g.generateTexture("brute", 48, 50);
    g.destroy();
  }

  private createNpcTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const cx = 19;
    const feetY = 48;
    const headY = 18;
    const headR = 12;

    g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, feetY + 1, 22, 7);

    g.fillStyle(0x8d6e63, 1);
    g.beginPath();
    g.moveTo(cx - 8, headY + 10);
    g.lineTo(cx + 8, headY + 10);
    g.lineTo(cx + 10, feetY);
    g.lineTo(cx - 10, feetY);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, OUTLINE, 1);
    g.beginPath();
    g.moveTo(cx - 8, headY + 10);
    g.lineTo(cx + 8, headY + 10);
    g.lineTo(cx + 10, feetY);
    g.lineTo(cx - 10, feetY);
    g.closePath();
    g.strokePath();

    g.fillStyle(0xf5e6c8, 1).fillRoundedRect(cx - 5, headY + 12, 10, 18, 3);
    g.lineStyle(1.5, OUTLINE, 1).strokeRoundedRect(cx - 5, headY + 12, 10, 18, 3);

    g.lineStyle(4, 0x8d6e63, 1);
    g.beginPath();
    g.moveTo(cx - 7, headY + 13);
    g.lineTo(cx - 10, headY + 22);
    g.strokePath();
    g.beginPath();
    g.moveTo(cx + 7, headY + 13);
    g.lineTo(cx + 10, headY + 22);
    g.strokePath();
    g.fillStyle(0xffd9b3, 1).fillCircle(cx - 10, headY + 23, 2.4).fillCircle(cx + 10, headY + 23, 2.4);

    g.fillStyle(0xffd9b3, 1).fillCircle(cx, headY, headR);
    g.lineStyle(2, OUTLINE, 1).strokeCircle(cx, headY, headR);

    g.fillStyle(0x6d4c41, 1);
    g.beginPath();
    g.moveTo(cx - headR, headY - 1);
    g.lineTo(cx - headR, headY - 4);
    g.lineTo(cx + headR, headY - 4);
    g.lineTo(cx + headR, headY - 1);
    g.lineTo(cx + headR - 2, headY - 5);
    g.lineTo(cx, headY - 7);
    g.lineTo(cx - headR + 2, headY - 5);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x6d4c41, 1).fillEllipse(cx, headY - 5, headR * 2, 8);

    g.fillStyle(0x2d3436, 1).fillCircle(cx - 4, headY + 1, 1.6).fillCircle(cx + 4, headY + 1, 1.6);
    g.fillStyle(0xff9e9e, 0.5).fillCircle(cx - 6, headY + 4, 1.8).fillCircle(cx + 6, headY + 4, 1.8);
    g.lineStyle(1.2, 0x7a4a3a, 1);
    g.beginPath();
    g.moveTo(cx - 2.5, headY + 5);
    g.lineTo(cx, headY + 6.5);
    g.lineTo(cx + 2.5, headY + 5);
    g.strokePath();

    g.generateTexture("npc", 38, 54);
    g.destroy();
  }

  private createDummyTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const cx = 20;
    const feetY = 48;

    g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, feetY + 1, 22, 7);

    g.fillStyle(0x8a5a33, 1).fillRoundedRect(cx - 2.5, feetY - 30, 5, 30, 2);
    g.lineStyle(1.5, OUTLINE, 1).strokeRoundedRect(cx - 2.5, feetY - 30, 5, 30, 2);
    g.fillStyle(0x8a5a33, 1).fillRoundedRect(cx - 13, feetY - 26, 26, 4, 2);
    g.lineStyle(1.5, OUTLINE, 1).strokeRoundedRect(cx - 13, feetY - 26, 26, 4, 2);

    g.fillStyle(0xd9b27c, 1).fillRoundedRect(cx - 9, feetY - 28, 18, 22, 7);
    g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 9, feetY - 28, 18, 22, 7);
    g.fillStyle(0x6d4c41, 1).fillRect(cx - 9, feetY - 22, 18, 2.5).fillRect(cx - 9, feetY - 13, 18, 2.5);

    g.fillStyle(0xd9b27c, 1).fillCircle(cx, feetY - 30, 5);
    g.lineStyle(2, OUTLINE, 1).strokeCircle(cx, feetY - 30, 5);

    g.lineStyle(1.6, 0x7a3b2e, 1);
    for (const ex of [cx - 4, cx + 4]) {
      g.beginPath();
      g.moveTo(ex - 1.6, feetY - 19);
      g.lineTo(ex + 1.6, feetY - 16);
      g.strokePath();
      g.beginPath();
      g.moveTo(ex + 1.6, feetY - 19);
      g.lineTo(ex - 1.6, feetY - 16);
      g.strokePath();
    }
    g.lineStyle(1.6, 0xc0392b, 1).strokeCircle(cx, feetY - 11, 3.4);
    g.fillStyle(0xc0392b, 1).fillCircle(cx, feetY - 11, 1.2);

    g.generateTexture("dummy", 40, 54);
    g.destroy();
  }

  private createRockTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const cx = 21;
    const baseY = 34;

    g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + 4, 30, 9);
    // boulder body
    g.fillStyle(0x8a8f98, 1);
    g.beginPath();
    g.moveTo(cx - 14, baseY);
    g.lineTo(cx - 10, baseY - 14);
    g.lineTo(cx - 2, baseY - 18);
    g.lineTo(cx + 8, baseY - 15);
    g.lineTo(cx + 14, baseY - 4);
    g.lineTo(cx + 12, baseY);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, OUTLINE, 1);
    g.beginPath();
    g.moveTo(cx - 14, baseY);
    g.lineTo(cx - 10, baseY - 14);
    g.lineTo(cx - 2, baseY - 18);
    g.lineTo(cx + 8, baseY - 15);
    g.lineTo(cx + 14, baseY - 4);
    g.lineTo(cx + 12, baseY);
    g.closePath();
    g.strokePath();
    // top highlight facet
    g.fillStyle(0xb6bcc4, 1);
    g.beginPath();
    g.moveTo(cx - 8, baseY - 12);
    g.lineTo(cx - 1, baseY - 16);
    g.lineTo(cx + 4, baseY - 11);
    g.lineTo(cx - 3, baseY - 8);
    g.closePath();
    g.fillPath();
    // shaded facet
    g.fillStyle(0x6b7079, 1);
    g.beginPath();
    g.moveTo(cx + 4, baseY - 11);
    g.lineTo(cx + 12, baseY - 4);
    g.lineTo(cx + 10, baseY);
    g.lineTo(cx + 2, baseY);
    g.closePath();
    g.fillPath();
    // copper ore specks
    g.fillStyle(0xd98c4a, 1).fillCircle(cx - 4, baseY - 6, 1.8).fillCircle(cx + 6, baseY - 8, 1.5);
    g.fillStyle(0xf0a868, 1).fillCircle(cx - 4, baseY - 6.6, 0.7).fillCircle(cx + 6, baseY - 8.6, 0.6);

    g.generateTexture("rock", 44, 44);
    g.destroy();
  }

  private createFishSpotTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const cx = 20;
    const cy = 22;

    // ripple rings on the water surface
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeEllipse(cx, cy, 30, 15);
    g.lineStyle(2, 0xeaf7ff, 0.55);
    g.strokeEllipse(cx, cy, 20, 10);
    g.lineStyle(1.5, 0xffffff, 0.45);
    g.strokeEllipse(cx, cy, 10, 5);

    // bobber float (red top, white bottom) above the water
    const bx = cx + 6;
    const by = cy - 8;
    g.fillStyle(0xffffff, 1).fillCircle(bx, by, 4);
    g.lineStyle(1.5, OUTLINE, 1).strokeCircle(bx, by, 4);
    g.fillStyle(0xe2483b, 1);
    g.beginPath();
    g.moveTo(bx - 4, by);
    g.lineTo(bx + 4, by);
    g.lineTo(bx + 3, by - 3);
    g.lineTo(bx, by - 4.4);
    g.lineTo(bx - 3, by - 3);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, OUTLINE, 1).strokeCircle(bx, by, 4);
    g.fillStyle(OUTLINE, 1).fillCircle(bx, by + 0.5, 1);
    // tiny fish glint
    g.fillStyle(0x8fd3ff, 0.9).fillCircle(cx - 6, cy + 2, 1.6);

    g.generateTexture("fishspot", 40, 40);
    g.destroy();
  }

  private createFarmPlotTextures() {
    const W = 46;
    const H = 30;

    const drawSoil = (g: Phaser.GameObjects.Graphics) => {
      g.fillStyle(0x2a1d12, 0.18).fillEllipse(W / 2, H - 4, W - 6, 8);
      g.fillStyle(0x6b4a2f, 1).fillRoundedRect(4, 4, W - 8, H - 8, 4);
      g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(4, 4, W - 8, H - 8, 4);
      g.fillStyle(0x573b25, 1);
      for (const fy of [H / 2 - 4, H / 2 + 2]) g.fillRoundedRect(8, fy, W - 16, 2, 1);
    };

    // Empty tilled soil.
    let g = this.make.graphics({ x: 0, y: 0 });
    drawSoil(g);
    g.generateTexture("plot_empty", W, H);
    g.destroy();

    // Growing — small green sprouts.
    g = this.make.graphics({ x: 0, y: 0 });
    drawSoil(g);
    for (const sx of [W / 2 - 10, W / 2, W / 2 + 10]) {
      g.lineStyle(2, 0x4caf50, 1);
      g.beginPath();
      g.moveTo(sx, H / 2 + 3);
      g.lineTo(sx, H / 2 - 4);
      g.strokePath();
      g.fillStyle(0x66bb6a, 1).fillCircle(sx - 2, H / 2 - 4, 2).fillCircle(sx + 2, H / 2 - 5, 2);
    }
    g.generateTexture("plot_growing", W, H);
    g.destroy();

    // Ready — golden wheat stalks.
    g = this.make.graphics({ x: 0, y: 0 });
    drawSoil(g);
    for (const sx of [W / 2 - 12, W / 2 - 4, W / 2 + 4, W / 2 + 12]) {
      g.lineStyle(2, 0xc79a3a, 1);
      g.beginPath();
      g.moveTo(sx, H / 2 + 4);
      g.lineTo(sx, H / 2 - 8);
      g.strokePath();
      g.fillStyle(0xf2c94c, 1).fillEllipse(sx, H / 2 - 9, 4, 7);
      g.lineStyle(1, OUTLINE, 0.7).strokeEllipse(sx, H / 2 - 9, 4, 7);
    }
    g.generateTexture("plot_ready", W, H);
    g.destroy();
  }

  private createPlayerTexture() {
    // Fallback sprite used only if avatar pose generation fails.
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
    graphics.lineStyle(2, OUTLINE, 1);
    graphics.strokeCircle(cx, headY, 12);
    graphics.fillStyle(0xffc857, 1);
    graphics.fillCircle(cx, headY - 1, 11);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(cx - 4, headY + 2, 2.5);
    graphics.fillCircle(cx + 4, headY + 2, 2.5);

    graphics.generateTexture("player", 36, 44);
    graphics.destroy();
  }
}
