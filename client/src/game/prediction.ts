import { PLAYER_SPEED } from "@metricbase/shared";

/**
 * Beyond this the server moved us deliberately (portal, teleport, admin
 * rescue) — snap instantly instead of easing.
 */
const SNAP_THRESHOLD = 150;

export interface PredictedPosition {
  x: number;
  y: number;
}

export function stepPrediction(
  position: PredictedPosition,
  dx: number,
  dy: number,
  deltaMs: number,
  speedMult = 1,
): PredictedPosition {
  const length = Math.hypot(dx, dy);
  if (length === 0) return position;

  const dt = deltaMs / 1000;
  const speed = PLAYER_SPEED * (speedMult || 1) * dt;

  return {
    x: position.x + (dx / length) * speed,
    y: position.y + (dy / length) * speed,
  };
}

/**
 * Pull the client prediction toward the authoritative server position without
 * ever hard-snapping (except teleports). While moving, the server naturally
 * trails the client by ~latency x speed, so leave a generous deadzone and only
 * bleed off the excess gradually — the old hard snap at 48px is what knocked
 * the character backward mid-run and made the following camera shake.
 */
export function reconcilePrediction(
  predicted: PredictedPosition,
  authoritative: PredictedPosition,
  moving: boolean,
): PredictedPosition {
  const dx = authoritative.x - predicted.x;
  const dy = authoritative.y - predicted.y;
  const drift = Math.hypot(dx, dy);

  if (drift > SNAP_THRESHOLD) return { ...authoritative };

  // Idle deadzone/pull tuned soft: right after a stop the server can settle a
  // few px away (it processes the stop ~latency later), and a strong pull read
  // as the character being shoved forward at the end of click-to-move walks.
  const deadzone = moving ? 40 : 10;
  if (drift <= deadzone) return predicted;

  const pull = 0.12;
  const correction = ((drift - deadzone) / drift) * pull;
  return {
    x: predicted.x + dx * correction,
    y: predicted.y + dy * correction,
  };
}
