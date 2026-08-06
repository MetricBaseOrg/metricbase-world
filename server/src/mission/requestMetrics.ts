// Rolling request timing for the Ops health strip. A 15-minute in-memory window
// of (timestamp, duration, status) samples — enough to answer "is prod slow or
// throwing right now", and cheap enough to sit in front of every route.
//
// Deliberately not persisted: this is a liveness read, and a number that
// survives a restart would be misleading right when it matters most.

import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_SAMPLES = 20000;

interface Sample {
  at: number;
  ms: number;
  status: number;
}

const samples: Sample[] = [];

export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    samples.push({ at: Date.now(), ms, status: res.statusCode });
    if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
  });
  next();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export interface RequestStats {
  windowMinutes: number;
  requests: number;
  perMinute: number;
  p50Ms: number;
  p95Ms: number;
  errors5xx: number;
  errors4xx: number;
  errorRate: number;
}

export function getRequestStats(): RequestStats {
  const cutoff = Date.now() - WINDOW_MS;
  // Drop anything that aged out; the array is time-ordered so one splice does it.
  const firstLive = samples.findIndex((s) => s.at >= cutoff);
  if (firstLive > 0) samples.splice(0, firstLive);
  else if (firstLive === -1 && samples.length) samples.length = 0;

  const durations = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors5xx = samples.filter((s) => s.status >= 500).length;
  const errors4xx = samples.filter((s) => s.status >= 400 && s.status < 500).length;
  return {
    windowMinutes: WINDOW_MS / 60000,
    requests: samples.length,
    perMinute: Number((samples.length / (WINDOW_MS / 60000)).toFixed(1)),
    p50Ms: Math.round(percentile(durations, 50)),
    p95Ms: Math.round(percentile(durations, 95)),
    errors5xx,
    errors4xx,
    errorRate: samples.length ? Number(((errors5xx / samples.length) * 100).toFixed(2)) : 0,
  };
}
