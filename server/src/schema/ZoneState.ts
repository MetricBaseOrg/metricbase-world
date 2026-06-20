import { schema } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";

export const ZoneState = schema({
  players: { map: PlayerSchema },
});

export type ZoneStateInstance = InstanceType<typeof ZoneState>;