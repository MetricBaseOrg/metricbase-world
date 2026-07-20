# MetricBase World — Major Upgrade

> Status: Living spec · Baseline game version: **0.38.0** · Target through: **0.45.0**
> Focus: Turn the PvE sandbox into an MMO open-world **PvP** game with a player-driven economy, plus a visual / UI / UX / FX upgrade.

This document is both the **design vision** and the **executable build plan**. The vision sections describe where MetricBase World is going; the *Phase Ladder* describes exactly what ships, in what order, against which files.

---

# Vision

MetricBase World is an ALL-IN-ONE game. PvP exists to create **risk, territory control, resource competition, guild politics, economic demand, and long-term progression**.

Combat supports the economy, it does not replace it. Players gather, craft, trade, build — *then* fight over valuable resources.

```text
Gather → Craft → Trade/Upgrade → Explore Dangerous Zones → Fight Players
   → Loot → Sell on Market → Become Rich → Expand Guild → Control Territory
```

---

# Current State (v0.38.0)

A faithful map of what the live game already does, so the upgrade extends rather than reinvents.

| System | Status | Where it lives |
|---|---|---|
| Movement (server-authoritative + client prediction) | ✅ Built | `server/src/rooms/ZoneRoom.ts`, `client/src/game/GameScene.ts` |
| **PvE** combat vs mobs (damage numbers, slash VFX, mob HP bars) | ✅ Built | `shared/src/combat.ts`, `ZoneRoom.handleAttack`, `GameScene.ts` |
| Health / stamina / knockout + respawn | ✅ Built | `shared/src/combat.ts`, `shared/src/stamina.ts` |
| Gathering (woodcutting / mining / fishing) + tool tiers | ✅ Built | `shared/src/resources.ts`, `skills.ts`, `equipment.ts` |
| Inventory (16 slots) + 2 equipment slots (weapon, tool) | ✅ Built | `shared/src/items.ts`, `equipment.ts` |
| Crafting (17 recipes, gold forge-fee sink) | ✅ Built | `shared/src/crafting.ts` |
| Economy: dynamic vendor + P2P gold market + multi-currency | ✅ Built | `shared/src/economy.ts`, `market.ts`, `currencies.ts` |
| Guilds (create / join / chat / tag) | ✅ Built | `shared/src/guild.ts`, `server/src/guild/guildRegistry.ts` |
| Housing, farming, day/night, weather | ✅ Built | `housing.ts`, `farming.ts`, `daynight.ts`, `weather.ts` |
| Canvas avatars (6 hair, 5 outfits, animations) | ✅ Built | `client/src/character/*` |
| Web Audio SFX framework (41 types) | ⚠️ Defined, not wired | `client/src/audio/soundEffects.ts` |
| **Player-vs-Player combat** | ❌ Missing | — |
| **Zone danger tiers (safe/yellow/red/black)** | ❌ Missing | — |
| **Armor / full equipment slots / rarity / durability** | ❌ Missing | — |
| **Death/full-loot rules, crime, reputation, bounty** | ❌ Missing | — |
| **Skill hotbar, weapon-driven abilities** | ❌ Missing | — |
| **Guild ranks/bank/tax, territory, siege, seasons** | ❌ Missing | — |

---

# Combat Model

## Controls (agreed scheme: keep WASD, add click + hotbar)

```
Movement      WASD / Arrow keys     (unchanged, server-authoritative)
Left Click    Select / target
Right Click   Attack target (or nearest hostile in range)
1 2 3 4 5     Weapon skills (determined by equipped weapon)
Q             Dash
E             Utility / Interact
R             Ultimate
Space         Roll
F             Interact / loot
```

The original "left-click to move" scheme is intentionally **not** adopted — WASD movement and prediction already feel good; we layer targeted combat on top instead of reworking pathing.

## Damage Formula

```
Final Damage = Attack × SkillModifier × Crit − ArmorReduction
```

