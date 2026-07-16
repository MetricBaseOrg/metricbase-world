# Assets List

Spec for ALL files: **transparent PNG, 1024×1024** (Claude downscales + wires on drop, like the
fish set). Style: chibi-cozy, matching the existing props + fish art. World objects sit on an iso
tile (front view, slight top-down tilt). Drop a batch → say so → it ships same day.

> **Shipping pipeline (since v0.110.0):** the shipped copies in `client/public/assets` are
> **WebP capped at 512px** — `node scripts/optimize-art.mjs` converts a dropped PNG batch and
> deletes the shipped .png. Keep dropping 1024px PNGs here as before; Claude runs the script and
> wires the `.webp` references.

> **Backgrounds:** transparent is ideal, but if a drop ships with a **baked-in background**
> (a transparency checkerboard or flat gray saved as solid pixels), that's fine — it gets
> auto-stripped on wire-in via a border flood-fill that keeps the subject (even white/gray
> parts like scarves, silver armor, or a gray rock). Ground **tiles** are left opaque on purpose.

**Marks:** ✅ = art file is in its folder · 🎨 = MISSING — draw this · (opt) = optional, covered
by an existing file.

**Folder layout:** source art lives in category subfolders — `tiles/`, `buildings/`, `nodes/`,
`mobs/`, `npcs/`, `items/`, `characters/`, plus `world/` for interiors/farm/portal. Drop each new
file into the folder named in its section header.

## 👉 START HERE

The original list is **done**: all tiles, buildings, nodes, **Mobs (6)**, **NPCs (5)**, and most
of both character sets shipped. **What's still missing, by impact (112 files):**

1. ~~`girl-front-walk-0..3`~~ ✅ v0.110.1 · ~~back-chop ×2~~ ✅ v0.111.0
2. **Item icons (55)** — biggest UI surface (inventory/shop/market all show placeholder art).
3. **Character gaps (38)** — portraits ×2, girl attack (16), boy+girl fish (16), boy
   back-attack (4) — exact file list in the character section.
4. **Interiors (15) + farm/billboard/portal (4)** in `assets/world/` — `scenery-rug`,
   `scenery-fireplace`, `scenery-bookshelf` are already referenced by code and 404 today.

## Tiles (1x1 tile) and Decor props — `assets/tiles/`

