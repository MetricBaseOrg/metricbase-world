import {
  appearanceTextureKey,
  avatarFrameTextureKey,
  type CharacterAppearance,
} from "@metricbase/shared";
import Phaser from "phaser";
import { ensureAvatarAnimation } from "./avatarAnimations";
import { drawAvatarPose } from "./avatarPose";

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  appearance: CharacterAppearance,
  width: number,
  height: number,
) {
  drawAvatarPose(ctx, appearance, { direction: "front", action: "idle", frame: 0 }, width, height);
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

/** @deprecated Use playAvatarAnimation — kept for compatibility */
export function ensurePhaserCharacterTexture(
  scene: Phaser.Scene,
  appearance: CharacterAppearance,
): string {
  ensureAvatarAnimation(scene, appearance, "front", "idle");
  return avatarFrameTextureKey(appearanceTextureKey(appearance), "front", "idle", 0);
}