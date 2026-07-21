# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Run both client and server concurrently (recommended)
pnpm dev

# Run individually
pnpm dev:client    # Vite dev server on http://localhost:5173
pnpm dev:server    # Game server on ws://localhost:2567

# Build
pnpm build         # All packages
pnpm build:client  # Client only (Vercel deploy uses this)

# Type checking
pnpm typecheck

# Database
pnpm --filter @metricbase/server run db:init  # Health-check write/read against live DB
```

There are no automated tests. The server (`tsx watch`) hot-reloads on file changes. The client uses Vite HMR.

## Architecture

**pnpm monorepo** with three packages:

- `client/` — Phaser 3 game + React UI (TypeScript, Vite)
- `server/` — Node.js + Colyseus authoritative game server + Express REST API (TypeScript, tsx)
- `shared/` — Types, constants, and game logic imported by both sides (`@metricbase/shared`)

### Data flow

```
Browser
  └─ React UI (Zustand store: useGameStore)
       └─ App.tsx wires NetworkManager events → store
  └─ Phaser 3 (GameScene)
       └─ reads networkManager for player positions, mobs, zone
  └─ NetworkManager (singleton, client/src/game/network.ts)
       └─ Colyseus client SDK ↔ ZoneRoom (server)
       └─ fetch() ↔ Express REST API (/api/...)
```

### Server

`server/src/rooms/ZoneRoom.ts` is the core. One `ZoneRoom` instance per active zone (hub, wilderness, grotto, interior lodge — interiors are ordinary zones reached by portals, furnished via the `scenery` field in `zones.ts`). It:
- Runs an authoritative tick loop at `TICK_RATE` (defined in shared)
- Handles messages: `input`, `chat`, `interact`, `attack`, `chop` (gather any resource node), `farmInteract`, `useItem`, `equipItem`, `craft`, `shopBuy`, `shopSell`, `marketPlace/Cancel/FillAsk/AcceptBid/PayBid/Refresh`, `housingBuy`, `shopStock`/`shopUnstock`/`shopBuyListing`/`shopCollect` (player-run shops), `emote`, `requestLeaderboard`, `linkWallet`, `requestRespawn`. Broadcasts `worldStats` (holder count + online) on join/leave + each minute.
- Persists characters to PostgreSQL on leave, portal transfer, and after significant events
- Tracks per-player state in Maps (inventories, gold, quest progress, wallets, gather-skill XP) keyed by player name
- Process-global registries persist across rooms + restarts: land plots / player shops (`housing/landRegistry.ts`), vendor sell-pressure (`market/sellPressure.ts`), planted farm plots (`farming/farmRegistry.ts` → `farm_plots` table), guilds (`guild/guildRegistry.ts` → `guilds` table; members carry the guild tag on `PlayerSchema.guildTag`, set in `onJoin`). Transient (in-memory, no DB): parties (`social/partyRegistry.ts`)
- Cross-zone social delivery: `social/presence.ts` maps online player name → a send fn bound to their current room's client (set in `onJoin`, cleared in `onLeave`). Guild/party chat + party invites/state route through it, so members in different zones still receive them.

REST API (`/api`):
- `authRouter` — Solana wallet challenge/verify, returns JWT access token
- `characterRouter` — character lookup by name or wallet
- `tokenShopRouter` — buy game gold/items with on-chain SPL token transfers

Database is optional: without `DATABASE_URL`, characters don't persist (logged on startup).

### Client

`GameScene.ts` (Phaser): renders the isometric tilemap, NPCs with HP bars, and player sprites. Applies client-side prediction for local movement (`prediction.ts`) and interpolates remote players. Sends input direction each frame only when it changes.

`network.ts`: `NetworkManager` singleton wraps Colyseus SDK. All server messages route through typed listener sets. Zone transfers are handled transparently (leave current room, join new room, re-link wallet).

`App.tsx`: subscribes to `NetworkManager` events and pushes to `useGameStore`. Renders `PhaserGame` + HUD overlays when joined, `LoginOverlay` when not.

### Shared

`shared/src/zones.ts` — zone configs (NPCs, portals, spawn tiles). Add new zones here and register them in `server/src/index.ts`.

`shared/src/` exports all game constants (speeds, ranges, cooldowns), quest/item/shop definitions, and Colyseus schema types.

## Environment

Server reads from `server/.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon-compatible) |
| `PORT` | WebSocket + HTTP port (default 2567) |
| `AUTH_SECRET` | JWT signing secret |
| `TOKEN_GATE_DISABLED` | Set `true` to bypass Solana token requirement |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `TOKEN_TREASURY_WALLET` | Wallet that receives SPL token purchases |

## Solana / Token integration

- Token mint: `DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump`
- Players authenticate by signing a server-issued challenge with their Solana wallet → receive JWT
- Token gate: requires ≥ 1000 tokens to enter (disabled in dev via `TOKEN_GATE_DISABLED=true`)
- Gold market (`server/src/market/`): peer-to-peer ask/bid system where players trade in-game gold for SPL tokens. Trades are verified on-chain via `verifyPeerTokenTransfer.ts`.

## Gameplay systems (the "everyday loop")

