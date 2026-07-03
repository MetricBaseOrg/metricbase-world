import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import {
  GAME_VERSION,
  getZoneConfig,
  PLAYER_ZONE_ROOM,
  ZONE_BLACK,
  ZONE_GROTTO,
  ZONE_HUB,
  ZONE_INTERIOR,
  ZONE_JAIL,
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
import { initZoneRegistry } from "./zones/zoneRegistry.js";
import { initAssetInventory } from "./zones/assetInventory.js";
import { initAssetMarket } from "./zones/assetMarket.js";
import { initFarmRegistry } from "./farming/farmRegistry.js";
import { initGuildRegistry } from "./guild/guildRegistry.js";
import { initTerritoryRegistry } from "./territory/territoryRegistry.js";
import { initSiegeRegistry } from "./siege/siegeRegistry.js";
import { adService } from "./ads/adService.js";
import { getBaseHolderCount } from "./solana/holderCount.js";
import { ZoneRoom } from "./rooms/ZoneRoom.js";
import { statsRouter } from "./api/stats.js";
import { STATS_PAGE_HTML } from "./api/statsPage.js";

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
app.use("/api", statsRouter);
app.get("/stats", (_req, res) => res.type("html").send(STATS_PAGE_HTML));

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(ZONE_HUB, ZoneRoom, { zoneId: ZONE_HUB });
gameServer.define(ZONE_WILDERNESS, ZoneRoom, { zoneId: ZONE_WILDERNESS });
gameServer.define(ZONE_GROTTO, ZoneRoom, { zoneId: ZONE_GROTTO });
gameServer.define(ZONE_INTERIOR, ZoneRoom, { zoneId: ZONE_INTERIOR });
gameServer.define(ZONE_BLACK, ZoneRoom, { zoneId: ZONE_BLACK });
gameServer.define(ZONE_JAIL, ZoneRoom, { zoneId: ZONE_JAIL });
// One room type serves every player-owned zone; filterBy keeps each world's
// visitors in their own room instance (matched on the zoneId join option).
gameServer.define(PLAYER_ZONE_ROOM, ZoneRoom).filterBy(["zoneId"]);

await initDatabase();
await initSellPressure();
await initLandRegistry();
await initZoneRegistry();
await initAssetInventory();
await initAssetMarket();
await initFarmRegistry();
await initGuildRegistry();
await initTerritoryRegistry();
await initSiegeRegistry();
await adService.init();

// Warm + periodically refresh the live $BASE holder count for the billboard.
void getBaseHolderCount();
setInterval(() => void getBaseHolderCount(), 5 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`MetricBase game server listening on ws://localhost:${PORT}`);
  console.log("[Anti-Bot] Anti-Bot System v1.0.0 is ACTIVATED and monitoring player inputs.");
});