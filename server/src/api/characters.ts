import {
  CharacterLookupResponse,
  DEFAULT_CHARACTER_APPEARANCE,
  normalizeCharacterAppearance,
  ZONE_HUB,
  type CharacterAppearance,
} from "@metricbase/shared";
import { Router } from "express";
import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth.js";
import {
  bindCharacterToWallet,
  CharacterBindingError,
  loadCharacterByName,
  loadCharacterByWallet,
} from "../db/characters.js";

export const characterRouter = Router();

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

  const payload: CharacterLookupResponse = saved
    ? {
        name: saved.name,
        walletAddress: saved.walletAddress,
        zoneId: saved.zoneId,
        x: saved.x,
        y: saved.y,
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
  return {
    name: saved.name,
    walletAddress: saved.walletAddress ?? wallet,
    zoneId: saved.zoneId,
    x: saved.x,
    y: saved.y,
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