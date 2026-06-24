# Browser-based isometric MMO — full build plan

> The sections below are the original full-scope vision. The list here tracks
> what is actually live in MetricBase World today.

## 0. Implementation status (live build)

Stack as shipped: Phaser 3 + React (Vite) client on Vercel, Node + Colyseus
server on Railway, Neon PostgreSQL, Solana token gate/market.

### Done

- Multiplayer movement (authoritative server + client prediction), zone transfer
  (hub ↔ wilderness), chat, quests, combat vs. mobs, inventory, equipment.
- Solana wallet login + token gate (fails open on RPC errors), peer-to-peer gold
  market (gold ↔ SPL token), Pip's gold shop.
- Chibi avatar art + animations (idle/walk/chop/fish), iso-cube tiles, redesigned
  props/NPCs, procedural background music + a full SFX set.
- **Everyday loop — Gather:** Woodcutting, Mining, Fishing (shared gather-session
  system; nodes, items, skill XP, HUD gauges, art, FX/SFX).
- **Day/night cycle:** a shared, time-driven world clock (`shared/src/daynight.ts`);
  the client tints the world dawn→day→dusk→night and a HUD clock shows the time.
  Cosmetic now, ready to drive future gameplay (night mobs, shop hours).
- **Player lamp/torch:** toggle (L / 💡) a networked personal light that glows
  through the dark; other players see it (PlayerSchema `lampOn` + `toggleLamp`).
- **Weather:** deterministic, time-driven weather (`shared/src/weather.ts`) —
  clear/cloudy/rain/fog/storm with rain particles, a weather tint, lightning,
  and a HUD readout. Shared by all clients; rain suppressed indoors. Procedural
  **rain + thunder ambience** (`audio/weatherAmbience.ts`) tracks the weather.
- **Living-world effects** (`shared/src/environment.ts`): night slows gathering
  unless your lamp is on; rain gives fishing a bonus catch. Server-authoritative.
- **Building lights:** owners toggle a house/shop light (🏠 panel) that glows at
  night for everyone and burns a per-plot energy reserve, refueled with craftable
  **Lamp Oil** (2 fish + 1 wood). `effectiveLight`, `housingLight`/`housingRefuel`;
  persisted on the plot.
- **Rest at home:** resting in your own house restores energy + HP on an 8-min
  cooldown, giving housing a gameplay function (`housingRest`, `REST_COOLDOWN_MS`).
- **Level cap 50:** combat Level and the four gather skills now climb to 50
  (`MAX_LEVEL`, `MAX_SKILL_LEVEL`); curves keep growing past the early game.
- **Interaction prompts:** a floating "E · …" cue over the nearest interactable
  (NPC / land plot / farm plot) so it's obvious what you can use and how.
- **Camera zoom:** wheel / pinch / HUD buttons zoom the world 0.9×–2.8×
  (persisted); overlays track the zoom.
- **Edge portals + gate art:** zone portals sit at map edges (no accidental
  entry) and render as glowing magenta gates with labels (`portal_gate`).
- **Ground detail scatter:** deterministic cosmetic flowers/mushrooms/pebbles/
  tufts/leaves over grass + subtle per-tile grass tint (`renderGroundDetails`).
- **Multi-currency gold market:** P2P gold orders can be priced in $BASE, USDC,
  IDRX, or SOL (per-order `currency`; SPL or native-SOL settlement verified
  on-chain). `shared/src/currencies.ts`, `verifyPeerSolTransfer`.
- **Energy / hunger:** working actions (gather/attack/farm) spend Energy;
  food restores it (`shared/src/stamina.ts`). Out of energy = too hungry to work
  until you eat; slow trickle avoids hard locks; persisted (`stamina` column).
- **Everyday loop — Farming:** tilled plots with a real-time growth cycle (plant
  seed → grow → harvest crop + Farming XP), live growth bars, Wheat→Bread.
- **Everyday loop — Craft:** workbench recipes (planks, copper bars, cooked fish,
  copper dagger) via the `C` / 🔨 Crafting panel.
- **Everyday loop — Trade:** sell gathered/crafted mats to Pip; P2P gold market
  (BASE is a Token-2022 mint — payments use the Token-2022 program + checked
  transfers).
- **Everyday loop — Build (Housing):** buy a land plot with gold (the biggest
  sink), build a house or shop, persistent ownership with your name on it.
- **Player-run shops:** a built **Shop** can be stocked from the owner's
  inventory at chosen prices; anyone buys (with quantity / buy-all). Sales
  accrue gold as plot **earnings** the owner collects on their next visit
  (sidesteps paying offline/cross-zone owners). Listings + earnings persisted
  as JSONB on `land_plots`.
