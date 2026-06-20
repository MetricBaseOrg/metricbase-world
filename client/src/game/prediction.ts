import { PLAYER_SPEED } from "@metricbase/shared";

const RECONCILE_THRESHOLD = 48;

export interface PredictedPosition {
  x: number;
  y: number;
}

export function stepPrediction(
  position: PredictedPosition,
  dx: number,
  dy: number,
  deltaMs: number,
): PredictedPosition {
  const length = Math.hypot(dx, dy);
  if (length === 0) return position;

  const dt = deltaMs / 1000;
  const speed = PLAYER_SPEED * dt;

  return {
    x: position.x + (dx / length) * speed,
    y: position.y + (dy / length) * speed,
  };
}

export function reconcilePrediction(
  predicted: PredictedPosition,
  authoritative: PredictedPosition,
): PredictedPosition {
  const drift = Math.hypot(predicted.x - authoritative.x, predicted.y - authoritative.y);
  if (drift > RECONCILE_THRESHOLD) {
    return { ...authoritative };
  }

  return {
    x: predicted.x * 0.8 + authoritative.x * 0.2,
    y: predicted.y * 0.8 + authoritative.y * 0.2,
  };
}