export type AvatarDirection =
  | "front"
  | "back"
  | "left"
  | "right"
  | "threeQuarterLeft"
  | "threeQuarterRight";

export type AvatarAction = "idle" | "walk" | "chop" | "fish";

export const AVATAR_DIRECTIONS: AvatarDirection[] = [
  "front",
  "back",
  "left",
  "right",
  "threeQuarterLeft",
  "threeQuarterRight",
];

export const AVATAR_ACTIONS: AvatarAction[] = ["idle", "walk", "chop", "fish"];

export const AVATAR_ACTION_FRAMES: Record<AvatarAction, number> = {
  idle: 1,
  walk: 4,
  chop: 3,
  fish: 4,
};

export const AVATAR_ACTION_FRAME_RATES: Record<AvatarAction, number> = {
  idle: 3,
  walk: 9,
  chop: 10,
  fish: 5,
};

export const AVATAR_ACTION_DURATIONS_MS: Record<AvatarAction, number> = {
  idle: 0,
  walk: 0,
  chop: 700,
  fish: 3200,
};

/** Resolve facing from movement input (isometric: +y = toward camera). */
export function directionFromInput(dx: number, dy: number): AvatarDirection {
  if (dx === 0 && dy === 0) return "front";

  if (dy > 0 && dx === 0) return "front";
  if (dy < 0 && dx === 0) return "back";
  if (dx > 0 && dy === 0) return "right";
  if (dx < 0 && dy === 0) return "left";
  if (dx > 0 && dy > 0) return "threeQuarterRight";
  if (dx < 0 && dy > 0) return "threeQuarterLeft";
  if (dx > 0 && dy < 0) return "threeQuarterRight";
  return "threeQuarterLeft";
}

export function directionFromDelta(dx: number, dy: number, fallback: AvatarDirection): AvatarDirection {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return fallback;
  return directionFromInput(Math.sign(dx), Math.sign(dy));
}

export function directionTowardTarget(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fallback: AvatarDirection,
): AvatarDirection {
  return directionFromDelta(toX - fromX, toY - fromY, fallback);
}

export function avatarAnimKey(
  appearanceKey: string,
  direction: AvatarDirection,
  action: AvatarAction,
): string {
  return `${appearanceKey}-${direction}-${action}`;
}

export function avatarFrameTextureKey(
  appearanceKey: string,
  direction: AvatarDirection,
  action: AvatarAction,
  frame: number,
): string {
  return `${appearanceKey}-${direction}-${action}-f${frame}`;
}