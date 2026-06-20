import {
  type AuthChallengeResponse,
  type AuthVerifyResponse,
  type TokenGateInfoResponse,
} from "@metricbase/shared";
import bs58 from "bs58";
import { getHttpServerUrl } from "../game/serverUrl";
import { getSolanaProvider } from "./solanaProvider";

const STORAGE_KEY = "metricbase_access_token";

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearStoredAccessToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function fetchTokenGateInfo(): Promise<TokenGateInfoResponse> {
  const response = await fetch(`${getHttpServerUrl()}/api/token-gate`);
  if (!response.ok) {
    throw new Error("Failed to load token gate settings");
  }
  return response.json() as Promise<TokenGateInfoResponse>;
}

export async function connectAndVerifyWallet(): Promise<AuthVerifyResponse> {
  const provider = getSolanaProvider();
  if (!provider) {
    throw new Error("Install Phantom or another Solana wallet to play.");
  }

  const connection = await provider.connect();
  const wallet = connection.publicKey.toString();

  const challengeResponse = await fetch(
    `${getHttpServerUrl()}/api/auth/challenge?wallet=${encodeURIComponent(wallet)}`,
  );
  if (!challengeResponse.ok) {
    throw new Error("Failed to start wallet verification");
  }

  const challenge = (await challengeResponse.json()) as AuthChallengeResponse;
  const messageBytes = new TextEncoder().encode(challenge.message);
  const signed = await provider.signMessage(messageBytes, "utf8");
  const signature = bs58.encode(signed.signature);

  const verifyResponse = await fetch(`${getHttpServerUrl()}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      signature,
      message: challenge.message,
    }),
  });

  const body = (await verifyResponse.json()) as AuthVerifyResponse & { error?: string; balance?: number; required?: number };
  if (!verifyResponse.ok) {
    if (verifyResponse.status === 403 && body.balance !== undefined) {
      throw new Error(
        `Token required. Balance: ${body.balance} (need ${body.required ?? "> 0"}).`,
      );
    }
    throw new Error(body.error ?? "Wallet verification failed");
  }

  sessionStorage.setItem(STORAGE_KEY, body.accessToken);
  return body;
}

export async function ensureWalletAccess(): Promise<AuthVerifyResponse | null> {
  const gate = await fetchTokenGateInfo();
  if (!gate.enabled) {
    return null;
  }

  const existing = getStoredAccessToken();
  if (existing) {
    const sessionResponse = await fetch(`${getHttpServerUrl()}/api/auth/session`, {
      headers: { Authorization: `Bearer ${existing}` },
    });
    if (sessionResponse.ok) {
      const session = (await sessionResponse.json()) as { wallet: string; expiresAt: number };
      return {
        accessToken: existing,
        wallet: session.wallet,
        tokenBalance: 0,
        expiresAt: session.expiresAt,
      };
    }
    clearStoredAccessToken();
  }

  return connectAndVerifyWallet();
}