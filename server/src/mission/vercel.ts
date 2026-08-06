// Vercel deployments client (the game client at world.metricbase.org). Read
// only, same reasoning as railway.ts.
//
// The client and the server deploy independently, and the failure mode that
// actually bites is a green server next to a client build that failed hours ago
// — Mission Center exists partly to make that visible in one glance.

const CACHE_MS = 30_000;
const TIMEOUT_MS = 8_000;

export interface VercelDeployment {
  id: string;
  state: string;
  createdAt: number;
  readyAt: number | null;
  url: string;
  target: string | null;
  commitSha: string | null;
  commitMessage: string | null;
}

export function isVercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim());
}

export function vercelConfigHint(): string {
  if (!process.env.VERCEL_API_TOKEN?.trim()) return "Set VERCEL_API_TOKEN to see client deploys.";
  if (!process.env.VERCEL_PROJECT_ID?.trim()) return "Set VERCEL_PROJECT_ID (Project Settings → General).";
  return "";
}

interface VercelApiDeployment {
  uid: string;
  state?: string;
  readyState?: string;
  created: number;
  ready?: number;
  url: string;
  target?: string | null;
  meta?: Record<string, string> | undefined;
}

let cache: { at: number; value: VercelDeployment[] } = { at: 0, value: [] };

export async function listVercelDeployments(limit = 10): Promise<VercelDeployment[]> {
  if (!isVercelConfigured()) return [];
  if (Date.now() - cache.at < CACHE_MS) return cache.value;

  const params = new URLSearchParams({ projectId: process.env.VERCEL_PROJECT_ID!.trim(), limit: String(limit) });
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (teamId) params.set("teamId", teamId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN!.trim()}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[mission] Vercel API ${res.status}`);
      return cache.value;
    }
    const json = (await res.json()) as { deployments?: VercelApiDeployment[] };
    const out = (json.deployments ?? []).map((d) => ({
      id: d.uid,
      state: (d.readyState ?? d.state ?? "UNKNOWN").toUpperCase(),
      createdAt: d.created,
      readyAt: d.ready ?? null,
      url: d.url,
      target: d.target ?? null,
      // Vercel namespaces git metadata by provider; GitHub is what this project uses.
      commitSha: d.meta?.githubCommitSha ?? null,
      commitMessage: d.meta?.githubCommitMessage ?? null,
    }));
    cache = { at: Date.now(), value: out };
    return out;
  } catch (error) {
    console.warn("[mission] Vercel API request failed:", error);
    return cache.value;
  } finally {
    clearTimeout(timer);
  }
}