The world is built around a **Gather → Craft → Trade → Build** loop with a
**Community** layer. Each piece is pure data in `shared/` consumed by the
authoritative server and rendered by the client.

- **Gathering** (`shared/src/resources.ts`, `shared/src/skills.ts`): resource nodes
  carry a `kind` (`tree` | `rock` | `fish`) plus a per-kind config. Pressing the
  gather key (F, or G for fishing) sends a `chop` message; the server runs one
  shared "gather session" (range/move/cancel checks, respawn timer) and, on
  completion, awards the node's loot item + skill XP. Three gather skills share
  one XP curve: **Woodcutting** (trees → Wood), **Mining** (rocks → Copper Ore),
  **Fishing** (fishing spots on water → River Fish). XP lives in the JSONB
  `skills` column; `buildSkillStatePayload` ships per-skill level/xp to the HUD.
  To add a gather skill: extend `ResourceKind`/`GatherSkill`, add a node config +
  `gatherInfo()` branch in `ZoneRoom`, a loot item, node art in `BootScene`, and a
  HUD gauge.
  **Tools** (`shared/src/equipment.ts` `TOOL_GATHER`): a craftable tool (Copper
  Axe/Pickaxe/Fishing Rod) equipped into the `toolId` slot multiplies gather
  duration for its matching skill (`getToolSpeedMultiplier`, applied in
  `handleChop`). Equipment is `{ weaponId, toolId }`, persisted as JSONB; equip is
  slot-aware (`equipItem { itemId, slot }`).
- **Crafting** (`shared/src/crafting.ts`): `CRAFT_RECIPES` define inputs → output.
  The `CraftPanel` (open with **C** / 🔨 button) sends a `craft` message; the
  server validates ingredients, consumes them, adds the output, and returns the
  updated inventory via `craftResult`. Crafted gear plugs into the existing
  `equipment.ts` weapon-bonus map; crafted food uses the `CONSUMABLE_HEAL` map.
- **Trade** (`server/src/market/`): Rudi's shop buys gathered/crafted materials for
  gold, and the peer-to-peer gold market swaps gold for SPL tokens (below).
- **Build — Housing & player shops** (`shared/src/housing.ts`,
  `server/src/housing/landRegistry.ts`): land plots are 3x3 footprints in
  `zones.ts`; buy one with gold (`housingBuy`) to build a **house** or **shop**.
  Ownership + shop `listings`/`earnings` are a process-global registry persisted
  as JSONB on `land_plots`. A built shop's owner stocks items at a price
  (`shopStock`/`shopUnstock`); visitors buy (`shopBuyListing`, server partial-
  fills by gold/stock/space); sales accrue plot `earnings` the owner pulls with
  `shopCollect`. Only built plots are solid (see collision below). Owners can
  repaint the roof (`housingCustomize`, `ROOF_COLORS` palette, persisted `roof`
  column); the client picks an art-baked `house_<id>`/`shop_<id>` texture variant.
  Owners can also name the building (`housingCustomize` `sign`, `sanitizeSign` +
  persisted `sign` column) — shown on the in-world plot label and shop title —
  and place props on the four plot corners (`housingDecorate`,
  `PLOT_DECORATIONS`, persisted JSONB `decor` column; client renders `decor_<id>`
  sprites at the corner tiles).
- **Community** (`shared/src/emotes.ts`, `shared/src/stats.ts`): `emote`
  broadcasts an emoji bubble to the zone; the WhoPanel lists who's online; the
  hub **billboard** shows the live `$BASE` holder count
  (`server/src/solana/holderCount.ts`, `getProgramAccounts`, cached) + players
  online, pushed via `worldStats`.
- **Leaderboard** (`shared/src/leaderboard.ts`, `server/src/db/leaderboard.ts`):
  `requestLeaderboard` → top-10 by Level, net worth (Richest — gold + inventory
  + owned Worlds/plots/build assets, valued in `server/src/db/networth.ts`), and
  total gather Skills. DB query cached 60s; deploy/health-probe accounts filtered.

## Key conventions

- All cross-package game constants (tick rate, movement speed, combat ranges) live in `shared/` — never duplicate them in client or server.
- Zone configuration (NPC placement, portals, spawn points, resources, farm/land plots, billboards) is pure data in `shared/src/zones.ts`; tile maps are hand-authored region layouts in `shared/src/maps.ts`.
- The server is the authority: client sends input direction only; server moves players and validates all economy actions.
- Character state in `ZoneRoom` is keyed by **player name** (not session ID), because sessions reset on zone transfer.
- **Collision** (`shared/src/maps.ts` `isBlockingTile` + `server/src/map/collision.ts`): walls **and water** block movement; an owned plot's 3x3 footprint is stamped solid (empty/for-sale plots stay walkable). Movement samples a 2x2 footprint, so keep a 1-tile buffer from water/walls.
- **Iso depth**: tiles use `depth = tileX+tileY`; all scenery, players, and NPCs use `depth = worldY` (their feet/anchor Y) so objects sort by position and occlude correctly. Buildings are drawn in `BootScene` from polygons (gable roof = ridge + two slopes + gable end).
