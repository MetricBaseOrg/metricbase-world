// Deploy marker: 0.106.5 — single-session enforcement (kick a character's old session on new login).
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import {
  BLACK_ZONE_BURN_AMOUNT,
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
import { getPool, initDatabase } from "./db/pool.js";
import { initSellPressure } from "./market/sellPressure.js";
import { initLandRegistry } from "./housing/landRegistry.js";
import { initZoneRegistry } from "./zones/zoneRegistry.js";
import { initAssetInventory } from "./zones/assetInventory.js";
import { initAssetMarket } from "./zones/assetMarket.js";
import { initJobs } from "./jobs/jobRegistry.js";
import { ensureMetricFloor, initMetrics } from "./economy/metrics.js";
import { initFarmRegistry } from "./farming/farmRegistry.js";
import { initGuildRegistry } from "./guild/guildRegistry.js";
import { initTerritoryRegistry } from "./territory/territoryRegistry.js";
import { initSiegeRegistry } from "./siege/siegeRegistry.js";
import { adService } from "./ads/adService.js";
import { getBaseHolderCount } from "./solana/holderCount.js";
import { ZoneRoom } from "./rooms/ZoneRoom.js";
import { buildStats, statsRouter } from "./api/stats.js";
import { brandsRouter } from "./api/brands.js";
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
app.use("/api", brandsRouter);
// /stats is server-rendered with the live headline numbers baked into the
// initial HTML (JS then keeps them fresh). Crawlers and game-discovery agents
// (e.g. solgames.buzz) see real player counts instead of "—" placeholders.
let statsHtmlCache: { html: string; at: number } = { html: "", at: 0 };
app.get("/stats", async (_req, res) => {
  try {
    if (Date.now() - statsHtmlCache.at > 20_000) {
      const s = await buildStats();
      const fill = (html: string, id: string, value: string) =>
        html.replace(new RegExp(`(id="${id}"[^>]*>)[^<]*(<)`), `$1${value}$2`);
      const n = (v: number) => Math.round(v).toLocaleString("en-US");
      let html = STATS_PAGE_HTML;
      html = fill(html, "onlineTop", n(s.players.online));
      html = fill(html, "ver", `v${s.version}`);
      html = fill(html, "registered", n(s.players.registered));
      html = fill(html, "online", n(s.players.online));
      html = fill(html, "circulating", `${n(s.players.circulatingGold)}g`);
      html = fill(html, "worlds", n(s.worlds.total));
      html = fill(html, "treasury", `${n(s.treasury.total)}g`);
      html = fill(html, "baseBurned", `${n(s.baseToken.burned)} $BASE`);
      html = fill(html, "baseHeld", `${n(s.baseToken.heldByPlayers)} $BASE`);
      html = fill(html, "adRevenue", `${n(s.ads.totalRevenue)} $BASE`);
      html = fill(html, "adImpr", n(s.ads.totalImpressions));
      html = fill(html, "dqActive", n(s.dailyQuests.activeToday));
      html = fill(html, "wVisits", n(s.worlds.visits));
      statsHtmlCache = { html, at: Date.now() };
    }
    res.type("html").send(statsHtmlCache.html);
  } catch {
    res.type("html").send(STATS_PAGE_HTML);
  }
});

const httpServer = createServer(app);

const gameServer = new Server({
  // Colyseus's ws-transport defaults maxPayload to 4KB, which is smaller than a
  // World build save (tiles + scenery + resources as JSON). An oversized frame
  // makes `ws` terminate the connection mid-save — the room drops the client and
  // the online counter flips to 0. Raise the limit; builds are already bounded
  // by sanitizeBuild (grid size), so a few MB is safe headroom.
  transport: new WebSocketTransport({ server: httpServer, maxPayload: 4 * 1024 * 1024 }),
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
await initJobs();
await initMetrics();
// Backfill lifetime metrics that predate the tracking system from durable
// character state, so /stats reflects history rather than starting at zero.
// Only metrics with an exact durable source are reconstructed (fabricating the
// rest — gather/craft/sell/etc., which have no per-event log — would be
// dishonest on a transparency dashboard). Idempotent: ensureMetricFloor never
// lowers a value, so this is safe on every boot and won't double-count.
try {
  const pool = getPool();
  if (pool) {
    // $BASE burned: each lifetime Black Zone pass is a one-time BLACK_ZONE_BURN_AMOUNT burn.
    const bp = await pool.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM characters WHERE black_pass = true");
    await ensureMetricFloor("base.burned", (bp.rows[0]?.n ?? 0) * BLACK_ZONE_BURN_AMOUNT);
    // Quests completed: durably stored per character in quest_progress.completed.
    const q = await pool.query<{ n: number }>(
      "SELECT COALESCE(SUM(jsonb_array_length(COALESCE(quest_progress->'completed','[]'::jsonb))),0)::int AS n FROM characters",
    );
    await ensureMetricFloor("quest.completed", q.rows[0]?.n ?? 0);
    // PvP kills: durably stored per character (current season is a safe floor).
    const pv = await pool.query<{ n: number }>("SELECT COALESCE(SUM(pvp_kills),0)::int AS n FROM characters");
    await ensureMetricFloor("pvp.kills", pv.rows[0]?.n ?? 0);
  }
} catch (error) {
  console.warn("[startup] metric backfill failed:", error);
}
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