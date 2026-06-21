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

const OUTLINE = "#3a2a1e";
const OUTLINE_WIDTH = 1.6;

// Vertical layout on the 40x56 logical grid (cx = 20). Feet rest near y = 50
// so map positioning stays consistent with the previous art.
const CX = AVATAR_LOGICAL_WIDTH / 2;
const HEAD_Y = 16;
const HEAD_R = 12;
const SHOULDER_Y = 30;
const BODY_TOP = 27;
const BODY_BOTTOM = 42;
const GROUND_Y = 51;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value)) | 0;
}

function hex(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, "0")}`;
}

function darken(color: number, amount = 0.2): number {
  const r = clampByte(((color >> 16) & 0xff) * (1 - amount));
  const g = clampByte(((color >> 8) & 0xff) * (1 - amount));
  const b = clampByte((color & 0xff) * (1 - amount));
  return (r << 16) | (g << 8) | b;
}

function lighten(color: number, amount = 0.2): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (
    (clampByte(r + (255 - r) * amount) << 16) |
    (clampByte(g + (255 - g) * amount) << 8) |
    clampByte(b + (255 - b) * amount)
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function outline(ctx: CanvasRenderingContext2D, color = OUTLINE, width = OUTLINE_WIDTH) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.stroke();
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

function shouldMirror(direction: AvatarDirection): boolean {
  return direction === "left" || direction === "threeQuarterLeft";
}

interface MotionOffsets {
  legSwing: number;
  armSwing: number;
  bob: number;
}

function walkOffsets(frame: number): MotionOffsets {
  const phase = frame % 4;
  // contact, passing, contact, passing — smooth alternating swing
  const legSwing = [0, 4.5, 0, -4.5][phase];
  return {
    legSwing,
    armSwing: -legSwing * 0.85,
    bob: phase % 2 === 1 ? -1 : 0,
  };
}

function idleOffsets(frame: number): MotionOffsets {
  // gentle breathing: rise on alternate frames
  return { legSwing: 0, armSwing: 0, bob: frame % 2 === 1 ? -0.8 : 0 };
}

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, bob: number) {
  // shadow shrinks slightly as the body lifts during the bob
  const scale = 1 + bob * 0.06;
  ctx.fillStyle = "rgba(58, 42, 30, 0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, GROUND_Y, 11 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bootColor: number,
  legSwing: number,
  bob: number,
  direction: AvatarDirection,
) {
  const profile = isProfile(direction);
  const bootW = profile ? 6.5 : 7;
  const bootH = 5;
  const gap = isBack(direction) ? 3.5 : 2.5;
  const baseY = GROUND_Y - bootH + bob;
  const leftX = cx - gap / 2 - bootW + legSwing;
  const rightX = cx + gap / 2 - legSwing;

  ctx.fillStyle = hex(bootColor);
  for (const x of [leftX, rightX]) {
    roundRect(ctx, x, baseY, bootW, bootH, 2.4);
    ctx.fill();
    outline(ctx);
    // toe highlight
    ctx.fillStyle = hex(lighten(bootColor, 0.22));
    roundRect(ctx, x + bootW * 0.45, baseY + 0.8, bootW * 0.45, bootH * 0.45, 1.5);
    ctx.fill();
    ctx.fillStyle = hex(bootColor);
  }
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  cx: number,
  legColor: number,
  legSwing: number,
  bob: number,
  outfitStyle: OutfitStyle,
  direction: AvatarDirection,
) {
  // robe hides most of the leg; casual/armor show fuller legs
  const legH = outfitStyle === "robe" ? 5 : 9;
  const legW = isProfile(direction) ? 5.5 : 6;
  const gap = isBack(direction) ? 3.5 : 2.5;
  const legTop = GROUND_Y - 5 - legH + bob;
  const leftX = cx - gap / 2 - legW + legSwing;
  const rightX = cx + gap / 2 - legSwing;

  ctx.fillStyle = hex(legColor);
  for (const x of [leftX, rightX]) {
    roundRect(ctx, x, legTop, legW, legH + 3, 2.4);
    ctx.fill();
    outline(ctx);
  }
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  shoulderX: number,
  shoulderY: number,
  handX: number,
  handY: number,
  sleeveColor: number,
  skinColor: number,
) {
  // upper sleeve
  ctx.strokeStyle = hex(sleeveColor);
  ctx.lineCap = "round";
  ctx.lineWidth = 4.4;
  const midX = (shoulderX + handX) / 2;
  const midY = (shoulderY + handY) / 2 - 0.5;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(midX, midY);
  ctx.stroke();
  // sleeve outline pass
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 5.6;
  // forearm skin
  ctx.strokeStyle = hex(skinColor);
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(midX, midY);
  ctx.lineTo(handX, handY);
  ctx.stroke();
  // hand
  ctx.fillStyle = hex(skinColor);
  ctx.beginPath();
  ctx.arc(handX, handY, 2.6, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, OUTLINE, 1.2);
}

function drawArms(
  ctx: CanvasRenderingContext2D,
  cx: number,
  shoulderY: number,
  skinColor: number,
  sleeveColor: number,
  armSwing: number,
  bob: number,
  direction: AvatarDirection,
  action: AvatarAction,
  frame: number,
) {
  const profile = isProfile(direction);
  const sy = shoulderY + bob;

  if (action === "chop") {
    drawChopArms(ctx, cx, sy, skinColor, sleeveColor, frame);
    return;
  }
  if (action === "fish") {
    drawFishArms(ctx, cx, sy, skinColor, sleeveColor, frame);
    return;
  }

  const reachLeftX = cx - 8;
  const reachRightX = cx + 8;
  const handDrop = 9;

  if (profile) {
    // single visible arm swinging
    drawArm(ctx, cx + 4, sy, cx + 6 + armSwing, sy + handDrop, sleeveColor, skinColor);
    return;
  }

  if (isBack(direction)) {
    drawArm(ctx, cx - 6, sy, reachLeftX - armSwing, sy + handDrop, sleeveColor, skinColor);
    drawArm(ctx, cx + 6, sy, reachRightX + armSwing, sy + handDrop, sleeveColor, skinColor);
    return;
  }

  drawArm(ctx, cx - 6, sy, reachLeftX - armSwing, sy + handDrop, sleeveColor, skinColor);
  drawArm(ctx, cx + 6, sy, reachRightX + armSwing, sy + handDrop, sleeveColor, skinColor);
}

function drawChopArms(
  ctx: CanvasRenderingContext2D,
  cx: number,
  shoulderY: number,
  skinColor: number,
  sleeveColor: number,
  frame: number,
) {
  // three-frame wind-up → swing-down with an axe
  const angles = [-1.5, -0.5, 0.7];
  const angle = angles[frame % 3] ?? 0;
  const pivotX = cx + 5;
  const pivotY = shoulderY + 3;
  const handX = pivotX + Math.cos(angle) * 11;
  const handY = pivotY + Math.sin(angle) * 11;

  // axe handle
  ctx.strokeStyle = "#6d4c41";
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(handX - Math.cos(angle) * 4, handY - Math.sin(angle) * 4);
  ctx.lineTo(handX + Math.cos(angle) * 9, handY + Math.sin(angle) * 9);
  ctx.stroke();
  // axe head
  const axeX = handX + Math.cos(angle) * 9;
  const axeY = handY + Math.sin(angle) * 9;
  ctx.fillStyle = "#b0bec5";
  roundRect(ctx, axeX - 3, axeY - 3, 6, 6, 1.5);
  ctx.fill();
  outline(ctx, OUTLINE, 1);

  // back arm (sleeve)
  ctx.strokeStyle = hex(sleeveColor);
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(cx - 5, shoulderY);
  ctx.lineTo(pivotX - 2, pivotY + 2);
  ctx.stroke();
  // front arm (skin) to grip
  ctx.strokeStyle = hex(skinColor);
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(cx + 5, shoulderY);
  ctx.lineTo(handX, handY);
  ctx.stroke();
  ctx.fillStyle = hex(skinColor);
  ctx.beginPath();
  ctx.arc(handX, handY, 2.6, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, OUTLINE, 1.2);
}

function drawFishArms(
  ctx: CanvasRenderingContext2D,
  cx: number,
  shoulderY: number,
  skinColor: number,
  sleeveColor: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.8) * 1.6;
  const rodTipX = cx + 17;
  const rodTipY = shoulderY - 9 + bob;

  // rod
  ctx.strokeStyle = "#6d4c41";
  ctx.lineCap = "round";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx + 6, shoulderY + 4);
  ctx.lineTo(rodTipX, rodTipY);
  ctx.stroke();
  // line
  ctx.strokeStyle = "rgba(120, 144, 156, 0.8)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(rodTipX, rodTipY);
  ctx.lineTo(rodTipX + 2, shoulderY + 15);
  ctx.stroke();

  // arm (sleeve + skin)
  ctx.strokeStyle = hex(sleeveColor);
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(cx - 5, shoulderY);
  ctx.lineTo(cx + 2, shoulderY + 5);
  ctx.stroke();
  ctx.strokeStyle = hex(skinColor);
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(cx + 2, shoulderY + 5);
  ctx.lineTo(cx + 7, shoulderY + 5);
  ctx.stroke();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bob: number,
  outfitColor: number,
  outfitStyle: OutfitStyle,
  direction: AvatarDirection,
) {
  const top = BODY_TOP + bob;
  const bottom = BODY_BOTTOM + bob;
  const outfit = hex(outfitColor);
  const outfitDark = hex(darken(outfitColor, 0.18));
  const outfitLight = hex(lighten(outfitColor, 0.16));
  const profile = isProfile(direction);
  const tq = isThreeQuarter(direction);
  const lean = tq ? 1.5 : 0;

  if (outfitStyle === "robe") {
    const topHalf = profile ? 5 : 7;
    const hemHalf = profile ? 8.5 : 11;
    ctx.fillStyle = outfit;
    ctx.beginPath();
    ctx.moveTo(cx - topHalf + lean, top);
    ctx.lineTo(cx + topHalf + lean, top);
    ctx.lineTo(cx + hemHalf + lean, bottom);
    ctx.quadraticCurveTo(cx + lean, bottom + 2.5, cx - hemHalf + lean, bottom);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    // belt
    ctx.fillStyle = outfitDark;
    roundRect(ctx, cx - topHalf - 0.5 + lean, top + 6, topHalf * 2 + 1, 2.6, 1);
    ctx.fill();
    // center seam highlight
    if (!profile && !isBack(direction)) {
      ctx.strokeStyle = outfitLight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + lean, top + 9);
      ctx.lineTo(cx + lean, bottom - 1);
      ctx.stroke();
    }
    return;
  }

  if (outfitStyle === "armor") {
    const half = profile ? 6 : 8.5;
    ctx.fillStyle = outfit;
    roundRect(ctx, cx - half + lean, top, half * 2, bottom - top - 2, 3.5);
    ctx.fill();
    outline(ctx);
    // chest highlight plates
    ctx.fillStyle = outfitLight;
    roundRect(ctx, cx - half + 1.5 + lean, top + 1.5, half - 1, 5, 2);
    ctx.fill();
    // belt
    ctx.fillStyle = outfitDark;
    roundRect(ctx, cx - half + lean, bottom - 6, half * 2, 3, 1);
    ctx.fill();
    // pauldrons
    if (!profile) {
      ctx.fillStyle = outfitLight;
      for (const sx of [cx - half + lean, cx + half + lean]) {
        ctx.beginPath();
        ctx.arc(sx, top + 1.5, 3.2, 0, Math.PI * 2);
        ctx.fill();
        outline(ctx);
      }
    }
    return;
  }

  // casual: short shirt
  const half = profile ? 5.5 : 7.5;
  const shirtBottom = top + (bottom - top) * 0.66;
  ctx.fillStyle = outfit;
  roundRect(ctx, cx - half + lean, top, half * 2, shirtBottom - top, 3.5);
  ctx.fill();
  outline(ctx);
  // collar
  if (!profile && !isBack(direction)) {
    ctx.fillStyle = outfitDark;
    ctx.beginPath();
    ctx.moveTo(cx - 2.5 + lean, top + 0.5);
    ctx.lineTo(cx + lean, top + 3);
    ctx.lineTo(cx + 2.5 + lean, top + 0.5);
    ctx.fill();
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bob: number,
  skinColor: number,
  direction: AvatarDirection,
) {
  const hy = HEAD_Y - bob;
  const offsetX = isThreeQuarter(direction) ? 1.5 : 0;
  ctx.fillStyle = hex(skinColor);
  ctx.beginPath();
  ctx.arc(cx + offsetX, hy, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx);
  // subtle rim shading on the shadowed side for a touch of volume
  if (!isBack(direction)) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx + offsetX, hy, HEAD_R - 0.4, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = hex(darken(skinColor, 0.06));
    ctx.beginPath();
    ctx.ellipse(cx + offsetX + HEAD_R * 0.6, hy + 1, HEAD_R * 0.5, HEAD_R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bob: number,
  hairColor: number,
  hairStyle: HairStyle,
  direction: AvatarDirection,
) {
  const hy = HEAD_Y - bob;
  const offsetX = isThreeQuarter(direction) ? 1.5 : 0;
  const x = cx + offsetX;
  const hair = hex(hairColor);
  const hairLight = hex(lighten(hairColor, 0.22));
  ctx.fillStyle = hair;

  if (isBack(direction)) {
    ctx.beginPath();
    ctx.arc(x, hy, HEAD_R + 0.5, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx);
    if (hairStyle === "long") {
      roundRect(ctx, x - HEAD_R, hy, HEAD_R * 2, 16, 5);
      ctx.fill();
      outline(ctx);
    }
    return;
  }

  if (isProfile(direction)) {
    // hair caps the crown and back of the skull
    ctx.beginPath();
    ctx.arc(x - 1, hy - 1, HEAD_R + 0.5, Math.PI * 0.15, Math.PI * 1.55);
    ctx.lineTo(x - HEAD_R + 1, hy + 4);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    if (hairStyle === "long") {
      roundRect(ctx, x - HEAD_R - 1, hy - 2, 5, 16, 2.5);
      ctx.fill();
      outline(ctx);
    }
    return;
  }

  // front / three-quarter crown — fringe sits high on the forehead, well
  // above the eyes, with short side pieces that frame (not cover) the face.
  const browY = hy - 3.5; // hairline stays above the eyes (eyes ~ hy + 1)
  ctx.beginPath();
  ctx.arc(x, hy - 1, HEAD_R + 0.5, Math.PI * 1.0, Math.PI * 2.0);
  // right temple down to the cheek, framing the face
  ctx.lineTo(x + HEAD_R, hy + 4);
  ctx.quadraticCurveTo(x + HEAD_R - 1, hy + 1, x + HEAD_R - 2.5, browY);
  // gentle parted fringe across the forehead
  ctx.quadraticCurveTo(x + 5, browY - 1.5, x + 1.5, browY + 1);
  ctx.quadraticCurveTo(x, browY - 2, x - 2.5, browY + 0.5);
  ctx.quadraticCurveTo(x - 6, browY - 1.5, x - HEAD_R + 2.5, browY);
  // left temple down to the cheek
  ctx.quadraticCurveTo(x - HEAD_R + 1, hy + 1, x - HEAD_R, hy + 4);
  ctx.closePath();
  ctx.fill();
  outline(ctx);

  if (hairStyle === "spiky") {
    ctx.fillStyle = hair;
    for (let i = -1; i <= 1; i++) {
      const sx = x + i * 6.5;
      ctx.beginPath();
      ctx.moveTo(sx - 3.5, hy - HEAD_R + 1);
      ctx.lineTo(sx, hy - HEAD_R - 4.5);
      ctx.lineTo(sx + 3.5, hy - HEAD_R + 1);
      ctx.closePath();
      ctx.fill();
      outline(ctx);
    }
  } else if (hairStyle === "long") {
    ctx.fillStyle = hair;
    for (const side of [-1, 1]) {
      roundRect(ctx, x + side * (HEAD_R - 0.5) - (side < 0 ? 4 : 0), hy - 4, 4.5, 16, 2.4);
      ctx.fill();
      outline(ctx);
    }
  }

  // glossy highlight on the crown
  ctx.fillStyle = hairLight;
  ctx.beginPath();
  ctx.ellipse(x - 3.5, hy - HEAD_R * 0.6, 3.2, 1.6, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bob: number,
  direction: AvatarDirection,
) {
  if (isBack(direction)) return;
  const hy = HEAD_Y - bob;
  const offsetX = isThreeQuarter(direction) ? 1.5 : 0;
  const x = cx + offsetX;
  const profile = isProfile(direction);
  const eyeDX = profile ? 4 : isThreeQuarter(direction) ? 3.2 : 4.6;
  const eyeY = hy + 1;

  // blush
  ctx.fillStyle = "rgba(255, 140, 140, 0.4)";
  if (!profile) {
    ctx.beginPath();
    ctx.ellipse(x - eyeDX - 2, eyeY + 4, 1.9, 1.2, 0, 0, Math.PI * 2);
    ctx.ellipse(x + eyeDX + 2, eyeY + 4, 1.9, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(x - eyeDX - 1, eyeY + 4, 1.8, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawEye = (ex: number) => {
    // white
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 2.6, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(58,42,30,0.55)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // iris/pupil
    ctx.fillStyle = "#34281f";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 0.5, 1.7, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // sparkle
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex + 0.8, eyeY - 0.9, 0.85, 0, Math.PI * 2);
    ctx.fill();
  };

  drawEye(x - eyeDX);
  if (!profile) drawEye(x + eyeDX);

  // smile
  ctx.strokeStyle = "#7a4a3a";
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (profile) {
    ctx.arc(x - eyeDX + 1, hy + 6, 1.6, 0.2, Math.PI - 0.6);
  } else {
    ctx.arc(x, hy + 5.5, 2.2, 0.25, Math.PI - 0.25);
  }
  ctx.stroke();
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
  if (mirror) {
    ctx.translate(CX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-CX, 0);
  }

  // Render pure left/right as three-quarter views — the cute face stays
  // visible and we avoid the awkward flat side-profile. Mirroring (handled
  // above) turns the right-facing draw into a left-facing one.
  const drawDirection: AvatarDirection =
    pose.direction === "left" || pose.direction === "right"
      ? "threeQuarterRight"
      : pose.direction === "threeQuarterLeft"
        ? "threeQuarterRight"
        : pose.direction;

  const motion =
    pose.action === "walk"
      ? walkOffsets(pose.frame)
      : pose.action === "idle"
        ? idleOffsets(pose.frame)
        : { legSwing: 0, armSwing: 0, bob: 0 };

  const skin = appearance.bodyColor;
  const outfitColor = appearance.outfitColor;
  const sleeveColor =
    appearance.outfitStyle === "armor"
      ? darken(outfitColor, 0.1)
      : appearance.outfitStyle === "casual"
        ? outfitColor
        : darken(outfitColor, 0.05);
  const legColor =
    appearance.outfitStyle === "casual" ? darken(outfitColor, 0.32) : darken(outfitColor, 0.2);
  const bootColor = darken(outfitColor, 0.5);

  drawShadow(ctx, CX, motion.bob);
  // back arm first so the body overlaps it for depth
  drawLegs(ctx, CX, legColor, motion.legSwing, motion.bob, appearance.outfitStyle, drawDirection);
  drawBoots(ctx, CX, bootColor, motion.legSwing, motion.bob, drawDirection);
  drawArms(
    ctx,
    CX,
    SHOULDER_Y,
    skin,
    sleeveColor,
    motion.armSwing,
    motion.bob,
    drawDirection,
    pose.action,
    pose.frame,
  );
  drawBody(ctx, CX, motion.bob, outfitColor, appearance.outfitStyle, drawDirection);
  drawHead(ctx, CX, motion.bob, skin, drawDirection);
  drawHair(ctx, CX, motion.bob, appearance.hairColor, appearance.hairStyle, drawDirection);
  drawFace(ctx, CX, motion.bob, drawDirection);

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