- grass.png ✅
- grass2.png ✅
- water.png ✅
- water2.png ✅
- river.png ✅
- soil.png ✅
- empty.png ✅
- sand.png ✅
- autumn-grass.png ✅ (new ground tile)
- cave-floor.png ✅ (new ground tile)
- swamp.png ✅ (new ground tile)
- wood-floor.png ✅ (new ground tile)
- farm-carrot.png ✅ (ground tile painted with growing carrots)
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
- bakery.png ✅ (new)
- bakery-stall.png ✅ (new, 2-tile footprint)
- barn.png ✅ (new)
- blacksmith.png ✅ (new)
- church.png ✅ (new)
- guard-tower.png ✅ (new)
- library.png ✅ (new)
- mosque.png ✅ (new)
- stable.png ✅ (new)
- tavern.png ✅ (new)
- townhall.png ✅ (new)

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
- rock.png ✅ (basic mining rock — the plain one; Hub's copper rocks reuse copper-rock.png)
- sakura-tree.png ✅ (new decorative tree)
- fish-pond.png ✅
- deep-pool.png ✅ (Deep Pool / Deep Grotto Pool — darker salmon waters)
- oak.png (opt — wild-oak ✅ + young-oak ✅ cover it)
- berry-bush.png ✅
- crop-field.png ✅
- crop-wheat.png ✅

---

## Big Art Upgrade — everything still procedural / emoji / hard-coded

Already done elsewhere (skip): 12 fish species + 12 dishes (`client/public/assets/fish/`),
login hero. Base zones (Hub/Wilderness/Grotto) will REUSE the node art above.

## Mobs — `assets/mobs/` ✅ SHIPPED

Each distinct mob now has its own art (was 4 procedural blobs):

- mob-slime.png ✅ (Wild Slime, green)
- mob-slime-brute.png ✅ (Slime Brute — bigger, meaner)
- mob-ember-slime.png ✅ (Ember Slime — fiery)
- mob-void-brute.png ✅ (Void Brute — dark/purple; gray smoke effect kept)
- mob-charred-sentinel.png ✅ (Charred Sentinel — burnt guardian)
- mob-training-dummy.png ✅ (Training Dummy — straw + wood post)

## NPCs — `assets/npcs/` ✅ SHIPPED

- npc-pip.png ✅ (Pip the merchant — the face of the game's economy)
- npc-guide.png ✅ (Aria, Hub guide)
- npc-smith.png ✅ (Brenna, blacksmith)
- npc-warden.png ✅ (Warden, Wilderness outpost)
- npc-rook.png ✅ (Rook, Grotto)

## Item icons — drop in `assets/items/` (63 items; fish/dishes already done)

Square icon look (like the fish art), must read at 34px. Filename = as listed
(Claude maps to exact item ids on drop):

- Consumables (4): health-potion ✅, bread ✅, carrot-soup ✅, carrot-bread ✅ (new v0.113.0 dishes)
- Materials (20): training-scrap 🎨, wood ✅, ore ✅ (copper ore), slime-gel 🎨, slime-core 🎨,
  wheat-seed ✅, wheat ✅, carrot-seed ✅, carrot ✅, plank ✅, copper-bar ✅, iron-ore ✅,
  iron-bar ✅, hardwood ✅, hardwood-plank ✅, steel-bar ✅, amber 🎨, gemstone 🎨, pearl 🎨,
  lamp-oil 🎨
- Weapons (4): rusty-blade 🎨, gel-knife 🎨, copper-dagger 🎨, gem-blade 🎨
- Tools (11): copper-axe 🎨, iron-axe 🎨, steel-axe 🎨, copper-pickaxe 🎨, iron-pickaxe 🎨,
  steel-pickaxe 🎨, fishing-rod 🎨, pro-rod 🎨, gilded-rod 🎨, abyssal-rod 🎨, harvest-net 🎨
- Armor/accessories (18): copper-helm 🎨, copper-chest 🎨, copper-gloves 🎨, copper-boots 🎨,
  iron-helm 🎨, iron-chest 🎨, iron-gloves 🎨, iron-boots 🎨, steel-helm 🎨, steel-chest 🎨,
  steel-gloves 🎨, steel-boots 🎨, lucky-lure 🎨, angler-ring 🎨, angler-cap 🎨, gem-ring 🎨,
  pearl-amulet 🎨, traveler-cape 🎨
- Mounts (3): pony 🎨, steed 🎨, dire-wolf 🎨
- Pets (3): pet-cat 🎨, pet-slime 🎨, pet-owl 🎨

**Done so far (8):** ore, wheat-seed, wheat, carrot-seed, carrot, copper-bar, iron-ore, iron-bar.

## Housing interiors — drop in `assets/world/` (15, all 🎨)

(Outdoor decor reuses lamp/barrel/flowerbed/hedge/bench/crates above — only interiors needed.)

The first three are already referenced by `BootScene.ts` and **404 in-game today** — draw those
first within this set:

- scenery-rug.png ✅ (shipped v0.113.0)
- scenery-fireplace.png ✅ (shipped v0.113.0)
- scenery-bookshelf.png ✅ (shipped v0.113.0)
- scenery-plant.png ✅ (shipped v0.113.0)
- scenery-table.png ✅ (shipped v0.113.0)
- scenery-chair.png ✅ (shipped v0.113.0)
- scenery-stall.png ✅ (shipped v0.113.0)
- scenery-produce.png ✅ (shipped v0.113.0)
- scenery-forge.png ✅ (shipped v0.113.0)
- scenery-anvil.png ✅ (shipped v0.113.0)
- scenery-quench.png ✅ (shipped v0.113.0)
- scenery-signpost.png ✅ (shipped v0.113.0)
- scenery-lantern.png ✅ (shipped v0.113.0)
- scenery-arcade.png ✅ (shipped v0.113.0) (arcade cabinet)
- scenery-blackjack.png ✅ (shipped v0.113.0) (card table)

## Farm plots, billboard, portal — drop in `assets/world/`

- plot-empty.png ✅ (shipped v0.113.0) (tilled empty soil plot)
- plot-growing.png ✅ (shipped v0.113.0) (sprouting crop, generic)
- crop-carrot.png ✅ (shipped v0.107.x — renamed in from farm-carrot art; crop-wheat.png ✅ too)
- billboard.png ✅ (shipped v0.113.0) (ad billboard frame — the creative renders inside it)
- portal-gate.png ✅ (shipped v0.113.0) (zone portal / gate)

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

### Progress (live manifest: boy = idle 2 / walk 4 / chop 4 / attack 4 · girl = idle 2 / walk 4 / chop 4)

**Boy ✅ (67/80 files):** idle + walk + chop complete in all 4 directions; attack in
front/right/tqright. **Still 🎨 (13):**

- `boy-back-attack-0..3` (4)
- `boy-<front|back|right|tqright>-fish-0..1` (8) — no fish frames exist yet for anyone
- `boy-portrait.png` (1)

**Girl ✅ (45/80 files):** idle + walk + chop complete in all 4 directions. **Still 🎨 (25):**

- `girl-<front|back|right|tqright>-attack-0..3` (16) — match the boy's 4-frame attack
- `girl-<front|back|right|tqright>-fish-0..1` (8)
- `girl-portrait.png` (1)

(Chop/attack shipped as 4-frame actions — new directions must match the manifest count for that
action. Fish is new: 2+ frames, any count, it just goes in the manifest. Undrawn combos fall
back to the HD idle pose, not the procedural doll, since v0.109.0.)

### Full set (later polish, optional) — matches current engine frame counts

idle 4 · walk 8 · chop 3 · fish 4 · attack 3 = 88 frames per character. Drop extra frames with
the same naming (`…-walk-4.png` etc.) any time — the engine's per-action frame counts are
tunable in `shared/src/avatar.ts`.

Batch tip: finish ONE direction (`front`) of the boy across all actions first, then the other
directions, before starting the girl.

## Priority order

1. ~~sand + rock + deep-pool~~ ✅ · ~~Mobs (6) + NPCs (5)~~ ✅ · ~~new buildings + tiles~~ ✅ ·
   ~~boy idle/walk/chop/attack~~ ✅ · ~~girl idle/walk/chop~~ ✅
2. Item icons — 53 left (`assets/items/`); highest UI impact
3. Character gaps — portraits, girl attack, fish, boy back-attack (38 files, list above)
4. Interiors (15, the 3 ⚠️ ones first) + farm plots/billboard/portal (4) — `assets/world/`
5. Iso tiles + details (after template chat)
