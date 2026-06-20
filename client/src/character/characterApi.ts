import {
  type CharacterAppearance,
  type CharacterLookupResponse,
} from "@metricbase/shared";
import { getHttpServerUrl } from "../game/serverUrl";

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
): Promise<void> {
  const response = await fetch(`${getHttpServerUrl()}/api/character`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, appearance }),
  });
  if (!response.ok) {
    throw new Error("Failed to save character");
  }
}