import type { XClaimResult, XTasksResponse } from "@metricbase/shared";
import { getHttpServerUrl } from "../game/serverUrl";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

/** Active X tasks + this player's per-task code and claimed status. */
export async function fetchXTasks(accessToken: string): Promise<XTasksResponse | null> {
  try {
    const res = await fetchWithTimeout(`${getHttpServerUrl()}/api/x/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as XTasksResponse;
  } catch {
    return null;
  }
}

export interface NewXTask {
  type: "reply" | "quote";
  targetUrl: string;
  title: string;
  description: string;
  hashtag: string;
  points: number;
}

/** Admin-only: post a new campaign. */
export async function createXTask(accessToken: string, task: NewXTask): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetchWithTimeout(`${getHttpServerUrl()}/api/x/tasks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: data.error || `Request failed (${res.status}).` };
    return { ok: Boolean(data.ok) };
  } catch {
    return { ok: false, error: "Network error — try again." };
  }
}

/** Admin-only: edit an existing campaign. */
export async function updateXTask(accessToken: string, id: string, task: NewXTask): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetchWithTimeout(`${getHttpServerUrl()}/api/x/tasks/${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: data.error || `Request failed (${res.status}).` };
    return { ok: Boolean(data.ok) };
  } catch {
    return { ok: false, error: "Network error — try again." };
  }
}

/** Admin-only: show/hide a campaign. */
export async function setXTaskActive(accessToken: string, id: string, active: boolean): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${getHttpServerUrl()}/api/x/tasks/${id}/active`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Submit a proof tweet URL to claim a task's season points. */
export async function claimXTask(accessToken: string, taskId: string, url: string): Promise<XClaimResult> {
  try {
    const res = await fetchWithTimeout(`${getHttpServerUrl()}/api/x/tasks/${taskId}/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await res.json().catch(() => ({}))) as XClaimResult;
    if (!res.ok) return { ok: false, error: data.error || `Request failed (${res.status}).` };
    return data;
  } catch {
    return { ok: false, error: "Network error — try again." };
  }
}
