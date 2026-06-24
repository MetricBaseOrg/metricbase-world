import Phaser from "phaser";
import { ROOF_COLORS, TILE_HEIGHT, TILE_WIDTH } from "@metricbase/shared";
import { TILESET_COLUMNS } from "./mapData";

const OUTLINE = 0x3a2a1e;

// Iso-cube tile palettes: top face, two side faces, dark edge, light accent.
// Tuned toward a warm, soft "cozy" look — gentler greens, cobblestone-lavender
// paths, and calmer water rather than neon brights.
const TILE_PALETTES = [
  { top: 0x8ac35d, left: 0x6aa548, right: 0x5b963d, edge: 0x46742d, accent: 0xaad97c, type: "grass" },
  { top: 0xc4bccb, left: 0xa69cb0, right: 0x948aa0, edge: 0x6c6276, accent: 0xded6e8, type: "stone" },
  { top: 0x5fb4e8, left: 0x439ad6, right: 0x3185c2, edge: 0x276896, accent: 0xa9dbf5, type: "water" },
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
    this.createHousingTextures();
    this.createDecorTextures();
    this.createSceneryTextures();
    this.createBillboardTexture();
    this.createPortalTexture();
    this.createGroundDetailTextures();
  }

  /** Small cosmetic props scattered over grass to make the ground feel alive. */
  private createGroundDetailTextures() {
    const shadow = (g: Phaser.GameObjects.Graphics, cx: number, by: number, w: number) =>
      g.fillStyle(0x2a1d12, 0.16).fillEllipse(cx, by, w, Math.max(3, w * 0.32));

    // Flower cluster — three little blooms on stems.
    let g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 22, H = 20, cx = W / 2, by = H - 3;
      shadow(g, cx, by, 14);
      const bloom = (x: number, y: number, petal: number) => {
        g.lineStyle(1.4, 0x4f8a3d, 1);
        g.strokePoints([{ x, y: by - 1 }, { x, y }], false);
        g.fillStyle(petal, 1).fillCircle(x, y, 2.6);
        g.fillStyle(0xfff0a8, 1).fillCircle(x, y, 1.1);
      };
      bloom(cx - 5, by - 9, 0xff8fb3);
      bloom(cx + 1, by - 12, 0xfff0a8);
      bloom(cx + 6, by - 8, 0x9ec5ff);
      g.generateTexture("detail_flowers", W, H);
      g.destroy();
    }

    // Mushroom — red cap with white spots.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 16, H = 16, cx = W / 2, by = H - 3;
      shadow(g, cx, by, 11);
      g.fillStyle(0xf2ecd9, 1).fillRoundedRect(cx - 2, by - 6, 4, 6, 1.5);
      g.fillStyle(0xd0463f, 1).fillEllipse(cx, by - 6, 11, 7);
      g.lineStyle(1.5, OUTLINE, 1).strokeEllipse(cx, by - 6, 11, 7);
      g.fillStyle(0xfff3e8, 1).fillCircle(cx - 2, by - 7, 1.3).fillCircle(cx + 3, by - 6, 1.1);
      g.generateTexture("detail_mushroom", W, H);
      g.destroy();
    }

    // Pebbles — a couple of small stones.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 18, H = 12, cx = W / 2, by = H - 3;
      shadow(g, cx, by, 13);
      g.fillStyle(0xb4aaa0, 1).fillEllipse(cx - 3, by - 2, 8, 5);
      g.fillStyle(0x9a8f85, 1).fillEllipse(cx + 4, by - 1, 6, 4);
      g.lineStyle(1.3, OUTLINE, 0.8).strokeEllipse(cx - 3, by - 2, 8, 5).strokeEllipse(cx + 4, by - 1, 6, 4);
      g.generateTexture("detail_pebbles", W, H);
      g.destroy();
    }

    // Grass tuft — a few blades.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 16, H = 16, cx = W / 2, by = H - 3;
      g.lineStyle(2, 0x5aa341, 1);
      g.strokePoints([{ x: cx - 4, y: by }, { x: cx - 5, y: by - 8 }], false);
      g.strokePoints([{ x: cx, y: by }, { x: cx, y: by - 11 }], false);
      g.strokePoints([{ x: cx + 4, y: by }, { x: cx + 6, y: by - 7 }], false);
      g.lineStyle(2, 0x7cc35a, 1);
      g.strokePoints([{ x: cx - 1, y: by }, { x: cx - 2, y: by - 9 }], false);
      g.generateTexture("detail_tuft", W, H);
      g.destroy();
    }

    // Fallen leaves — autumn accents.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 18, H = 12, cx = W / 2, by = H - 4;
      g.fillStyle(0xe08a3c, 1).fillEllipse(cx - 3, by, 6, 3.4);
      g.fillStyle(0xc7632a, 1).fillEllipse(cx + 4, by - 2, 5, 3);
      g.fillStyle(0xd8a13e, 1).fillEllipse(cx + 1, by + 1, 4, 2.4);
      g.generateTexture("detail_leaf", W, H);
      g.destroy();
    }
  }

  private createPortalTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const W = 56;
    const H = 80;
    const cx = W / 2;
    const baseY = H - 10;
    const pcy = baseY - 30; // portal centre

    // Ground glow pad.
    g.fillStyle(0xb84fd6, 0.18).fillEllipse(cx, baseY, 34, 12);
    // Stone footing (a small iso diamond).
    g.fillStyle(0x6b6470, 1).fillPoints(
      [
        { x: cx, y: baseY - 6 },
        { x: cx + 16, y: baseY },
        { x: cx, y: baseY + 6 },
        { x: cx - 16, y: baseY },
      ],
      true,
    );
    g.lineStyle(2, OUTLINE, 1).strokePoints(
      [
        { x: cx, y: baseY - 6 },
        { x: cx + 16, y: baseY },
        { x: cx, y: baseY + 6 },
        { x: cx - 16, y: baseY },
      ],
      true,
    );

    // Stone ring (frame) around the portal surface.
    g.fillStyle(0x7a6a86, 1).fillEllipse(cx, pcy, 21, 31);
    g.lineStyle(2.5, OUTLINE, 1).strokeEllipse(cx, pcy, 21, 31);
    // Glowing magenta portal surface, layered for a soft radial look.
    g.fillStyle(0x6a249a, 1).fillEllipse(cx, pcy, 17, 27);
    g.fillStyle(0xab46cf, 1).fillEllipse(cx, pcy, 12, 21);
    g.fillStyle(0xe7a6f7, 0.95).fillEllipse(cx, pcy - 1, 7, 14);
    g.fillStyle(0xfbe2ff, 0.9).fillEllipse(cx, pcy - 2, 3.5, 8);
    // Swirl hints.
    g.lineStyle(1.5, 0xf3d0ff, 0.7).strokeEllipse(cx + 2, pcy + 2, 9, 16);
    // Sparkles.
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - 9, pcy - 12, 1.4);
    g.fillCircle(cx + 8, pcy + 8, 1.6);
    g.fillCircle(cx + 6, pcy - 14, 1.2);

    g.generateTexture("portal_gate", W, H);
    g.destroy();
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
    // Iso-diamond soil bed spanning a 2x2 tile footprint.
    const W = 128;
    const H = 76;
    const cx = W / 2;
    const cy = 40;
    const hw = 58;
    const hh = 29;

    const isoDiamond = (g: Phaser.GameObjects.Graphics, color: number) => {
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(cx, cy - hh);
      g.lineTo(cx + hw, cy);
      g.lineTo(cx, cy + hh);
      g.lineTo(cx - hw, cy);
      g.closePath();
      g.fillPath();
    };

    // Crop positions across the bed: two parallel rows following the furrows.
    const crops = (perRow: number) => {
      const out: { x: number; y: number }[] = [];
      for (const r of [-0.5, 0.5]) {
        const ox = r * -hw * 0.34;
        const oy = r * hh * 0.34;
        for (let i = 0; i < perRow; i++) {
          const t = (i + 0.5) / perRow - 0.5;
          out.push({ x: cx + t * hw * 1.1 + ox, y: cy + t * hh * 1.1 + oy });
        }
      }
      return out;
    };

    const drawSoil = (g: Phaser.GameObjects.Graphics) => {
      isoDiamond(g, 0x6b4a2f);
      // furrows running parallel to the right edge (the iso row direction)
      g.lineStyle(1.5, 0x573b25, 1);
      for (const k of [-1, 0, 1]) {
        const ox = k * -hw * 0.3;
        const oy = k * hh * 0.3;
        g.beginPath();
        g.moveTo(cx - hw * 0.55 + ox, cy - hh * 0.55 + oy);
        g.lineTo(cx + hw * 0.55 + ox, cy + hh * 0.55 + oy);
        g.strokePath();
      }
      g.lineStyle(2, OUTLINE, 1);
      g.beginPath();
      g.moveTo(cx, cy - hh);
      g.lineTo(cx + hw, cy);
      g.lineTo(cx, cy + hh);
      g.lineTo(cx - hw, cy);
      g.closePath();
      g.strokePath();
    };

    let g = this.make.graphics({ x: 0, y: 0 });
    drawSoil(g);
    g.generateTexture("plot_empty", W, H);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 });
    drawSoil(g);
    for (const p of crops(3)) {
      g.lineStyle(2, 0x4caf50, 1);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x, p.y - 9);
      g.strokePath();
      g.fillStyle(0x66bb6a, 1).fillCircle(p.x - 2, p.y - 9, 2).fillCircle(p.x + 2, p.y - 10, 2);
    }
    g.generateTexture("plot_growing", W, H);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 });
    drawSoil(g);
    for (const p of crops(3)) {
      g.lineStyle(2, 0xc79a3a, 1);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x, p.y - 13);
      g.strokePath();
      g.fillStyle(0xf2c94c, 1).fillEllipse(p.x, p.y - 14, 4, 7);
      g.lineStyle(1, OUTLINE, 0.7).strokeEllipse(p.x, p.y - 14, 4, 7);
    }
    g.generateTexture("plot_ready", W, H);
    g.destroy();
  }

  private createHousingTextures() {
    // Iso building on a 3x3 tile footprint with a gable roof: a ridge runs
    // along the SW-NE axis, the big slope faces the camera (down-left), and the
    // triangular gable end sits over the SE wall (the door side).
    const W = 176;
    const H = 156;
    const cx = W / 2;
    const baseY = 104;
    const hw = 84;
    const hh = 42;
    const wallH = 40;
    const ridgeH = 40;

    type P = [number, number];
    const fE: P = [cx + hw, baseY];
    const fS: P = [cx, baseY + hh];
    const fW: P = [cx - hw, baseY];
    const tE: P = [cx + hw, baseY - wallH];
    const tS: P = [cx, baseY + hh - wallH];
    const tW: P = [cx - hw, baseY - wallH];
    const tN: P = [cx, baseY - hh - wallH];
    // Ridge ends: raised above the midpoints of the two SE/NW eaves.
    const ridgeS: P = [(tS[0] + tE[0]) / 2, (tS[1] + tE[1]) / 2 - ridgeH];
    const ridgeN: P = [(tW[0] + tN[0]) / 2, (tW[1] + tN[1]) / 2 - ridgeH];
    const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    const poly = (g: Phaser.GameObjects.Graphics, pts: P[], fill: number) => {
      g.fillStyle(fill, 1);
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      g.fillPath();
    };
    const outline = (g: Phaser.GameObjects.Graphics, pts: P[], close = true) => {
      g.lineStyle(2, OUTLINE, 1);
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      if (close) g.closePath();
      g.strokePath();
    };

    // Window panes: a cross of mullions across a window quad [bl, br, tr, tl].
    const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const windowPanes = (g: Phaser.GameObjects.Graphics, q: P[]) => {
      g.lineStyle(1.5, OUTLINE, 0.85);
      g.beginPath();
      g.moveTo(...mid(q[0], q[1]));
      g.lineTo(...mid(q[3], q[2]));
      g.strokePath();
      g.beginPath();
      g.moveTo(...mid(q[0], q[3]));
      g.lineTo(...mid(q[1], q[2]));
      g.strokePath();
    };

    const building = (
      g: Phaser.GameObjects.Graphics,
      roofColor: number,
      roofDark: number,
      accent: (g: Phaser.GameObjects.Graphics) => void,
    ) => {
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + hh + 2, hw * 2, 10);
      // walls (SW darker, SE lighter for iso shading)
      poly(g, [fW, fS, tS, tW], 0xcdb791);
      poly(g, [fS, fE, tE, tS], 0xead9b8);
      outline(g, [fW, fS, tS, tW]);
      outline(g, [fS, fE, tE, tS]);
      // Gable roof: back-right slope (hidden filler) first, then the big front
      // slope facing the camera, then the SE gable end over the door.
      poly(g, [tN, tE, ridgeS, ridgeN], roofDark);
      poly(g, [tW, tS, ridgeS, ridgeN], roofColor);
      poly(g, [tS, tE, ridgeS], roofDark);
      outline(g, [tW, tS, ridgeS, ridgeN]);
      outline(g, [tS, tE, ridgeS]);
      outline(g, [ridgeN, ridgeS], false);
      accent(g);
    };

    // House accent — door + a window on each visible wall.
    const houseAccent = (gg: Phaser.GameObjects.Graphics) => {
      // door on the SE wall
      const dbl = lerp(fS, fE, 0.38);
      const dbr = lerp(fS, fE, 0.6);
      const door: P[] = [dbl, dbr, [dbr[0], dbr[1] - 28], [dbl[0], dbl[1] - 28]];
      poly(gg, door, 0x7a5236);
      outline(gg, door);
      gg.fillStyle(0xf2c94c, 1).fillCircle(dbr[0] - 4, dbr[1] - 13, 1.8);
      // a window on each wall
      const seWin = (() => {
        const a = lerp(fS, fE, 0.66);
        const b = lerp(fS, fE, 0.86);
        return [
          [a[0], a[1] - 16],
          [b[0], b[1] - 16],
          [b[0], b[1] - 30],
          [a[0], a[1] - 30],
        ] as P[];
      })();
      poly(gg, seWin, 0xbfe3ff);
      outline(gg, seWin);
      windowPanes(gg, seWin);
      const wbl = lerp(fW, fS, 0.32);
      const wbr = lerp(fW, fS, 0.56);
      const win: P[] = [
        [wbl[0], wbl[1] - 18],
        [wbr[0], wbr[1] - 18],
        [wbr[0], wbr[1] - 32],
        [wbl[0], wbl[1] - 32],
      ];
      poly(gg, win, 0xbfe3ff);
      outline(gg, win);
      windowPanes(gg, win);
    };

    // Shop accent (factory) — a glass display window with goods on the SE wall
    // under a roof-coloured striped, scalloped awning, plus a slim door and a
    // hanging coin sign. The awning takes the building's roof colour so painted
    // shops get matching market fronts (like a real high street of stalls).
    // A point on the SE wall: base position `p` (0=front-centre .. 1=right) and
    // vertical offset `o` (0=base, up to wallH at the eave).
    const onSE = (p: number, o: number): P => {
      const base = lerp(fS, fE, p);
      return [base[0], base[1] - o];
    };
    const makeShopAccent = (roof: number, roofDark: number) => (gg: Phaser.GameObjects.Graphics) => {
      // Slim door on the left of the front wall.
      const door: P[] = [onSE(0.12, 0), onSE(0.3, 0), onSE(0.3, 30), onSE(0.12, 30)];
      poly(gg, door, 0x7a5236);
      outline(gg, door);
      gg.fillStyle(0xf2c94c, 1).fillCircle(onSE(0.29, 14)[0] - 1, onSE(0.29, 14)[1], 1.8);

      // Glass display window with goods on a shelf.
      const win: P[] = [onSE(0.4, 4), onSE(0.92, 4), onSE(0.92, 29), onSE(0.4, 29)];
      poly(gg, win, 0xcdebff);
      gg.fillStyle(0xffffff, 0.3);
      poly(gg, [onSE(0.4, 18), onSE(0.92, 18), onSE(0.92, 29), onSE(0.4, 29)], 0xeaf7ff);
      outline(gg, win);
      // shelf line
      outline(gg, [onSE(0.4, 13), onSE(0.92, 13)], false);
      // a few goods (generic colourful wares) sitting on the shelf
      const wares = [0xe2483b, 0xf2a93c, 0x6cc06a, 0xb06fd0, 0xe2483b];
      wares.forEach((col, i) => {
        const p = 0.46 + i * 0.1;
        const b = onSE(p, 13);
        gg.fillStyle(col, 1).fillRoundedRect(b[0] - 2.4, b[1] - 8, 4.8, 8, 1.4);
        gg.lineStyle(1, OUTLINE, 0.7).strokeRoundedRect(b[0] - 2.4, b[1] - 8, 4.8, 8, 1.4);
      });

      // Scalloped striped awning above the window (roof colour).
      const awTop = 41;
      const awBot = 30;
      const awL = 0.34;
      const awR = 0.96;
      const awn: P[] = [onSE(awL, awBot), onSE(awR, awBot), onSE(awR, awTop), onSE(awL, awTop)];
      poly(gg, awn, roof);
      for (let i = 0; i < 6; i += 2) {
        const a = awL + ((awR - awL) * i) / 6;
        const b = awL + ((awR - awL) * (i + 1)) / 6;
        poly(gg, [onSE(a, awBot), onSE(b, awBot), onSE(b, awTop), onSE(a, awTop)], roofDark);
      }
      outline(gg, awn);
      // scallop fringe hanging off the awning's front edge
      for (let i = 0; i < 6; i++) {
        const a = awL + ((awR - awL) * i) / 6;
        const m = awL + ((awR - awL) * (i + 0.5)) / 6;
        const b = awL + ((awR - awL) * (i + 1)) / 6;
        gg.fillStyle(i % 2 === 0 ? roof : roofDark, 1);
        gg.fillTriangle(...onSE(a, awBot), ...onSE(b, awBot), ...onSE(m, awBot - 5));
      }

      // Hanging coin sign over the door.
      gg.fillStyle(0xf2c94c, 1).fillCircle(onSE(0.2, 34)[0], onSE(0.2, 34)[1], 6);
      gg.lineStyle(2, OUTLINE, 1).strokeCircle(onSE(0.2, 34)[0], onSE(0.2, 34)[1], 6);
    };

    const bakeBuilding = (key: string, roof: number, roofDark: number, accent: typeof houseAccent) => {
      const bg = this.make.graphics({ x: 0, y: 0 });
      building(bg, roof, roofDark, accent);
      bg.generateTexture(key, W, H);
      bg.destroy();
    };

    // Base textures: House (blue roof) and Shop (warm roof).
    bakeBuilding("house", 0x4f8cff, 0x3a6fd0, houseAccent);
    bakeBuilding("shop", 0xe07a3c, 0xb85f2a, makeShopAccent(0xe07a3c, 0xb85f2a));

    // Roof-paint variants ("house_<id>" / "shop_<id>") for housing customization.
    for (const color of ROOF_COLORS) {
      bakeBuilding(`house_${color.id}`, color.roof, color.roofDark, houseAccent);
      bakeBuilding(`shop_${color.id}`, color.roof, color.roofDark, makeShopAccent(color.roof, color.roofDark));
    }

    // Empty plot — iso dirt diamond + a "for sale" signpost.
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x2a1d12, 0.16).fillEllipse(cx, baseY + hh + 2, hw * 2, 9);
    poly(g, [[cx, baseY - hh], fE, fS, fW], 0x9b8a6a);
    outline(g, [[cx, baseY - hh], fE, fS, fW]);
    g.fillStyle(0x8a5a33, 1).fillRoundedRect(cx - 3, baseY - 46, 6, 44, 2);
    g.lineStyle(1.5, OUTLINE, 1).strokeRoundedRect(cx - 3, baseY - 46, 6, 44, 2);
    g.fillStyle(0xf3ead2, 1).fillRoundedRect(cx - 21, baseY - 58, 42, 21, 3);
    g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 21, baseY - 58, 42, 21, 3);
    g.fillStyle(0x4caf50, 1).fillRoundedRect(cx - 15, baseY - 52, 30, 4, 1.5);
    g.fillStyle(0x4caf50, 1).fillRoundedRect(cx - 15, baseY - 45, 20, 4, 1.5);
    g.generateTexture("plot_marker", W, H);
    g.destroy();
  }

  /** Small decorative props players place at the corners of their plot. */
  private createDecorTextures() {
    const W = 28;
    const H = 40;
    const cx = W / 2;
    const baseY = H - 4;
    const shadow = (g: Phaser.GameObjects.Graphics, rx = 9, ry = 3.5) =>
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + 2, rx * 2, ry * 2);

    // Lamp post — tall pole with a glowing amber lantern.
    let g = this.make.graphics({ x: 0, y: 0 });
    shadow(g, 7, 3);
    g.fillStyle(0x5a4632, 1).fillRoundedRect(cx - 2, baseY - 30, 4, 30, 1.5);
    g.lineStyle(1.5, OUTLINE, 1).strokeRoundedRect(cx - 2, baseY - 30, 4, 30, 1.5);
    g.fillStyle(0x3a2a1e, 1).fillRoundedRect(cx - 7, baseY - 1, 14, 4, 2);
    g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 7, baseY - 1, 14, 4, 2);
    g.fillStyle(0xffe08a, 1).fillRoundedRect(cx - 6, baseY - 40, 12, 12, 3);
    g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 6, baseY - 40, 12, 12, 3);
    g.fillStyle(0xfff6d6, 0.9).fillCircle(cx, baseY - 34, 3);
    g.generateTexture("decor_lamp", W, H);
    g.destroy();

    // Flower bed — a soil mound dotted with little blooms.
    g = this.make.graphics({ x: 0, y: 0 });
    shadow(g, 10, 4);
    g.fillStyle(0x6b4a2f, 1).fillEllipse(cx, baseY - 3, 22, 11);
    g.lineStyle(2, OUTLINE, 1).strokeEllipse(cx, baseY - 3, 22, 11);
    const blooms: Array<[number, number, number]> = [
      [cx - 6, baseY - 7, 0xff6b9d],
      [cx + 1, baseY - 11, 0xffc93c],
      [cx + 7, baseY - 6, 0x7ed3ff],
      [cx - 2, baseY - 5, 0xff8a5c],
    ];
    for (const [x, y, color] of blooms) {
      g.fillStyle(0x3f8f4a, 1).fillRect(x - 0.7, y, 1.4, 5);
      g.fillStyle(color, 1).fillCircle(x, y, 2.6);
      g.fillStyle(0xfff6d6, 1).fillCircle(x, y, 1);
    }
    g.generateTexture("decor_flowers", W, H);
    g.destroy();

    // Topiary — a rounded shrub in a little pot.
    g = this.make.graphics({ x: 0, y: 0 });
    shadow(g, 8, 3.5);
    g.fillStyle(0xb5743a, 1).fillRoundedRect(cx - 6, baseY - 9, 12, 9, 2);
    g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 6, baseY - 9, 12, 9, 2);
    g.fillStyle(0x2e7d32, 1).fillCircle(cx, baseY - 18, 10);
    g.fillStyle(0x3f9d44, 1).fillCircle(cx - 3, baseY - 21, 5);
    g.fillStyle(0x81c784, 0.7).fillCircle(cx - 4, baseY - 22, 2.5);
    g.lineStyle(2, OUTLINE, 1).strokeCircle(cx, baseY - 18, 10);
    g.generateTexture("decor_bush", W, H);
    g.destroy();

    // Barrel — wooden cask with hoop bands.
    g = this.make.graphics({ x: 0, y: 0 });
    shadow(g, 8, 3.5);
    g.fillStyle(0xa9743f, 1).fillRoundedRect(cx - 8, baseY - 22, 16, 22, 5);
    g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 8, baseY - 22, 16, 22, 5);
    g.fillStyle(0x6f4a28, 1).fillRect(cx - 8, baseY - 17, 16, 2.4);
    g.fillStyle(0x6f4a28, 1).fillRect(cx - 8, baseY - 7, 16, 2.4);
    g.fillStyle(0xc89a63, 0.7).fillRect(cx - 5, baseY - 21, 2, 19);
    g.generateTexture("decor_barrel", W, H);
    g.destroy();
  }

  /** Indoor furniture used to dress interior zones (the Community Lodge). */
  private createSceneryTextures() {
    // Shared isometric box: a top diamond (2:1) extruded down into SW + SE
    // walls. `gy` is the ground-level diamond centre; the box rises `height`.
    type IP = { x: number; y: number };
    const isoBox = (
      gr: Phaser.GameObjects.Graphics,
      cx: number,
      gy: number,
      hw: number,
      hh: number,
      height: number,
      topCol: number,
      leftCol: number,
      rightCol: number,
    ): { top: IP; right: IP; bottom: IP; left: IP } => {
      const ty = gy - height;
      const N: IP = { x: cx, y: ty - hh };
      const E: IP = { x: cx + hw, y: ty };
      const S: IP = { x: cx, y: ty + hh };
      const Wp: IP = { x: cx - hw, y: ty };
      const E2: IP = { x: cx + hw, y: gy };
      const S2: IP = { x: cx, y: gy + hh };
      const W2: IP = { x: cx - hw, y: gy };
      gr.fillStyle(leftCol, 1).fillPoints([Wp, S, S2, W2], true);
      gr.fillStyle(rightCol, 1).fillPoints([S, E, E2, S2], true);
      gr.fillStyle(topCol, 1).fillPoints([N, E, S, Wp], true);
      gr.lineStyle(2, OUTLINE, 1);
      gr.strokePoints([Wp, S, S2, W2], true);
      gr.strokePoints([S, E, E2, S2], true);
      gr.strokePoints([N, E, S, Wp], true);
      return { top: N, right: E, bottom: S, left: Wp };
    };

    // Rug — a flat patterned mat drawn as an iso diamond (players walk over it).
    let g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 64;
      const H = 40;
      const cx = W / 2;
      const cy = H / 2;
      const hw = 28;
      const hh = 16;
      const diamond = (col: number, s: number) => {
        g.fillStyle(col, 1);
        g.beginPath();
        g.moveTo(cx, cy - hh * s);
        g.lineTo(cx + hw * s, cy);
        g.lineTo(cx, cy + hh * s);
        g.lineTo(cx - hw * s, cy);
        g.closePath();
        g.fillPath();
      };
      diamond(0xb5485f, 1);
      g.lineStyle(2, OUTLINE, 1).strokePoints(
        [
          { x: cx, y: cy - hh },
          { x: cx + hw, y: cy },
          { x: cx, y: cy + hh },
          { x: cx - hw, y: cy },
        ],
        true,
      );
      diamond(0xe7b6c2, 0.62);
      diamond(0xb5485f, 0.32);
      g.generateTexture("scenery_rug", W, H);
      g.destroy();
    }

    // Fireplace — stone hearth with a glowing fire.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 40;
      const H = 46;
      const cx = W / 2;
      const baseY = H - 4;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + 2, 30, 6);
      g.fillStyle(0x9a8f86, 1).fillRoundedRect(cx - 16, baseY - 34, 32, 34, 4);
      g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 16, baseY - 34, 32, 34, 4);
      g.fillStyle(0x3a2a22, 1).fillRoundedRect(cx - 10, baseY - 20, 20, 20, 3);
      g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 10, baseY - 20, 20, 20, 3);
      g.fillStyle(0xff7a1a, 1).fillTriangle(cx - 7, baseY - 1, cx + 7, baseY - 1, cx, baseY - 16);
      g.fillStyle(0xffd33d, 1).fillTriangle(cx - 4, baseY - 1, cx + 4, baseY - 1, cx, baseY - 11);
      g.fillStyle(0xc8bcb0, 1).fillRect(cx - 18, baseY - 38, 36, 5);
      g.lineStyle(2, OUTLINE, 1).strokeRect(cx - 18, baseY - 38, 36, 5);
      g.generateTexture("scenery_fireplace", W, H);
      g.destroy();
    }

    // Bookshelf — tall cabinet with coloured book rows.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 32;
      const H = 48;
      const cx = W / 2;
      const baseY = H - 4;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + 2, 24, 5);
      g.fillStyle(0x7a5230, 1).fillRoundedRect(cx - 12, baseY - 40, 24, 40, 3);
      g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 12, baseY - 40, 24, 40, 3);
      const rowColors = [0xd25b5b, 0x4f8cff, 0x49b265, 0xe6a800];
      for (let r = 0; r < 4; r++) {
        const ry = baseY - 36 + r * 9;
        g.fillStyle(0x3a2a1e, 1).fillRect(cx - 10, ry + 7, 20, 1.5);
        for (let b = 0; b < 4; b++) {
          g.fillStyle(rowColors[(r + b) % rowColors.length], 1).fillRect(cx - 9 + b * 5, ry, 4, 7);
        }
      }
      g.generateTexture("scenery_bookshelf", W, H);
      g.destroy();
    }

    // Potted plant — leafy fronds in a pot.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 28;
      const H = 44;
      const cx = W / 2;
      const baseY = H - 4;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + 2, 18, 5);
      g.fillStyle(0xb5743a, 1).fillRoundedRect(cx - 7, baseY - 12, 14, 12, 2);
      g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 7, baseY - 12, 14, 12, 2);
      g.fillStyle(0x2e7d32, 1).fillEllipse(cx, baseY - 22, 18, 18);
      g.fillStyle(0x3f9d44, 1).fillEllipse(cx - 4, baseY - 27, 8, 10);
      g.fillStyle(0x81c784, 0.7).fillEllipse(cx + 3, baseY - 24, 5, 7);
      g.lineStyle(2, OUTLINE, 1).strokeEllipse(cx, baseY - 22, 18, 18);
      g.generateTexture("scenery_plant", W, H);
      g.destroy();
    }

    // Table — round top on a pedestal.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 34;
      const H = 32;
      const cx = W / 2;
      const baseY = H - 4;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + 2, 22, 5);
      g.fillStyle(0x8a5a33, 1).fillRect(cx - 2, baseY - 12, 4, 12);
      g.lineStyle(1.5, OUTLINE, 1).strokeRect(cx - 2, baseY - 12, 4, 12);
      g.fillStyle(0xb5793f, 1).fillEllipse(cx, baseY - 14, 26, 9);
      g.lineStyle(2, OUTLINE, 1).strokeEllipse(cx, baseY - 14, 26, 9);
      g.fillStyle(0xd9a566, 0.6).fillEllipse(cx - 4, baseY - 16, 10, 3);
      g.generateTexture("scenery_table", W, H);
      g.destroy();
    }

    // Chair — a little stool with a backrest.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 24;
      const H = 32;
      const cx = W / 2;
      const baseY = H - 4;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, baseY + 2, 14, 4);
      g.fillStyle(0x9a6638, 1).fillRoundedRect(cx - 7, baseY - 22, 14, 12, 2);
      g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 7, baseY - 22, 14, 12, 2);
      g.fillStyle(0xb5793f, 1).fillRoundedRect(cx - 8, baseY - 12, 16, 6, 2);
      g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(cx - 8, baseY - 12, 16, 6, 2);
      g.fillStyle(0x7a5230, 1).fillRect(cx - 7, baseY - 6, 2.5, 6);
      g.fillStyle(0x7a5230, 1).fillRect(cx + 4.5, baseY - 6, 2.5, 6);
      g.generateTexture("scenery_chair", W, H);
      g.destroy();
    }

    // Market stall — an iso wooden counter under a striped awning on posts.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 84;
      const H = 104;
      const cx = W / 2;
      const gy = 80; // counter ground-diamond centre
      const hw = 26;
      const hh = 13;
      const ch = 16; // counter height
      const ctY = gy - ch; // counter top-diamond centre
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, gy + hh + 2, hw * 2, 10);
      // Iso counter.
      const counter = isoBox(g, cx, gy, hw, hh, ch, 0xc89255, 0x8a5a33, 0xb5793f);
      // Goods along the counter's top diamond.
      const fruit = [0xd0463f, 0xe8902e, 0x49b265, 0xd0463f, 0xe8902e];
      fruit.forEach((col, i) => {
        const t = (i + 1) / (fruit.length + 1);
        const px = counter.left.x + (counter.right.x - counter.left.x) * t;
        const py = counter.left.y + (counter.right.y - counter.left.y) * t;
        g.fillStyle(col, 1).fillCircle(px, py - 2, 3);
      });
      // Two awning poles framing the counter.
      const poleTopY = 22;
      const poleBotY = ctY - 1;
      for (const pxc of [cx - 22, cx + 22]) {
        g.fillStyle(0x6f4a2a, 1).fillRect(pxc - 1.5, poleTopY, 3, poleBotY - poleTopY);
        g.lineStyle(2, OUTLINE, 1).strokeRect(pxc - 1.5, poleTopY, 3, poleBotY - poleTopY);
      }
      // Iso awning canopy — a tilted diamond roof above the counter, striped.
      const ay = 20;
      const awnHw = 32;
      const awnHh = 13;
      const aN: IP = { x: cx, y: ay - awnHh };
      const aE: IP = { x: cx + awnHw, y: ay };
      const aS: IP = { x: cx, y: ay + awnHh };
      const aW2: IP = { x: cx - awnHw, y: ay };
      g.fillStyle(0xf3e6c8, 1).fillPoints([aN, aE, aS, aW2], true);
      // Red stripes running down the camera-facing (SW) half.
      for (let k = 1; k < 5; k += 2) {
        const t0 = k / 5;
        const t1 = (k + 0.5) / 5;
        const p0: IP = { x: aW2.x + (aS.x - aW2.x) * t0, y: aW2.y + (aS.y - aW2.y) * t0 };
        const p1: IP = { x: aW2.x + (aS.x - aW2.x) * t1, y: aW2.y + (aS.y - aW2.y) * t1 };
        const q0: IP = { x: aN.x + (aE.x - aN.x) * t0, y: aN.y + (aE.y - aN.y) * t0 };
        const q1: IP = { x: aN.x + (aE.x - aN.x) * t1, y: aN.y + (aE.y - aN.y) * t1 };
        g.fillStyle(0xd0463f, 1).fillPoints([p0, p1, q1, q0], true);
      }
      g.lineStyle(2, OUTLINE, 1).strokePoints([aN, aE, aS, aW2], true);
      g.generateTexture("scenery_stall", W, H);
      g.destroy();
    }

    // Crate — an iso wooden box with a cross-plank and produce on top.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 34;
      const H = 32;
      const cx = W / 2;
      const gy = 20;
      const hw = 12;
      const hh = 6;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, gy + hh + 2, hw * 2, 6);
      const box = isoBox(g, cx, gy, hw, hh, 13, 0xc08850, 0x7a5230, 0xa9733f);
      // Cross-plank on the SE (right) face.
      g.lineStyle(1.8, 0x6f4a2a, 1);
      g.strokePoints([box.bottom, { x: box.right.x, y: box.right.y + 13 }], false);
      g.strokePoints([{ x: box.bottom.x, y: box.bottom.y + 13 }, box.right], false);
      // Produce poking out the top diamond.
      g.fillStyle(0xd0463f, 1).fillCircle(box.top.x - 3, box.top.y + hh, 3);
      g.fillStyle(0xe8902e, 1).fillCircle(box.top.x + 4, box.top.y + hh + 1, 3);
      g.generateTexture("scenery_crate", W, H);
      g.destroy();
    }

    // Produce basket — an iso basket brimming with fruit.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 34;
      const H = 30;
      const cx = W / 2;
      const gy = 20;
      const hw = 12;
      const hh = 6;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, gy + hh + 2, hw * 2, 6);
      const box = isoBox(g, cx, gy, hw, hh, 9, 0xd9b15f, 0x9a6a36, 0xc28a4a);
      // Weave lines on the SE face.
      g.lineStyle(1.3, 0x9a6a36, 1);
      g.strokePoints([{ x: box.bottom.x, y: box.bottom.y + 4 }, { x: box.right.x, y: box.right.y + 4 }], false);
      // Heap of fruit on the top diamond.
      const tx = box.top.x;
      const ty = box.top.y + hh;
      g.fillStyle(0xd0463f, 1).fillCircle(tx - 5, ty, 4);
      g.fillStyle(0x49b265, 1).fillCircle(tx + 1, ty - 1, 4);
      g.fillStyle(0xe8902e, 1).fillCircle(tx + 6, ty, 4);
      g.fillStyle(0xb05fbf, 1).fillCircle(tx, ty - 4, 3);
      g.generateTexture("scenery_produce", W, H);
      g.destroy();
    }

    // Forge furnace — an iso stone block with a glowing mouth and a chimney.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 52;
      const H = 60;
      const cx = W / 2;
      const gy = 42;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, gy + 9, 40, 8);
      isoBox(g, cx, gy, 17, 9, 26, 0x9a8f86, 0x6f655d, 0x8a8079);
      // Glowing mouth on the SE (right) face.
      g.fillStyle(0x2a1410, 1).fillEllipse(cx + 9, gy - 8, 12, 9);
      g.fillStyle(0xff7a1a, 1).fillEllipse(cx + 9, gy - 7, 9, 6);
      g.fillStyle(0xffd33d, 1).fillEllipse(cx + 9, gy - 6, 5, 3.5);
      // Chimney on the back of the top.
      isoBox(g, cx - 5, gy - 26, 5, 2.5, 14, 0x847a72, 0x5f564f, 0x756c64);
      // A wisp of smoke.
      g.fillStyle(0xcfcac4, 0.5).fillCircle(cx - 5, gy - 44, 4);
      g.fillStyle(0xcfcac4, 0.35).fillCircle(cx - 2, gy - 50, 5);
      g.generateTexture("scenery_forge", W, H);
      g.destroy();
    }

    // Anvil — a dark iron anvil on an iso oak stump.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 44;
      const H = 44;
      const cx = W / 2;
      const gy = 30;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, gy + 7, 28, 6);
      // Oak stump base.
      isoBox(g, cx, gy, 12, 6, 12, 0xb5793f, 0x7a5230, 0x9a6638);
      // Anvil body (dark iron) sitting on the stump top.
      const top = gy - 12;
      isoBox(g, cx, top, 9, 4.5, 6, 0x4a505a, 0x2c3037, 0x3c424b);
      // Horn poking off the E side + a little step.
      g.fillStyle(0x3c424b, 1).fillTriangle(cx + 9, top - 9, cx + 18, top - 5, cx + 9, top - 2);
      g.lineStyle(2, OUTLINE, 1).strokeTriangle(cx + 9, top - 9, cx + 18, top - 5, cx + 9, top - 2);
      g.fillStyle(0x6a7280, 0.6).fillEllipse(cx, top - 10, 12, 4);
      g.generateTexture("scenery_anvil", W, H);
      g.destroy();
    }

    // Quench barrel — an iso wooden barrel brimming with water.
    g = this.make.graphics({ x: 0, y: 0 });
    {
      const W = 34;
      const H = 42;
      const cx = W / 2;
      const gy = 30;
      g.fillStyle(0x2a1d12, 0.22).fillEllipse(cx, gy + 7, 24, 6);
      const faces = isoBox(g, cx, gy, 11, 5.5, 18, 0x3f8fd0, 0x7a5230, 0x9a6638);
      // Water highlight on the top diamond.
      g.fillStyle(0x8fd0f6, 0.7).fillEllipse(faces.top.x, faces.top.y + 5.5, 12, 5);
      // Iron hoops across the staves.
      g.lineStyle(1.6, 0x4a3a28, 1);
      g.strokePoints([{ x: cx - 11, y: gy - 6 }, { x: cx, y: gy - 0.5 }, { x: cx + 11, y: gy - 6 }], false);
      g.strokePoints([{ x: cx - 11, y: gy - 12 }, { x: cx, y: gy - 6.5 }, { x: cx + 11, y: gy - 12 }], false);
      g.generateTexture("scenery_quench", W, H);
      g.destroy();
    }
  }

  private createBillboardTexture() {
    // A community noticeboard. Live numbers are drawn as text on top in-scene;
    // this is just the wooden frame + header banner.
    const W = 150;
    const H = 124;
    const cx = W / 2;
    const g = this.make.graphics({ x: 0, y: 0 });

    g.fillStyle(0x2a1d12, 0.2).fillEllipse(cx, H - 4, 96, 12);
    // posts
    for (const px of [cx - 42, cx + 34]) {
      g.fillStyle(0x8a5a33, 1).fillRoundedRect(px, 56, 8, 62, 2);
      g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(px, 56, 8, 62, 2);
    }
    // board
    g.fillStyle(0xf6ecd6, 1).fillRoundedRect(8, 6, W - 16, 86, 9);
    g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(8, 6, W - 16, 86, 9);
    // header banner
    g.fillStyle(0x4f8cff, 1).fillRoundedRect(14, 12, W - 28, 24, 6);
    g.lineStyle(2, OUTLINE, 1).strokeRoundedRect(14, 12, W - 28, 24, 6);
    // a faint divider between the two stats
    g.lineStyle(1.5, 0xd8c39a, 1);
    g.beginPath();
    g.moveTo(18, 64);
    g.lineTo(W - 18, 64);
    g.strokePath();

    g.generateTexture("billboard", W, H);
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
