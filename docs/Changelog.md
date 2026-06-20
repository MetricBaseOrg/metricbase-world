# Changelog

All notable changes to **MetricBase World** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Slime Grotto (`zone_grotto`)** — Third zone reachable from Wilderness portal (22, 14). Moss NPC offers grotto quests; **Slime Brute** boss (150 HP, 12 counter damage) drops **Slime Core** (sell at Pip for 25g).
- **Grotto quest chain** — "Into the Grotto" (visit zone) and "Brute Force" (defeat Slime Brute), continuing after the slime commendation line.
- **Slime Core item** — New material loot from the Slime Brute.
- **Mobile quest log** — Floating action button opens a bottom sheet quest panel on small screens; desktop keeps the HUD quest card.

### Fixed

- **Death overlay countdown** — Knockout timer now appears immediately on defeat without a browser refresh. Server sets `knockedOutUntil` before profile/damage messages; `playerDamage` includes `knockedOut` + `freeRespawnAt`; client `applyProfilePatch()` preserves knockout state on partial updates.

### Added (prior unreleased)

- **Knockout respawn** — Player HP reaching 0 triggers knockout. Pay **100 gold** to respawn now or wait **30 minutes**. Death overlay with live countdown; movement and combat blocked while knocked out. `knocked_out_until` persisted on characters.
- **Sound effects** — Procedural Web Audio SFX for combat hits, shop, market, inventory, chat, quests, and level-up. HUD mute toggle (🔊/🔇).
- **Slime hunting content** — Wild Slime mob in Wilderness; Slime Gel loot; quest chain from Rook (Slime Patrol → Gel Collection → Commendation). Commendation rewards **Gel-Edged Knife** (+8 damage).
- **Combat polish** — Slime sprite, floating damage numbers, out-of-combat HP regen, player hurt SFX.
- **Training dummy gold once** — Dummy gold reward granted only on **first kill per character** (`mob_gold_claimed` JSONB on characters).
- **NPC interact XP cooldown** — Shop/merchant XP from talking to NPCs limited to **once per 24 hours** per player+NPC (`npc_interact_at` on characters).
- **Open gold market (MetricBase SPL)** — Pip's **Gold Market** tab is a public order book. Players post bids (buy gold) and offers (sell gold); tokens settle peer-to-peer between wallets. Server verifies on-chain transfers and moves escrowed gold.
- **Merchant shop (Pip)** — Press **E** near Pip in the Hub to open his shop. Buy health potions and a rusty blade with gold; sell training scrap, slime gel, and slime core. Gold persists in Postgres and shows in the HUD.
- **Soft currency (gold)** — New players start with 25 gold. Earn more from quests, combat, and selling items.
- **Starter quests** — Quest log UI with persisted `quest_progress` JSONB. Full Aria starter chain through Veteran Adventurer.
- **Training dummy combat** — Attack hostile NPCs with **Space**. Server-authoritative damage, HP bars, respawn timer, and XP on defeat.
- **Inventory and loot** — 16-slot inventory, weapon equip, health potion use. Mob loot tables in `mobRewards.ts`.
- **Zone NPCs** — Hub guide (Aria), merchant (Pip), wilderness scout (Rook), grotto warden (Moss).
- **XP progression** — Earn XP from NPC conversations (cooldown), portal travel, quests, and combat. Level-ups broadcast to the zone.
- **Leave World** button — disconnects cleanly and returns to the login screen (character saved on leave).

### Fixed (prior unreleased)

- **Market cancel loses gold** — SQL CTE now returns pre-cancel `escrow_gold`; service refunds correctly.
- **Character missing after Leave World and rejoin** — Listeners receive current room snapshot on subscribe; game view mounts before connecting.
- **Character keeps moving after releasing WASD** — Client sends `{ dx: 0, dy: 0 }` on key release; local position snaps when idle.

### Changed

- Production client URL updated to **https://world.metricbase.org**.
- Three zone rooms registered: `zone_hub`, `zone_wilderness`, `zone_grotto`.

---

## [0.1.2] — 2026-06-20

### Fixed

- **Chat input blocked by movement keys** — Phaser was capturing W/A/S/D globally for movement, preventing those letters from appearing in the chat box. Added `inputControl.ts` to disable Phaser keyboard input while the chat field is focused.

### Changed

- Added `docs/Game.md` and `docs/Changelog.md`.

---

## [0.1.1] — 2026-06-20

### Fixed

