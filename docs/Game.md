# MetricBase World — Game Overview

## Vision

**MetricBase World** is a browser-native isometric MMO: a persistent online world where players explore zones together in real time, chat, progress their characters, and participate in an in-game economy with optional Solana token integration.

The long-term goal (see `PLAN.md`) is a zero-install MMO with:

- Seamless zone travel across a sharded world
- Real-time multiplayer with authoritative server simulation
- Character progression, items, and social systems
- Optional Solana token integration for in-game economy
- Horizontally scalable infrastructure

The current build is a playable multiplayer prototype with the full **everyday
loop** — Gather (woodcutting, mining, fishing, farming), Craft, Trade, and Build
(housing + player-run shops) — plus quests, a peer-to-peer gold market, a
Community layer (emotes, online roster, $BASE-holder billboard), and a
leaderboard.

On top of that sits the **PvP Major Upgrade** (see the dedicated section below and
`pvp-update.md`): a combat foundation (stats, armour, crit, weapon-driven
abilities, equipment durability), open-world **PvP zones** (Safe/Yellow/Red/Black)
with death loot, **crime & bounties**, **Guild Warfare** (ranks, bank, tax, wars),
**Territory Control** (capturable points that pay guild income), and weekly-style
**Castle Siege** for the King Crystal. There are five explorable zones including a
burn-gated full-loot **Black Zone**, plus a VIP **Community Lodge** with a Base
Rush arcade.

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
14. **Gather** — Chop trees (**F**), mine rocks, and fish the lake (**G**) — Woodcutting, Mining, and Fishing each level up. Plant and harvest crops on **farm plots** (Farming). Skill gauges show in the HUD.
15. **Craft** — Open the Crafting panel (**C** / 🔨) to turn materials into planks, copper bars, cooked fish, bread, and a copper dagger (small gold forge fee).
16. **Build (Housing)** — Buy an empty 3x3 land plot for **500 gold** (press **E** on it) and build a **house** or **shop**. Ownership persists with your name on it; built structures block movement, empty plots don't.
17. **Player-run shops** — Stock your shop with items from your inventory at prices you set; other players buy them (choose a quantity or "All"). Collect your accrued **earnings** when you visit.
18. **Community** — Open the 😀 tray to **emote** (everyone nearby sees it), check **who's online** (top-centre), and read the hub **billboard** showing the live **$BASE holder count** and players online.
19. **Leaderboard** — Open 🏆 to see the top players by **Level**, **Richest** (gold), and **Skills** (total gather levels).
20. **Persist progress** — Character name, zone, position, level, XP, gold, inventory, equipped weapon, quests, skills, knockout timer, owned plots/shops, and NPC interact cooldowns save to PostgreSQL (Neon).
21. **Leave World** — Use the HUD button to disconnect and return to the login screen.

### Zones

| Zone ID | Display Name | Notes |
|---------|--------------|-------|
| `zone_hub` | MetricBase Hub | 🟢 Safe. Themed regions: NW forest, W quarry, central plaza (Aria, Pip, billboard), NE houses, SW farmland, SE lake. Portal to Wilderness; west door to the VIP Community Lodge |
| `zone_wilderness` | Wilderness | 🟡 Yellow (opt-in PvP). Rook, Training Dummy, Wild Slimes; extra trees/rocks/fish; a capture point; portals to Hub and Slime Grotto |
| `zone_grotto` | Slime Grotto | 🔴 Red (open PvP). Moss, Slime Brute; iron/gemstone/hardwood/fish nodes; a capture point; **Black Gate** to the Obsidian Reach |
| `zone_black` | Obsidian Reach | ⚫ Black (full loot). Burn-gated lifetime entry; richest resources; two capture points; the **King Crystal** siege objective |
| `zone_interior` | Community Lodge | 🟢 Safe, **VIP-only** (hold 20M $BASE or a 14-day pass). Base Rush arcade |

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
| E / Interact button | Interact with nearest thing: NPC/shop, farm plot, or land plot/shop |
| Space / Attack button | Attack nearest hostile NPC |
| F | Chop/mine the nearest tree or rock |
| G | Fish at the nearest fishing spot |
| I | Toggle inventory |
| C | Toggle the Crafting panel |
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

## Major Upgrade: PvP, Guilds & Territory (How to Play)

Everything below is the **PvP Major Upgrade** layered on top of the everyday loop.
Full design + build notes live in `docs/pvp-update.md`.

### Controls (updated)

Movement still uses **WASD / arrow keys** and the mobile **D-pad** — those always
work. On top of that:

| Input | Action |
|-------|--------|
| **Left-click / tap ground** | Walk there (click-to-move); a marker shows your destination |
| **Left-click / tap an enemy** | Target a hostile mob **or player** (a reticle appears) |
| **Right-click** (or **Space**, or mobile ⚔️) | Attack your target / nearest hostile |
| **1–5 / Q / E / R** | Weapon abilities on the **skill hotbar** (desktop) |
| **F** | Pick up a **loot bag** in reach (else gather) — mobile uses the ✨ button |
| Left-click the **King Crystal** during a siege | Strike it (Black Zone) |

