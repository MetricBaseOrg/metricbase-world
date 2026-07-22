import {
  type AuthChallengeResponse,
  type AuthVerifyResponse,
  type TokenGateInfoResponse,
} from "@metricbase/shared";
import bs58 from "bs58";
import { getHttpServerUrl } from "../game/serverUrl";
import { getTelegramInitData } from "../telegram/telegramApp";
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
const VERIFY_TIMEOUT_MS = 45_000;

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

/**
 * Sign in with Telegram instead of a wallet.
 *
 * Sends the launch's signed initData for server-side HMAC verification and
 * receives the same kind of access token a wallet sign-in yields, keyed to a
 * `tg:<id>` identity. Walletless players can play fully; a wallet is only
 * needed to receive $BASE (season payouts) or make on-chain purchases.
 */
export async function loginWithTelegram(): Promise<AuthVerifyResponse> {
  const initData = await getTelegramInitData();
  if (!initData) {
    throw new Error("Telegram sign-in is only available inside the Telegram app.");
  }

  const response = await fetchWithTimeout(
    `${getHttpServerUrl()}/api/auth/telegram`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    },
    VERIFY_TIMEOUT_MS,
  );

  const data = (await response.json()) as AuthVerifyResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Telegram sign-in failed.");
  }
  sessionStorage.setItem(STORAGE_KEY, data.accessToken);
  return data;
}

export function listAvailableWallets(): WalletConnector[] {
  return discoverWallets();
}

export function resolveWalletConnector(preferredId?: string | null): WalletConnector | null {
  return pickWalletConnector(preferredId);
}

// One connection attempt at a time. On touch devices a single tap can dispatch
// two click events before React disables the button, and firing connect()
// twice makes wallets reject with "Request ... already pending" (MetaMask) or
// stack prompts (Phantom). A second call simply joins the in-flight attempt.
let inflightConnect: Promise<AuthVerifyResponse> | null = null;

export async function connectAndVerifyWallet(
  wallet: WalletConnector,
): Promise<AuthVerifyResponse> {
  if (inflightConnect) return inflightConnect;
  inflightConnect = doConnectAndVerify(wallet).finally(() => {
    inflightConnect = null;
  });
  return inflightConnect;
}

async function doConnectAndVerify(wallet: WalletConnector): Promise<AuthVerifyResponse> {
  setSelectedWalletId(wallet.id);

  let walletAddress: string;
  try {
    walletAddress = await withTimeout(
      wallet.connect(),
      WALLET_CONNECT_TIMEOUT_MS,
      "Wallet connection timed out. Open your wallet extension and approve the connection.",
    );
  } catch (connectError) {
    // A request stuck inside the wallet app (e.g. from an earlier tap or
    // another tab) rejects every retry until the player deals with it there.
    const msg = connectError instanceof Error ? connectError.message : String(connectError);
    if (/already pending|already processing/i.test(msg)) {
      throw new Error(
        "Your wallet already has a connection request waiting. Open the wallet app, approve or dismiss it, then try again.",
      );
    }
    throw connectError;
  }

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
    VERIFY_TIMEOUT_MS,
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