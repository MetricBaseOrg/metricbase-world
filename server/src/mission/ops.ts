// Ops payload for Mission Center: "did my ship land, and is prod healthy".
//
// The headline question this answers is the stale-build one. railway.toml
// documents a real incident where the builder mismatch made every deploy FAIL
// while the last good build kept serving happily — /health stayed green and
// nothing surfaced it. Comparing the running GAME_VERSION against the newest
// SUCCESS deploy's commit makes that state impossible to miss.

import { GAME_VERSION } from "@metricbase/shared";
import { getPool } from "../db/pool.js";
import { ZoneRoom } from "../rooms/ZoneRoom.js";
import { countErrorsSince } from "./logBuffer.js";
import { getRequestStats, type RequestStats } from "./requestMetrics.js";
import {
  isRailwayConfigured,
  listDeployments,
  railwayConfigHint,
  type RailwayDeployment,
} from "./railway.js";
import { isVercelConfigured, listVercelDeployments, vercelConfigHint, type VercelDeployment } from "./vercel.js";

export interface OpsPayload {
  version: string;
  uptimeSeconds: number;
  startedAt: number;
  memoryMb: number;
  onlinePlayers: number;
  database: { configured: boolean; reachable: boolean; latencyMs: number | null };
  requests: RequestStats;
  errorsLast15m: number;
  server: {
    configured: boolean;
    hint: string;
    deployments: RailwayDeployment[];
    /** True when the newest deploy attempt FAILED but an older build is serving
     *  — the silent-failure state. */
    staleBuild: boolean;
  };
  client: { configured: boolean; hint: string; deployments: VercelDeployment[] };
}

const BOOTED_AT = Date.now();

async function pingDatabase(): Promise<{ configured: boolean; reachable: boolean; latencyMs: number | null }> {
  const pool = getPool();
  if (!pool) return { configured: false, reachable: false, latencyMs: null };
  const started = Date.now();
  try {
    await pool.query("SELECT 1");
    return { configured: true, reachable: true, latencyMs: Date.now() - started };
  } catch (error) {
    console.warn("[mission] database ping failed:", error);
    return { configured: true, reachable: false, latencyMs: null };
  }
}

const TERMINAL_BAD = new Set(["FAILED", "CRASHED"]);

/** The newest attempt failed, yet something is still serving (we're running, so
 *  it is). That's the case worth a banner. */
function detectStaleBuild(deployments: RailwayDeployment[]): boolean {
  const newest = deployments[0];
  if (!newest) return false;
  if (!TERMINAL_BAD.has(newest.status.toUpperCase())) return false;
  return deployments.slice(1).some((d) => d.status.toUpperCase() === "SUCCESS");
}

export async function buildOps(): Promise<OpsPayload> {
  const [database, serverDeploys, clientDeploys] = await Promise.all([
    pingDatabase(),
    listDeployments(10),
    listVercelDeployments(10),
  ]);

  return {
    version: GAME_VERSION,
    uptimeSeconds: Math.floor((Date.now() - BOOTED_AT) / 1000),
    startedAt: BOOTED_AT,
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    onlinePlayers: ZoneRoom.onlinePlayerCount(),
    database,
    requests: getRequestStats(),
    errorsLast15m: countErrorsSince(15 * 60 * 1000),
    server: {
      configured: isRailwayConfigured(),
      hint: railwayConfigHint(),
      deployments: serverDeploys,
      staleBuild: detectStaleBuild(serverDeploys),
    },
    client: {
      configured: isVercelConfigured(),
      hint: vercelConfigHint(),
      deployments: clientDeploys,
    },
  };
}
