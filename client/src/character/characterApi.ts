import {
  type CharacterAppearance,
  type CharacterLookupResponse,
} from "@metricbase/shared";
import { getHttpServerUrl } from "../game/serverUrl";

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function lookupBondedCharacter(
  accessToken: string,
): Promise<CharacterLookupResponse> {
  const response = await fetch(`${getHttpServerUrl()}/api/character/me`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    throw new Error("Failed to load wallet character");
  }
  return response.json() as Promise<CharacterLookupResponse>;
}

/** Public name check — only reveals whether a name is bonded, not wallet identity. */
export async function lookupCharacter(name: string): Promise<CharacterLookupResponse> {
  const response = await fetch(
    `${getHttpServerUrl()}/api/character?name=${encodeURIComponent(name)}`,
  );
  if (!response.ok) {
    throw new Error("Failed to look up character");
  }
  return response.json() as Promise<CharacterLookupResponse>;
}

export async function saveCharacterAppearance(
  name: string,
  appearance: CharacterAppearance,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`${getHttpServerUrl()}/api/character`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ name, appearance }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      bondedName?: string;
    };
    if (response.status === 403 && body.bondedName) {
      throw new Error(`This wallet is bonded to "${body.bondedName}".`);
    }
    throw new Error(body.error ?? "Failed to save character");
  }
}