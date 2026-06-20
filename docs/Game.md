# MetricBase World — Game Overview

## Vision

**MetricBase World** is a browser-native isometric MMO: a persistent online world where players explore zones together in real time, chat, progress their characters, and participate in an in-game economy with optional Solana token integration.

The long-term goal (see `PLAN.md`) is a zero-install MMO with:

- Seamless zone travel across a sharded world
- Real-time multiplayer with authoritative server simulation
- Character progression, items, and social systems
- Optional Solana token integration for in-game economy
- Horizontally scalable infrastructure

The current build is **Milestone 2** — a playable multiplayer prototype with combat, inventory, quests, shop, peer-to-peer gold market, knockout respawn, and three explorable zones.

---

## Current Gameplay (Milestone 2)

### What players can do today

1. **Enter the world** — Choose a character name (up to 16 characters) on the login screen. Optional Solana wallet auth gates entry in production (bypass with `TOKEN_GATE_DISABLED=true` in dev).
2. **Move** — Use **WASD** or arrow keys to walk the isometric map. On mobile, use the on-screen D-pad. Movement is server-authoritative with client-side prediction.
3. **See other players** — Other connected players appear as sprites with name labels. Your own character is highlighted in gold.
4. **Zone chat** — Type messages in the chat panel. System messages announce joins, leaves, combat, and quest events.
5. **Travel between zones** — Walk onto **purple portal tiles** to transfer between three zones (see table below).
6. **Talk to NPCs** — Walk close and press **E** (or tap Interact on mobile). Dialogue appears in chat. NPC chat XP is granted **once per 24 hours** per player per NPC.
7. **Complete quests** — Starter chain from Aria, slime patrol from Rook, grotto hunt from Moss. Track objectives in the **Quest Log** (desktop HUD or mobile FAB sheet). Progress saves to PostgreSQL.
8. **Combat** — Press **Space** or tap **Attack** when in range of hostile NPCs. Server-authoritative damage, HP bars, floating damage numbers, counter-attacks, and mob respawn timers.
9. **Player knockout** — If your HP reaches 0, you are knocked out. Pay **100 gold** to respawn immediately, or wait **30 minutes** for a free respawn. A death overlay shows the countdown.
10. **Loot and inventory** — Defeated mobs drop items and gold. Open inventory from the HUD (**I**). Equip weapons, use health potions, sell materials at Pip's shop.
11. **Shop and economy** — Pip's Provisions in the Hub: buy potions and weapons with gold, sell loot. **Gold Market** tab lists peer-to-peer bids and offers for trading in-game gold against MetricBase SPL tokens (on-chain verified).
12. **Earn XP and level up** — Quests, combat, portal travel, and NPC chat grant experience. Out-of-combat HP regen. Level-ups broadcast to the zone with sound.
13. **Sound effects** — Procedural Web Audio SFX for combat, shop, market, inventory, chat, quests, and level-up. Mute toggle in the HUD.
14. **Persist progress** — Character name, zone, position, level, XP, gold, inventory, equipped weapon, quests, knockout timer, and NPC interact cooldowns save to PostgreSQL (Neon).
15. **Leave World** — Use the HUD button to disconnect and return to the login screen.

### Zones

| Zone ID | Display Name | Notes |
|---------|--------------|-------|
| `zone_hub` | MetricBase Hub | Default spawn; Aria (quests), Pip (shop + market); portal to Wilderness at (20, 12) |
| `zone_wilderness` | Wilderness | Rook (slime quests), Training Dummy, Wild Slime; portals to Hub (2, 12) and Slime Grotto (22, 14) |
| `zone_grotto` | Slime Grotto | Moss (brute quest), Slime Brute boss; portal back to Wilderness at (2, 12) |

### Combat targets

| NPC | Zone | HP | Notes |
|-----|------|-----|-------|
| Training Dummy | Wilderness | 90 | Drops Training Scrap; **gold reward only on first kill** per character |
| Wild Slime | Wilderness | 45 | Drops Slime Gel, 3g per kill |
| Slime Brute | Slime Grotto | 150 | Drops Slime Core, 8g per kill; 12 counter damage |

### Quest chains

**Hub starter (Aria)**

1. Meet the Guide → Into the Wilderness → Practice Makes Perfect → Salvage the Scrap → Veteran Adventurer

**Wilderness slime line (Rook)**

6. Slime Patrol → Gel Collection → Commendation (rewards Gel-Edged Knife, +8 damage)

**Grotto line (Rook → Moss)**

8. Into the Grotto → Brute Force

