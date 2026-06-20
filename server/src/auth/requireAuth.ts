import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./accessToken.js";

export interface AuthenticatedRequest extends Request {
  authWallet: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired wallet session" });
    return;
  }

  (req as AuthenticatedRequest).authWallet = payload.wallet;
  next();
}

export function getWalletFromAuthHeader(authorization: string | undefined): string | null {
  const token = String(authorization ?? "").replace(/^Bearer\s+/i, "");
  const payload = verifyAccessToken(token);
  return payload?.wallet ?? null;
}