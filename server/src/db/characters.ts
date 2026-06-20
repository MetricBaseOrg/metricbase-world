import {
  EMPTY_INVENTORY,
  EMPTY_QUEST_PROGRESS,
  normalizeCharacterAppearance,
  normalizeInventory,
  type CharacterAppearance,
  type InventoryEntry,
  type QuestProgress,
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
  questProgress: QuestProgress;
  appearance: CharacterAppearance;
  inventory: InventoryEntry[];
}

type CharacterRow = {
  name: string;
  wallet_address: string | null;
  zone_id: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  quest_progress: QuestProgress | null;
  appearance: CharacterAppearance | null;
  inventory: InventoryEntry[] | null;
};

export async function loadCharacterByName(name: string): Promise<CharacterRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<CharacterRow>(
    `SELECT name, wallet_address, zone_id, x, y, level, xp, quest_progress, appearance, inventory
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
    `SELECT name, wallet_address, zone_id, x, y, level, xp, quest_progress, appearance, inventory
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
    `INSERT INTO characters (name, wallet_address, zone_id, x, y, level, xp, quest_progress, appearance, inventory, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, NOW())
     ON CONFLICT (name)
     DO UPDATE SET
       wallet_address = COALESCE(EXCLUDED.wallet_address, characters.wallet_address),
       zone_id = EXCLUDED.zone_id,
       x = EXCLUDED.x,
       y = EXCLUDED.y,
       level = EXCLUDED.level,
       xp = EXCLUDED.xp,
       quest_progress = EXCLUDED.quest_progress,
       appearance = EXCLUDED.appearance,
       inventory = EXCLUDED.inventory,
       updated_at = NOW()`,
    [
      record.name,
      record.walletAddress,
      record.zoneId,
      record.x,
      record.y,
      record.level,
      record.xp,
      JSON.stringify(record.questProgress),
      JSON.stringify(record.appearance),
      JSON.stringify(record.inventory),
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
    questProgress:
      existingByWallet?.questProgress ??
      existingByName?.questProgress ??
      { active: [], objectiveIndex: {}, completed: [] },
    appearance,
    inventory: existingByWallet?.inventory ?? existingByName?.inventory ?? [],
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
    questProgress: normalizeQuestProgress(row.quest_progress),
    appearance: normalizeCharacterAppearance(row.appearance),
    inventory: normalizeInventory(row.inventory ?? EMPTY_INVENTORY),
  };
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