Armor reduces damage with **diminishing returns** (shared helper, used by both server authority and client preview). A single source of truth in `shared/src/combat.ts` / `shared/src/stats.ts`.

## Character Stats

Primary: Health, Mana, Stamina, Movement Speed, Attack Speed, Critical Chance, Critical Damage, Armor, Magic Resist, Attack Range, Vision Range. Economy stats: Gather/Mining/Fishing/Crafting Speed, Carry Weight, Luck.

## Progression

No fixed classes — **the equipped weapon determines the 5 active skills**. Swap weapons, swap your kit. Encourages experimentation.

| Weapon | Role | Weapon | Role |
|---|---|---|---|
| Sword | Balanced | Bow | Long range, weak up close |
| Spear | Long reach | Crossbow | Heavy ranged |
| Hammer | Slow, high dmg, stun | Staff | Magic / AOE / support |
| Axe | Bleed | Dagger | Fast, crit, stealth |

---

# Equipment, Rarity, Durability

**Slots:** Helmet · Armor · Gloves · Boots · Ring · Ring · Necklace · Cape · Weapon · Offhand · Pet · Mount.

**Rarity:** Common · Uncommon · Rare · Epic · Legendary · Mythic · Ancient · Unique — applied as stat multipliers.

**Durability:** every fight (and gathering) reduces durability. Repair costs resources + gold. Destroyed gear creates demand for crafters — a permanent resource sink.

---

# PvP Zones & Death

| Zone | PvP | On death |
|---|---|---|
| **Safe** (town, market, guild hall, starter) | None | No penalty |
| **Yellow** | Optional | Lose durability; small loot penalty |
| **Red** | Open | Drop gathered resources + gold fee; gear survives |
| **Black** | Full loot | Drop everything except cosmetics, quest items, soulbound |

Anti-grief throughout: starter protection, combat-level matching, spawn immunity, combat tagging, logout/AFK timers, safe logout.

## Crime, Reputation & Bounty

Attack first → become Criminal → red name → guards attack in safe zones → bounty rises. Reputation ladder: Friendly · Neutral · Suspicious · Criminal · Outlaw · Legend. Players place bounties; hunters track criminals for gold, guild rep, and titles.

---

# Guild Warfare, Territory & Siege

- **Guild PvP:** wars, rankings, tax, bank, buffs, shop, missions, alliances, rivalries.
- **Territory:** guilds capture mines, forests, farms, lakes, ruins, ports, marketplaces, castles, villages → resource bonus, tax income, prestige, exclusive crafting stations, spawn points.
- **Castle Siege:** weekly, large-scale (50v50+), capture flags, destroy gates, protect the king crystal. Winner owns the territory.

---

# Seasons

Every 90 days: reset PvP rank, leaderboard, territory ownership. Keep characters, items, buildings, economy. Rewards: titles, mount/weapon skins, guild statues, housing decor, cosmetics, season badges.

---

# Economy Integration

Everything consumed in PvP is **crafted by players**: weapons, armor, food, potions, arrows, repair kits, bombs, traps, mount gear. PvP constantly creates demand → permanent resource sink.

---

# Phase Ladder (build order)

Each phase ships behind a `GAME_VERSION` bump (`shared/src/index.ts`) and must keep gathering, crafting, market, guild chat, housing, and farming working.

### Phase 0 — Visual / UI / UX + Combat UI · **→ 0.39.0**
The combat *shell*. No new combat math yet.
- Skill hotbar `client/src/ui/SkillBar.tsx` (5 slots + Q/E/R + Space), radial cooldowns (reuse `CircleGauge.tsx`), mobile variant in `TouchControls.tsx`.
- Click/target combat in `inputControl.ts` + `GameScene.ts`: right-click attacks nearest hostile, left-click targets; target reticle + hostile highlight. WASD untouched.
- Feedback polish: crit damage numbers (gold/large), screen-shake, hit-stop, expanded impact VFX in `GameScene.ts`.
- Wire the 41 SFX via Web Audio synthesis in `audio/soundEffects.ts` (no binary assets).
- Avatar builder upgrade: more hair/outfit + dye picker (`character/*`, `ui/CharacterPreview.tsx`); bump Character Art Version.
- *Done when:* hotbar cooldowns animate, right-click kills a slime with sound + crit numbers, builder shows new options, no WASD/gather regression.

