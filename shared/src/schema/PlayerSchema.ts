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
});

export type Player = InstanceType<typeof PlayerSchema>;