### Controls

| Input | Action |
|-------|--------|
| WASD / Arrow keys | Move (when chat is not focused) |
| E / Interact button | Talk to nearest NPC; open shop if merchant |
| Space / Attack button | Attack nearest hostile NPC |
| I | Toggle inventory |
| Chat input | Type messages; movement pauses while typing |
| Enter | Send chat message |
| Purple tiles | Zone portal transfer |
| 🔊 / 🔇 (HUD) | Toggle sound effects |
| Leave World (HUD) | Disconnect and return to login |

On mobile, the D-pad, Attack, Interact, inventory, and quest log FAB replace keyboard shortcuts where applicable.

### Economy

| Item | Source | Sell price (Pip) |
|------|--------|------------------|
| Training Scrap | Training Dummy | 8g |
| Slime Gel | Wild Slime | 12g |
| Slime Core | Slime Brute | 25g |
| Health Potion | Pip's shop | — (buy 15g) |
| Rusty Blade | Pip's shop | — (buy 40g, +12 damage) |
| Gel-Edged Knife | Commendation quest | — (+8 damage) |

Starting gold: **25g**. Knockout respawn costs **100g**.

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
│  One room per zone · authoritative movement, combat, economy  │
└─────────────────────────────┬───────────────────────────────┘
                              │ SQL
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Neon — PostgreSQL                                          │
│  Character persistence (position, XP, gold, inventory,      │
│  quests, knockout timer, NPC interact cooldowns, market)    │
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
| Client | https://world.metricbase.org |
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
| Blockchain | Solana (wallet auth, SPL token gate, peer market) |

---

## Project Structure

```
metricbase-world/
├── client/                    # Browser game client → Vercel
│   └── src/
│       ├── App.tsx            # Root layout; wires NetworkManager → store
│       ├── store/gameStore.ts # Zustand (player, combat, inventory, quests)
│       ├── ui/                # HUD, chat, shop, market, inventory, death overlay
│       ├── audio/             # Procedural Web Audio SFX
│       └── game/              # Phaser scenes, network, prediction
│
├── server/                    # Authoritative game server → Railway
│   └── src/
│       ├── index.ts           # Express + Colyseus bootstrap, zone room defs
│       ├── rooms/ZoneRoom.ts  # Movement, combat, shop, market, quests, persistence
│       ├── api/               # Character lookup, wallet auth, token shop
│       ├── db/                # Neon Postgres pool + character queries
│       └── market/            # Peer-to-peer gold order book
│
├── shared/                    # Code shared by client and server
│   └── src/
│       ├── zones.ts           # Zone configs, portals, NPCs, combat stats
│       ├── quests.ts          # Quest definitions and progress helpers
│       ├── items.ts           # Item catalog and inventory types
│       ├── shop.ts            # Merchant buy/sell tables
│       ├── mobRewards.ts      # Per-mob loot and gold
│       ├── combat.ts          # Player/mob combat constants, respawn costs
│       ├── maps.ts            # Tile layer data per zone
│       └── schema/            # Colyseus PlayerSchema + ZoneState
│
├── docs/
│   ├── Game.md                # This file
│   └── Changelog.md           # Project change history
│
├── vercel.json                # Vercel build + SPA rewrite config
├── railway.toml               # Railway build + start commands
└── README.md                  # Setup and deploy instructions
```

### Key data flows

**Combat flow**

1. Client sends `attack` with target NPC id when in range.
2. Server validates cooldown, range, and knockout state; applies damage to mob or player.
3. On mob defeat: grant XP, gold (respecting once-only rules), loot to inventory, advance quest objectives.
4. On player knockout: set `knockedOutUntil`, block movement/combat, show death overlay with pay-or-wait options.

**Shop / market flow**

1. Client sends `interact` near Pip; server opens shop catalog with current gold and inventory.
2. `shopBuy` / `shopSell` validated server-side; gold and inventory persisted.
3. Gold Market orders escrow gold server-side; fills verified against on-chain SPL transfers.

---

## Roadmap (not yet implemented)

From `PLAN.md`:

- [ ] Redis session layer
- [ ] Full ability system and class roles
- [ ] Guilds and parties
- [ ] More zones and bosses
- [ ] Tiled/LDtk map pipeline (currently procedural placeholder tiles)
- [ ] Deeper mobile UX polish

---

## Local Development

```bash
npx pnpm install
npx pnpm dev
```

- Client: http://localhost:5173
- Server: ws://localhost:2567

See `README.md` for database setup and deployment instructions.