### Phase 1 — Combat Foundation · **→ 0.40.0**
- Expanded stat model + diminishing-returns armor formula (`stats.ts`, `combat.ts`).
- Full equipment slots + rarity multipliers (`equipment.ts`, `schema/PlayerSchema.ts`).
- Durability + repair recipe/cost (`items.ts`, `crafting.ts`).
- Weapon-driven abilities (`shared/src/abilities.ts`, server `handleAbility`).
- *Done when:* armor reduces damage server-side; weapon swap changes hotbar; gear wears and repairs.

### Phase 2a — Zones, Controls & Venue · **→ 0.41.0 (shipped)**
- Zone danger tiers (`zones.ts`: Wilderness=Yellow, Grotto=Red) + client `ZoneBanner` tint/banner/chip.
- **Click/tap-to-move** alongside WASD + touch D-pad (`GameScene` pointer + move marker) — mobile-friendly.
- **VIP Community Lodge**: entry gated to wallets holding ≥ 20,000,000 $BASE (`zones.ts` `vipMinHold`, server `walletHoldsAtLeast`).
- **Arcade machine** in the Lodge → embeds Base Rush (`apps.metricbase.org/base-rush`) via `ArcadeModal` (full-screen iframe + open-in-tab).

### Phase 2b — Open-World PvP combat · **→ 0.42.0 (shipped)**
- PvP combat path (`ZoneRoom.handleAttackPlayer`) with anti-grief: starter protection (<L5), spawn immunity, Yellow-zone opt-in flag (`togglePvpFlag`), combat tagging.
- Tier-based death loot + **loot bags on the ground** (server `dropLootBag`/`handleLootPickup`, client render + F pickup). Red drops materials; Black drops everything + half loose gold.
- Crime / reputation / bounty (`shared/src/reputation.ts`): unlawful kills flag you Criminal (red name on `PlayerSchema`, barred from Safe zones); `placeBounty` pays the killer.
- **Black zone "Obsidian Reach"** (full-loot) reached via the Grotto's Black Gate — entry **burns 1,000,000 $BASE on-chain** (`verifyTokenBurn` server-side, `tokenBurn.ts` client, `BlackZoneModal`). A verified burn grants a 1-hour pass.
- *Verify (manual QA needed):* two clients fight in the Grotto (Red), loser drops a lootable bag; killing in Yellow flags the attacker criminal and bars town entry; burning 1,000,000 $BASE opens the Black Gate. Build-verified; runtime needs DB + two clients + funded wallet.

### Phase 3 — Guild Warfare · **→ 0.44.0 (shipped)**

- **Ranks** (leader / officer / member): leader promotes/demotes/kicks; officers kick members + manage war/bank.
- **Guild bank**: members deposit, officers+ withdraw (`depositToBank`/`withdrawFromBank`, persisted `guilds.bank`).
- **Income tax** (leader-set, 0–10%): a slice of members' gold earnings auto-skims to the bank (`applyGuildTax` hooked in `grantGold`).
- **War declarations** (mutual): warring guilds fight freely (bypass Yellow opt-in) and war kills are lawful (no criminal flag). `declareWar`/`endWar`, war list in `GuildPanel`.
- Persisted via new `guilds` columns (officers, bank, tax_rate, wars); state pushed to all members via presence (`broadcastGuildState`).
- *Verify (manual QA):* two guilds declare war and fight in a Yellow zone without flagging; tax skims to the bank on mob kills; officers withdraw.

