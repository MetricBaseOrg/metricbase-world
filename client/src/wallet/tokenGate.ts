import {
  type AuthChallengeResponse,
  type AuthVerifyResponse,
  type TokenGateInfoResponse,
} from "@metricbase/shared";
import bs58 from "bs58";
import { getHttpServerUrl } from "../game/serverUrl";
import { fetchWithTimeout, withTimeout } from "../utils/fetchWithTimeout";
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

const WALLET_CONNECT_TIMEOUT_MS = 90_000;
const WALLET_SIGN_TIMEOUT_MS = 90_000;
const API_TIMEOUT_MS = 25_000;

export async function fetchTokenGateInfo(): Promise<TokenGateInfoResponse> {
  const response = await fetchWithTimeout(
    `${getHttpServerUrl()}/api/token-gate`,
    undefined,
    API_TIMEOUT_MS,
  );
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

  const walletAddress = await withTimeout(
    wallet.connect(),
    WALLET_CONNECT_TIMEOUT_MS,
    "Wallet connection timed out. Open your wallet extension and approve the connection.",
  );

  const challengeResponse = await fetchWithTimeout(
    `${getHttpServerUrl()}/api/auth/challenge?wallet=${encodeURIComponent(walletAddress)}`,
    undefined,
    API_TIMEOUT_MS,
  );
  if (!challengeResponse.ok) {
    throw new Error("Failed to start wallet verification");
  }

  const challenge = (await challengeResponse.json()) as AuthChallengeResponse;
  const messageBytes = new TextEncoder().encode(challenge.message);
  const signatureBytes = await withTimeout(
    wallet.signMessage(messageBytes),
    WALLET_SIGN_TIMEOUT_MS,
    "Wallet signature timed out. Open your wallet extension and approve the message.",
  );
  const signature = bs58.encode(signatureBytes);

  const verifyResponse = await fetchWithTimeout(
    `${getHttpServerUrl()}/api/auth/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: walletAddress,
        signature,
        message: challenge.message,
      }),
    },
    API_TIMEOUT_MS,
  );

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

export async function getValidWalletSession(): Promise<AuthVerifyResponse | null> {
  const existing = getStoredAccessToken();
  if (!existing) {
    return null;
  }

  const sessionResponse = await fetchWithTimeout(
    `${getHttpServerUrl()}/api/auth/session`,
    {
      headers: { Authorization: `Bearer ${existing}` },
    },
    API_TIMEOUT_MS,
  );
  if (!sessionResponse.ok) {
    clearStoredAccessToken();
    return null;
  }

  const session = (await sessionResponse.json()) as { wallet: string; expiresAt: number };
  return {
    accessToken: existing,
    wallet: session.wallet,
    tokenBalance: 0,
    expiresAt: session.expiresAt,
  };
}

export async function ensureWalletAccess(): Promise<AuthVerifyResponse | null> {
  const session = await getValidWalletSession();
  if (session) {
    return session;
  }

  const gate = await fetchTokenGateInfo();
  if (!gate.enabled) {
    return null;
  }

  const wallet = pickWalletConnector();
  if (!wallet) {
    return null;
  }

  return connectAndVerifyWallet(wallet);
}