- **Everyday loop — Community:** **emotes** (emoji bubble broadcast to the
  zone), a **/who online roster** (names + levels), and a hub **billboard**
  showing the live on-chain **$BASE holder count** + players online.
- **Leaderboard:** top-10 by combat **Level**, **Richest** (gold), and total
  **Skills** (sum of gather levels). Server-cached DB query, probe accounts
  filtered out.
- **Economy v1 (sustainability):** dynamic vendor prices — Pip pays less for a
  material as it's sold (supply saturation, decays over time, 40% floor) to cap
  the gold faucet; crafting forge fees + 4% market trade fee + 500g land plots
  as gold sinks. Tuning in `shared/src/economy.ts`.
- **World + iso art:** hand-authored hub with themed regions (NW forest, W
  quarry, central plaza, NE neighbourhood, SW farmland, SE lake); **water is
  impassable** (fish from the shore). Buildings are isometric (gable roofs);
  scenery, players, and NPCs **depth-sort by world Y** (you're occluded behind
  tall objects). **Building collision**: only *built* houses/shops are solid —
  empty plots are open ground. OG social card at
  `client/public/metricbase-world.png`.

### Next (roadmap)

- Housing depth: ✅ roof paint (6-colour, persisted), ✅ shop signage (custom
  building names, persisted), and ✅ corner decorations (place props on the four
  plot corners, persisted). ✅ Walk-in interiors: a shared networked Community
  Lodge zone entered from the hub (others visible inside). Next: per-plot-private
  interiors and player-placeable interior furniture (the lodge ships with a
  reusable static zone scenery system today).
- ✅ Guilds: found (1000g sink) / join / leave, tags on nameplates, roster panel,
  persisted in a process-global registry + `guilds` table.
- ✅ Guild chat + ✅ parties (invite/accept/leave, party chat) — both cross-zone
  via a process-global presence bus (`social/presence.ts`). Parties are transient
  (in-memory); guild chat reaches members in any zone. ✅ Party combat bonuses:
  the finisher earns +15% kill XP per nearby party ally (same zone, ~5 tiles) and
  nearby allies share assist XP + "defeat" quest credit (`partyKillXp` /
  `partyAssistXp` in `shared/src/party.ts`). ✅ Party shared gather XP: nearby
  members earn a 25% share of a gather's skill XP (`partyGatherShareXp`). Next:
  shared loot rolls and party-shared collect-quest progress.
- ✅ Tool/gear progression that boosts gather speed — copper tools (30% faster)
  and an **iron tier**: Iron Deposits (Mining 3) → Iron Ore → Iron Bars → Iron
  Axe/Pickaxe (50% faster). All three gather skills now have a tier-2 node:
  Hardwood (Woodcutting 3) and Deep Pool salmon (Fishing 3), feeding Hardwood
  Planks, Grilled Salmon, and the Angler's Pro Rod (50% faster fishing).
  ✅ Steel tier raises *yield*: Steel Bars (iron + hardwood) forge a Steel
  Axe/Pickaxe and Trawler's Net — 50% faster *and* a 40% chance of a bonus drop
  (`getToolYieldBonus`, rolled in `completeChop`). ✅ Rare gather drops: a small,
  tier-scaled chance to also yield Amber / Gemstone / Pearl (`rollRareGatherDrop`)
  — high-value Pip sales, and a Gemstone forges the **Gemforged Blade** (+30 atk),
  the top weapon. Next: gear with rolled stat ranges and set bonuses.
- ✅ Persist farm-plot state to the DB (process-global `farm_plots` registry;
  crops keep growing across restarts).
- More zones, NPCs, quests, and recipes around the loop. ✅ Brenna the
  Blacksmith (hub) + a five-quest Smith chain (iron → steel → gemstone →
  master Steel Pickaxe) that onboards players into the tool/material tiers.
  ✅ Housing + farming now span every outdoor zone (hub 7+7, Wilderness 3+3,
  Grotto 3+2); the Lodge interior is excluded as it's itself a building.

---

## 1. Vision, scope, and constraints

- **Core pitch:** Browser-native isometric MMO with persistent world, real-time multiplayer, and live economy.
- **Target platforms:** Modern desktop browsers (Chrome, Edge, Firefox, Safari) and recent mobile browsers.
- **Session profile:** 15–60 minute sessions, thousands of concurrent players per shard.
- **Art style:** 2D isometric tiles (pixel art or stylized), streamed in chunks.
- **Business constraints:**
  - Zero-install, URL-only access.
  - Reasonable hosting costs, horizontally scalable.
  - Live-ops friendly (events, patches, balance changes).

