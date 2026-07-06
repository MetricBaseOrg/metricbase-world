# 🎨 Art Upgrade Manifest — everything still procedural / emoji / hard-coded

Spec for ALL files: **transparent PNG, 1024×1024** (I downscale + wire on drop, like the fish set).
Style: match the chibi-cozy look of the existing 52 World assets + fish art.
World objects: draw like the existing props (front-facing with slight top-down tilt, sits on an iso tile).
Suggested drop folders are given per section — exact filenames matter.

Already done (skip): 12 fish species, 12 dishes, 52 World-placeable props (`assets/*.png`), login hero.

---

## 1. Resource nodes in the BASE zones — `assets/world/` 🔥 highest visibility

The Hub/Wilderness/Grotto nodes are procedural canvas shapes (one generic tree/rock/fishspot),
even though named variants exist. (Player Worlds already use the 52 PNGs — base zones don't.)

| File | Node (as named in-game) |
|---|---|
| `node-oak.png` | Wild Oak / Young Oak (hub trees) |
| `node-copper-rock.png` | Copper Rock |
| `node-fishing-spot.png` | Fishing Spot (ripple ring / lily pads on water) |
| `node-deep-pool.png` | Deep Pool / Deep Grotto Pool (darker, salmon waters) |

Note: Pine, Sapling, Hardwood, Ironwood, Ancient/Cavern Hardwood, Iron Vein/Deposit, Dense Iron
Lode, Gem-Studded Rock, Obsidian Gem Vein already have PNGs in `assets/` — I'll reuse those for
base zones during the upgrade, so DON'T redraw them.

## 2. Mobs — `assets/mobs/` 🔥

All mobs share 4 procedural textures today. One art per distinct mob:

| File | Mob |
|---|---|
| `mob-slime.png` | Wild Slime (green) |
| `mob-slime-brute.png` | Slime Brute (bigger, meaner) |
| `mob-ember-slime.png` | Ember Slime (fiery) |
| `mob-void-brute.png` | Void Brute (dark/purple) |
| `mob-charred-sentinel.png` | Charred Sentinel (burnt guardian) |
| `mob-training-dummy.png` | Training Dummy (straw + wood post) |

## 3. NPCs — `assets/npcs/` 🔥

Every NPC uses one generic villager texture:

| File | NPC |
|---|---|
| `npc-pip.png` | Pip (the merchant — the face of the game's economy) |
| `npc-guide.png` | Hub Guide (Aria) |
| `npc-smith.png` | Blacksmith (Brenna) |
| `npc-warden.png` | Warden (Wilderness outpost) |
| `npc-rook.png` | Rook (Grotto) |

## 4. Item icons — `assets/items/` — 61 items (fish/dishes already done)

Square icon look (like the fish art), reads at 34px. Filename = item id minus `item_`.

**Consumables (2):** `health-potion` · `bread`
**Materials (20):** `training-scrap` · `wood` · `ore` (copper ore) · `slime-gel` · `slime-core` ·
`wheat-seed` · `wheat` · `carrot-seed` · `carrot` · `plank` · `copper-bar` · `iron-ore` ·
`iron-bar` · `hardwood` · `hardwood-plank` · `steel-bar` · `amber` · `gemstone` · `pearl` ·
`lamp-oil`
**Weapons (4):** `rusty-blade` · `gel-knife` · `copper-dagger` · `gem-blade`
**Tools (11):** `copper-axe` · `iron-axe` · `steel-axe` · `copper-pickaxe` · `iron-pickaxe` ·
`steel-pickaxe` · `fishing-rod` · `pro-rod` · `gilded-rod` · `abyssal-rod` · `harvest-net`
**Armor/accessories (18):** `copper-helm` · `copper-chest` · `copper-gloves` · `copper-boots` ·
`iron-helm` · `iron-chest` · `iron-gloves` · `iron-boots` · `steel-helm` · `steel-chest` ·
`steel-gloves` · `steel-boots` · `lucky-lure` · `angler-ring` · `angler-cap` · `gem-ring` ·
`pearl-amulet` · `traveler-cape`
**Mounts (3):** `pony` · `steed` · `dire-wolf`
**Pets (3):** `pet-cat` · `pet-slime` · `pet-owl`

(Exact ids I map on drop — e.g. `copper-boots` is `item_copper_greaves`; don't worry about it.)

## 5. Housing / interior scenery — `assets/world/` (19 procedural textures)

`scenery-rug` · `scenery-fireplace` · `scenery-bookshelf` · `scenery-plant` · `scenery-table` ·
`scenery-chair` · `scenery-stall` · `scenery-crate` · `scenery-produce` · `scenery-forge` ·
`scenery-anvil` · `scenery-quench` (quench barrel) · `scenery-lamppost` · `scenery-hedge` ·
`scenery-bench` · `scenery-signpost` · `scenery-lantern` · `scenery-arcade` (arcade cabinet) ·
`scenery-blackjack` (card table)

Plus outdoor decor (4): `decor-lamp` · `decor-flowers` · `decor-bush` · `decor-barrel`
(some overlap with existing World assets — `lamp.png`, `barrel.png`, `flowerbed.png`, `hedge.png`,
`bench.png`, `crates.png` exist; I'll reuse those where they fit, so **only draw the interior set:
rug, fireplace, bookshelf, plant, table, chair, stall, produce, forge, anvil, quench, signpost,
lantern, arcade, blackjack**).

## 6. Farm plots + billboard — `assets/world/`

| File | What |
|---|---|
| `plot-empty.png` | Tilled empty soil plot |
| `plot-growing.png` | Sprouting crop (generic) |
| `crop-carrot.png` | Ripe carrot plot (wheat exists: `crop-wheat.png`) |
| `billboard.png` | Ad billboard frame (the creative renders inside it) |
| `portal-gate.png` | Zone portal / gate |

## 7. Ground & ambience (lower priority, needs a chat before drawing)

- **Ground tileset**: 5 iso cube tiles (grass, stone path, water, wall, portal tile) — these are
  strict 64×32-top iso cubes drawn as a spritesheet; let's align on a template before you draw.
- **Ground details** (5 tiny sprinkles): flowers, mushroom, pebbles, grass tuft, leaf.
- **Weather/fx**: rain, splash, sparkles are code-drawn and honestly fine.

## 8. The BIG one — player characters (discuss before drawing)

Avatars are 100% procedural (paper-doll: 2 genders × 5 hair styles × 5 outfits × any colors,
4 directions × 5 actions × walk/fish/chop/attack frames). Hand-drawn = a full sprite-sheet
system with layered tinting — a project of its own. Options: (a) keep procedural bodies but add
hand-drawn heads/hair, (b) full sheets for a fixed set of looks, (c) leave as-is. Don't draw
anything here until we pick.

---

### Priority order (my recommendation)
1. **§1–3** — base-zone nodes, mobs, NPCs (what every player stares at all day; ~15 files)
2. **§4** — item icons (61 files; bag/crafting/shop instantly look premium)
3. **§5–6** — interiors + farm/billboard (~20 files)
4. **§7** — tiles/details (after we align on the iso template)
5. **§8** — characters (separate project)

Drop any batch in the right folder and tell me — each batch ships on its own, no need to wait
for the full set.
