import { getHttpServerUrl } from "../game/serverUrl";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export interface InvitationConfig {
  active: boolean;
}

export interface InvitationInfo {
  code: string;
  inviteeWallet: string | null;
  inviteeName: string | null;
  usedAt: string | null;
  createdAt: string;
}

export interface InvitationStateResponse {
  codes: InvitationInfo[];
  invitedCount: number;
  maxCodesAllowed: number;
  generatedCount: number;
  codesRemaining: number;
}

export async function getInvitationConfig(): Promise<InvitationConfig> {
  const response = await fetchWithTimeout(`${getHttpServerUrl()}/api/invitations/config`);
  if (!response.ok) {
    throw new Error("Failed to load invitation configuration.");
  }
  return response.json() as Promise<InvitationConfig>;
}

export async function getInvitations(accessToken: string): Promise<InvitationStateResponse> {
  const response = await fetchWithTimeout(`${getHttpServerUrl()}/api/invitations`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to load invitations.");
  }
  return response.json() as Promise<InvitationStateResponse>;
}

export async function generateInvitationCode(accessToken: string): Promise<string> {
  const response = await fetchWithTimeout(`${getHttpServerUrl()}/api/invitations`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to generate invitation code.");
  }
  const body = await response.json() as { ok: boolean; code: string };
  return body.code;
}
