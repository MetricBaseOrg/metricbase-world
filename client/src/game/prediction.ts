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

  // Trust client prediction for small drift — constant blending caused visible jitter.
  return predicted;
}