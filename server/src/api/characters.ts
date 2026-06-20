import {
  CharacterLookupResponse,
  DEFAULT_CHARACTER_APPEARANCE,
  normalizeCharacterAppearance,
  ZONE_HUB,
  type CharacterAppearance,
} from "@metricbase/shared";
import { Router } from "express";
import { loadCharacter, saveCharacter } from "../db/characters.js";

export const characterRouter = Router();

characterRouter.get("/character", async (req, res) => {
  const name = sanitizeName(String(req.query.name ?? ""));
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const saved = await loadCharacter(name);

  const payload: CharacterLookupResponse = saved
    ? {
        name: saved.name,
        zoneId: saved.zoneId,
        x: saved.x,
        y: saved.y,
        level: saved.level,
        xp: saved.xp,
        found: true,
        appearance: saved.appearance,
      }
    : {
        name,
        zoneId: ZONE_HUB,
        x: 0,
        y: 0,
        level: 1,
        xp: 0,
        found: false,
        appearance: { ...DEFAULT_CHARACTER_APPEARANCE },
      };

  res.json(payload);
});

characterRouter.post("/character", async (req, res) => {
  const name = sanitizeName(String(req.body?.name ?? ""));
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const appearance = normalizeCharacterAppearance(req.body?.appearance as Partial<CharacterAppearance>);
  const saved = await loadCharacter(name);

  await saveCharacter({
    name,
    zoneId: saved?.zoneId ?? ZONE_HUB,
    x: saved?.x ?? 0,
    y: saved?.y ?? 0,
    level: saved?.level ?? 1,
    xp: saved?.xp ?? 0,
    questProgress: saved?.questProgress ?? { active: [], objectiveIndex: {}, completed: [] },
    appearance,
  });

  res.json({ ok: true, name, appearance });
});

function sanitizeName(name: string): string {
  const trimmed = name.trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : "";
}