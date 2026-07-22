export const METRICBASE_TOKEN_MINT = "DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump";

/**
 * Minimum $BASE balance required to enter the world.
 *
 * 0 = FREE TO PLAY. A connected, signature-verified wallet is still required
 * (it is the player's identity — characters, bans, season payouts and every
 * on-chain purchase are keyed to it); holders just aren't screened on balance.
 * Override per-environment with MIN_TOKEN_UI_AMOUNT to re-introduce a
 * threshold without a code change.
 */
export const MIN_TOKEN_UI_AMOUNT = 0;

export interface AuthChallengeResponse {
  wallet: string;
  message: string;
  expiresAt: number;
}

export interface AuthVerifyRequest {
  wallet: string;
  signature: string;
  message: string;
}

export interface AuthVerifyResponse {
  accessToken: string;
  wallet: string;
  tokenBalance: number;
  expiresAt: number;
}

export interface TokenGateInfoResponse {
  mint: string;
  /** Tokens needed to enter. 0 = free to play; a wallet is still required. */
  minUiAmount: number;
  /** Whether wallet authentication is enforced at all. Only ever false on
   *  local dev servers — see isTokenGateEnabled() on the server. */
  enabled: boolean;
  /** Whether this server can verify Telegram logins (TELEGRAM_BOT_TOKEN set).
   *  False = don't offer the button; the endpoint would only 503. */
  telegramLogin?: boolean;
}