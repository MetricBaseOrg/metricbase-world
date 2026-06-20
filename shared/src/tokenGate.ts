export const METRICBASE_TOKEN_MINT = "DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump";

/** Minimum UI token amount required to enter the world (must hold > 0 by default). */
export const MIN_TOKEN_UI_AMOUNT = 0.000001;

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