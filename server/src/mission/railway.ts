// Railway Public API client — READ ONLY by design. Mission Center reports on
// deploys, it doesn't trigger them: the console is behind a single password, and
// a leaked password that can bounce prod is a different risk class than one that
// can only look at it. Redeploys stay in the Railway dashboard / CLI.
//
// Docs: https://docs.railway.com/integrations/api/manage-deployments

const ENDPOINT = "https://backboard.railway.com/graphql/v2";
const CACHE_MS = 30_000;
const TIMEOUT_MS = 8_000;

export interface RailwayDeployment {
  id: string;
  status: string;
  createdAt: number;
  /** Populated for finished deploys; null while building. */
  finishedAt: number | null;
  commitSha: string | null;
  commitMessage: string | null;
  branch: string | null;
}

export interface RailwayLogLine {
  at: number;
  severity: string;
  message: string;
}

/** Railway injects these into every running service, so in prod there is nothing
 *  to configure beyond the token. The explicit vars are the local-dev escape. */
function ids(): { projectId: string; serviceId: string; environmentId: string } | null {
  const projectId = process.env.RAILWAY_PROJECT_ID?.trim();
  const serviceId = process.env.RAILWAY_SERVICE_ID?.trim();
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim();
  if (!projectId || !serviceId || !environmentId) return null;
  return { projectId, serviceId, environmentId };
}

export function isRailwayConfigured(): boolean {
  return Boolean(process.env.RAILWAY_API_TOKEN?.trim() && ids());
}

/** Why the panel is empty, in words the operator can act on. */
export function railwayConfigHint(): string {
  if (!process.env.RAILWAY_API_TOKEN?.trim()) return "Set RAILWAY_API_TOKEN to see deploy history.";
  if (!ids()) return "RAILWAY_PROJECT_ID / SERVICE_ID / ENVIRONMENT_ID are missing (Railway injects these in prod).";
  return "";
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const token = process.env.RAILWAY_API_TOKEN?.trim();
  if (!token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[mission] Railway API ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      console.warn("[mission] Railway API errors:", json.errors.map((e) => e.message).join("; "));
      return null;
    }
    return json.data ?? null;
  } catch (error) {
    console.warn("[mission] Railway API request failed:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const DEPLOYMENTS_QUERY = `query deployments($input: DeploymentListInput!, $first: Int) {
  deployments(input: $input, first: $first) {
    edges { node { id status createdAt meta } }
  }
}`;

interface DeploymentNode {
  id: string;
  status: string;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}

/** `meta` is an untyped JSON blob whose commit keys have moved around between
 *  Railway builder generations, so read it defensively rather than assuming. */
function readMeta(meta: Record<string, unknown> | null | undefined): {
  sha: string | null;
  message: string | null;
  branch: string | null;
} {
  const m = (meta ?? {}) as Record<string, unknown>;
  const str = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = m[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  return {
    sha: str("commitHash", "commitSha", "gitCommitSha"),
    message: str("commitMessage", "gitCommitMessage"),
    branch: str("branch", "gitBranch"),
  };
}

let deployCache: { at: number; value: RailwayDeployment[] } = { at: 0, value: [] };

export async function listDeployments(limit = 10): Promise<RailwayDeployment[]> {
  if (!isRailwayConfigured()) return [];
  if (Date.now() - deployCache.at < CACHE_MS) return deployCache.value;
  const input = ids();
  if (!input) return [];
  const data = await gql<{ deployments: { edges: { node: DeploymentNode }[] } }>(DEPLOYMENTS_QUERY, {
    input,
    first: limit,
  });
  if (!data) return deployCache.value; // Serve stale rather than blanking the panel.
  const out = data.deployments.edges.map(({ node }) => {
    const meta = readMeta(node.meta);
    return {
      id: node.id,
      status: node.status,
      createdAt: new Date(node.createdAt).getTime(),
      finishedAt: null,
      commitSha: meta.sha,
      commitMessage: meta.message,
      branch: meta.branch,
    } satisfies RailwayDeployment;
  });
  deployCache = { at: Date.now(), value: out };
  return out;
}

const LOGS_QUERY = `query deploymentLogs($deploymentId: String!, $limit: Int, $filter: String) {
  deploymentLogs(deploymentId: $deploymentId, limit: $limit, filter: $filter) {
    timestamp message severity
  }
}`;

/** Runtime logs for the currently-running deployment. Railway exposes the
 *  running deployment's own id to the process, so no lookup is needed for the
 *  common case. */
export async function tailDeploymentLogs(limit = 200, filter = ""): Promise<RailwayLogLine[]> {
  if (!isRailwayConfigured()) return [];
  let deploymentId = process.env.RAILWAY_DEPLOYMENT_ID?.trim();
  if (!deploymentId) {
    deploymentId = (await listDeployments(1))[0]?.id;
    if (!deploymentId) return [];
  }
  const data = await gql<{ deploymentLogs: { timestamp: string; message: string; severity: string }[] }>(LOGS_QUERY, {
    deploymentId,
    limit: Math.min(Math.max(limit, 1), 500),
    filter: filter.trim() || null,
  });
  if (!data) return [];
  return data.deploymentLogs.map((l) => ({
    at: new Date(l.timestamp).getTime(),
    severity: (l.severity ?? "info").toLowerCase(),
    message: l.message ?? "",
  }));
}