### Phase 4 — Territory Control · **→ 0.45.0 (shipped)**

- **Capture points** in PvP zones (Wilderness/Grotto/Black) — claim by standing on a point uncontested for ~12s; a rival guild member nearby freezes/contests it.
- **Persistent ownership** (`territories` table + registry); a flag renders the owning guild's tag + a capture-progress ring + contested state.
- **Territory income**: each held point pays gold into the owning guild's bank every 5 min (`payTerritoryIncome` → `depositToBankById`); disbanding a guild releases its territories.
- Also fixed: billboard "online" now counts **global** non-spectator players across all zones (was per-zone), rebroadcast to every zone on join/leave.

### Phase 5 — Castle Siege · **→ 0.46.0 (shipped)**

- **King Crystal** objective in the Obsidian Reach (Black Zone), vulnerable on a recurring schedule (default 10-min window every 30 min, epoch-aligned via `getSiegeWindow`).
- Guilds strike the crystal during the open window (click it); the guild that lands the killing blow is crowned **Sovereign of MetricBase** until the next siege, wins `SIEGE_PRIZE` gold into its bank, and is announced server-wide.
- Sovereign persists (`siege_state` table, `siegeRegistry`); crystal HP resets each window. Client shows the crystal + HP bar in-world and a `SiegeBanner` (live banner / 👑 Sovereign chip).

### Phase 6 — PvP Seasons · **→ 0.47.0 (shipped)**

- **PvP rating** earned on kills (+25) / lost on death (−15, floored at 0), persisted per character (`pvp_rating`/`pvp_kills`/`pvp_season`).
- **Rank tiers** Bronze → Legend from rating (`shared/src/pvprank.ts` `getPvpRank`).
- **90-day seasons** (`getPvpSeason`) with **lazy reset** — a player's rating/kills reset to baseline on their first login of a new season.
- **Seasonal leaderboard**: a new **PvP** tab (top by rating, shows rank + season) alongside Level/Richest/Skills.

---

# Stat & Economy Rebalance (PvP tuning targets)

Holistic retune so PvP combat reads well and the economy stays a sink. Finalized numbers land with Phase 1; targets:

| Lever | Current (0.38.0) | PvP target | Rationale |
|---|---|---|---|
| Player base HP | 40 + 8/level | 60 + 10/level | Longer TTK so positioning/skills matter |
| Base attack | 18 + weapon bonus | 18 × skill mod − armor | Formula-driven, armor-aware |
| Armor | none | diminishing returns | Reward defensive gear without invuln |
| Crit | none | chance + multiplier | Build variety |
| Durability | none | wears per fight/gather | Gear sink → crafter demand |
| Respawn cost | 100g flat | tier-scaled | Risk matches zone reward |

---

# Future Features

Naval PvP · Airships · Mounted combat · Mercenary contracts · Kingdom politics · Player governments · Jail · Arena · Battlegrounds · World championships · Cross-server wars · Regional trading wars.

---

# Success Metrics

DAU · Avg session time · PvP participation · Guild participation · Crafted items/day · Marketplace volume · Resources gathered · Items destroyed · Player kills · Territory wars/week · Inflation rate · Gold sink vs generation.

---

# Design Philosophy

- **Easy to Learn** — simple controls, intuitive combat.
- **Hard to Master** — positioning, timing, teamwork, strategy decide battles.
- **Player-Driven Economy** — every item has value because PvP creates demand.
- **Risk Creates Stories** — the memorable moments come from risking cargo, defending territory, escaping with loot.
- **PvP Supports the Sandbox** — combat is the engine that drives gathering, crafting, trading, politics, and the living economy.

---

# References

Design refs in `assets/`: `design.png`, `farmer.png`, `fisher.png`, `hair.png`, `miner.png`, `outfit.png`, `pvp.png`.
