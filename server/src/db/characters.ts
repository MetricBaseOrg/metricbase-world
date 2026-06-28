import {
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  EMPTY_QUEST_PROGRESS,
  STARTING_GOLD,
  STARTING_STAMINA,
  clampStamina,
  getPlayerMaxHp,
  normalizeCharacterAppearance,
  normalizeEquipment,
  normalizeInventory,
  normalizeSkills,
  type CharacterAppearance,
  type InventoryEntry,
  type PlayerEquipment,
  type QuestProgress,
  type SkillXpMap,
} from "@metricbase/shared";
import { getPool } from "./pool.js";

export interface CharacterRecord {
  name: string;
  walletAddress: string | null;
  zoneId: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  gold: number;
  questProgress: QuestProgress;
  appearance: CharacterAppearance;
  inventory: InventoryEntry[];
  hp: number;
  equipment: PlayerEquipment;
  npcInteractAt: Record<string, number>;
  mobGoldClaimed: Record<string, boolean>;
  knockedOutUntil: number | null;
  skills: SkillXpMap;
  stamina: number;
  /** VIP Lodge pass expiry (epoch ms), or null when none. */
  vipPassUntil: number | null;
}

type CharacterRow = {
  name: string;
  wallet_address: string | null;
  zone_id: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  gold: number | null;
  quest_progress: QuestProgress | null;
  appearance: CharacterAppearance | null;
  inventory: InventoryEntry[] | null;
  hp: number | null;
  equipment: PlayerEquipment | null;
  npc_interact_at: Record<string, number> | null;
  mob_gold_claimed: Record<string, boolean> | null;
  knocked_out_until: string | number | null;
  skills: SkillXpMap | null;
  stamina: number | null;
  vip_pass_until: string | number | null;
};

export async function loadCharacterByName(name: string): Promise<CharacterRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<CharacterRow>(
    `SELECT name, wallet_address, zone_id, x, y, level, xp, gold, quest_progress, appearance, inventory, hp, equipment, npc_interact_at, mob_gold_claimed, knocked_out_until, skills, stamina, vip_pass_until
     FROM characters
     WHERE name = $1`,
    [name],
  );

  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

export async function loadCharacterByWallet(wallet: string): Promise<CharacterRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<CharacterRow>(
    `SELECT name, wallet_address, zone_id, x, y, level, xp, gold, quest_progress, appearance, inventory, hp, equipment, npc_interact_at, mob_gold_claimed, knocked_out_until, skills, stamina, vip_pass_until
     FROM characters
     WHERE wallet_address = $1`,
    [wallet],
  );

  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

/** @deprecated Use loadCharacterByName or loadCharacterByWallet */
export async function loadCharacter(name: string): Promise<CharacterRecord | null> {
  return loadCharacterByName(name);
}

export async function saveCharacter(record: CharacterRecord): Promise<void> {
  const db = getPool();
  if (!db) return;

  await db.query(
    `INSERT INTO characters (name, wallet_address, zone_id, x, y, level, xp, gold, quest_progress, appearance, inventory, hp, equipment, npc_interact_at, mob_gold_claimed, knocked_out_until, skills, stamina, vip_pass_until, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17::jsonb, $18, $19, NOW())
     ON CONFLICT (name)
     DO UPDATE SET
       wallet_address = COALESCE(EXCLUDED.wallet_address, characters.wallet_address),
       zone_id = EXCLUDED.zone_id,
       x = EXCLUDED.x,
       y = EXCLUDED.y,
       level = EXCLUDED.level,
       xp = EXCLUDED.xp,
       gold = EXCLUDED.gold,
       quest_progress = EXCLUDED.quest_progress,
       appearance = EXCLUDED.appearance,
       inventory = EXCLUDED.inventory,
       hp = EXCLUDED.hp,
       equipment = EXCLUDED.equipment,
       npc_interact_at = EXCLUDED.npc_interact_at,
       mob_gold_claimed = EXCLUDED.mob_gold_claimed,
       knocked_out_until = EXCLUDED.knocked_out_until,
       skills = EXCLUDED.skills,
       stamina = EXCLUDED.stamina,
       vip_pass_until = COALESCE(EXCLUDED.vip_pass_until, characters.vip_pass_until),
       updated_at = NOW()`,
    [
      record.name,
      record.walletAddress,
      record.zoneId,
      record.x,
      record.y,
      record.level,
      record.xp,
      record.gold,
      JSON.stringify(record.questProgress),
      JSON.stringify(record.appearance),
      JSON.stringify(record.inventory),
      record.hp,
      JSON.stringify(record.equipment),
      JSON.stringify(record.npcInteractAt),
      JSON.stringify(record.mobGoldClaimed),
      record.knockedOutUntil,
      JSON.stringify(record.skills),
      record.stamina,
      record.vipPassUntil,
    ],
  );
}

export class CharacterBindingError extends Error {
  constructor(
    message: string,
    readonly code: "wallet_bonded" | "name_taken" | "wallet_required",
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = "CharacterBindingError";
  }
}

