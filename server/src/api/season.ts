import { Router } from "express";
import { currentSeason } from "@metricbase/shared";
import { requireAuth, type AuthenticatedRequest } from "../auth/requireAuth.js";
import { adService } from "../ads/adService.js";
import { distributeSeasonRewards } from "../season/payout.js";

export const seasonRouter = Router();

/**
 * Admin-only season payout. Dry-run by default — it computes and returns the
 * full split (per-player amounts, total, house balance, solvency) WITHOUT moving
 * anything. Pass `execute: true` to actually pay out (idempotent + solvency-
 * guarded). Defaults to the most recently ended season.
 *
 *   POST /api/season/payout   { seasonNumber?: number, execute?: boolean }
 */
seasonRouter.post("/season/payout", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  if (!adService.isAdmin(wallet)) {
    res.status(403).json({ error: "Not authorized." });
    return;
  }
  const requested = Number(req.body?.seasonNumber);
  const seasonNumber = Number.isInteger(requested) && requested > 0 ? requested : currentSeason().number - 1;
  const execute = req.body?.execute === true;
  try {
    const report = await distributeSeasonRewards(seasonNumber, execute);
    res.json({ ok: !report.error, report });
  } catch (error) {
    console.error("[season] payout endpoint failed:", error);
    res.status(500).json({ error: "Payout failed. See server logs." });
  }
});
