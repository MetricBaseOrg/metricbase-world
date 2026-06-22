# MetricBase World

Browser-native isometric MMO prototype.

## Stack

| Layer | Tech | Host |
|-------|------|------|
| Client | Phaser 3, React, Vite | **Vercel** |
| Game server | Colyseus, Express | WebSocket host (Railway, Fly.io, Render) |
| Database | PostgreSQL | **Neon** (Vercel integration) |
| Shared | TypeScript | Monorepo workspace |

> **Why not all on Vercel?** Colyseus needs a persistent WebSocket server. Vercel serverless functions can't host real-time game rooms. The client ships to Vercel; the game server runs on a small always-on Node host.

## Local development

```bash
npx pnpm install
npx pnpm dev
```

- Client: http://localhost:5173
- Server: ws://localhost:2567

Move with **WASD**, chat in the zone panel, walk onto **purple portal tiles** to change zones, press **Space** to attack hostile NPCs, and press **E** near merchants and quest givers.

**Production:** [world.metricbase.org](https://world.metricbase.org) (client) · `metricbaseserver-production.up.railway.app` (game server)

## Deploy client to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Vercel reads `vercel.json` automatically — no root directory override needed.
4. Add environment variable:

   | Variable | Example |
   |----------|---------|
   | `VITE_SERVER_URL` | `wss://metricbase-game.up.railway.app` |

5. Deploy.

Or via CLI:

```bash
npx vercel
```

## Database (Neon)

Use [Neon](https://neon.tech) — it integrates directly with Vercel's marketplace.

1. Copy your Neon **pooled** connection string.
2. Save it to `server/.env` (never commit this file):

   ```
   DATABASE_URL=postgresql://...@ep-xxx-pooler....neon.tech/neondb?sslmode=require
   PORT=2567
   ```

3. Initialize the schema:

   ```bash
   cd server && pnpm db:init
   ```

4. Set the same `DATABASE_URL` on your **game server** production host (not Vercel).

Without `DATABASE_URL`, the game runs fine — characters just won't persist between sessions.

## Deploy game server (Railway)

The Colyseus server must run on a WebSocket-capable host. This repo includes `railway.toml`.

1. Create a [Railway](https://railway.app) project from this repo.
2. Set environment variables:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Neon connection string |
   | `PORT` | *(Railway sets this automatically)* |

3. Deploy — Railway builds shared + server and runs `node server/dist/index.js`.
4. Copy the public Railway URL into Vercel:

   ```
   VITE_SERVER_URL=wss://<app>.up.railway.app
   VITE_SERVER_HTTP_URL=https://<app>.up.railway.app
   ```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Client + server locally |
| `pnpm build:client` | Production client build (Vercel) |
| `pnpm dev:server` | Game server only |
| `pnpm typecheck` | Type-check all packages |

## Project layout

```
client/   Phaser renderer + React UI  →  Vercel
server/   Colyseus zones + chat       →  Railway / Fly / Render
shared/   Zone maps, protocol types
```

## Progress

- [x] Isometric multiplayer movement
- [x] Zone chat
- [x] Three zones with portals (Hub, Wilderness, Slime Grotto)
- [x] PostgreSQL persistence (Neon)
- [x] Vercel client deployment config
- [x] Railway game server deploy config
- [x] Character lookup API + rejoin saved zone
- [x] Client-side movement prediction
- [x] Zone NPCs with E to interact
- [x] XP progression and level-up
- [x] Leave World button (save on disconnect)
- [x] Quest system with persisted progress (10 quests, 3 chains)
- [x] Combat (dummy, wild slime, slime brute) with loot and gold
- [x] Inventory, weapons, consumables
- [x] Craftable tools (axe/pickaxe/rod) — equip for faster gathering
- [x] Iron tier — Iron Deposits (Mining 3) → ore → bars → iron tools (50% faster)
- [x] Tier-2 woodcutting & fishing — Hardwood + Deep Pool salmon → planks, food, pro rod
- [x] Farm plots persist to the DB (crops keep growing across restarts)
- [x] Housing depth — repaint your house/shop roof (6 colors, persisted)
- [x] Housing depth — name your building (custom shop sign, persisted)
- [x] Housing depth — decorate your plot corners with props (persisted)
- [x] Walk-in interiors — shared networked Community Lodge zone (enter from the hub)
- [x] Furnished interiors — reusable zone scenery system (fireplace, shelves, rug, seating)
- [x] Merchant shop (Pip) and soft currency (gold)
- [x] Peer-to-peer gold market (MetricBase SPL)
- [x] Knockout respawn (100g or 30 min wait)
- [x] Sound effects with HUD mute toggle
- [x] Mobile touch controls + quest log FAB
- [x] Solana wallet auth + token gate
- [x] Guilds — found (gold sink) / join / leave, tags on nameplates, roster (persisted)
- [x] Guild chat + parties — cross-zone chat channels via a presence bus; invite-based parties
- [ ] Redis session layer
- [ ] Full ability system and class roles

See `docs/Game.md` for full gameplay details and `docs/Changelog.md` for release history.