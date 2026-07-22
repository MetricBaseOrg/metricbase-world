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
import { isTelegramIdentity, normalizePayoutWallet } from "../auth/telegramAuth.js";
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
  payout_wallet: string | null;
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
          `SELECT name, level, xp, gold, gems, honor, guild_coin, motto, payout_wallet,
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
      isTelegramAccount: isTelegramIdentity(wallet),
      payoutWallet: null,
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
    // Telegram players have no address of their own, so the dashboard shows a
    // "where should we send your rewards?" prompt when this is unset.
    isTelegramAccount: isTelegramIdentity(wallet),
    payoutWallet: row.payout_wallet ?? null,
    lastSeenAt: row.updated_at ? row.updated_at.getTime() : null,
    unreadMail: await countUnread(row.name),
    inventory: normalizeInventory(row.inventory),
    equippedPetId: equipment.petId,
    equippedMountId: equipment.mountId,
  };
  res.json(payload);
});

/**
 * Nominate where this player's $BASE season rewards should be sent.
 *
 * This is a PAYOUT DESTINATION, not an identity: it never authenticates
 * anything, so no signature is required and setting it cannot take over an
 * account — naming an address you don't own would only pay its owner. What it
 * CAN do is lose money to a typo, since the transfer is irreversible, so the
 * address is strictly validated as a real 32-byte pubkey and echoed back for
 * the player to confirm.
 */
dashboardRouter.post("/dashboard/payout-wallet", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const raw = String((req.body as { payoutWallet?: unknown })?.payoutWallet ?? "").trim();

  // Empty clears it (wallet players fall back to their own address).
  const payoutWallet = raw ? normalizePayoutWallet(raw) : null;
  if (raw && !payoutWallet) {
    res.status(400).json({
      error: "That doesn't look like a Solana wallet address. Paste the full address from your wallet.",
    });
    return;
  }

  const db = getPool();
  if (!db) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }

  const result = await db.query(
    `UPDATE characters SET payout_wallet = $1, updated_at = NOW() WHERE wallet_address = $2`,
    [payoutWallet, wallet],
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "No character bonded to this account yet." });
    return;
  }
  res.json({ ok: true, payoutWallet });
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
