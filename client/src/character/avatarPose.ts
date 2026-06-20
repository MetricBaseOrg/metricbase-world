import {
  type AvatarAction,
  type AvatarDirection,
  type CharacterAppearance,
  type HairStyle,
  type OutfitStyle,
} from "@metricbase/shared";

export const AVATAR_LOGICAL_WIDTH = 40;
export const AVATAR_LOGICAL_HEIGHT = 56;

export interface AvatarPose {
  direction: AvatarDirection;
  action: AvatarAction;
  frame: number;
}

function hex(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, "0")}`;
}

function darken(color: number, amount = 0.2): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
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

function walkOffsets(frame: number): { legSwing: number; armSwing: number; bob: number } {
  const phase = frame % 4;
  const swings = [0, 3, 0, -3];
  return {
    legSwing: swings[phase],
    armSwing: -swings[phase],
    bob: phase % 2 === 0 ? 0 : 1,
  };
}

function shouldMirror(direction: AvatarDirection): boolean {
  return direction === "left" || direction === "threeQuarterLeft";
}

function isBack(direction: AvatarDirection): boolean {
  return direction === "back";
}

function isProfile(direction: AvatarDirection): boolean {
  return direction === "left" || direction === "right";
}

function isThreeQuarter(direction: AvatarDirection): boolean {
  return direction === "threeQuarterLeft" || direction === "threeQuarterRight";
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
  _skinColor: number,
  outfitColor: number,
  outfitStyle: OutfitStyle,
  legSwing: number,
  direction: AvatarDirection,
) {
  const legW = isProfile(direction) ? 5 : 6;
  const legH = outfitStyle === "robe" ? 9 : 11;
  const gap = isBack(direction) ? 3 : 2;
  const leftX = cx - gap / 2 - legW + legSwing;
  const rightX = cx + gap / 2 - legSwing;
  const legColor =
    outfitStyle === "casual"
      ? darken(outfitColor, 0.08)
      : outfitStyle === "armor"
        ? darken(outfitColor, 0.18)
        : darken(outfitColor, 0.12);

  ctx.fillStyle = hex(legColor);
  roundRect(ctx, leftX, legTop, legW, legH, 2);
  ctx.fill();
  strokePart(ctx);
  roundRect(ctx, rightX, legTop, legW, legH, 2);
  ctx.fill();
  strokePart(ctx);

  if (outfitStyle === "robe" && !isProfile(direction)) {
    ctx.fillStyle = hex(outfitColor);
    roundRect(ctx, cx - 8, legTop - 2, 16, legH + 4, 3);
    ctx.fill();
    strokePart(ctx);
  }
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  cx: number,
  torsoY: number,
  outfitColor: number,
  _outfitStyle: OutfitStyle,
  direction: AvatarDirection,
) {
  const outfit = hex(outfitColor);
  const outfitDark = hex(darken(outfitColor, 0.14));
  const width = isProfile(direction) ? 10 : isThreeQuarter(direction) ? 13 : 14;
  const offset = isThreeQuarter(direction) ? 2 : 0;

  ctx.fillStyle = outfit;
  roundRect(ctx, cx - width / 2 + offset, torsoY, width, isBack(direction) ? 12 : 11, 4);
  ctx.fill();
  strokePart(ctx);

  if (!isBack(direction)) {
    ctx.fillStyle = outfitDark;
    ctx.fillRect(cx - 1 + offset, torsoY + 3, 2, 5);
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  skinColor: number,
  direction: AvatarDirection,
) {
  const radius = isProfile(direction) ? 10 : 11;
  const offsetX = isThreeQuarter(direction) ? 2 : 0;

  ctx.fillStyle = hex(skinColor);
  ctx.beginPath();
  ctx.arc(cx + offsetX, headY, radius, 0, Math.PI * 2);
  ctx.fill();
  strokePart(ctx);
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  hairColor: number,
  hairStyle: HairStyle,
  direction: AvatarDirection,
) {
  if (isBack(direction)) {
    ctx.fillStyle = hex(hairColor);
    ctx.beginPath();
    ctx.arc(cx, headY, 12, 0, Math.PI * 2);
    ctx.fill();
    if (hairStyle === "long") {
      ctx.fillRect(cx - 12, headY, 24, 14);
    }
    return;
  }

  ctx.fillStyle = hex(hairColor);
  if (isProfile(direction)) {
    ctx.beginPath();
    ctx.arc(cx + 2, headY - 1, 11, Math.PI * 0.2, Math.PI * 1.5);
    ctx.lineTo(cx - 4, headY + 6);
    ctx.closePath();
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.arc(cx, headY - 1, 11.5, Math.PI, 0);
  ctx.lineTo(cx + 11, headY + 4);
  ctx.quadraticCurveTo(cx, headY + 7, cx - 11, headY + 4);
  ctx.closePath();
  ctx.fill();
  strokePart(ctx);
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  direction: AvatarDirection,
) {
  if (isBack(direction)) return;

  const eyeX = isProfile(direction) ? 3 : isThreeQuarter(direction) ? 2 : 4;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - eyeX, headY + 1, 2.4, 0, Math.PI * 2);
  if (!isProfile(direction)) ctx.arc(cx + eyeX, headY + 1, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2d3436";
  ctx.beginPath();
  ctx.arc(cx - eyeX, headY + 1.5, 1.2, 0, Math.PI * 2);
  if (!isProfile(direction)) ctx.arc(cx + eyeX, headY + 1.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  if (!isProfile(direction)) {
    ctx.strokeStyle = "#4a3728";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, headY + 6.5, 2, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
}

function drawArms(
  ctx: CanvasRenderingContext2D,
  cx: number,
  shoulderY: number,
  skinColor: number,
  outfitColor: number,
  armSwing: number,
  direction: AvatarDirection,
  action: AvatarAction,
  frame: number,
) {
  const skin = hex(skinColor);
  const outfit = hex(outfitColor);
  ctx.lineCap = "round";

  if (action === "chop") {
    const angles = [-1.4, -0.4, 0.5];
    const angle = angles[frame % 3] ?? 0;
    const handX = cx + 10;
    const handY = shoulderY + 8 + frame * 2;
    ctx.strokeStyle = "#6d4c41";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(handX - 4, handY - 10);
    ctx.lineTo(handX + Math.cos(angle) * 10, handY + Math.sin(angle) * 10);
    ctx.stroke();
    ctx.fillStyle = "#9e9e9e";
    ctx.fillRect(handX + Math.cos(angle) * 8, handY + Math.sin(angle) * 8 - 2, 6, 4);
    ctx.strokeStyle = skin;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx + 6, shoulderY + 2);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    return;
  }

  if (action === "fish") {
    const bob = Math.sin(frame * 0.8) * 2;
    ctx.strokeStyle = "#6d4c41";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + 8, shoulderY + 4);
    ctx.lineTo(cx + 18, shoulderY - 8 + bob);
    ctx.stroke();
    ctx.strokeStyle = "#90caf9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 18, shoulderY - 8 + bob);
    ctx.lineTo(cx + 20, shoulderY + 14);
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 6, shoulderY + 2);
    ctx.lineTo(cx + 10, shoulderY + 6);
    ctx.stroke();
    return;
  }

  const leftReach = cx - 9 - armSwing;
  const rightReach = cx + 9 + armSwing;
  ctx.strokeStyle = outfit;
  ctx.lineWidth = 4;
  if (!isProfile(direction) || direction === "right") {
    ctx.beginPath();
    ctx.moveTo(cx + 7, shoulderY + 1);
    ctx.lineTo(rightReach, shoulderY + 8);
    ctx.stroke();
  }
  if (!isProfile(direction) || direction === "left") {
    ctx.beginPath();
    ctx.moveTo(cx - 7, shoulderY + 1);
    ctx.lineTo(leftReach, shoulderY + 8);
    ctx.stroke();
  }
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3;
  if (!isProfile(direction)) {
    ctx.beginPath();
    ctx.arc(leftReach, shoulderY + 10, 2.2, 0, Math.PI * 2);
    ctx.arc(rightReach, shoulderY + 10, 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawAvatarPose(
  ctx: CanvasRenderingContext2D,
  appearance: CharacterAppearance,
  pose: AvatarPose,
  width: number,
  height: number,
) {
  const scale = Math.min(width / AVATAR_LOGICAL_WIDTH, height / AVATAR_LOGICAL_HEIGHT);
  const offsetX = (width - AVATAR_LOGICAL_WIDTH * scale) / 2;
  const offsetY = (height - AVATAR_LOGICAL_HEIGHT * scale) / 2 + 4 * scale;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const mirror = shouldMirror(pose.direction);
  const cx = AVATAR_LOGICAL_WIDTH / 2;
  if (mirror) {
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
  }

  const drawDirection: AvatarDirection =
    pose.direction === "left"
      ? "right"
      : pose.direction === "threeQuarterLeft"
        ? "threeQuarterRight"
        : pose.direction;

  const { legSwing, armSwing, bob } =
    pose.action === "walk"
      ? walkOffsets(pose.frame)
      : pose.action === "idle"
        ? { legSwing: pose.frame % 2, armSwing: 0, bob: 0 }
        : { legSwing: 0, armSwing: 0, bob: 0 };

  const groundY = 50 + bob;
  const headY = 14 - bob;
  const torsoY = 25;
  const shoulderY = 27;
  const legTop = 36;

  drawShadow(ctx, cx, groundY);
  drawLegs(
    ctx,
    cx,
    legTop,
    appearance.bodyColor,
    appearance.outfitColor,
    appearance.outfitStyle,
    legSwing,
    drawDirection,
  );
  drawTorso(ctx, cx, torsoY, appearance.outfitColor, appearance.outfitStyle, drawDirection);
  drawArms(
    ctx,
    cx,
    shoulderY,
    appearance.bodyColor,
    appearance.outfitColor,
    armSwing,
    drawDirection,
    pose.action,
    pose.frame,
  );
  drawHead(ctx, cx, headY, appearance.bodyColor, drawDirection);
  drawHair(ctx, cx, headY, appearance.hairColor, appearance.hairStyle, drawDirection);
  drawFace(ctx, cx, headY, drawDirection);

  ctx.restore();
}

export function renderAvatarPoseCanvas(
  appearance: CharacterAppearance,
  pose: AvatarPose,
  width = 80,
  height = 100,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    drawAvatarPose(ctx, appearance, pose, width, height);
  }
  return canvas;
}