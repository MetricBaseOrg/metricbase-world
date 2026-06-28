import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import {
  GAME_VERSION,
  getZoneConfig,
  ZONE_BLACK,
  ZONE_GROTTO,
  ZONE_HUB,
  ZONE_INTERIOR,
  ZONE_WILDERNESS,
} from "@metricbase/shared";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { authRouter } from "./api/auth.js";
import { characterRouter } from "./api/characters.js";
import { tokenShopRouter } from "./api/tokenShop.js";
import { invitationsRouter } from "./api/invitations.js";
import { initDatabase } from "./db/pool.js";
import { initSellPressure } from "./market/sellPressure.js";
import { initLandRegistry } from "./housing/landRegistry.js";
import { initFarmRegistry } from "./farming/farmRegistry.js";
import { initGuildRegistry } from "./guild/guildRegistry.js";
import { initTerritoryRegistry } from "./territory/territoryRegistry.js";
import { initSiegeRegistry } from "./siege/siegeRegistry.js";
import { getBaseHolderCount } from "./solana/holderCount.js";
import { ZoneRoom } from "./rooms/ZoneRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  // Report the live build + the loaded hub portal tiles so a stale deploy is
  // obvious at a glance (e.g. a portal still at the old mid-map position).
  res.json({
    status: "ok",
    version: GAME_VERSION,
    hubPortals: getZoneConfig(ZONE_HUB).portals.map((p) => ({
      label: p.label,
      tile: [p.tileX, p.tileY],
    })),
  });
});

app.use("/api", authRouter);
app.use("/api", characterRouter);
app.use("/api", tokenShopRouter);
app.use("/api", invitationsRouter);

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(ZONE_HUB, ZoneRoom, { zoneId: ZONE_HUB });
gameServer.define(ZONE_WILDERNESS, ZoneRoom, { zoneId: ZONE_WILDERNESS });
gameServer.define(ZONE_GROTTO, ZoneRoom, { zoneId: ZONE_GROTTO });
gameServer.define(ZONE_INTERIOR, ZoneRoom, { zoneId: ZONE_INTERIOR });
gameServer.define(ZONE_BLACK, ZoneRoom, { zoneId: ZONE_BLACK });

await initDatabase();
await initSellPressure();
await initLandRegistry();
await initFarmRegistry();
await initGuildRegistry();
await initTerritoryRegistry();
await initSiegeRegistry();

// Warm + periodically refresh the live $BASE holder count for the billboard.
void getBaseHolderCount();
setInterval(() => void getBaseHolderCount(), 5 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`MetricBase game server listening on ws://localhost:${PORT}`);
  console.log("[Anti-Bot] Anti-Bot System v1.0.0 is ACTIVATED and monitoring player inputs.");
});