---

## 2. High-level architecture

### 2.1 Frontend (client)

- **Rendering:**
  - **Engine:** Phaser 3 or similar HTML5 engine, customized for isometric tilemaps and entity batching.
  - **Tech:** TypeScript, WebGL (WebGPU optional later), Vite/ESBuild bundling.
- **UI layer:**
  - React (or lightweight alternative) for menus: inventory, chat, party, map, settings.
  - Global state via Redux/Zustand/Recoil.
- **Networking:**
  - WebSocket client (Colyseus client SDK or custom).
  - Client-side prediction + interpolation for movement.
- **Platform integration:**
  - Auth via JWT/OAuth (email, social login).
  - Analytics + error reporting (Sentry, custom events).

### 2.2 Backend (game servers)

- **Authoritative game server:**
  - Node.js + Colyseus (or Nakama/Custom) for rooms, matchmaking, and state sync.
  - Each “zone” or “instance” is a room; seamless travel via handoff between rooms.
- **Microservices:**
  - **Auth service:** login, sessions, bans.
  - **Profile service:** characters, progression, cosmetics.
  - **Economy service:** currency, items, trades, anti-cheat.
  - **Blockchain service:** Solana integration, wallet binding, token validation, and on-chain sync for `DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump`.
  - **Chat/social service:** channels, whispers, guilds.
- **Data layer:**
  - Primary DB: PostgreSQL or MongoDB for persistent data.
  - Redis for fast state, matchmaking, and pub/sub events.
- **Infrastructure:**
  - Containerized (Docker), orchestrated via Kubernetes or Nomad.
  - Horizontal scaling of game server pods per CCU demand.
  - Load balancer + API gateway (NGINX/Envoy).

### 2.3 Tooling and pipelines

- **World building:**
  - Tiled or LDtk for isometric maps; export to JSON.
  - Internal “World Editor” for placing NPCs, spawns, triggers.
- **Content pipeline:**
  - Git-based workflow, CI/CD for assets and scripts.
  - Versioned data (items, quests, skills) in JSON/YAML.
- **Monitoring:**
  - Metrics (Prometheus + Grafana).
  - Logs (ELK stack or hosted logging).
  - Alerting (PagerDuty/Slack).

---

## 3. Game design foundations

### 3.1 Core gameplay loops

- **Exploration loop:**
  - Move through isometric zones, discover landmarks, unlock fast travel.
- **Combat loop (if combat-based):**
  - Real-time or tick-based combat with abilities, cooldowns, and roles.
- **Progression loop:**
  - XP, levels, skill trees, gear upgrades, achievements.
- **Social loop:**
  - Parties, guilds, shared objectives, world events.

### 3.2 World structure

- **Zones and shards:**
  - World split into zones (cities, wilderness, dungeons).
  - Each zone is a Colyseus room; players transfer seamlessly between zones.
- **Streaming:**
  - Chunk-based tile loading (e.g., 64×64 tiles per chunk).
  - Preload adjacent chunks; unload distant ones.

### 3.3 Economy and items

- **Currencies:**
  - Soft currency (earned via play).
  - Main in-game currency: Solana token `DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump`.
  - Optional premium currency (cosmetics only).
- **Items:**
  - Equipment, consumables, crafting materials.
  - Rarity tiers and stat rolls.
- **Market:**
  - NPC shops, player trading (auction house or direct trade).
  - Anti-exploit checks on server side.

---

## 4. Technical implementation plan (phased)

### 4.1 Phase 0 — Foundations and prototypes (2–4 weeks)

- **Decide stack:**
  - Client: Phaser 3 + TypeScript + React UI.
  - Server: Node.js + Colyseus + PostgreSQL + Redis.
- **Set up repos:**
  - `client/` and `server/` monorepo (e.g., PNPM workspace).
- **Prototype single-player isometric scene:**
  - Load isometric tilemap from Tiled.
  - Implement camera, basic movement, collision.
- **Prototype WebSocket connection:**
  - Connect to Colyseus room.
  - Sync simple player positions.

### 4.2 Phase 1 — Core multiplayer and movement (4–6 weeks)

- **Authoritative movement:**
  - Client sends input (direction, actions).
  - Server simulates movement and collision.
  - Clients render server state with interpolation.
- **Basic entities:**
  - Players, static obstacles, simple NPCs.
