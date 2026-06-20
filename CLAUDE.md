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

`server/src/rooms/ZoneRoom.ts` is the core. One `ZoneRoom` instance per active zone (hub + wilderness). It:
- Runs an authoritative tick loop at `TICK_RATE` (defined in shared)
- Handles messages: `input`, `chat`, `interact`, `attack`, `shopBuy`, `shopSell`, `marketPlace/Cancel/FillAsk/AcceptBid/PayBid/Refresh`, `linkWallet`
- Persists characters to PostgreSQL on leave, portal transfer, and after significant events
- Tracks per-player state in Maps (inventories, gold, quest progress, wallets) keyed by player name

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

## Key conventions

- All cross-package game constants (tick rate, movement speed, combat ranges) live in `shared/` — never duplicate them in client or server.
- Zone configuration (NPC placement, portals, spawn points) is pure data in `shared/src/zones.ts`.
- The server is the authority: client sends input direction only; server moves players and validates all economy actions.
- Character state in `ZoneRoom` is keyed by **player name** (not session ID), because sessions reset on zone transfer.
