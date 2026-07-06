# Assets List

Spec for ALL files: **transparent PNG, 1024×1024** (Claude downscales + wires on drop, like the
fish set). Style: chibi-cozy, matching the existing props + fish art. World objects sit on an iso
tile (front view, slight top-down tilt). Drop a batch → say so → it ships same day.

## Tiles (1x1 tile) and Decor props (1x1 tile, ground-anchored)

- grass.png ✅
- grass2.png
- water.png ✅
- soil.png ✅
- empty.png ✅
- sand.png
- stone-path.png
- snow.png
- lava.png
- lamp.png
- bench.png
- fountain.png
- statue.png
- flowerbed.png
- barrel.png
- crate.png
- signpost.png
- hedge.png
- torch.png

## Buildings (3x3 tiles)

- market-wheat.png ✅
- market-carrot.png
- house.png ✅
- house-0.png ✅
- house-50.png ✅ (build progress stages — I'll use these for construction animation)
- shop-blue.png
- mansion.png
- cabin.png
- windmill.png
- fence.png
- gate.png
- bridge.png

## Resource nodes (1x1 tile)

- well.png
- pine.png ✅
- pine-small.png ✅ (→ tree / woodcutting)
- wild-oak.png
- young-oak.png
- sapling.png
- hardwood.png
- ironwood.png
- cavern-hardwood.png
- ancient-hardwood.png
- copper-rock.png
- iron-deposit.png
- iron-vein.png
- gem-studded.png
- obsidian-gem.png
- king-crystal.png
- crates.png
- rock.png (→ mining node) — needed, not yet dropped
- fish-pond.png (→ fishing spot) — needed, not yet dropped
- oak.png
- berry-bush.png
- crop-field.png

---

## Big Art Upgrade — everything still procedural / emoji / hard-coded

Already done elsewhere (skip): 12 fish species + 12 dishes (`client/public/assets/fish/`),
login hero. The base zones (Hub/Wilderness/Grotto) will REUSE the resource-node art above —
the only new node art needed is:

- deep-pool.png (→ Deep Pool / Deep Grotto Pool — darker salmon waters)

## Mobs — drop in `assets/mobs/` 🔥 high priority

All monsters share 4 procedural canvas blobs today. One art per distinct mob:

- mob-slime.png (Wild Slime, green)
- mob-slime-brute.png (Slime Brute — bigger, meaner)
- mob-ember-slime.png (Ember Slime — fiery)
- mob-void-brute.png (Void Brute — dark/purple)
- mob-charred-sentinel.png (Charred Sentinel — burnt guardian)
- mob-training-dummy.png (Training Dummy — straw + wood post)

## NPCs — drop in `assets/npcs/` 🔥 high priority

Every NPC uses one generic villager texture:

- npc-pip.png (Pip the merchant — the face of the game's economy)
- npc-guide.png (Aria, Hub guide)
- npc-smith.png (Brenna, blacksmith)
- npc-warden.png (Warden, Wilderness outpost)
- npc-rook.png (Rook, Grotto)

## Item icons — drop in `assets/items/` (61 items; fish/dishes already done)

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

## Housing interiors — drop in `assets/world/` (15 procedural textures)

(Outdoor decor reuses lamp/barrel/flowerbed/hedge/bench/crates above — only interiors needed.)

- scenery-rug.png
- scenery-fireplace.png
- scenery-bookshelf.png
- scenery-plant.png
- scenery-table.png
- scenery-chair.png
- scenery-stall.png
- scenery-produce.png
- scenery-forge.png
- scenery-anvil.png
- scenery-quench.png (quench barrel)
- scenery-signpost.png
- scenery-lantern.png
- scenery-arcade.png (arcade cabinet)
- scenery-blackjack.png (card table)

## Farm plots, billboard, portal — drop in `assets/world/`

- plot-empty.png (tilled empty soil plot)
- plot-growing.png (sprouting crop, generic)
- crop-carrot.png (ripe carrot plot — wheat exists: crop-wheat.png)
- billboard.png (ad billboard frame — the creative renders inside it)
- portal-gate.png (zone portal / gate)

## Ground & ambience (lower priority — talk before drawing)

- Ground tileset: 5 iso cube tiles (grass, stone path, water, wall, portal tile) — strict
  64×32-top iso spritesheet; align on a template with Claude BEFORE drawing.
- Ground details (5 tiny sprinkles): flowers, mushroom, pebbles, grass tuft, leaf.
- Weather/fx (rain, splashes, sparkles) are code-drawn and fine as-is.

## The BIG one — player characters (discuss before drawing)

Avatars are 100% procedural paper-doll (2 genders × 5 hair × 5 outfits × any colors,
4 directions × 5 actions with frames). Hand-drawn = a layered sprite-sheet project of its own.
Options: (a) procedural bodies + hand-drawn heads/hair, (b) full sheets for fixed looks,
(c) leave as-is. Pick one together before any drawing starts.

## Priority order

1. Mobs + NPCs + deep-pool (~12 files — what players stare at all day)
2. Item icons (61 — bag/crafting/shop instantly look premium)
3. Interiors + farm/billboard/portal (~20)
4. Iso tiles + details (after template chat)
5. Characters (separate project)
