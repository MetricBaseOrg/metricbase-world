# Changelog

All notable changes to **MetricBase World** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- **Ad claims were impossible** — `takeMemberEarnings` ran `UPDATE … SET earnings = 0 … RETURNING earnings`, but Postgres `RETURNING` yields the **post-update** value (0), so every claim returned "Nothing to claim yet." It now captures the pre-update balance via a `FROM` subquery. Also enforces the **10,000 $BASE minimum claim** server-side and loads brand `lifetime_spent` on init so a restart no longer clobbers it.
- **Ad deposit credited but balance showed 0** — The brand dashboard returned the in-memory balance, which could be stale/empty (e.g. before the wallet link resolved). Deposits + dashboard now resolve the wallet as the linked one **or** the client-reported one (the deposit is verified against the transaction's actual payer), and the dashboard **syncs the balance from the DB** before responding. Added an "Already paid? Credit a past deposit" tx-hash recovery (idempotent).
- **Ad deposit button blocked with "disabled"** — The client gate fired when the brand dashboard hadn't delivered `houseWallet` yet; the server now always sends the dashboard (with `houseWallet`/mint) and the client re-requests instead of hard-failing. Deposit button restyled to match the cashier.
- **Grotto ad billboard covered by a house** — Moved land plot `grotto_land_1` (its 3×3 footprint sat over the right Grotto billboard tile). Hub billboards moved to clear corners off the tree/house name tags.
- **Gold market chart said "No trades yet" when trades existed** — The price chart only ever aggregated `base`-currency trades, so trades settled in IDRX / USDC / SOL never showed up. The chart is now **currency-aware**: it follows the selected currency in the picker (and refreshes when you switch), shows prices in that currency's units (e.g. "IDRX per 1 gold"), and the empty state names the currency ("No USDC trades yet — switch the currency above to see other markets"). Threaded a `chartCurrency` through `buildMarketState` → `listRecentMarketTrades` and the `marketRefresh` message.

### Changed

- **Mobs hit much harder** — Counter-attack damage from the **Training Dummy** (8 → 48), **Wild Slime** (5 → 30), and **Slime Brute** (12 → 72) is increased by 500% (×6). Combat is now far riskier — keep food/potions handy and don't trade blows carelessly.

### Added

- **In-game ad marketplace — brands bid, players earn** — A two-sided ad platform (kickbacks.ai-style) opened from **⚙️ → 📣 Ads & Earnings**, with money in **$BASE** over the casino treasury/payout rails. **Brands** deposit $BASE, create a campaign (image, headline, click URL), and bid a **CPM (per 1,000 impressions)**; approved ads serve on **in-world billboards** (one per zone) and a **global banner**, ranked by bid. One impression is counted per player, per minute, per visible slot; the brand is charged `CPM/1000` and a **registered viewing player earns 50%**. **Players** who invite 5 friends can **join the rev-share program** and **claim** earnings in $BASE (min 10,000). Self-serve with **admin approval** (treasury wallet); empty slots show an "Ads here" house promo. New `shared/src/ads.ts`, `server/src/ads/adService.ts`, `server/src/db/ads.ts` (tables `ad_brands`/`ad_campaigns`/`ad_members`/`ad_ledger`), `client/src/ui/AdsPanel.tsx` + `AdBanner.tsx`, in-world billboards in `GameScene.ts`.
- **Ad admin dashboard** — Admin-only **📊 Dashboard** tab monitoring the marketplace: platform totals (revenue / players paid / platform cut / impressions / active + pending campaigns), **slot occupancy**, and a live **bid-rank leaderboard** (CPM, balance, views, current slot). Admins are auto-enrolled in the program and bypass the invite requirement. `adService.getAdminDashboard()` + `adAdminDashboard` message.
- **Ads show in every zone** — Each zone's billboard shows its own ranked ad, or **falls back to the top-ranked ad** when its slot is empty, so a single advertiser appears worldwide (the global banner does the same). **Fallback impressions are billed** — the top-ranked campaign is charged and the viewer earns their share for fallback views, the same as real slot assignments.
- **Mobile: Map & Mail moved off the d-pad cluster** — The 🗺️ and 📬 buttons next to the on-screen controls were removed; both stay reachable from the top bar (the zone chip opens the map, the 📬 chip opens mail).
- **Recent transactions ticker on the gold market** — Under the price chart, the Gold Market now lists the **latest fills across all currencies** (newest first) — each row shows the gold traded, the amount + currency it settled in, and a relative timestamp ("3m ago"). Powered by a new `listLatestMarketTrades` query and a `recentTrades` field on the market payload.
- **Unified top bar — social toggles consolidated** — On desktop the Guild / Party / Leaderboard / Who toggles are now grouped into a single auto-laid-out **social rail** centered at the top, replacing the four hand-positioned floaters. The whole top edge now reads as one bar: the **TopBar** (name, stats, gold, ⚙️) on the left, the social rail in the centre, and the **Quest log** on the right — all on one line. Mobile keeps its right-side FAB stack untouched (the rail is `display:contents` below 769px). New `chibi-social-rail` wrapper.
- **Animated water shimmer** — Water is no longer a flat fill: soft cyan-white **glints drift and twinkle** across the surface (about half the water tiles get one, scattered deterministically). Each fades in/out on its own phase and sways sideways with a slow sine, so rivers and pools gently ripple. Additive `water_shimmer` glints, animated in `updateWaterShimmer`, torn down with the map on zone change.
- **Night light pools + fire/lantern flicker** — Every lamp post, lantern, and fireplace we placed now actually **lights the world**: each casts a warm additive glow pool that **brightens as night falls** (driven by the day/night clock) and back off by day. **Lamps & lanterns** breathe with a gentle pulse; **fireplaces** flicker livelier and stay lit even in daylight (a warmer orange glow). Reuses the existing `lamp-glow` so it layers over the night overlay like player lamps. New `updateSceneryLights` + per-prop light specs in `renderScenery`.
- **Community Lodge furnished out** — The indoor lodge goes from sparse to cozy: warm **floor lanterns** flanking the fireplace, **bookshelves / storage crates / plants** lining both side walls, a second pair of **chairs** round each table (proper seating nooks), an **entrance rug runner** leading to the door, and **plants flanking the exit doormat**. New `scenery_lantern` texture (a wooden stand with a glowing lantern). 23 props, all verified inside the room on floor tiles and clear of the keeper, spawn, and door.
- **Wilderness & Grotto dressed with props** — The two outdoor zones now get the same scenery treatment as the hub. The **Wilderness** trail gains signposts at both gates, lamp posts lighting the path, a trailside bench, and a hedge row by the south homesteads; the **Slime Grotto** gets an exit signpost and lamp posts lighting the cave gloom (no hedges/benches underground). All placements verified on walkable tiles, clear of resources, NPCs, portals, spawns, and plot footprints.
- **Idle bob + contact shadows** — Players and NPCs now feel alive: standing avatars **gently bob/breathe** in place (each on its own phase so they're not synced), and every player and NPC casts a **soft elliptical contact shadow** on the ground so they read as planted, not floating. The shadow stays put while the avatar bobs above it (a subtle hover). Slimes bounce a little higher; the wooden training dummy stays rigid. Bob is computed bob-free from the true ground position so it never interferes with movement/interpolation. New `contact_shadow` texture.
- **Cobblestone paths + plaza props** — Stone tiles now render as proper **cobblestone** (iso grid of varied cells with mortar lines) instead of flat colour, so paths and the plaza read as cobbled streets. The hub plaza is dressed with new props — **lamp posts** (with a warm glow), a **hedge** border, a **bench**, and a **signpost** toward the Wilderness gate — placed via the zone scenery system (verified on walkable tiles, skipped by the ground-scatter). New `scenery_lamppost/hedge/bench/signpost` textures + cobble in `drawTileDetail`.
- **Warmer, cozier palette** — Retuned the iso tile colours toward a softer cozy-MMO look: gentler warm **grass**, **cobblestone-lavender paths/plaza** (instead of flat beige-grey), and **calmer water** rather than neon brights; grass-tile tint variation leans warm to match. Pure colour tuning in the tile palettes.
- **Market shopfronts** — Built **shops** now have a proper storefront: a **glass display window with colourful goods on a shelf**, under a **scalloped striped awning that takes the shop's roof colour** (so painted shops get matching market fronts), plus a slim door and a hanging coin sign. Makes shops read clearly as places to buy — a step toward the cozy-market look. Reworked `shopAccent` in the building textures.
- **Cleaner top-bar HUD (desktop)** — The tall, cluttered left HUD panel is replaced by a compact **top bar**: name + level, zone + day/night + weather, glanceable HP/Energy/Level + gather-skill badges, and gold — with everything secondary (sound/music/lamp/zoom toggles, equipment, wallet, How-to-Play, version, **Leave World**) tucked behind a **⚙️ settings menu**. Much less screen clutter, closer to a modern cozy-MMO layout. Mobile keeps its existing compact HUD. New `TopBar` component.
- **Lusher, cozier ground** — The flat grass is now scattered with cosmetic detail — **flowers, mushrooms, pebbles, grass tufts, and fallen leaves** — and each grass tile gets a subtle warm/cool tint so the ground reads varied and alive instead of uniform. All deterministic per tile (every player sees the same world, no networking), placed only on open grass (skips paths, water, buildings, NPCs, resources, plots), and purely decorative. New `detail_*` textures + `renderGroundDetails` in the client. A step toward the cozy-MMO look.
- **Portals moved to the map edges + new gate visuals** — Zone portals were mid-map floor tiles players kept stepping on by accident. They now sit at the **edges** of each zone (hub Wilderness Gate → far east, Lodge door → west; Wilderness/Grotto return gates → west edge), and arrival still drops you at the zone's central spawn (no bounce). Each portal now renders a clear **glowing magenta gate** — a stone-ringed portal with a pulsing aura, a gentle bob, and a floating destination label — instead of a plain recoloured tile, so it reads as a portal. New `portal_gate` texture + `renderPortals` in the client.
- **Crafting takes time** — Crafting is no longer instant: it now has a **cast-time at the workbench** (base 4s + 1s per material unit, capped at 12s — heavier gear takes longer). Server-authoritative with a per-player lock; materials are consumed on completion (a disconnect mid-craft costs nothing), and the panel shows a **"Crafting…"** button while it works. `getCraftDurationMs` in `shared/src/crafting.ts`.
- **Camera zoom** — Players can now zoom the world in and out: **mouse wheel** on desktop, **two-finger pinch** on touch, or the **🔍+ / 🔍−** HUD buttons (zoom 0.9×–2.8×). The choice persists across sessions, and the lighting/weather/prompt overlays all track the new zoom.
- **Ambient weather audio** — Weather now sounds real: a procedural rain bed (filtered brown-noise loop) whose loudness and brightness track the shared weather, plus rolling **thunder** during storms. Fully synthesized through the existing Web Audio bus (no audio files), eased in/out, suppressed indoors, and tied to the 🎵 music toggle. `client/src/audio/weatherAmbience.ts`.
- **Rest at home** — Your house now has a real function: open your **own house** in the 🏠 panel and **Rest** to fully restore **energy and HP**, on an **8-minute cooldown**. Ties housing into the energy/hunger loop and rewards the 500g home investment — food is still the on-the-go option. Server-authoritative (owner + house-only + cooldown checks); new `housingRest` message, `REST_COOLDOWN_MS` in `shared/src/housing.ts`.
- **Multi-currency gold market** — The peer-to-peer gold market now accepts **USDC, IDRX (`idrxZcP8…`), and SOL** alongside **$BASE**. When you post a bid or offer you pick the currency; each order shows what it's priced in, and settlement transfers that currency's SPL mint (or native SOL) directly between the two wallets, verified on-chain server-side. Per-order `currency` is persisted (`market_orders.currency`, auto-migrated); the price chart still tracks $BASE only. New `verifyPeerSolTransfer` for native SOL; `shared/src/currencies.ts` holds the registry.
- **Interaction prompts** — A floating "**E · …**" bubble now appears over the nearest thing you can use — an NPC ("Talk to Pip" / "Shop with Pip"), a land plot ("Buy this plot" / "Manage your house" / "Browse shop"), or a farm plot ("Plant seed" / "Harvest"). It shows **✨** on touch devices. Makes housing, shops, and farming far easier to discover — no more guessing what's interactable. Client-only, reuses the existing proximity logic.
- **Building lights + craftable Lamp Oil** — Owners can switch a built house/shop's **light** on/off from the 🏠 panel. A lit building casts a warm window glow visible to everyone (brightest at night), and **consumes the building's energy reserve** while on (100 energy ≈ 20 min). Refuel it with **Lamp Oil** — a new craftable fuel (**2 River Fish + 1 Wood** at the workbench; each flask restores 50 energy) — which ties building upkeep into the gather→craft loop and gives raw fish a second use. When the reserve empties the light auto-switches off. State persists per plot (`light_on`/`energy`/`energy_at` columns, auto-migrated) and drains on a time basis so it stays correct across restarts. Owner-only, server-validated; new `housingLight`/`housingRefuel` messages + `effectiveLight` in `shared/src/housing.ts`.
- **Living-world effects — time & weather now matter** — The day/night cycle and weather feed real gameplay (server-authoritative, `shared/src/environment.ts`): **gathering is slower at night** (up to +50% time at deepest night) **unless your lamp is on**, giving the lamp a real purpose and rewarding light; and **fishing gets a bonus catch in the rain** (up to +40% in a downpour). A gentle throttled hint nudges you to light your lamp when you gather in the dark.
- **Weather** — The world now has live weather: **clear, cloudy, rain, fog, and thunderstorms** (with lightning flashes). The client renders falling-rain particles and a weather tint that eases in/out, and the HUD pill shows the current conditions next to the time. Like day/night it's deterministic and time-driven (`shared/src/weather.ts` `getWeather`, ~4-min periods from a weighted table) so every player shares the same skies with zero networking. Rain is suppressed indoors (Community Lodge).
- **Player lamp / torch** — Press **L** (or tap the 💡 HUD button) to toggle a personal **lamp** that casts a warm radial glow cutting through the night darkness. The light is **networked** — other players see your torch too — via a new `lampOn` field on the player schema and a `toggleLamp` message; the glow brightens additively over the day/night overlay and scales with how dark it is (most useful at night, near-invisible by day). Lamp resets to off on zone change (matching the server). Constant in `shared/src/daynight.ts`.
- **Day/night cycle** — The world now runs on a live day/night cycle (a full day every 20 real minutes), shared by all players. The client renders a smooth lighting tint over the world that shifts through dawn → day → dusk → night, and the HUD gains a clock pill showing the in-world time + phase (☀️/🌇/🌙/🌅). Deterministic and time-driven (`shared/src/daynight.ts` `getWorldTime`) so every client agrees with zero extra networking; cosmetic for now but ready to drive future gameplay (night mobs, shop hours). Documented in the /docs guide.
- **Energy / hunger system — food now matters** — Players have an **Energy** stat (0–100, the 🍗 HUD gauge). Working actions spend it: gathering (4), attacking (3), planting/harvesting (3). Run out and you're **too hungry** to keep working until you eat. **Food restores energy** (Bread +25, Cooked Fish +35, Grilled Salmon +55) on top of its HP heal — health potions heal HP only. A slow out-of-action trickle (1/12s) prevents hard soft-locks, and Pip now stocks **Bread (8g)** so there's always a food source. Stamina persists on the character (new `stamina` column, auto-migrated) and is sent in the profile payload. Server-authoritative gates in `handleChop`/`handleAttack`/`handleFarmInteract`; constants/helpers in `shared/src/stamina.ts`. The /docs guide gains an "Energy & Food" section.
- **Player "How to Play" guide** — A self-contained, branded docs page served at **/docs** (https://world.metricbase.org/docs) covering getting started (wallet + $BASE gate), controls, the Gather → Craft → Trade → Build loop, gathering tiers/tools/rare drops, farming, crafting, combat/knockout, quests, the dynamic shop + gold market, housing/player shops, social play (guilds/parties/chat), the zones, and new-player tips. Static `client/public/docs.html` (copied to `dist/`) with a Vercel rewrite mapping `/docs` → `/docs.html` ahead of the SPA catch-all, so it loads instantly without the game bundle.
- **Housing & farming in every outdoor zone** — Land and farm plots are no longer hub-only. The **Wilderness** gains frontier homesteads (3 land) and a tilled field (3 farm), and the **Slime Grotto** gains a small cavern settlement (2 land + 3 mushroom-bed farms). Every footprint was placement-verified against each map (no water/wall tiles, no overlap with mobs, gather nodes, portals, or other plots). The Community Lodge interior is excluded — it's itself a building. Pure zone data; collision/persistence already generalise across zones.
- **Party shared gather XP** — Gathering together now pays off like fighting together: when a partied player finishes a woodcutting/mining/fishing gather, every other party member in the same zone within ~5 tiles earns a **25% share of the skill XP** (and levels up from it). Reuses the same nearby-ally logic as combat assists; surfaced in the 🎉 party panel hint.
- **More farm & housing land** — The hub now offers **7 farm plots** (up from 3) in an expanded south-central field, and **7 land plots** (up from 3) ringing the plaza to the NW, N, and E. Pure zone data — empty plots stay walkable, only built homes become solid, and ownership/crops persist as before (no migration; plot state is created lazily by id).
- **Brenna the Blacksmith & the Smith quest chain** — A new NPC, **Brenna**, runs a forge in the hub plaza and offers a five-quest progression that guides players through the tool/material tiers added recently: meet her (intro) → gather 5 Iron Ore → forge 2 Steel Bars → find a rare Gemstone → return for a master reward (a free **Steel Pickaxe**, +300 XP, +100g). Gated behind *Veteran Adventurer* so it opens mid-game alongside the slime line. Pure quest/NPC data — Brenna uses the standard NPC sprite, no new art.
- **Rare gather drops & a prestige weapon** — Every woodcutting/mining/fishing gather now has a small (~3%+, rising with node tier) chance to also yield a rare material — **Amber**, **Gemstone**, or **Pearl** — announced with a ✨ flourish. Pip pays handsomely for them (55–60g), and a **Gemstone** can be forged with steel + hardwood into the **Gemforged Blade**, the best weapon in the game (**+30 attack**). Rolled server-side in `completeChop` (`rollRareGatherDrop`), independent of the steel yield bonus.
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

- **Tougher survival tuning** — **Energy costs increased** (gather 4→8, attack 3→5, farm 3→6) so food and rest matter more, and **gathering takes longer** (base chop/mine time 60s→90s per node tier; fishing scales from that). Constants in `shared/src/stamina.ts` and `shared/src/skills.ts`.
- **Extended level cap → 50** — Combat **Level** now climbs from a cap of 10 all the way to **50** (the XP curve keeps growing past the early game; L50 ≈ 122k total XP), and the four **gather skills** extend to **50** as well. HP keeps scaling with level; the XP bar shows full at the cap. Pure curve change in `shared/src/progression.ts` + `skills.ts` (`MAX_LEVEL`, `MAX_SKILL_LEVEL`) — existing characters keep their XP and simply have far more headroom to grow.
- **Brenna has a real forge** — The blacksmith now works at an **isometric forge**: a glowing stone furnace with a chimney behind her, an iron **anvil** on an oak stump, and a water **quench barrel** flanking her counter. Drawn as true iso boxes (top diamond + SW/SE shaded walls + outline, via a shared `isoBox` helper) to match the world's buildings — new `scenery_forge` / `scenery_anvil` / `scenery_quench` props.
- **Pip has a real market stall (isometric)** — Pip is no longer a lone standing NPC: he now stands at a striped-awning **market stall** with a produce-laden counter, flanked by a crate and a fruit basket, so the hub merchant reads as an actual marketplace. All three props are drawn as **true isometric boxes** (top diamond + SW/SE shaded walls + iso awning) via the shared `isoBox` helper, matching the world's buildings — `scenery_stall` / `scenery_crate` / `scenery_produce`, depth-sorted and placed via the zone scenery system.
- **Isometric buildings + depth sorting** — Houses/shops/farms/plots are true iso art (gable roofs); scenery, players, and NPCs depth-sort by world Y, so you're occluded behind tall objects (e.g. the billboard).

### Fixed

- **HUD & chat now share one width** — The left-column HUD (260px) and chat box (360px) were different widths, looking misaligned. Both now use a shared `--chibi-side-col` (300px) so the left column lines up cleanly; mobile keeps its own content-based sizing.
- **HUD overlapping the chat box** — On desktop the left HUD panel (no height cap) could grow down over the bottom-left chat box and hide it. The HUD now reserves room for the chat and scrolls internally on short screens, so the chat is always visible.
- **Pip's market stall cropped** — The stall's awning was drawn at negative texture coordinates (above the canvas), clipping the top. Rebuilt the stall texture with a taller canvas and safe margins so the whole iso stall renders.
- **Emotes invisible for guilded players** — Emote bubbles matched a player by their nameplate *label*, which carries the `[GUILD]` tag, against the raw name — so an emote never showed a bubble over any player in a guild. Rendered players now track their raw name and match on that. (The 😀 emote tray and 👥 who-roster toggles themselves were working — the missing bubble made emotes look broken.)
- **Interaction prompt background** — The floating "E · …" interaction prompt now has a transparent background (dark outline + shadow for legibility) instead of an opaque box.
- **Shop/modal close button unreachable on mobile** — The floating top social toggles (👥 🏆 🛡️ 🎉) stacked over a centered modal's × close button on small screens, making Pip's Shop (and the housing / player-shop panels) impossible to close. The social rail + emote tray now hide whenever a blocking center modal is open.
- **Docs discoverability** — The How-to-Play guide existed at `/docs` but had no entry point in the game. Added visible links: a "📖 New here? Read the How-to-Play guide" button on the login screen and a "📖 How to Play" pill in the HUD (both open `/docs` in a new tab).
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