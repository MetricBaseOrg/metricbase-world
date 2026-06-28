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
});

export type Player = InstanceType<typeof PlayerSchema>;