- **Zone architecture:**
  - Implement multiple rooms (zones).
  - Teleport between rooms via server handoff.
- **Persistence:**
  - Save character data (position, stats, inventory) on logout.

### 4.3 Phase 2 — Combat, abilities, and progression (6–10 weeks)

- **Combat system:**
  - Server-side damage, cooldowns, hit detection.
  - Client-side VFX and animation.
- **Stats and leveling:**
  - XP gain, level thresholds, stat growth.
  - Skill trees or ability unlocks.
- **Loot and items:**
  - Drop tables, rarity, binding rules.
  - Inventory UI and server validation.

### 4.4 Phase 3 — Social systems and world expansion (6–10 weeks)

- **Chat:**
  - Global, zone, party, guild channels.
  - Moderation tools (mute, report).
- **Parties and guilds:**
  - Party invites, shared rewards.
  - Guild creation, ranks, shared storage (optional).
- **World content:**
  - More zones, dungeons, hubs.
  - Quests, events, daily/weekly activities.

### 4.5 Phase 4 — Economy, trading, and live-ops (8–12 weeks)

- **Economy balancing:**
  - Currency sinks (repairs, travel, crafting).
  - Anti-inflation measures (taxes, fees).
- **Trading systems:**
  - Player-to-player trade with confirmation.
  - Auction house with server-side validation.
- **Live-ops tools:**
  - Admin panel for events, buffs, announcements.
  - A/B testing hooks for drop rates, XP boosts.

### 4.6 Phase 5 — Optimization, scaling, and polish (ongoing)

- **Performance:**
  - Client: sprite batching, culling, LOD, texture atlases.
  - Server: profiling hot paths, optimizing DB queries.
- **Scalability:**
  - Auto-scaling game server pods based on CCU.
  - Sharding or instancing for overcrowded zones.
- **UX polish:**
  - Onboarding tutorial.
  - Settings (keybinds, graphics, accessibility).
- **Security:**
  - Input validation, anti-cheat (speed, teleport, dupes).
  - Rate limiting and DDoS protection.

---

## 5. Detailed system design

### 5.1 Networking model

- **Client responsibilities:**
  - Capture input.
  - Predict movement locally.
  - Render latest server state.
- **Server responsibilities:**
  - Authoritative simulation (movement, combat, economy).
  - Periodic state snapshots (e.g., 10–20 ticks/sec).
  - Lag compensation (e.g., input timestamps).

### 5.2 Data model (examples)

- **Player:**
  - `id`, `accountId`, `name`
  - `position` (zoneId, x, y)
  - `stats` (hp, mana, strength, etc.)
  - `inventory` (items, quantities)
- **Item:**
  - `id`, `templateId`
  - `rarity`, `stats`, `ownerId`
- **Zone:**
  - `id`, `name`
  - `mapFile`, `spawnPoints`
  - `maxPlayers`, `instanceType`

### 5.3 World streaming

- **Client:**
  - Maintain active chunk set around player.
  - Request chunk data from server or pre-bundled assets.
- **Server:**
  - Track entities per chunk.
  - Only send relevant entities to each client (interest management).

---

## 6. Team, workflow, and tools

- **Roles:**
  - **Tech lead:** architecture, code reviews.
  - **Frontend devs:** Phaser + React.
  - **Backend devs:** Node.js + Colyseus + DB.
  - **Game designer:** systems, balance, content.
  - **Artist(s):** tilesets, characters, UI.
  - **DevOps:** infra, CI/CD, monitoring.
- **Workflow:**
  - Agile sprints (2 weeks).
  - Feature branches + PRs.
  - Automated tests for core systems (movement, combat, economy).
- **Tools:**
  - GitHub/GitLab, CI (GitHub Actions).
  - Issue tracking (Jira/Linear).
  - Design docs in Markdown (like this plan).

---

## 7. Milestones and deliverables

- **Milestone 1:**
  - Single zone, 20 players, movement + chat.
- **Milestone 2:**
  - Combat, basic progression, 3 zones.
- **Milestone 3:**
  - Parties, guilds, trading, 500+ CCU per shard.
- **Milestone 4:**
  - Live-ops tools, events, performance pass.
- **Milestone 5:**
  - Soft launch, telemetry-driven tuning, roadmap for expansions.

---

## 8. Specification requirements

- **Platform support:**
  - Browser-based 3D experience that runs on modern desktop browsers and recent mobile browsers.
  - Graceful fallback or reduced feature mode for lower-end devices.