The skill hotbar sits bottom-centre on desktop; the abilities it shows **change with
your equipped weapon**.

### Combat & Equipment

- **Stats:** HP is 60 + 10/level. Damage is `Attack × SkillMod × Crit − Armour`,
  where armour has **diminishing returns** (more armour always helps, never makes
  you invulnerable). Base 5% crit at 1.5×; gear raises both.
- **Equipment slots:** weapon, tool, helmet, chest, gloves, boots, two rings,
  necklace, cape, offhand. Gear has **8 rarity tiers** (Common → Unique), shown by
  name colour, that scale its stats.
- **Crafting armour:** forge copper/iron/steel **helmets, chestplates, gauntlets,
  greaves**, plus a gemstone ring, pearl amulet, and traveler's cape at the
  Crafting panel (materials + a gold forge fee).
- **Durability & repair:** your weapon and armour wear down as you fight; gear that
  hits 0 **breaks** and unequips. Use **🔧 Repair all gear** in the Inventory panel
  to restore everything for a gold fee (2g per point) — a steady gold sink.
- **Enhancement (+N):** in the Character panel, select an equipped piece and
  **Enhance** it (gold, with a success rate that drops at higher levels, up to +9)
  to boost its stats. Your **Gear Score** climbs with better, more-enhanced gear.
- **Crafting panel tabs:** the forge has **Craft** (gear/tools/food), **Refine**
  (smelt ore→bars, mill logs→planks), **Enhance** (the same +N upgrade), and
  **Dismantle** (salvage an unwanted item back into ~half its materials).
- **Currencies:** alongside **🪙 Gold** you earn **🎖️ Honor** (PvP victories),
  **🔰 Guild Coin** (PvP wins while in a guild), and **💎 Gems** (a rare drop
  from powerful foes). Balances show in the top bar and the Character panel.
- **Quartermaster:** hit **Spend ▸** in the Character panel to trade those
  currencies for supplies — Honor buys potions/rations/gemstones, Guild Coin
  buys bulk crafting stock, and Gems buy premium gear and fast mounts.
- **Weapon abilities:** each weapon type (sword, dagger, …) grants a 5-slot kit with
  per-ability cooldown, stamina cost, and damage multiplier. Swap weapons to swap
  your hotbar.
- The Inventory panel shows your live **⚔️ attack / 🛡️ armour / 🎯 crit / 💥 crit
  power** and a durability bar per equipped piece.

### PvP Zones & Death

Every zone has a **danger tier**, shown by a banner on entry and a corner chip:

| Tier | Where | Rules |
|------|-------|-------|
| 🟢 **Safe** | Hub, Community Lodge | No PvP |
| 🟡 **Yellow** | Wilderness | Opt-in PvP — toggle your **PvP flag**; both fighters must be flagged. No item loss. |
| 🔴 **Red** | Slime Grotto | Open PvP. On death you drop your **gathered materials**; gear survives. |
| ⚫ **Black** | Obsidian Reach | **Full loot** — drop everything in your bag + half your loose gold. Richest resources. |

When you're knocked out in Red/Black, your dropped items spawn a **loot bag** on the
ground that anyone can grab with **F**. Anti-grief is built in: players under level 5
can't be drawn into PvP, there's brief **spawn immunity** after entering a zone, and
if you get stuck on terrain you're auto-returned to spawn.

### Crime, Reputation & Bounties

Kill a non-consenting player (a "lawful" kill in a Yellow zone) and you become a
**Criminal** — your name turns red and **town/Safe-zone gates are barred to you**
until the flag expires (~10 min). Anyone can place a **bounty** (gold) on a target;
whoever knocks them out claims the pooled gold. Guild-war kills are sanctioned and
don't make you a criminal.

**Jail:** if a criminal is defeated in PvP, the guards **arrest** them — they're
sent to the **Jail** zone and held for 2 minutes (no pay-to-respawn). The cell's
exit stays locked until the sentence is served, after which they're released and
pardoned (criminal flag cleared) so they can re-enter towns.

### Duels (Arena)

For a fair fight with no stakes, **left-click a player** and hit **⚔️ Duel** to
challenge them. If they accept, you both heal to full and fight a **consensual
1v1 anywhere — even in a safe town** — with **no loot, no crime, and no knockout
penalty**. Drop your opponent to win; the loser is simply restored. Duels draw
after 90s, and leaving forfeits.

### Mounts

Craft a **mount** — Sturdy Pony (+25%), Swift Steed (+45%), or Dire Wolf (+70%) —
and equip it from the Inventory panel's Mount slot for a permanent
**movement-speed** boost.

### Pets

