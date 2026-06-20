import {
  type AuthChallengeResponse,
  type AuthVerifyResponse,
  type TokenGateInfoResponse,
} from "@metricbase/shared";
import bs58 from "bs58";
import { getHttpServerUrl } from "../game/serverUrl";
import {
  clearSelectedWalletId,
  discoverWallets,
  pickWalletConnector,
  setSelectedWalletId,
  type WalletConnector,
} from "./discovery";

const STORAGE_KEY = "metricbase_access_token";

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearStoredAccessToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  clearSelectedWalletId();
}

export async function fetchTokenGateInfo(): Promise<TokenGateInfoResponse> {
  const response = await fetch(`${getHttpServerUrl()}/api/token-gate`);
  if (!response.ok) {
    throw new Error("Failed to load token gate settings");
  }
  return response.json() as Promise<TokenGateInfoResponse>;
}

export function listAvailableWallets(): WalletConnector[] {
  return discoverWallets();
}

export function resolveWalletConnector(preferredId?: string | null): WalletConnector | null {
  return pickWalletConnector(preferredId);
}

export async function connectAndVerifyWallet(
  wallet: WalletConnector,
): Promise<AuthVerifyResponse> {
  setSelectedWalletId(wallet.id);

  const walletAddress = await wallet.connect();

  const challengeResponse = await fetch(
    `${getHttpServerUrl()}/api/auth/challenge?wallet=${encodeURIComponent(walletAddress)}`,
  );
  if (!challengeResponse.ok) {
    throw new Error("Failed to start wallet verification");
  }

  const challenge = (await challengeResponse.json()) as AuthChallengeResponse;
  const messageBytes = new TextEncoder().encode(challenge.message);
  const signatureBytes = await wallet.signMessage(messageBytes);
  const signature = bs58.encode(signatureBytes);

  const verifyResponse = await fetch(`${getHttpServerUrl()}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: walletAddress,
      signature,
      message: challenge.message,
    }),
  });

  const body = (await verifyResponse.json()) as AuthVerifyResponse & {
    error?: string;
    balance?: number;
    required?: number;
  };
  if (!verifyResponse.ok) {
    if (verifyResponse.status === 403 && body.balance !== undefined) {
      throw new Error(
        `Need at least ${body.required ?? "the required"} tokens. Your balance: ${body.balance}.`,
      );
    }
    throw new Error(body.error ?? "Wallet verification failed");
  }

  sessionStorage.setItem(STORAGE_KEY, body.accessToken);
  return body;
}

export async function ensureWalletAccess(): Promise<AuthVerifyResponse | null> {
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

  const gate = await fetchTokenGateInfo();
  if (!gate.enabled) {
    return null;
  }

  const wallet = pickWalletConnector();
  if (!wallet) {
    throw new Error("Choose a wallet to continue.");
  }

  return connectAndVerifyWallet(wallet);
}