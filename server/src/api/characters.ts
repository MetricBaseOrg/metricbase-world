import { CharacterLookupResponse, ZONE_HUB } from "@metricbase/shared";
import { Router } from "express";
import { loadCharacter } from "../db/characters.js";

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
      }
    : {
        name,
        zoneId: ZONE_HUB,
        x: 0,
        y: 0,
        level: 1,
        xp: 0,
        found: false,
      };

  res.json(payload);
});

function sanitizeName(name: string): string {
  const trimmed = name.trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : "";
}