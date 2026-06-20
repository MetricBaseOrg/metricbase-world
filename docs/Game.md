# MetricBase World — Game Overview

## Vision

**MetricBase World** is a browser-native isometric MMO: a persistent online world where players explore zones together in real time, chat, progress their characters, and eventually participate in a live economy.

The long-term goal (see `PLAN.md`) is a zero-install MMO with:

- Seamless zone travel across a sharded world
- Real-time multiplayer with authoritative server simulation
- Character progression, items, and social systems
- Optional Solana token integration for in-game economy
- Horizontally scalable infrastructure

The current build is **Milestone 1** — a playable multiplayer prototype that proves the core loop: move, chat, travel between zones, and return to a saved position.

---

## Current Gameplay (Milestone 1)

### What players can do today

1. **Enter the world** — Choose a character name (up to 16 characters) on the login screen.
2. **Move** — Use **WASD** or arrow keys to walk the isometric map. Movement is server-authoritative with client-side prediction for responsiveness.
3. **See other players** — Other connected players appear as sprites with name labels. Your own character is highlighted in gold.
4. **Zone chat** — Type messages in the chat panel. System messages announce when players join or leave.
5. **Travel between zones** — Walk onto **purple portal tiles** to transfer between:
   - **MetricBase Hub** — central spawn area
   - **Wilderness** — outer zone with a return portal
6. **Talk to NPCs** — Purple NPCs in each zone. Walk close and press **E** to hear dialogue and earn XP.
7. **Complete quests** — Aria offers starter quests. Track objectives in the **Quest Log** (top-right). Progress saves to the database.
8. **Combat practice** — Attack the **Training Dummy** in the Wilderness with **Space** when in range.
9. **Earn XP and level up** — Quests, combat, portal travel, and NPC chat grant experience. Progress is shown in the HUD XP bar.
10. **Persist progress** — Character name, zone, position, level, XP, and quests are saved to PostgreSQL (Neon). Rejoining with the same name restores your last location.
11. **Leave World** — Use the HUD button to disconnect and return to the login screen.

### Zones

| Zone ID | Display Name | Notes |
|---------|--------------|-------|
| `zone_hub` | MetricBase Hub | Default spawn; portal to Wilderness at tile (20, 12) |
| `zone_wilderness` | Wilderness | Portal back to Hub at tile (2, 12) |

### Controls

| Input | Action |
|-------|--------|
| WASD / Arrow keys | Move (when chat is not focused) |
| E | Talk to nearest NPC |
| Space | Attack nearest training dummy |
| Chat input | Type messages; movement pauses while typing |
| Enter | Send chat message |
| Purple tiles | Zone portal transfer |
| Leave World (HUD) | Disconnect and return to login |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Player)                                           │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ Phaser 3 (WebGL)    │  │ React UI (HUD, chat, login) │  │
│  │ Isometric renderer  │  │ Zustand state               │  │
│  └──────────┬──────────┘  └──────────────┬──────────────┘  │
│             │         colyseus.js          │                  │
└─────────────┼──────────────────────────────┼──────────────────┘
              │ WebSocket + HTTP             │
              ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Railway — Game Server                                      │
│  Express (REST) + Colyseus (WebSocket rooms)                │
│  One room per zone · authoritative movement & chat          │
└─────────────────────────────┬───────────────────────────────┘
                              │ SQL
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Neon — PostgreSQL                                          │
│  Character persistence (name, zone, x, y, level)            │
└─────────────────────────────────────────────────────────────┘

