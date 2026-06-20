import {
  appearanceTextureKey,
  AVATAR_ACTION_FRAMES,
  AVATAR_ACTION_FRAME_RATES,
  avatarAnimKey,
  avatarFrameTextureKey,
  type AvatarAction,
  type AvatarDirection,
  type CharacterAppearance,
} from "@metricbase/shared";
import Phaser from "phaser";
import { renderAvatarPoseCanvas } from "./avatarPose";

const registeredAnims = new Set<string>();

function ensureFrameTexture(
  scene: Phaser.Scene,
  appearance: CharacterAppearance,
  direction: AvatarDirection,
  action: AvatarAction,
  frame: number,
): string {
  const appearanceKey = appearanceTextureKey(appearance);
  const key = avatarFrameTextureKey(appearanceKey, direction, action, frame);
  if (scene.textures.exists(key)) {
    return key;
  }

  const canvas = renderAvatarPoseCanvas(appearance, { direction, action, frame });
  scene.textures.addBase64(key, canvas.toDataURL("image/png"));
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

export function ensureAvatarAnimation(
  scene: Phaser.Scene,
  appearance: CharacterAppearance,
  direction: AvatarDirection,
  action: AvatarAction,
): string {
  const appearanceKey = appearanceTextureKey(appearance);
  const animKey = avatarAnimKey(appearanceKey, direction, action);
  if (registeredAnims.has(animKey) && scene.anims.exists(animKey)) {
    return animKey;
  }

  const frameCount = AVATAR_ACTION_FRAMES[action];
  const frames = Array.from({ length: frameCount }, (_, frame) => ({
    key: ensureFrameTexture(scene, appearance, direction, action, frame),
    frame: 0,
  }));

  if (scene.anims.exists(animKey)) {
    scene.anims.remove(animKey);
  }

  scene.anims.create({
    key: animKey,
    frames,
    frameRate: AVATAR_ACTION_FRAME_RATES[action],
    repeat: action === "walk" || action === "idle" || action === "fish" || action === "chop" ? -1 : 0,
  });

  registeredAnims.add(animKey);
  return animKey;
}

export function playAvatarAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  appearance: CharacterAppearance,
  direction: AvatarDirection,
  action: AvatarAction,
): string {
  const animKey = ensureAvatarAnimation(scene, appearance, direction, action);
  if (sprite.anims.currentAnim?.key !== animKey || !sprite.anims.isPlaying) {
    sprite.play(animKey, true);
  }
  return animKey;
}

export function preloadAvatarAnimations(
  scene: Phaser.Scene,
  appearance: CharacterAppearance,
): void {
  const directions: AvatarDirection[] = [
    "front",
    "back",
    "left",
    "right",
    "threeQuarterLeft",
    "threeQuarterRight",
  ];
  const actions: AvatarAction[] = ["idle", "walk"];

  for (const direction of directions) {
    for (const action of actions) {
      ensureAvatarAnimation(scene, appearance, direction, action);
    }
  }
}