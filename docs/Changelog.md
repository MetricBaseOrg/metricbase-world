# Changelog

All notable changes to **MetricBase World** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Steel tier & yield tools** — A third tool tier that boosts **yield** instead of just speed. Temper **Steel Bars** (2 Iron Bar + 1 Hardwood Plank) at the forge, then craft a **Steel Axe**, **Steel Pickaxe**, or **Trawler's Net**. Each gathers **50% faster** (matching iron) *and* has a **40% chance to drop a bonus resource** per gather (`yieldBonus` on `TOOL_GATHER`, rolled server-side in `completeChop`; "bonus haul!" shows in the gather log). Pip buys steel bars for 48g. Ties the whole gather chain together: steel needs iron (mining) + hardwood planks (woodcutting), and the net feeds fishing.
- **Party combat bonuses** — Fighting alongside your party now pays off. When a partied player lands the killing blow on a mob, every other party member in the same zone within ~5 tiles counts as a nearby ally: the finisher earns **+15% kill XP per nearby ally** (capped at the party max), and each nearby ally earns **50% of the base kill XP as assist XP** plus **shared credit toward their own "defeat" quest objectives**. Fully server-authoritative; surfaced as `assisted vs …` system lines and a hint in the 🎉 party panel.
- **Parties** — Invite a player by name (🎉 panel) to form a transient party of up to 4. Invitees get an accept/decline banner; members see a live roster (leader 👑) and share a **party chat** channel. Parties are in-memory and cross-zone (delivered via the presence bus); leaving or disconnecting reassigns the leader or disbands a party that drops below two.
- **Guild & party chat** — The chat box has a channel toggle (Zone / Guild / Party) and tints `[Guild]`/`[Party]` lines; messages reach members in any zone.
- **Guilds** — Found a guild for **1000 gold** (a new sink) with a name and a 2–4 char tag, or join an existing one, from the 🛡️ panel. Your guild **tag shows on your nameplate** (`[TAG] Name`) for everyone in the world. The panel lists your roster (leader marked 👑) and browsable guilds to join; leaving hands off leadership or disbands an empty guild. Persisted in a new `guilds` table via a process-global registry (memberships survive restarts). _Guild chat is a planned follow-up._
- **Walk-in interiors — Community Lodge** — A new indoor zone (`zone_interior`) you enter through a doorway NW of the hub plaza. It's a real networked Colyseus room: other players inside are visible and you can walk around together, greeted by Hearth the lodge keeper. Step on the south doormat to head back out. Built on the existing zone/portal/transfer rails (new zone config + interior map builder + room define) — no new networking. The lodge is furnished via a new reusable zone **scenery** system (fireplace, bookshelves, plants, tables, chairs, and a central rug) — decorative props that depth-sort with players (rugs render flat underfoot).
- **Housing depth — plot decorations** — Plot owners can place props (Lamp Post, Flower Bed, Topiary, Barrel) on each of their plot's four corners from the 🏠 panel. Decorations render in-world for everyone and persist per plot (new `decor` JSONB column, auto-migrated). Owner-only, server-validated (slot + prop id).
- **Housing depth — shop signage** — Plot owners can name their building (up to 20 chars) in the 🏠 panel; the custom sign shows on the in-world plot label and as the player-shop title for everyone. Persists on the plot (`sign` column, auto-migrated); server sanitizes + length-caps and validates ownership.
- **Housing depth — roof paint** — Plot owners can repaint their house or shop roof from a 6-colour palette (Sky/Rose/Leaf/Plum/Teal/Amber) in the 🏠 plot panel. The choice persists on the plot (new `roof` column, auto-migrated) and everyone sees the recoloured building — rendered as art-consistent roof-colour variants (walls/awning unchanged), not a flat tint. Owner-only, validated server-side.
- **Farm plots persist** — Planted crops now survive server restarts. Farm state moved from per-room memory to a process-global registry backed by a new `farm_plots` table (auto-migrated via `schema.sql`); growth is time-based (`planted_at`/`ready_at` epoch millis), so a crop keeps maturing while the server is down and is ripe when you return. Plant writes a row, harvest deletes it. Mirrors the land-plot / sell-pressure persistence pattern.
- **Tier-2 woodcutting & fishing** — **Hardwood** trees and **Deep Pool** salmon spots in the Wilderness (require **Woodcutting 3** / **Fishing 3**), giving all three gather skills a second tier. Hardwood mills into **Hardwood Planks**; **Prized Salmon** grills into **Grilled Salmon** (+60 HP). The new **Angler's Pro Rod** (hardwood plank + iron bar) is the missing tier-2 fishing tool — **50% faster** catches — and ties woodcutting + mining + fishing into one craft. Pip buys hardwood (12g) and salmon (16g); tier-2 nodes are tinted (deep-green hardwood, rosy deep pools).
- **Iron tier** — Higher-level **Iron Deposits** (rock nodes) in the Wilderness require **Mining 3** and drop **Iron Ore**. Smelt it into **Iron Bars**, then forge an **Iron Axe** or **Iron Pickaxe** that gather **50% faster** (vs. 30% for copper tools). Pip buys iron ore (18g) and bars (30g). Iron deposits render with a cold steel-blue tint to stand apart from copper rocks.
- **Tools & gather-speed progression** — Craft a **Copper Axe**, **Copper Pickaxe**, or **Sturdy Fishing Rod** (planks + copper bars at the workbench). Equip one into the new **tool slot** (separate from your weapon) to gather its matching resource **30% faster**. Tool choice persists with your character (JSONB `equipment`, no migration). Shown in the HUD (🛠️) and Inventory.
- **Leaderboard** — 🏆 panel (top-centre) with top-10 by combat **Level**, **Richest** (gold), and total **Skills** (sum of gather levels). DB-backed, cached 60s, probe accounts filtered.
- **Player-run shops** — Build a **Shop**, stock items from your inventory at your own prices; visitors buy (quantity / buy-all, server partial-fills). Sales accrue plot **earnings** the owner collects on a visit. Listings + earnings persisted as JSONB on `land_plots`.
- **Housing** — Buy a 3x3 land plot with **500 gold** (a major gold sink) and build a **house** or **shop**; ownership persists with your name on it. Built structures are solid (3x3 collision); empty plots stay walkable.
- **Community** — **Emotes** (😀 tray → emoji bubble broadcast to the zone), a **/who online roster** (names + levels), and a hub **billboard** showing the live on-chain **$BASE holder count** + players online.
- **World remap** — Hand-authored hub with themed regions (NW forest, W quarry, central plaza, NE neighbourhood, SW farmland, **SE lake**). **Water is impassable** — fishing spots sit on the lake, fished from the shore. Wilderness gains a river with crossings; grotto gains pools.
- **Everyday loop — Gather/Craft/Farm** — Mining (Copper Ore), Fishing (River Fish), and Farming (plant → grow → harvest) join Woodcutting; **Crafting** panel (**C** / 🔨) turns materials into planks, bars, food, and a copper dagger.
- **Economy sustainability** — Dynamic vendor prices (supply saturation decays over time, 40% floor) cap the gold faucet; sinks = crafting forge fees, 4% market fee, 500g land plots.
- **OG social card** — `client/public/metricbase-world.png` wired as the `og:`/`twitter:` preview image.
- **Slime Grotto (`zone_grotto`)** — Third zone reachable from Wilderness portal (22, 14). Moss NPC offers grotto quests; **Slime Brute** boss (150 HP, 12 counter damage) drops **Slime Core** (sell at Pip for 25g).
- **Grotto quest chain** — "Into the Grotto" (visit zone) and "Brute Force" (defeat Slime Brute), continuing after the slime commendation line.
- **Slime Core item** — New material loot from the Slime Brute.
- **Mobile quest log** — Floating action button opens a bottom sheet quest panel on small screens; desktop keeps the HUD quest card.

### Changed

- **Isometric buildings + depth sorting** — Houses/shops/farms/plots are true iso art (gable roofs); scenery, players, and NPCs depth-sort by world Y, so you're occluded behind tall objects (e.g. the billboard).

### Fixed

- **HUD duplicate** — Removed the redundant player-count pill from the HUD (the online roster owns it now); kept the connection status badge.
- **Gold market on Token-2022** — `$BASE` is a Token-2022 mint; payments use the Token-2022 program + checked transfers (fixes the "wrong amount / IncorrectProgramId" failures).
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