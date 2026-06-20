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

function drawChibiFace(ctx: CanvasRenderingContext2D, cx: number, headY: number) {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - 4, headY + 2, 2.6, 0, Math.PI * 2);
  ctx.arc(cx + 4, headY + 2, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2d3436";
  ctx.beginPath();
  ctx.arc(cx - 4, headY + 2.5, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 4, headY + 2.5, 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 143, 163, 0.55)";
  ctx.beginPath();
  ctx.arc(cx - 7, headY + 5, 2.2, 0, Math.PI * 2);
  ctx.arc(cx + 7, headY + 5, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#4a3728";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, headY + 7, 2.2, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  hairColor: number,
  hairStyle: HairStyle,
) {
  ctx.fillStyle = hex(hairColor);

  if (hairStyle === "short") {
    ctx.beginPath();
    ctx.arc(cx, headY, 12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (hairStyle === "long") {
    ctx.beginPath();
    ctx.arc(cx, headY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 13, headY + 2, 5, 16);
    ctx.fillRect(cx + 8, headY + 2, 5, 16);
    return;
  }

  const spikes = [
    { x: -11, y: -12, w: 6, h: 10 },
    { x: -4, y: -16, w: 6, h: 12 },
    { x: 3, y: -16, w: 6, h: 12 },
    { x: 10, y: -12, w: 6, h: 10 },
  ];
  ctx.beginPath();
  ctx.arc(cx, headY + 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(darken(hairColor, 0.08));
  for (const spike of spikes) {
    ctx.beginPath();
    ctx.moveTo(cx + spike.x, headY + spike.y + spike.h);
    ctx.lineTo(cx + spike.x + spike.w / 2, headY + spike.y);
    ctx.lineTo(cx + spike.x + spike.w, headY + spike.y + spike.h);
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
    roundRect(ctx, cx - 7, cy - 4, 14, 10, 4);
    ctx.fill();
    return;
  }

  if (outfitStyle === "armor") {
    roundRect(ctx, cx - 8, cy - 5, 16, 11, 3);
    ctx.fill();
    ctx.fillStyle = hex(darken(outfitColor, 0.15));
    ctx.fillRect(cx - 10, cy - 2, 3, 6);
    ctx.fillRect(cx + 7, cy - 2, 3, 6);
    return;
  }

  roundRect(ctx, cx - 6, cy - 3, 12, 9, 4);
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
  const offsetY = (height - 44 * scale) / 2 + 6 * scale;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const cx = 16;
  const cy = 30;
  const headY = cy - 20;

  ctx.fillStyle = "rgba(74, 55, 40, 0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  drawOutfit(ctx, cx, cy, appearance.outfitColor, appearance.outfitStyle);

  ctx.fillStyle = hex(appearance.bodyColor);
  ctx.beginPath();
  ctx.arc(cx, headY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a3728";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawHair(ctx, cx, headY, appearance.hairColor, appearance.hairStyle);
  drawChibiFace(ctx, cx, headY);

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
  gradient.addColorStop(0, "#dff4ff");
  gradient.addColorStop(1, "#fff4e6");
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

  ctx.fillStyle = "rgba(126, 217, 87, 0.5)";
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

  const canvas = renderCharacterCanvas(appearance, 72, 88);
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}