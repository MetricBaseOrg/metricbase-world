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
  zoneId: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  questProgress: QuestProgress;
  appearance: CharacterAppearance;
  inventory: InventoryEntry[];
}

export async function loadCharacter(name: string): Promise<CharacterRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<{
    name: string;
    zone_id: string;
    x: number;
    y: number;
    level: number;
    xp: number;
    quest_progress: QuestProgress | null;
    appearance: CharacterAppearance | null;
    inventory: InventoryEntry[] | null;
  }>(
    `SELECT name, zone_id, x, y, level, xp, quest_progress, appearance, inventory
     FROM characters
     WHERE name = $1`,
    [name],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    name: row.name,
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

export async function saveCharacter(record: CharacterRecord): Promise<void> {
  const db = getPool();
  if (!db) return;

  await db.query(
    `INSERT INTO characters (name, zone_id, x, y, level, xp, quest_progress, appearance, inventory, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, NOW())
     ON CONFLICT (name)
     DO UPDATE SET
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