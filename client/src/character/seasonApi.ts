import { getHttpServerUrl } from "../game/serverUrl";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

export interface SeasonPayoutLine {
  name: string;
  wallet: string;
  points: number;
  amount: number;
  status?: "paid" | "skipped" | "failed";
  signature?: string;
  error?: string;
}

export interface SeasonPayoutReport {
  seasonNumber: number;
  seasonId: string;
  pool: number;
  totalPoints: number;
  eligible: number;
  totalToPay: number;
  houseBalance: number | null;
  solvent: boolean;
  withdrawEnabled: boolean;
  executed: boolean;
  alreadyPaid: number;
  lines: SeasonPayoutLine[];
  error?: string;
}

/** Admin-only. Dry-run (execute=false) previews the split without moving funds;
 * execute=true performs the payout. seasonNumber omitted = the last ended season. */
export async function requestSeasonPayout(
  accessToken: string,
  seasonNumber: number | undefined,
  execute: boolean,
): Promise<{ ok: boolean; report?: SeasonPayoutReport; error?: string }> {
  const res = await fetchWithTimeout(`${getHttpServerUrl()}/api/season/payout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ seasonNumber, execute }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; report?: SeasonPayoutReport; error?: string };
  if (!res.ok) return { ok: false, error: data?.error || `Request failed (${res.status}).` };
  return { ok: Boolean(data.ok), report: data.report, error: data.error };
}
