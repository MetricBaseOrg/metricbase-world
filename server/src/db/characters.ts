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
  /** Lifetime Black Zone access from a one-time $BASE burn. */
  blackPass: boolean;
  /** PvP rating (Phase 6). */
  pvpRating: number;
  /** PvP kill count this season. */
  pvpKills: number;
  /** Season the rating/kills belong to (for lazy reset). */
  pvpSeason: number;
  /** Soft currency: PvP honor. */
  honor: number;
  /** Soft currency: guild coin. */
  guildCoin: number;
  /** Soft currency: premium gems. */
  gems: number;
  /** Bag expansion steps purchased with $BASE burns (0 = base 16 slots). */
  bagLevel: number;
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
  black_pass: boolean | null;
  pvp_rating: number | null;
  pvp_kills: number | null;
  pvp_season: number | null;
  honor: number | null;
  guild_coin: number | null;
  gems: number | null;
  bag_level: number | null;
};

export async function loadCharacterByName(name: string): Promise<CharacterRecord | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<CharacterRow>(
    `SELECT name, wallet_address, zone_id, x, y, level, xp, gold, quest_progress, appearance, inventory, hp, equipment, npc_interact_at, mob_gold_claimed, knocked_out_until, skills, stamina, vip_pass_until, black_pass, pvp_rating, pvp_kills, pvp_season
     , honor, guild_coin, gems, bag_level
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
    `SELECT name, wallet_address, zone_id, x, y, level, xp, gold, quest_progress, appearance, inventory, hp, equipment, npc_interact_at, mob_gold_claimed, knocked_out_until, skills, stamina, vip_pass_until, black_pass, pvp_rating, pvp_kills, pvp_season
     , honor, guild_coin, gems, bag_level
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

  // DATA-LOSS SAFEGUARD: XP is monotonic in this game (it never decreases).
  // The `WHERE EXCLUDED.xp >= characters.xp` guard makes a save that would
  // REGRESS a character's XP a no-op for the ENTIRE row — so if a player's
  // in-memory state ever fails to load and a near-default record is written,
  // it can't clobber their real progress (level, gold, inventory, skills,
  // gear all survive). A brand-new character (INSERT, no conflict) is
  // unaffected; normal play (equal or higher XP) always writes through.
  //
  // Gather-skill XP (mining/woodcutting/fishing/farming) is ALSO monotonic, but
  // combat XP and skill XP advance independently — a pure gathering session
  // raises skills while combat xp stays flat, so the xp guard passes at EQUAL
  // xp. If such a save carries a stale/empty skills map (a partial state load:
  // combat xp loaded but skills came back default), a blind `skills =
  // EXCLUDED.skills` overwrite would ZERO a player's trained skills. So skills
  // are merged with a per-skill GREATEST below: a save can never lower any
  // skill, mirroring the xp/level/bag_level protection. (This is what silently
  // reset gathering progress for players like "showot".)
  //
  // WALLET-CANONICAL IDENTITY: the save is located by the immutable, verified
  // WALLET (`ON CONFLICT (wallet_address)`), not the mutable display `name`, so a
  // save always lands on the right account row and a rename can never split or
  // orphan a character's data. `name` is NOT in the UPDATE SET (it's a display
  // label changed only by the dedicated rename flow), so a normal save never
  // rewrites it. Walletless rows (local/dev with the token gate off) fall back to
  // the legacy name conflict target.
  const conflictTarget = record.walletAddress ? "wallet_address" : "name";
  const result = await db.query(
    `INSERT INTO characters (name, wallet_address, zone_id, x, y, level, xp, gold, quest_progress, appearance, inventory, hp, equipment, npc_interact_at, mob_gold_claimed, knocked_out_until, skills, stamina, vip_pass_until, black_pass, pvp_rating, pvp_kills, pvp_season, honor, guild_coin, gems, bag_level, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17::jsonb, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())
     ON CONFLICT (${conflictTarget})
     DO UPDATE SET
       wallet_address = COALESCE(EXCLUDED.wallet_address, characters.wallet_address),
       zone_id = EXCLUDED.zone_id,
       x = EXCLUDED.x,
       y = EXCLUDED.y,
       level = GREATEST(characters.level, EXCLUDED.level),
       xp = GREATEST(characters.xp, EXCLUDED.xp),
       gold = EXCLUDED.gold,
       quest_progress = EXCLUDED.quest_progress,
       appearance = EXCLUDED.appearance,
       inventory = EXCLUDED.inventory,
       hp = EXCLUDED.hp,
       equipment = EXCLUDED.equipment,
       npc_interact_at = EXCLUDED.npc_interact_at,
       mob_gold_claimed = EXCLUDED.mob_gold_claimed,
       knocked_out_until = EXCLUDED.knocked_out_until,
       skills = jsonb_build_object(
         'woodcutting', GREATEST(COALESCE((characters.skills->>'woodcutting')::int, 0), COALESCE((EXCLUDED.skills->>'woodcutting')::int, 0)),
         'mining',      GREATEST(COALESCE((characters.skills->>'mining')::int, 0),      COALESCE((EXCLUDED.skills->>'mining')::int, 0)),
         'fishing',     GREATEST(COALESCE((characters.skills->>'fishing')::int, 0),     COALESCE((EXCLUDED.skills->>'fishing')::int, 0)),
         'farming',     GREATEST(COALESCE((characters.skills->>'farming')::int, 0),     COALESCE((EXCLUDED.skills->>'farming')::int, 0))
       ),
       stamina = EXCLUDED.stamina,
       vip_pass_until = COALESCE(EXCLUDED.vip_pass_until, characters.vip_pass_until),
       black_pass = characters.black_pass OR EXCLUDED.black_pass,
       pvp_rating = EXCLUDED.pvp_rating,
       pvp_kills = EXCLUDED.pvp_kills,
       pvp_season = EXCLUDED.pvp_season,
       honor = EXCLUDED.honor,
       guild_coin = EXCLUDED.guild_coin,
       gems = EXCLUDED.gems,
       bag_level = GREATEST(characters.bag_level, EXCLUDED.bag_level),
       updated_at = NOW()
     WHERE EXCLUDED.xp >= characters.xp
     RETURNING xp`,
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
      record.blackPass,
      record.pvpRating,
      record.pvpKills,
      record.pvpSeason,
      record.honor,
      record.guildCoin,
      record.gems,
      record.bagLevel,
    ],
  );

  // The guard rejected this save (incoming XP below stored) — a strong signal
  // that this player's in-memory state didn't load correctly. Loud-log it so
  // corruption is caught early instead of silently losing progress.
  if (result.rowCount === 0) {
    console.error(
      `[characters] BLOCKED regressive save for "${record.name}" ` +
        `(incoming xp=${record.xp}, level=${record.level}) — existing progress preserved. ` +
        `Investigate: this player's state may have failed to load.`,
    );
  }
}

