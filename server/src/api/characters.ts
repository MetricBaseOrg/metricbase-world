import {
  CharacterLookupResponse,
  DEFAULT_CHARACTER_APPEARANCE,
  normalizeCharacterAppearance,
  ZONE_HUB,
  type CharacterAppearance,
} from "@metricbase/shared";
import { Router } from "express";
import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth.js";
import { isInvitationSystemActive, isInvitationRequired, validateAndUseInviteCode } from "../db/invitations.js";
import {
  bindCharacterToWallet,
  CharacterBindingError,
  loadCharacterByName,
  loadCharacterByWallet,
} from "../db/characters.js";
import { canEnterZone, isPlayerZoneId } from "../zones/zoneRegistry.js";

export const characterRouter = Router();

/**
 * A player's saved zone can become un-enterable after they left it — a visitor
 * pass on a paid World expires, or the World is unpublished/deleted. Since the
 * client joins whatever zone we return here on login, an un-enterable saved zone
 * would 403 the join and LOCK THE PLAYER OUT of the game entirely. Fall back to
 * the Hub (a spawn everyone can always enter); their location self-heals on the
 * next save. Built-in zones and Worlds they own/hold a pass for pass through.
 */
function safeSpawnZone(zoneId: string, playerName: string): string {
  if (isPlayerZoneId(zoneId) && !canEnterZone(zoneId, playerName)) return ZONE_HUB;
  return zoneId;
}

characterRouter.get("/character/me", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const saved = await loadCharacterByWallet(wallet);

  const payload: CharacterLookupResponse = saved
    ? toLookupResponse(saved, wallet)
    : {
        name: "",
        walletAddress: wallet,
        zoneId: ZONE_HUB,
        x: 0,
        y: 0,
        level: 1,
        xp: 0,
        found: false,
        bonded: false,
        appearance: { ...DEFAULT_CHARACTER_APPEARANCE },
      };

  res.json(payload);
});

characterRouter.get("/character", async (req, res) => {
  const name = sanitizeName(String(req.query.name ?? ""));
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const saved = await loadCharacterByName(name);
  const zoneId = saved ? safeSpawnZone(saved.zoneId, saved.name) : ZONE_HUB;
  const redirected = Boolean(saved) && zoneId !== saved!.zoneId;

  const payload: CharacterLookupResponse = saved
    ? {
        name: saved.name,
        walletAddress: saved.walletAddress,
        zoneId,
        x: redirected ? 0 : saved.x,
        y: redirected ? 0 : saved.y,
        level: saved.level,
        xp: saved.xp,
        found: true,
        bonded: Boolean(saved.walletAddress),
        appearance: saved.appearance,
      }
    : {
        name,
        walletAddress: null,
        zoneId: ZONE_HUB,
        x: 0,
        y: 0,
        level: 1,
        xp: 0,
        found: false,
        bonded: false,
        appearance: { ...DEFAULT_CHARACTER_APPEARANCE },
      };

  res.json(payload);
});

characterRouter.post("/character", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const name = sanitizeName(String(req.body?.name ?? ""));
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const existing = await loadCharacterByWallet(wallet);
  if (!existing && isInvitationSystemActive()) {
    const inviteCode = req.body?.inviteCode ? String(req.body.inviteCode).trim() : "";
    if (!inviteCode) {
      // Invites are optional by default — only block when explicitly required.
      if (isInvitationRequired()) {
        res.status(400).json({ error: "Invitation code is required to register." });
        return;
      }
    } else {
      try {
        await validateAndUseInviteCode(inviteCode, wallet);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid invitation code.";
        // A bad code blocks only when codes are required; otherwise the player
        // registers without a referral credit rather than being turned away.
        if (isInvitationRequired()) {
          res.status(400).json({ error: msg });
          return;
        }
        console.warn(`[characters] optional invite code rejected (${msg}); registering without referral`);
      }
    }
  }

  const appearance = normalizeCharacterAppearance(req.body?.appearance as Partial<CharacterAppearance>);

  try {
    const record = await bindCharacterToWallet(wallet, name, appearance);
    res.json({
      ok: true,
      name: record.name,
      walletAddress: record.walletAddress,
      appearance: record.appearance,
      bonded: true,
    });
  } catch (error) {
    if (error instanceof CharacterBindingError) {
      const status = error.code === "name_taken" ? 409 : 403;
      res.status(status).json({
        error: error.message,
        code: error.code,
        ...error.details,
      });
      return;
    }
    throw error;
  }
});

function toLookupResponse(
  saved: NonNullable<Awaited<ReturnType<typeof loadCharacterByWallet>>>,
  wallet: string,
): CharacterLookupResponse {
  const zoneId = safeSpawnZone(saved.zoneId, saved.name);
  const redirected = zoneId !== saved.zoneId;
  return {
    name: saved.name,
    walletAddress: saved.walletAddress ?? wallet,
    zoneId,
    // On a Hub fallback, drop the stale World coordinates so they spawn at the
    // Hub's default spawn rather than an arbitrary tile.
    x: redirected ? 0 : saved.x,
    y: redirected ? 0 : saved.y,
    level: saved.level,
    xp: saved.xp,
    found: true,
    bonded: true,
    appearance: saved.appearance,
  };
}

function sanitizeName(name: string): string {
  const trimmed = name.trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : "";
}