- **Rendering & world:**
  - Roblox-style 3D world with low-poly/blocky assets, physics-friendly movement, and scalable scene streaming.
  - Seamless room/zone transitions with minimal loading disruptions.
- **Networking:**
  - Real-time WebSocket sync for player movement, state updates, and chat.
  - Authoritative server simulation with client-side prediction and reconciliation.
- **Economy:**
  - Solana token support for the main currency: `DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump`.
  - Backend blockchain service for wallet integration, token verification, and on-chain transaction tracking.
- **Security & validation:**
  - Anti-cheat and anti-exploit checks on the server for movement, item trades, and currency flows.
  - Secure authentication, session handling, and rate limiting.
- **Content pipeline:**
  - Versioned game data and world assets managed through Git and CI.
  - Editable world and item definitions for rapid iteration.

  ---

  ## 9. Hosting & Scaling

  - **Hosting:**
    - Static assets (models, textures, JS bundles) served from CDN / object storage (S3, Azure Blob) with cache-control and immutable asset hashes.
    - Game server fleet (authoritative Colyseus/Nakama rooms) hosted in containerized Kubernetes clusters (EKS/GKE/AKS) or managed container services.
    - Managed databases for persistence: Primary PostgreSQL with read-replicas and automated backups; Redis (managed) for ephemeral state and pub/sub.
    - Solana-related infrastructure: a lightweight blockchain service (stateless API) to interact with Solana RPC endpoints, a secure signing gateway for authorized on-chain actions, and optional indexer for token activity.

  - **Scaling plan:**
    - Horizontal scaling of game server pods with HPA (Horizontal Pod Autoscaler) driven by custom metrics (active rooms, CCU per pod, CPU) and KEDA or custom scaler for event-driven spikes.
    - Shard sizing: define target CCU per shard (e.g., 500–2,000 CCU) and autoscale pod count per shard; use load balancer + routing to distribute new sessions evenly.
    - Database scaling: use connection pooling (PgBouncer), read replicas for heavy read workloads, and partitioning/archival for large tables.
    - Asset delivery: use CDN with regional POPs and edge caching; fallback to origin on cache-miss.
    - State and session handoff: design lightweight handoff protocol to transfer players between pods/rooms with minimal loss; persist durable state in DB and ephemeral state in Redis.
    - Cost controls: scale down idle shards during off-peak hours, apply spot/low-cost instances for non-critical workloads, and implement rate limits for auto-scaling to avoid runaway costs.
    - Observability: instrument autoscaling metrics, request/response latencies, resource usage, and on-chain transaction rates; feed into Prometheus + Grafana and alerting.

  ---

  ## 10. Cost estimates

  - **Assumptions:**
  - Target shard CCU: 100–500 concurrent users per shard for early MVP.
  - Average session length: 30 minutes.
  - Typical pod supports ~100–250 CCU for lean isometric simulation.

- **Recurring monthly costs (order-of-magnitude):**
  - CDN / storage (models, bundles): $50–$500 (depends on traffic and asset size).
  - Game server compute (K8s nodes / pods): $200–$4,000 for a small fleet, shrinking further with aggressive autoscaling and spot capacity.
  - Database (managed Postgres + replicas): $100–$1,000.
  - Redis (managed): $50–$500.
  - Solana RPC & indexer (RPC calls, minimal on-chain usage): $50–$500.
  - Monitoring, logs, and alerting: $20–$200.
  - Bandwidth egress: $100–$1,000 depending on CCU and asset sizes.
  - Misc (CDN invalidations, backups, incidental services): $25–$200.

- **One-time / upfront costs:**
  - Development and integration (team months): Varies by team size; budget accordingly.
  - CI/CD and infra automation setup: $2k–$8k (or equivalent engineering time).
  - Optional Solana indexer or custom signer gateway setup: $1k–$4k initial engineering + infra.

- **Cost model guidance:**
  - Use a per-CCU marginal cost model to forecast monthly spend: estimate per-CCU CPU/memory footprint, convert to node-hour costs, and multiply by projected CCU-hours.
  - Factor in peak provisioning and autoscaling inefficiencies (reserve ~20% headroom).
  - For Solana token operations, minimize on-chain calls and budget for covered RPC provider tiers during initial launch.
  ## 11. Next steps (practical)

1. **Lock tech stack** (Phaser 3 + Colyseus + Postgres + Redis).
2. **Create monorepo** and minimal client/server skeleton.
3. **Build isometric single-player prototype** (movement, camera, collision).
4. **Integrate Colyseus** and get 2–4 players moving in the same map.
5. **Iterate** toward Milestone 1 with strict scope control.

