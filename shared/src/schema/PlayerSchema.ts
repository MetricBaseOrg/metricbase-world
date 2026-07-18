import { schema } from "@colyseus/schema";

export const PlayerSchema = schema({
  sessionId: "string",
  name: "string",
  x: "number",
  y: "number",
  level: "number",
  xp: "number",
  bodyColor: "number",
  hairColor: "number",
  outfitColor: "number",
  hairStyle: "string",
  outfitStyle: "string",
  guildTag: "string",
  lampOn: "boolean",
  weaponId: "string",
  toolId: "string",
  spectator: "boolean",
  /** Opt-in PvP flag (required to fight in Yellow zones). */
  pvpFlagged: "boolean",
  /** Criminal status — shows a red name and bars Safe-zone entry. */
  criminal: "boolean",
  /** Movement-speed multiplier from the equipped mount (1 = base). */
  speedMult: "number",
  /** Equipped cosmetic pet item id ("" when none) — shown as a companion. */
  petId: "string",
  /** Public vitals — opponents can read HP/energy in PvP (synced each tick). */
  hp: "number",
  maxHp: "number",
  stamina: "number",
  /** Carrying a caravan cargo satchel — shown as a 📦 nameplate badge in PvP
   * zones (where the cargo drops on death), so haulers can be escorted or
   * intercepted. Reconciled with the active-run registry each tick. */
  hauling: "boolean",
});

export type Player = InstanceType<typeof PlayerSchema>;