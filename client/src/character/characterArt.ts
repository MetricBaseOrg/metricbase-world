import {
  appearanceTextureKey,
  type CharacterAppearance,
  type HairStyle,
  type OutfitStyle,
} from "@metricbase/shared";
import Phaser from "phaser";

function hex(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, "0")}`;
}

function darken(color: number, amount = 0.2): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
  return (r << 16) | (g << 8) | b;
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hairColor: number,
  hairStyle: HairStyle,
) {
  ctx.fillStyle = hex(hairColor);

  if (hairStyle === "short") {
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 10, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (hairStyle === "long") {
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 11, cy - 12, 5, 18);
    ctx.fillRect(cx + 6, cy - 12, 5, 18);
    return;
  }

  const spikes = [
    { x: -10, y: -24, w: 6, h: 10 },
    { x: -4, y: -28, w: 6, h: 12 },
    { x: 3, y: -28, w: 6, h: 12 },
    { x: 9, y: -24, w: 6, h: 10 },
  ];
  ctx.beginPath();
  ctx.arc(cx, cy - 12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(darken(hairColor, 0.08));
  for (const spike of spikes) {
    ctx.beginPath();
    ctx.moveTo(cx + spike.x, cy + spike.y + spike.h);
    ctx.lineTo(cx + spike.x + spike.w / 2, cy + spike.y);
    ctx.lineTo(cx + spike.x + spike.w, cy + spike.y + spike.h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawOutfit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outfitColor: number,
  outfitStyle: OutfitStyle,
) {
  ctx.fillStyle = hex(outfitColor);

  if (outfitStyle === "robe") {
    roundRect(ctx, cx - 8, cy - 8, 16, 14, 3);
    ctx.fill();
    return;
  }

  if (outfitStyle === "armor") {
    roundRect(ctx, cx - 10, cy - 10, 20, 16, 2);
    ctx.fill();
    ctx.fillStyle = hex(darken(outfitColor, 0.15));
    ctx.fillRect(cx - 12, cy - 6, 4, 8);
    ctx.fillRect(cx + 8, cy - 6, 4, 8);
    return;
  }

  roundRect(ctx, cx - 7, cy - 6, 14, 12, 4);
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  appearance: CharacterAppearance,
  width: number,
  height: number,
) {
  const scale = Math.min(width / 96, height / 120);
  const offsetX = (width - 32 * scale) / 2;
  const offsetY = (height - 40 * scale) / 2 + 8 * scale;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const cx = 16;
  const cy = 28;

  ctx.fillStyle = "#2d3436";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  drawOutfit(ctx, cx, cy, appearance.outfitColor, appearance.outfitStyle);

  ctx.fillStyle = hex(appearance.bodyColor);
  ctx.beginPath();
  ctx.arc(cx, cy - 14, 10, 0, Math.PI * 2);
  ctx.fill();

  drawHair(ctx, cx, cy, appearance.hairColor, appearance.hairStyle);

  ctx.restore();
}

export function renderCharacterCanvas(
  appearance: CharacterAppearance,
  width = 160,
  height = 200,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(79, 140, 255, 0.12)");
  gradient.addColorStop(1, "rgba(108, 92, 231, 0.08)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawIsoFloor(ctx, width, height);
  drawCharacter(ctx, appearance, width, height);
  return canvas;
}

function drawIsoFloor(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cx = width / 2;
  const cy = height - 36;
  const hw = 42;
  const hh = 18;

  ctx.fillStyle = "rgba(92, 184, 92, 0.35)";
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function ensurePhaserCharacterTexture(
  scene: Phaser.Scene,
  appearance: CharacterAppearance,
): string {
  const key = appearanceTextureKey(appearance);
  if (scene.textures.exists(key)) {
    return key;
  }

  const canvas = renderCharacterCanvas(appearance, 64, 80);
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}