Client static assets are hosted separately on Vercel.
```

### Why split client and server?

Colyseus requires a **persistent WebSocket server**. Vercel serverless functions cannot host real-time game rooms, so:

- **Vercel** serves the static client (`client/dist`)
- **Railway** runs the always-on Node.js game server
- **Neon** stores persistent character data

### Production URLs

| Service | URL |
|---------|-----|
| Client | https://metricbase-world.vercel.app |
| Game server | https://metricbaseserver-production.up.railway.app |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Client rendering | Phaser 3, TypeScript, Vite |
| Client UI | React 18, Zustand |
| Networking | colyseus.js (WebSocket client) |
| Game server | Node.js, Colyseus 0.16, Express |
| State sync | @colyseus/schema v3 |
| Database | PostgreSQL via `pg` (Neon) |
| Monorepo | pnpm workspaces |
| Client hosting | Vercel |
| Server hosting | Railway |

---

## Project Structure

```
metricbase-world/
├── client/                    # Browser game client → Vercel
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx           # React entry point
│       ├── App.tsx            # Root layout; login → game transition
│       ├── store/
│       │   └── gameStore.ts   # Zustand store (player, chat, HUD state)
│       ├── ui/
│       │   ├── LoginOverlay.tsx   # Character name entry
│       │   ├── HUD.tsx            # Zone, status, player info overlay
│       │   └── ChatPanel.tsx      # Zone chat log + input
│       └── game/
│           ├── PhaserGame.tsx     # Phaser.Game lifecycle wrapper
│           ├── BootScene.ts       # Procedural tileset + player textures
│           ├── GameScene.ts       # Tilemap render, movement, player sync
│           ├── network.ts         # Colyseus client; room join/leave/chat
│           ├── serverUrl.ts       # VITE_SERVER_URL env resolution
│           ├── inputControl.ts    # Pause Phaser keyboard when UI is typing
│           ├── prediction.ts      # Client-side movement prediction
│           └── mapData.ts         # Client-side zone tile data
│
├── server/                    # Authoritative game server → Railway
│   ├── railway.toml           # (referenced by root railway.toml)
│   └── src/
│       ├── index.ts           # Express + Colyseus bootstrap, zone room defs
│       ├── rooms/
│       │   └── ZoneRoom.ts    # Movement tick, chat, portals, persistence
│       ├── api/
│       │   └── characters.ts  # GET /api/character?name=…
│       ├── db/
│       │   ├── pool.ts        # Neon Postgres connection pool
│       │   ├── characters.ts  # load/save character queries
│       │   └── schema.sql     # characters table DDL
│       └── map/
│           └── collision.ts   # Server-side walkability checks
│
├── shared/                    # Code shared by client and server
│   └── src/
│       ├── index.ts           # Constants, tile math, re-exports
│       ├── zones.ts           # Zone configs, portals, NPCs, spawn points
│       ├── progression.ts     # XP thresholds, level helpers
│       ├── maps.ts            # Tile layer data per zone
│       ├── messages.ts        # Protocol types (chat, join, transfer)
│       └── schema/
│           ├── PlayerSchema.ts  # Colyseus player state schema
│           └── ZoneState.ts     # Colyseus room state schema
│
├── scripts/
│   └── verify-deploy.mjs      # Smoke-test Vercel + Railway endpoints
│
├── docs/
│   ├── Game.md                # This file
│   └── Changelog.md           # Project change history
│
├── vercel.json                # Vercel build + SPA rewrite config
├── railway.toml               # Railway build + start commands
├── pnpm-workspace.yaml        # Workspace packages + build allowlist
├── PLAN.md                    # Full long-term design document
└── README.md                  # Setup and deploy instructions
```

### Package responsibilities

| Package | NPM name | Role |
|---------|----------|------|
| `client/` | `@metricbase/client` | Renders the game, handles input, connects to server |
| `server/` | `@metricbase/server` | Simulates zones, validates movement, persists characters |
| `shared/` | `@metricbase/shared` | Zone data, protocol types, Colyseus schemas, tile helpers |

### Key data flows

**Join flow**

1. Player submits name on login overlay.
2. Client calls `GET /api/character?name=…` to look up saved zone/position.
3. Client calls `joinOrCreate(zone_room, { name, zoneId }, ZoneState)` over WebSocket.
4. Server `ZoneRoom.onJoin` spawns player at saved position or zone spawn tile.
5. Phaser `GameScene` renders the map and syncs remote player sprites from room state.

**Movement flow**

1. Client reads WASD input each frame (unless chat is focused).
2. Client sends `{ dx, dy }` input messages to server.
3. Server tick (20 Hz) applies movement with collision checks.
4. Server state patches broadcast to all clients.
5. Client predicts local movement and reconciles against server position.

**Zone transfer flow**

1. Player walks onto a portal tile.
2. Server saves character to new zone, sends `transfer` message to client.
3. Client leaves current room and joins the target zone room.

---

## Roadmap (not yet implemented)

From `PLAN.md` and `README.md`:

- [ ] Redis session layer
- [ ] Combat and abilities
- [ ] Inventory and items
- [ ] Quest system
- [ ] Guilds and parties
- [ ] Solana token economy integration
- [ ] Tiled/LDtk map pipeline (currently procedural placeholder tiles)
- [ ] Mobile touch controls
- [ ] Authentication (OAuth/JWT)

---

## Local Development

```bash
npx pnpm install
npx pnpm dev
```

- Client: http://localhost:5173
- Server: ws://localhost:2567

See `README.md` for database setup and deployment instructions.