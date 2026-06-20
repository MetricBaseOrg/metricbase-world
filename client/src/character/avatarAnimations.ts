import {
  appearanceTextureKey,
  AVATAR_ACTION_FRAMES,
  AVATAR_ACTION_FRAME_RATES,
  avatarFrameTextureKey,
  type AvatarAction,
  type AvatarDirection,
  type CharacterAppearance,
} from "@metricbase/shared";
import Phaser from "phaser";
import { AVATAR_LOGICAL_HEIGHT, AVATAR_LOGICAL_WIDTH, renderAvatarPoseCanvas } from "./avatarPose";

const FALLBACK_PLAYER_TEXTURE = "player";

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

  try {
    const canvas = renderAvatarPoseCanvas(appearance, { direction, action, frame });
    scene.textures.addCanvas(key, canvas);
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  } catch (error) {
    console.warn("Avatar texture generation failed, using fallback sprite.", error);
    return FALLBACK_PLAYER_TEXTURE;
  }
}

export function getAnimFrame(action: AvatarAction, elapsedMs: number): number {
  const frameCount = AVATAR_ACTION_FRAMES[action];
  if (frameCount <= 1) return 0;
  const frameRate = AVATAR_ACTION_FRAME_RATES[action];
  const msPerFrame = 1000 / frameRate;
  return Math.floor(elapsedMs / msPerFrame) % frameCount;
}

export function setAvatarPose(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  appearance: CharacterAppearance,
  direction: AvatarDirection,
  action: AvatarAction,
  frame: number,
): string {
  const textureKey = ensureFrameTexture(scene, appearance, direction, action, frame);
  if (sprite.anims.isPlaying) {
    sprite.anims.stop();
  }
  const resolvedKey = scene.textures.exists(textureKey) ? textureKey : FALLBACK_PLAYER_TEXTURE;
  if (sprite.texture.key !== resolvedKey) {
    sprite.setTexture(resolvedKey);
    sprite.setOrigin(0.5, 0.93);
  }
  sprite.setDisplaySize(AVATAR_LOGICAL_WIDTH, AVATAR_LOGICAL_HEIGHT);
  return resolvedKey;
}

export function preloadAvatarTextures(scene: Phaser.Scene, appearance: CharacterAppearance): void {
  const directions: AvatarDirection[] = [
    "front",
    "back",
    "left",
    "right",
    "threeQuarterLeft",
    "threeQuarterRight",
  ];
  const actions: AvatarAction[] = ["idle", "walk", "chop", "fish"];

  for (const direction of directions) {
    for (const action of actions) {
      const frameCount = AVATAR_ACTION_FRAMES[action];
      for (let frame = 0; frame < frameCount; frame++) {
        ensureFrameTexture(scene, appearance, direction, action, frame);
      }
    }
  }
}

/** @deprecated Use setAvatarPose — Phaser anims caused visible texture flicker. */
export function playAvatarAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  appearance: CharacterAppearance,
  direction: AvatarDirection,
  action: AvatarAction,
): string {
  return setAvatarPose(scene, sprite, appearance, direction, action, 0);
}

/** @deprecated Use preloadAvatarTextures */
export function preloadAvatarAnimations(
  scene: Phaser.Scene,
  appearance: CharacterAppearance,
): void {
  preloadAvatarTextures(scene, appearance);
}