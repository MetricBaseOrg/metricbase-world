# Assets List

Spec for ALL files: **transparent PNG, 1024×1024** (Claude downscales + wires on drop, like the
fish set). Style: chibi-cozy, matching the existing props + fish art. World objects sit on an iso
tile (front view, slight top-down tilt). Drop a batch → say so → it ships same day.

**Marks:** ✅ = art file is in its folder · 🎨 = MISSING — draw this · (opt) = optional, covered
by an existing file.

**Folder layout:** source art lives in category subfolders — `tiles/`, `buildings/`, `nodes/`
(the 52 done files), plus empty drop folders `mobs/`, `npcs/`, `items/`, `world/` for the new
batches. Drop each new file into the folder named in its section header.

## 👉 START HERE

Everything in the original list below is done except **3 files**: `sand.png` (→ `tiles/`),
`rock.png` and `deep-pool.png` (→ `nodes/`). After those, the highest-impact batch is
**Mobs (6) + NPCs (5)** — they're what players stare at all day and currently share 4 procedural
blobs. Then item icons.

## Tiles (1x1 tile) and Decor props — `assets/tiles/`

- grass.png ✅
- grass2.png ✅
- water.png ✅
- water2.png ✅
- river.png ✅
- soil.png ✅
- empty.png ✅
- sand.png 🎨
- stone-path.png ✅
- snow.png ✅
- lava.png ✅
- lamp.png ✅
- bench.png ✅
- fontain.png ✅ (fountain — filename keeps the typo, it's wired that way)
- statue.png ✅
- flowerbed.png ✅
- barrel.png ✅
- crate.png (opt — crates.png ✅ covers it)
- signpost.png ✅
- hedge.png ✅
- torch.png ✅

## Buildings (3x3 tiles) — `assets/buildings/`

- market-wheat.png ✅
- market-carrot.png ✅
- house.png ✅
- house-0.png ✅
- house-50.png ✅ (build progress stages — construction animation)
- shop-blue.png ✅
- mansion.png ✅
- cabin.png ✅
- windmill.png ✅
- fence.png ✅
- gate.png ✅
- bridge.png ✅

## Resource nodes (1x1 tile) — `assets/nodes/`

- well.png ✅
- pine.png ✅
- pine-small.png ✅
- wild-oak.png ✅
- young-oak.png ✅
- sapling.png ✅
- hardwood.png ✅
- ironwood.png ✅
- cavern-hardwood.png ✅
- ancient-hardwood.png ✅
- copper-rock.png ✅
- iron-deposit.png ✅
- iron-vein.png ✅
- gem-studded.png ✅
- obsidian-gem.png ✅
- king-crystal.png ✅
- crates.png ✅
- rock.png 🎨 (basic mining rock — Hub's copper rocks reuse copper-rock.png, this is the plain one)
- fish-pond.png ✅
- deep-pool.png 🎨 (Deep Pool / Deep Grotto Pool — darker salmon waters)
- oak.png (opt — wild-oak ✅ + young-oak ✅ cover it)
- berry-bush.png ✅
- crop-field.png ✅
- crop-wheat.png ✅

---

## Big Art Upgrade — everything still procedural / emoji / hard-coded

Already done elsewhere (skip): 12 fish species + 12 dishes (`client/public/assets/fish/`),
login hero. Base zones (Hub/Wilderness/Grotto) will REUSE the node art above.

## Mobs — drop in `assets/mobs/` 🔥 NEXT BATCH (all 🎨)

All monsters share 4 procedural canvas blobs today. One art per distinct mob:

- mob-slime.png 🎨 (Wild Slime, green)
- mob-slime-brute.png 🎨 (Slime Brute — bigger, meaner)
- mob-ember-slime.png 🎨 (Ember Slime — fiery)
- mob-void-brute.png 🎨 (Void Brute — dark/purple)
- mob-charred-sentinel.png 🎨 (Charred Sentinel — burnt guardian)
- mob-training-dummy.png 🎨 (Training Dummy — straw + wood post)

## NPCs — drop in `assets/npcs/` 🔥 NEXT BATCH (all 🎨)

Every NPC uses one generic villager texture:

- npc-pip.png 🎨 (Pip the merchant — the face of the game's economy)
- npc-guide.png 🎨 (Aria, Hub guide)
- npc-smith.png 🎨 (Brenna, blacksmith)
- npc-warden.png 🎨 (Warden, Wilderness outpost)
- npc-rook.png 🎨 (Rook, Grotto)

## Item icons — drop in `assets/items/` (61 items, all 🎨; fish/dishes already done)

Square icon look (like the fish art), must read at 34px. Filename = as listed
(Claude maps to exact item ids on drop):

- Consumables (2): health-potion, bread
- Materials (20): training-scrap, wood, ore (copper ore), slime-gel, slime-core, wheat-seed,
  wheat, carrot-seed, carrot, plank, copper-bar, iron-ore, iron-bar, hardwood, hardwood-plank,
  steel-bar, amber, gemstone, pearl, lamp-oil
- Weapons (4): rusty-blade, gel-knife, copper-dagger, gem-blade
- Tools (11): copper-axe, iron-axe, steel-axe, copper-pickaxe, iron-pickaxe, steel-pickaxe,
  fishing-rod, pro-rod, gilded-rod, abyssal-rod, harvest-net
- Armor/accessories (18): copper-helm, copper-chest, copper-gloves, copper-boots, iron-helm,
  iron-chest, iron-gloves, iron-boots, steel-helm, steel-chest, steel-gloves, steel-boots,
  lucky-lure, angler-ring, angler-cap, gem-ring, pearl-amulet, traveler-cape
- Mounts (3): pony, steed, dire-wolf
- Pets (3): pet-cat, pet-slime, pet-owl

## Housing interiors — drop in `assets/world/` (15, all 🎨)

(Outdoor decor reuses lamp/barrel/flowerbed/hedge/bench/crates above — only interiors needed.)

- scenery-rug.png 🎨
- scenery-fireplace.png 🎨
- scenery-bookshelf.png 🎨
- scenery-plant.png 🎨
- scenery-table.png 🎨
- scenery-chair.png 🎨
- scenery-stall.png 🎨
- scenery-produce.png 🎨
- scenery-forge.png 🎨
- scenery-anvil.png 🎨
- scenery-quench.png 🎨 (quench barrel)
- scenery-signpost.png 🎨
- scenery-lantern.png 🎨
- scenery-arcade.png 🎨 (arcade cabinet)
- scenery-blackjack.png 🎨 (card table)

## Farm plots, billboard, portal — drop in `assets/world/` (all 🎨)

- plot-empty.png 🎨 (tilled empty soil plot)
- plot-growing.png 🎨 (sprouting crop, generic)
- crop-carrot.png 🎨 (ripe carrot plot — wheat done: crop-wheat.png ✅)
- billboard.png 🎨 (ad billboard frame — the creative renders inside it)
- portal-gate.png 🎨 (zone portal / gate)

## Ground & ambience (lower priority — talk before drawing)

- Ground tileset: 5 iso cube tiles (grass, stone path, water, wall, portal tile) — strict
  64×32-top iso spritesheet; align on a template with Claude BEFORE drawing.
- Ground details (5 tiny sprinkles): flowers, mushroom, pebbles, grass tuft, leaf.
- Weather/fx (rain, splashes, sparkles) are code-drawn and fine as-is.

## Player characters — DECIDED: 2 hand-drawn defaults — drop in `assets/characters/`

New flow: connect wallet → name → **gender only** (appearance pickers removed). One default
look per gender; cosmetics come later via a $BASE-burn lucky wheel (separate art list then —
draw the bases with clean silhouettes so hats/capes/auras can layer on top).

**Frame spec (CRITICAL — consistency is what makes animation work):**
- One PNG per frame, transparent, **768×768 canvas for every frame**
- Character centred horizontally, **feet on a fixed baseline at 87% height (y≈668)** in EVERY
  frame — if the baseline wobbles between frames the character will jitter in-game
- Same proportions/scale across all frames and both characters (they stand ~600px tall)
- Directions to draw (engine mirrors the rest): `front` (faces camera), `back`,
  `right` (side profile), `tqright` (¾ view facing lower-right)
- Naming: `<char>-<direction>-<action>-<frame>.png`, frames 0-indexed
  e.g. `boy-front-walk-0.png`, `girl-tqright-fish-1.png`

### Starter set (ships the feature) — 48 frames per character, 96 total

| Action | Frames | × 4 directions | Notes |
|---|---|---|---|
| idle | 2 | 8 | breathe/bob between the two |
| walk | 4 | 16 | contact → up → contact → up |
| chop | 2 | 8 | wind-up → swing (axe in hand) |
| fish | 2 | 8 | cast/hold → tug (rod in hand) |
| attack | 2 | 8 | wind-up → strike (sword in hand) |

Plus per character: `boy-portrait.png`, `girl-portrait.png` (bust, 768×768 — HUD, login,
profile card). **Total: 98 files.**

### Full set (later polish, optional) — matches current engine frame counts

idle 4 · walk 8 · chop 3 · fish 4 · attack 3 = 88 frames per character. Drop extra frames with
the same naming (`…-walk-4.png` etc.) any time — the engine's per-action frame counts are
tunable in `shared/src/avatar.ts`.

Batch tip: start with ONE direction (`front`) of the boy across all actions (12 frames) and
drop it — I'll wire it in-game so you can check the look/scale before drawing the other 86.

## Priority order

1. sand + rock + deep-pool (finish the original list — 3 files)
2. Mobs (6) + NPCs (5) — folders are ready: `assets/mobs/`, `assets/npcs/`
3. Item icons (61) — `assets/items/`
4. Interiors + farm/billboard/portal (~20) — `assets/world/`
5. Iso tiles + details (after template chat)
6. Characters (separate project)