- **Join Zone silently failing** — Client connected to Colyseus but did not register room state schemas, leaving `room.state.players` undefined and crashing before the game view loaded. Moved `PlayerSchema` and `ZoneState` to `shared/` and pass `ZoneState` into `joinOrCreate()`.
- **No feedback on failed login** — Login overlay now shows a "Connecting…" state and displays error messages when the server connection fails.

### Changed

- Colyseus schemas moved from `server/src/schema/` to `shared/src/schema/` so client and server share identical state definitions.
- `@colyseus/schema` added as a dependency of `@metricbase/shared`.

### Deployed

- Vercel production env vars configured:
  - `VITE_SERVER_URL=wss://metricbaseserver-production.up.railway.app`
  - `VITE_SERVER_HTTP_URL=https://metricbaseserver-production.up.railway.app`
- Railway game server public domain: `metricbaseserver-production.up.railway.app`
- Client live at: https://world.metricbase.org

---

## [0.1.0] — 2026-06-20

Initial playable prototype (Milestone 1 / Phase 0–1 foundation).

### Added

#### Monorepo & tooling

- pnpm workspace with three packages: `client/`, `server/`, `shared/`
- Root scripts: `dev`, `build`, `typecheck`, `vercel-build`, `verify-deploy`
- `pnpm-workspace.yaml` `allowBuilds` for `esbuild` and `msgpackr-extract` (pnpm v11 native-build policy)
- `PLAN.md` — full long-term game and architecture design document
- `README.md` — local dev and deployment guide
- `.env.example` — environment variable template

#### Client (`@metricbase/client`)

- Phaser 3 isometric renderer with procedurally generated tileset and player sprites
- `BootScene` — texture generation; `GameScene` — tilemap render, camera follow, player rendering
- WASD + arrow key movement with camera tracking
- React UI layer: login overlay, HUD (zone, status, player count), zone chat panel
- Zustand store for player name, level, connection state, and chat messages
- `NetworkManager` — Colyseus client wrapper for join, input, chat, and zone transfer
- Client-side movement prediction and server reconciliation (`prediction.ts`)
- `serverUrl.ts` — resolves `VITE_SERVER_URL` / `VITE_SERVER_HTTP_URL` from env
- Character auto-rejoin: looks up saved zone via HTTP before WebSocket join

#### Server (`@metricbase/server`)

- Express HTTP server with CORS enabled
- Colyseus WebSocket server with `WebSocketTransport`
- `ZoneRoom` — authoritative 20 Hz movement tick, collision, chat, portal transfers
- Two zone rooms: `zone_hub` (MetricBase Hub) and `zone_wilderness` (Wilderness)
- Rate-limited zone chat with system join/leave messages
- `GET /api/character?name=…` — character lookup for login rejoin
- `GET /health` — deployment health check
- PostgreSQL persistence via Neon (`characters` table: name, zone, x, y, level)
- `db:init` script to apply `schema.sql`
- `normalizeDatabaseUrl()` for Neon SSL connection strings

#### Shared (`@metricbase/shared`)

- Isometric constants: tile size (64×32), map size (24×24), player speed, tick rate
- `tileToWorld()` / `worldToTile()` coordinate helpers
- Zone configs with spawn points and portal definitions
- Tile layer data for Hub and Wilderness maps
- Protocol types: `JoinOptions`, `ChatMessagePayload`, `ZoneTransferPayload`, `CharacterLookupResponse`
- Colyseus Schema v3 definitions (`schema()` API) for `PlayerSchema` and `ZoneState`

#### Deployment

- `vercel.json` — pnpm install, client build, SPA rewrites
- `railway.toml` — builds shared + server, starts `node server/dist/index.js`, health check on `/health`
- `scripts/verify-deploy.mjs` — smoke tests for Vercel HTML, Railway health, and character API

### Fixed (during initial build)

- **pnpm install `ERR_PNPM_IGNORED_BUILDS`** — added `allowBuilds` entries for native dependencies
- **Colyseus Schema v3 decorators** — replaced `@type()` decorators with `schema()` API (tsx does not apply decorators at runtime)
- **Neon SSL** — connection string normalization for `sslmode=require`
- **Port conflicts** — documented/local fix for stale server processes on port 2567

### Infrastructure

- **Vercel** — hosts static client (`metricbase/metricbase-world`)
- **Railway** — hosts Colyseus game server (`triumphant-reflection` project, `@metricbase/server` service)
- **Neon** — PostgreSQL for character persistence

---

## [0.0.1] — 2026-06-20

### Added

- Initial repository commit
- Project scaffolding and `PLAN.md` design document