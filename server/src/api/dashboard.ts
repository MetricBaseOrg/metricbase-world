import {
  MOTTO_MAX_LENGTH,
  normalizeCharacterAppearance,
  normalizeEquipment,
  normalizeInventory,
  normalizeSkills,
  totalSkillLevel,
  DEFAULT_CHARACTER_APPEARANCE,
  type CharacterAppearance,
  type DashboardResponse,
  type InventoryEntry,
  type PlayerEquipment,
  type SkillXpMap,
} from "@metricbase/shared";
import { Router } from "express";
import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth.js";
import { countUnread } from "../db/mail.js";
import { getPool } from "../db/pool.js";

export const dashboardRouter = Router();

type DashboardRow = {
  name: string;
  level: number;
  xp: number;
  gold: number | null;
  gems: number | null;
  honor: number | null;
  guild_coin: number | null;
  motto: string | null;
  appearance: CharacterAppearance | null;
  inventory: InventoryEntry[] | null;
  equipment: PlayerEquipment | null;
  skills: SkillXpMap | null;
  updated_at: Date | null;
};

/** Everything the /dashboard page renders, for the signed-in wallet. */
dashboardRouter.get("/dashboard/me", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const db = getPool();

  const row = db
    ? (
        await db.query<DashboardRow>(
          `SELECT name, level, xp, gold, gems, honor, guild_coin, motto,
                  appearance, inventory, equipment, skills, updated_at
           FROM characters WHERE wallet_address = $1`,
          [wallet],
        )
      ).rows[0] ?? null
    : null;

  if (!row) {
    const empty: DashboardResponse = {
      found: false,
      name: "",
      appearance: { ...DEFAULT_CHARACTER_APPEARANCE },
      level: 1,
      xp: 0,
      totalLevel: 1,
      gold: 0,
      gems: 0,
      honor: 0,
      guildCoin: 0,
      motto: "",
      lastSeenAt: null,
      unreadMail: 0,
      inventory: [],
      equippedPetId: null,
      equippedMountId: null,
    };
    res.json(empty);
    return;
  }

  const skills = normalizeSkills(row.skills);
  const equipment = normalizeEquipment(row.equipment);
  const payload: DashboardResponse = {
    found: true,
    name: row.name,
    appearance: normalizeCharacterAppearance(row.appearance ?? undefined),
    level: row.level,
    xp: row.xp,
    totalLevel: row.level + totalSkillLevel(skills),
    gold: row.gold ?? 0,
    gems: row.gems ?? 0,
    honor: row.honor ?? 0,
    guildCoin: row.guild_coin ?? 0,
    motto: row.motto ?? "",
    lastSeenAt: row.updated_at ? row.updated_at.getTime() : null,
    unreadMail: await countUnread(row.name),
    inventory: normalizeInventory(row.inventory),
    equippedPetId: equipment.petId,
    equippedMountId: equipment.mountId,
  };
  res.json(payload);
});

/** Save the profile motto shown on the dashboard. */
dashboardRouter.post("/dashboard/motto", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const motto = sanitizeMotto(String(req.body?.motto ?? ""));

  const db = getPool();
  if (!db) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }

  const result = await db.query(
    `UPDATE characters SET motto = $1, updated_at = NOW() WHERE wallet_address = $2`,
    [motto, wallet],
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "No character bonded to this wallet yet." });
    return;
  }
  res.json({ ok: true, motto });
});

function sanitizeMotto(raw: string): string {
  // Strip control characters, collapse whitespace, clamp length.
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MOTTO_MAX_LENGTH);
}