export type RenameResult =
  | { ok: true; oldName: string; newName: string }
  | { ok: false; error: string };

/**
 * Rename a character (display name only — identity stays the immutable wallet).
 * Because a dozen tables reference players by the mutable name, this cascades
 * every reference to the new name in ONE transaction, so nothing is orphaned:
 * mail, jobs, guild leader + member/officer/request rosters, zone passes, world/
 * land ownership, farm plots, asset inventory/listings, pending gold, daily
 * state and market display. References are matched by the OLD name (unique,
 * case-insensitive) so both pre- and post-backfill rows are caught; the wallet
 * columns remain as the durable anchor. Callers MUST force the player to
 * reconnect afterwards so in-memory (name-keyed transient) state rebuilds.
 */
export async function renameCharacter(wallet: string, rawNewName: string): Promise<RenameResult> {
  const db = getPool();
  if (!db) return { ok: false, error: "Database unavailable." };
  const newName = rawNewName.trim();
  if (newName.length < 1 || newName.length > 16) return { ok: false, error: "Name must be 1–16 characters." };
  if (!/^[A-Za-z0-9_]+$/.test(newName)) return { ok: false, error: "Use only letters, numbers and underscores." };

  const current = await loadCharacterByWallet(wallet);
  if (!current) return { ok: false, error: "Character not found for this wallet." };
  const oldName = current.name;
  if (oldName === newName) return { ok: false, error: "That's already your name." };
  const clash = await findExistingNameCI(newName);
  if (clash && clash.toLowerCase() !== oldName.toLowerCase()) {
    return { ok: false, error: `That name is taken (as "${clash}").` };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Identity row keyed by the immutable wallet.
    await client.query("UPDATE characters SET name = $1, updated_at = NOW() WHERE wallet_address = $2", [newName, wallet]);
    // Plain name-reference columns (match by the unique old name, case-insensitive).
    const nameCols: Array<[string, string]> = [
      ["mail", "recipient"], ["mail", "sender"],
      ["jobs", "employer_name"], ["jobs", "worker_name"],
      ["zone_passes", "holder_name"], ["player_zones", "owner_name"],
      ["land_plots", "owner_name"], ["farm_plots", "planter_name"],
      ["asset_inventory", "player_name"], ["asset_listings", "seller_name"],
      ["pending_gold", "player_name"], ["daily_state", "player_name"],
      ["market_orders", "player_name"], ["guilds", "leader_name"],
      ["companies", "owner_name"], ["company_contracts", "poster_name"],
      ["share_holdings", "holder_name"], ["share_trades", "trader_name"],
    ];
    for (const [table, col] of nameCols) {
      await client.query(`UPDATE ${table} SET ${col} = $1 WHERE lower(${col}) = lower($2)`, [newName, oldName]);
    }
    // Guild JSON rosters: swap the old name for the new inside members/officers/join_requests.
    await client.query(
      `UPDATE guilds SET
         members       = COALESCE((SELECT jsonb_agg(CASE WHEN e = to_jsonb($2::text) THEN to_jsonb($1::text) ELSE e END) FROM jsonb_array_elements(members) e), '[]'::jsonb),
         officers      = COALESCE((SELECT jsonb_agg(CASE WHEN e = to_jsonb($2::text) THEN to_jsonb($1::text) ELSE e END) FROM jsonb_array_elements(officers) e), '[]'::jsonb),
         join_requests = COALESCE((SELECT jsonb_agg(CASE WHEN e = to_jsonb($2::text) THEN to_jsonb($1::text) ELSE e END) FROM jsonb_array_elements(join_requests) e), '[]'::jsonb)
       WHERE members @> to_jsonb(ARRAY[$2]::text[]) OR officers @> to_jsonb(ARRAY[$2]::text[]) OR join_requests @> to_jsonb(ARRAY[$2]::text[])`,
      [newName, oldName],
    );
    // Company JSON rosters + name-keyed maps (salaries, stats.contrib).
    await client.query(
      `UPDATE companies SET
         members       = COALESCE((SELECT jsonb_agg(CASE WHEN e = to_jsonb($2::text) THEN to_jsonb($1::text) ELSE e END) FROM jsonb_array_elements(members) e), '[]'::jsonb),
         managers      = COALESCE((SELECT jsonb_agg(CASE WHEN e = to_jsonb($2::text) THEN to_jsonb($1::text) ELSE e END) FROM jsonb_array_elements(managers) e), '[]'::jsonb),
         trainees      = COALESCE((SELECT jsonb_agg(CASE WHEN e = to_jsonb($2::text) THEN to_jsonb($1::text) ELSE e END) FROM jsonb_array_elements(trainees) e), '[]'::jsonb),
         join_requests = COALESCE((SELECT jsonb_agg(CASE WHEN e = to_jsonb($2::text) THEN to_jsonb($1::text) ELSE e END) FROM jsonb_array_elements(join_requests) e), '[]'::jsonb),
         salaries      = CASE WHEN salaries ? $2 THEN (salaries - $2) || jsonb_build_object($1, salaries->$2) ELSE salaries END,
         stats         = CASE WHEN stats->'contrib' ? $2
                              THEN jsonb_set(stats, '{contrib}', (stats->'contrib' - $2) || jsonb_build_object($1, stats->'contrib'->$2))
                              ELSE stats END
       WHERE members @> to_jsonb(ARRAY[$2]::text[]) OR join_requests @> to_jsonb(ARRAY[$2]::text[]) OR salaries ? $2 OR stats->'contrib' ? $2`,
      [newName, oldName],
    );
    await client.query("COMMIT");
    return { ok: true, oldName, newName };
  } catch (error) {
    await client.query("ROLLBACK");
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[characters] rename ${oldName} -> ${newName} failed:`, msg);
    // A unique-violation almost always means a stale/orphan row already holds the
    // target name in a PK table (asset_inventory/pending_gold/daily_state).
    return { ok: false, error: "Rename failed — that name may conflict with old data. Try another." };
  } finally {
    client.release();
  }
}

/**
 * Case-insensitive name probe — blocks visually-identical names ("pip" vs
 * "Pip") that would confuse mail, jobs, and pay-by-name flows. Returns the
 * existing exact spelling, or null.
 */
async function findExistingNameCI(name: string): Promise<string | null> {
  const db = getPool();
  if (!db) return null;
  const result = await db.query<{ name: string }>(
    "SELECT name FROM characters WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [name],
  );
  return result.rowCount ? result.rows[0].name : null;
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

  // No exact match: also reject names that only differ by letter case.
  if (!existingByName) {
    const similar = await findExistingNameCI(name);
    if (similar && similar !== name) {
      throw new CharacterBindingError(
        `That name is already taken (as "${similar}"). Pick another.`,
        "name_taken",
      );
    }
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
    blackPass: existingByWallet?.blackPass ?? existingByName?.blackPass ?? false,
    pvpRating: existingByWallet?.pvpRating ?? existingByName?.pvpRating ?? 1000,
    pvpKills: existingByWallet?.pvpKills ?? existingByName?.pvpKills ?? 0,
    pvpSeason: existingByWallet?.pvpSeason ?? existingByName?.pvpSeason ?? 0,
    honor: existingByWallet?.honor ?? existingByName?.honor ?? 0,
    guildCoin: existingByWallet?.guildCoin ?? existingByName?.guildCoin ?? 0,
    gems: existingByWallet?.gems ?? existingByName?.gems ?? 0,
    bagLevel: existingByWallet?.bagLevel ?? existingByName?.bagLevel ?? 0,
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

    // Brand-new name: reject case-only lookalikes of existing characters.
    const similar = await findExistingNameCI(name);
    if (similar && similar !== name) {
      throw new CharacterBindingError(
        `That name is already taken (as "${similar}"). Pick another.`,
        "name_taken",
      );
    }
    return null;
  }

  // No wallet on the join (token gate off / spectators): never hand out a
  // character that belongs to a bonded wallet, and never let a new walletless
  // player squat an existing name.
  const byName = await loadCharacterByName(name);
  if (byName?.walletAddress) {
    throw new CharacterBindingError(
      "That name belongs to a bonded character — connect its wallet to play it.",
      "name_taken",
    );
  }
  if (byName) return byName;
  const similar = await findExistingNameCI(name);
  if (similar) {
    throw new CharacterBindingError(
      `That name is already taken (as "${similar}"). Pick another.`,
      "name_taken",
    );
  }
  return null;
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
    blackPass: row.black_pass === true,
    pvpRating: row.pvp_rating ?? 1000,
    pvpKills: row.pvp_kills ?? 0,
    pvpSeason: row.pvp_season ?? 0,
    honor: row.honor ?? 0,
    guildCoin: row.guild_coin ?? 0,
    gems: row.gems ?? 0,
    bagLevel: row.bag_level ?? 0,
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