import {
  appearanceTextureKey,
  type CharacterAppearance,
  type HairStyle,
  type OutfitStyle,
} from "@metricbase/shared";
import Phaser from "phaser";

const LOGICAL_WIDTH = 40;
const LOGICAL_HEIGHT = 56;

function hex(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, "0")}`;
}

function darken(color: number, amount = 0.2): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
  return (r << 16) | (g << 8) | b;
}

function lighten(color: number, amount = 0.1): number {
  const r = Math.min(255, ((color >> 16) & 0xff) * (1 + amount)) | 0;
  const g = Math.min(255, ((color >> 8) & 0xff) * (1 + amount)) | 0;
  const b = Math.min(255, (color & 0xff) * (1 + amount)) | 0;
  return (r << 16) | (g << 8) | b;
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

function strokePart(ctx: CanvasRenderingContext2D, color = "#4a3728", width = 1.8) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, groundY: number) {
  ctx.fillStyle = "rgba(74, 55, 40, 0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, groundY, 11, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  cx: number,
  legTop: number,
  skinColor: number,
  outfitColor: number,
  outfitStyle: OutfitStyle,
) {
  const legW = 6;
  const legH = outfitStyle === "robe" ? 9 : 11;
  const gap = 2;
  const leftX = cx - gap / 2 - legW;
  const rightX = cx + gap / 2;
  const legColor =
    outfitStyle === "casual"
      ? darken(outfitColor, 0.08)
      : outfitStyle === "armor"
        ? darken(outfitColor, 0.18)
        : darken(outfitColor, 0.12);
  const footColor = darken(legColor, 0.22);

  ctx.fillStyle = hex(legColor);
  roundRect(ctx, leftX, legTop, legW, legH, 2);
  ctx.fill();
  strokePart(ctx);

  roundRect(ctx, rightX, legTop, legW, legH, 2);
  ctx.fill();
  strokePart(ctx);

  if (outfitStyle === "armor") {
    ctx.fillStyle = hex(darken(outfitColor, 0.05));
    ctx.fillRect(leftX, legTop, legW, 3);
    ctx.fillRect(rightX, legTop, legW, 3);
  }

  ctx.fillStyle = hex(footColor);
  ctx.beginPath();
  ctx.ellipse(leftX + legW / 2, legTop + legH + 1.2, 3.8, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(rightX + legW / 2, legTop + legH + 1.2, 3.8, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (outfitStyle === "robe") {
    ctx.fillStyle = hex(outfitColor);
    roundRect(ctx, cx - 8, legTop - 2, 16, legH + 4, 3);
    ctx.fill();
    strokePart(ctx);
  }

  if (outfitStyle === "casual") {
    ctx.fillStyle = hex(skinColor);
    ctx.beginPath();
    ctx.arc(leftX + legW / 2, legTop + legH - 1, 1.6, 0, Math.PI * 2);
    ctx.arc(rightX + legW / 2, legTop + legH - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  side: -1 | 1,
  cx: number,
  shoulderY: number,
  skinColor: number,
  outfitColor: number,
  outfitStyle: OutfitStyle,
) {
  const skin = hex(skinColor);
  const outfit = hex(outfitColor);
  const outfitDark = hex(darken(outfitColor, 0.12));
  const shoulderX = cx + side * 8;
  const elbowX = cx + side * 11;
  const handX = cx + side * 10.5;
  const handY = shoulderY + 11;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (outfitStyle === "robe") {
    ctx.strokeStyle = outfit;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 1);
    ctx.lineTo(elbowX, shoulderY + 8);
    ctx.stroke();

    ctx.strokeStyle = outfitDark;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(elbowX, shoulderY + 8);
    ctx.lineTo(handX, handY);
    ctx.stroke();
  } else if (outfitStyle === "armor") {
    ctx.fillStyle = outfit;
    roundRect(ctx, shoulderX - side * 2.5, shoulderY - 1, side * 5, 6, 2);
    ctx.fill();
    strokePart(ctx, "#3d2e22", 1.2);

    ctx.strokeStyle = outfitDark;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 4);
    ctx.lineTo(elbowX, shoulderY + 9);
    ctx.stroke();

    ctx.strokeStyle = skin;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(elbowX, shoulderY + 9);
    ctx.lineTo(handX, handY);
    ctx.stroke();
  } else {
    ctx.strokeStyle = outfit;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 1);
    ctx.lineTo(elbowX, shoulderY + 6);
    ctx.stroke();

    ctx.strokeStyle = skin;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(elbowX, shoulderY + 6);
    ctx.lineTo(handX, handY);
    ctx.stroke();
  }

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(handX, handY + 1, 2.3, 0, Math.PI * 2);
  ctx.fill();
  strokePart(ctx, "#4a3728", 1);
}

function drawArms(
  ctx: CanvasRenderingContext2D,
  cx: number,
  shoulderY: number,
  skinColor: number,
  outfitColor: number,
  outfitStyle: OutfitStyle,
) {
  drawArm(ctx, -1, cx, shoulderY, skinColor, outfitColor, outfitStyle);
  drawArm(ctx, 1, cx, shoulderY, skinColor, outfitColor, outfitStyle);
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  cx: number,
  torsoY: number,
  outfitColor: number,
  outfitStyle: OutfitStyle,
) {
  const outfit = hex(outfitColor);
  const outfitDark = hex(darken(outfitColor, 0.14));
  const outfitLight = hex(lighten(outfitColor, 0.08));

  ctx.fillStyle = outfit;

  if (outfitStyle === "robe") {
    roundRect(ctx, cx - 8, torsoY, 16, 14, 4);
    ctx.fill();
    strokePart(ctx);

    ctx.fillStyle = outfitDark;
    ctx.fillRect(cx - 2, torsoY + 2, 4, 10);
    ctx.fillStyle = outfitLight;
    ctx.beginPath();
    ctx.arc(cx, torsoY + 1, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (outfitStyle === "armor") {
    roundRect(ctx, cx - 9, torsoY - 1, 18, 13, 3);
    ctx.fill();
    strokePart(ctx);

    ctx.fillStyle = outfitDark;
    ctx.fillRect(cx - 7, torsoY + 1, 14, 3);
    ctx.fillRect(cx - 1, torsoY + 5, 2, 6);
    ctx.fillStyle = outfitLight;
    ctx.fillRect(cx - 6, torsoY + 2, 3, 4);
    ctx.fillRect(cx + 3, torsoY + 2, 3, 4);
    return;
  }

  roundRect(ctx, cx - 7, torsoY, 14, 11, 4);
  ctx.fill();
  strokePart(ctx);

  ctx.fillStyle = outfitLight;
  ctx.fillRect(cx - 5, torsoY + 2, 10, 2);
  ctx.fillStyle = outfitDark;
  ctx.fillRect(cx - 1, torsoY + 5, 2, 4);
}

function drawHead(ctx: CanvasRenderingContext2D, cx: number, headY: number, skinColor: number) {
  ctx.fillStyle = hex(skinColor);
  ctx.beginPath();
  ctx.arc(cx, headY, 11, 0, Math.PI * 2);
  ctx.fill();
  strokePart(ctx);

  ctx.fillStyle = hex(darken(skinColor, 0.06));
  ctx.beginPath();
  ctx.arc(cx, headY + 8, 4.5, 0.2, Math.PI - 0.2);
  ctx.fill();
}

function drawHairBack(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  hairColor: number,
  hairStyle: HairStyle,
) {
  if (hairStyle !== "long") return;

  ctx.fillStyle = hex(darken(hairColor, 0.06));
  roundRect(ctx, cx - 13, headY + 1, 5, 15, 2);
  ctx.fill();
  roundRect(ctx, cx + 8, headY + 1, 5, 15, 2);
  ctx.fill();
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
    ctx.arc(cx, headY - 1, 11.5, Math.PI, 0);
    ctx.lineTo(cx + 11, headY + 4);
    ctx.quadraticCurveTo(cx, headY + 7, cx - 11, headY + 4);
    ctx.closePath();
    ctx.fill();
    strokePart(ctx, darkenHex(hairColor, 0.25), 1.2);

    ctx.fillStyle = hex(darken(hairColor, 0.1));
    ctx.beginPath();
    ctx.arc(cx, headY - 2, 9, Math.PI + 0.3, -0.3);
    ctx.fill();
    return;
  }

  if (hairStyle === "long") {
    ctx.beginPath();
    ctx.arc(cx, headY - 1, 11.5, Math.PI, 0);
    ctx.lineTo(cx + 11, headY + 3);
    ctx.quadraticCurveTo(cx, headY + 6, cx - 11, headY + 3);
    ctx.closePath();
    ctx.fill();
    strokePart(ctx, darkenHex(hairColor, 0.25), 1.2);

    ctx.fillStyle = hex(hairColor);
    roundRect(ctx, cx - 13, headY + 2, 5, 14, 2);
    ctx.fill();
    roundRect(ctx, cx + 8, headY + 2, 5, 14, 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.arc(cx, headY + 1, 10.5, 0, Math.PI * 2);
  ctx.fill();

  const spikes = [
    { x: -10, y: -14, w: 5, h: 11 },
    { x: -3, y: -18, w: 5, h: 13 },
    { x: 4, y: -18, w: 5, h: 13 },
    { x: 11, y: -14, w: 5, h: 11 },
  ];
  ctx.fillStyle = hex(darken(hairColor, 0.06));
  for (const spike of spikes) {
    ctx.beginPath();
    ctx.moveTo(cx + spike.x, headY + spike.y + spike.h);
    ctx.lineTo(cx + spike.x + spike.w / 2, headY + spike.y);
    ctx.lineTo(cx + spike.x + spike.w, headY + spike.y + spike.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = hex(hairColor);
  ctx.beginPath();
  ctx.arc(cx, headY + 1, 9, Math.PI + 0.4, -0.4);
  ctx.fill();
}

function darkenHex(color: number, amount: number): string {
  return hex(darken(color, amount));
}

function drawChibiFace(ctx: CanvasRenderingContext2D, cx: number, headY: number) {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - 4, headY + 1, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 4, headY + 1, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2d3436";
  ctx.beginPath();
  ctx.arc(cx - 4, headY + 1.5, 1.2, 0, Math.PI * 2);
  ctx.arc(cx + 4, headY + 1.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 143, 163, 0.55)";
  ctx.beginPath();
  ctx.arc(cx - 7, headY + 5, 2, 0, Math.PI * 2);
  ctx.arc(cx + 7, headY + 5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#4a3728";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, headY + 6.5, 2, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  appearance: CharacterAppearance,
  width: number,
  height: number,
) {
  const scale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  const offsetX = (width - LOGICAL_WIDTH * scale) / 2;
  const offsetY = (height - LOGICAL_HEIGHT * scale) / 2 + 4 * scale;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const cx = LOGICAL_WIDTH / 2;
  const groundY = 50;
  const headY = 14;
  const torsoY = 25;
  const shoulderY = 27;
  const legTop = 36;

  drawShadow(ctx, cx, groundY);
  drawHairBack(ctx, cx, headY, appearance.hairColor, appearance.hairStyle);
  drawLegs(ctx, cx, legTop, appearance.bodyColor, appearance.outfitColor, appearance.outfitStyle);
  drawArms(ctx, cx, shoulderY, appearance.bodyColor, appearance.outfitColor, appearance.outfitStyle);
  drawTorso(ctx, cx, torsoY, appearance.outfitColor, appearance.outfitStyle);
  drawHead(ctx, cx, headY, appearance.bodyColor);
  drawHair(ctx, cx, headY, appearance.hairColor, appearance.hairStyle);
  drawChibiFace(ctx, cx, headY);

  ctx.restore();
}

export function renderCharacterCanvas(
  appearance: CharacterAppearance,
  width = 160,
  height = 200,
  options?: { background?: boolean },
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const showBackground = options?.background ?? true;
  if (showBackground) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#dff4ff");
    gradient.addColorStop(1, "#fff4e6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    drawIsoFloor(ctx, width, height);
  }

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

  const canvas = renderCharacterCanvas(appearance, 80, 100, { background: false });
  scene.textures.addBase64(key, canvas.toDataURL("image/png"));
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}