Collect cosmetic **companion pets** — Hearth Kitten, Pet Slime, or Spirit Owl —
from the Quartermaster (spend 💎 Gems). Equip one in the Character panel's **Pet**
slot and it trails along beside you in the world for everyone to see.

### Community Lodge (VIP) & Base Rush Arcade

The **Community Lodge** is VIP-only, with three ways in (all prompted at the door,
saved to your character):

- **Hold ≥ 10,000,000 $BASE** — free, permanent access while you hold.
- **Burn pass** — **100 gold + burn 10,000 $BASE** for a **14-day** pass.
- **Gold pass** — **1,000 gold** (no burn) for a **14-day** pass.

Inside, talk to the arcade host to open the **Base Rush** game
(`apps.metricbase.org/base-rush`) in a full-screen cabinet.

**Lodge Blackjack.** Talk to **Ace, the Blackjack Dealer** to open the table.
Pick a currency table — **SOL, USDC, IDRX, or $BASE** — then **deposit** from
your wallet to build a balance at that table. Bet from your balance and play
**Classic Blackjack**: the dealer stands on 17, blackjack pays **3:2**, and you
can **Hit / Stand / Double**. Cards are dealt by the server (provably the same
RNG for everyone). **Withdraw** any time to cash your balance back out to your
wallet on-chain. Each table is denominated in its own currency, with its own
min deposit and bet limits.

### The Black Zone (Obsidian Reach)

Reached through the **Black Gate** in the Slime Grotto. Entry requires **burning
1,000,000 $BASE on-chain — a one-time, LIFETIME unlock** (verified server-side;
saved to your account). It's full-loot and holds the best resources (obsidian
gemstone veins, ancient hardwood, dense iron) and the King Crystal.

### Guild Warfare

- **Found a guild** (1,000g) or **request to join** one — joins are
  **approval-gated**: a leader or officer must accept your request before you're a
  member. Your pending request shows as "Pending" (cancel any time), and
  leaders/officers see incoming requests in the guild panel.
- **Ranks:** Leader 👑 / Officer ⭐ / Member. The leader promotes, demotes, and
  kicks; officers can approve/deny join requests, kick members, and manage the
  bank + wars.
- **Guild bank:** any member deposits gold; officers and the leader withdraw.
- **Income tax:** the leader sets 0–10%; a slice of every member's gold earnings is
  auto-skimmed into the bank.
- **Wars:** declare war on another guild (mutual). Warring guilds can fight each
  other **freely** — even in Yellow zones without flagging — and those kills are
  lawful. End the war to make peace.

All of this is in the **🛡️ Guild** panel.

### Territory Control

PvP zones contain **capture points** (e.g. Grotto Heart, Obsidian Throne). Stand on a
point as a guild member for ~12 seconds **uncontested** to claim it — a rival guild
member nearby **contests** it and freezes progress. A flag shows the owning guild's
tag, a capture-progress ring, and contested state. Each point your guild holds pays
**territory income** into your guild bank every 5 minutes. Ownership persists; if a
guild disbands, its territory is released.

### PvP Seasons & Rank

Every PvP knockout adjusts your **PvP rating** (+25 on a kill, −15 on a death,
floored at 0), which maps to a **rank**: Bronze → Silver → Gold → Platinum →
Diamond → Master → Grandmaster → Legend. The **🏆 Leaderboard** has a **PvP tab**
showing the season's top fighters by rating. Seasons last **90 days**; at each
rollover your rating resets to the baseline on your next login (your character,
items, and gold are kept).

### Castle Siege

On a recurring schedule (default: a **10-minute window every 30 minutes**), the
**King Crystal** in the Obsidian Reach becomes vulnerable — a red **"CASTLE SIEGE
LIVE"** banner appears. Guilds race to destroy it (click the crystal to strike it).
The guild that lands the killing blow is crowned **Sovereign of MetricBase** until
the next siege, wins a large prize into its guild bank, and is announced
server-wide. The reigning Sovereign is shown in a 👑 chip and persists across
restarts.

> **$BASE / on-chain note:** VIP passes and Black-Zone entry use real Solana token
> burns/holdings, verified by the server. Configure `TOKEN_MINT` / `SOLANA_RPC_URL`
> on the server (and the client RPC) for your live $BASE mint.

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

- [x] Weapon-driven ability system (Phase 1)
- [x] Guilds and parties (guild warfare added in Phase 3)
- [x] More zones and bosses (Obsidian Reach / Black Zone + King Crystal)
- [x] Open-world PvP, territory control, castle siege (Phases 2–5)
- [ ] Redis session layer
- [ ] Tiled/LDtk map pipeline (currently procedural placeholder tiles)
- [ ] Deeper mobile UX polish
- [ ] PvP Seasons — rating/rank, 90-day reset, seasonal leaderboards (Phase 6)

---

## Local Development

```bash
npx pnpm install
npx pnpm dev
```

- Client: http://localhost:5173
- Server: ws://localhost:2567

See `README.md` for database setup and deployment instructions.