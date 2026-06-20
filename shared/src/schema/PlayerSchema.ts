import { schema } from "@colyseus/schema";

export const PlayerSchema = schema({
  sessionId: "string",
  name: "string",
  x: "number",
  y: "number",
  level: "number",
  xp: "number",
});

export type Player = InstanceType<typeof PlayerSchema>;