export async function bindCharacterToWallet(
  wallet: string,
  name: string,
  appearance: CharacterAppearance,
): Promise<CharacterRecord> {
  const existingByWallet = await loadCharacterByWallet(wallet);
  const existingByName = await loadCharacterByName(name);

  if (existingByWallet && existingByWallet.name !== name) {
    throw new CharacterBindingError(
      `This wallet is already bonded to "${existingByWallet.name}".`,
      "wallet_bonded",
      { bondedName: existingByWallet.name },
    );
  }

  if (
    existingByName?.walletAddress &&
    existingByName.walletAddress !== wallet
  ) {
    throw new CharacterBindingError(
      "This character name is already bonded to another wallet.",
      "name_taken",
    );
  }

  const record: CharacterRecord = {
    name,
    walletAddress: wallet,
    zoneId: existingByWallet?.zoneId ?? existingByName?.zoneId ?? "zone_hub",
    x: existingByWallet?.x ?? existingByName?.x ?? 0,
    y: existingByWallet?.y ?? existingByName?.y ?? 0,
    level: existingByWallet?.level ?? existingByName?.level ?? 1,
    xp: existingByWallet?.xp ?? existingByName?.xp ?? 0,
    gold: existingByWallet?.gold ?? existingByName?.gold ?? STARTING_GOLD,
    questProgress:
      existingByWallet?.questProgress ??
      existingByName?.questProgress ??
      { active: [], objectiveIndex: {}, completed: [] },
    appearance,
    inventory: existingByWallet?.inventory ?? existingByName?.inventory ?? [],
    hp:
      existingByWallet?.hp ??
      existingByName?.hp ??
      getPlayerMaxHp(existingByWallet?.level ?? existingByName?.level ?? 1),
    equipment: normalizeEquipment(
      existingByWallet?.equipment ?? existingByName?.equipment ?? EMPTY_EQUIPMENT,
    ),
    npcInteractAt:
      existingByWallet?.npcInteractAt ?? existingByName?.npcInteractAt ?? {},
    mobGoldClaimed:
      existingByWallet?.mobGoldClaimed ?? existingByName?.mobGoldClaimed ?? {},
    knockedOutUntil:
      existingByWallet?.knockedOutUntil ?? existingByName?.knockedOutUntil ?? null,
    skills: normalizeSkills(existingByWallet?.skills ?? existingByName?.skills),
    stamina: clampStamina(
      existingByWallet?.stamina ?? existingByName?.stamina ?? STARTING_STAMINA,
    ),
    vipPassUntil: existingByWallet?.vipPassUntil ?? existingByName?.vipPassUntil ?? null,
  };

  await saveCharacter(record);
  return record;
}

export async function resolveCharacterForJoin(
  wallet: string | null,
  name: string,
): Promise<CharacterRecord | null> {
  if (wallet) {
    const byWallet = await loadCharacterByWallet(wallet);
    if (byWallet && byWallet.name !== name) {
      throw new CharacterBindingError(
        `This wallet is bonded to "${byWallet.name}".`,
        "wallet_bonded",
        { bondedName: byWallet.name },
      );
    }

    const byName = await loadCharacterByName(name);
    if (byName?.walletAddress && byName.walletAddress !== wallet) {
      throw new CharacterBindingError(
        "This character name belongs to another wallet.",
        "name_taken",
      );
    }

    if (byWallet) return byWallet;
    if (byName) {
      if (!byName.walletAddress) {
        return { ...byName, walletAddress: wallet };
      }
      return byName;
    }

    return null;
  }

  return loadCharacterByName(name);
}

function mapRow(row: CharacterRow): CharacterRecord {
  return {
    name: row.name,
    walletAddress: row.wallet_address,
    zoneId: row.zone_id,
    x: row.x,
    y: row.y,
    level: row.level,
    xp: row.xp,
    gold: row.gold ?? STARTING_GOLD,
    questProgress: normalizeQuestProgress(row.quest_progress),
    appearance: normalizeCharacterAppearance(row.appearance),
    inventory: normalizeInventory(row.inventory ?? EMPTY_INVENTORY),
    hp: row.hp ?? getPlayerMaxHp(row.level),
    equipment: normalizeEquipment(row.equipment ?? EMPTY_EQUIPMENT),
    npcInteractAt: normalizeNpcInteractAt(row.npc_interact_at),
    mobGoldClaimed: normalizeMobGoldClaimed(row.mob_gold_claimed),
    knockedOutUntil: normalizeKnockedOutUntil(row.knocked_out_until),
    skills: normalizeSkills(row.skills),
    stamina: row.stamina === null ? STARTING_STAMINA : clampStamina(row.stamina),
    vipPassUntil: normalizeKnockedOutUntil(row.vip_pass_until),
  };
}

function normalizeKnockedOutUntil(raw: string | number | null): number | null {
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "string" ? Number(raw) : raw;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeMobGoldClaimed(raw: Record<string, boolean> | null): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};

  const result: Record<string, boolean> = {};
  for (const [npcId, claimed] of Object.entries(raw)) {
    if (typeof npcId === "string" && claimed === true) {
      result[npcId] = true;
    }
  }
  return result;
}

function normalizeNpcInteractAt(raw: Record<string, number> | null): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};

  const result: Record<string, number> = {};
  for (const [npcId, timestamp] of Object.entries(raw)) {
    if (typeof npcId === "string" && typeof timestamp === "number" && Number.isFinite(timestamp)) {
      result[npcId] = timestamp;
    }
  }
  return result;
}

function normalizeQuestProgress(raw: QuestProgress | null): QuestProgress {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_QUEST_PROGRESS };
  }

  return {
    active: Array.isArray(raw.active) ? raw.active.filter((id) => typeof id === "string") : [],
    objectiveIndex:
      raw.objectiveIndex && typeof raw.objectiveIndex === "object" ? { ...raw.objectiveIndex } : {},
    completed: Array.isArray(raw.completed)
      ? raw.completed.filter((id) => typeof id === "string")
      : [],
  };
}