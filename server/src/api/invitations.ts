import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth/requireAuth.js";
import {
  getInvitationsForWallet,
  getInvitedCount,
  getGeneratedCount,
  createInvitation,
  isInvitationSystemActive,
} from "../db/invitations.js";
import { getGrantedCodesCount } from "@metricbase/shared";

export const invitationsRouter = Router();

invitationsRouter.get("/invitations/config", (_req, res) => {
  res.json({ active: isInvitationSystemActive() });
});

invitationsRouter.get("/invitations", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  try {
    const codes = await getInvitationsForWallet(wallet);
    const invitedCount = await getInvitedCount(wallet);
    const maxCodesAllowed = getGrantedCodesCount(invitedCount);
    const generatedCount = await getGeneratedCount(wallet);
    const codesRemaining = Math.max(0, maxCodesAllowed - generatedCount);

    res.json({
      codes,
      invitedCount,
      maxCodesAllowed,
      generatedCount,
      codesRemaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load invitations";
    res.status(500).json({ error: message });
  }
});

invitationsRouter.post("/invitations", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  try {
    const code = await createInvitation(wallet);
    res.json({ ok: true, code });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invitation";
    res.status(400).json({ error: message });
  }
});
