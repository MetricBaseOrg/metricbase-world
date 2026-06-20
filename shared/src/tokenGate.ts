export const METRICBASE_TOKEN_MINT = "DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump";

/** Minimum token balance required to enter the world. */
export const MIN_TOKEN_UI_AMOUNT = 1000;

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
  minUiAmount: number;
  enabled: boolean;
}