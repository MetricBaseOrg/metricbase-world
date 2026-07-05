# Fish art drop folder

Drop transparent PNGs here (~256×256, fish facing LEFT, any style matching the
game's look). Until a file exists, the game shows the species' emoji instead —
so missing art never breaks anything. Exact filenames:

| File | Species | Rarity | Waters |
|---|---|---|---|
| `river-fish.png` | River Fish | Common | River/lake |
| `bluegill.png` | Bluegill | Common | River/lake |
| `carp.png` | Striped Carp | Uncommon | River/lake |
| `catfish.png` | Whiskered Catfish | Uncommon | River/lake |
| `golden-trout.png` | Golden Trout | Rare | River/lake |
| `crystal-koi.png` | Crystal Koi | Epic | River/lake |
| `ancient-sturgeon.png` | Ancient Sturgeon | Legendary | River/lake |
| `salmon.png` | Prized Salmon | Common | Deep (Wilderness/Grotto) |
| `silver-pike.png` | Silver Pike | Uncommon | Deep |
| `ghostfin-eel.png` | Ghostfin Eel | Rare | Deep |
| `stormray.png` | Stormray | Epic | Deep |
| `abyssal-leviathan.png` | Abyssal Leviathan | Legendary | Deep |

Species/rarity table lives in `shared/src/fishSpecies.ts`.

## Dish art (cooked meals)

Same rules (transparent PNG ~256×256, plated dish / bowl / skewer look).
Canvas-drawn fallback shows until each file lands:

| File | Dish | From |
|---|---|---|
| `dish-river-fish.png` | Cooked Fish | River Fish |
| `dish-bluegill.png` | Pan-Seared Bluegill | Bluegill |
| `dish-carp.png` | Hearty Carp Stew | Striped Carp |
| `dish-catfish.png` | Crispy Catfish Fry | Whiskered Catfish |
| `dish-golden-trout.png` | Golden Trout Fillet | Golden Trout |
| `dish-crystal-koi.png` | Crystal Koi Sashimi | Crystal Koi |
| `dish-ancient-sturgeon.png` | Ancient Sturgeon Roast | Ancient Sturgeon |
| `dish-salmon.png` | Grilled Salmon | Prized Salmon |
| `dish-silver-pike.png` | Grilled Pike Skewer | Silver Pike |
| `dish-ghostfin-eel.png` | Smoked Ghostfin Eel | Ghostfin Eel |
| `dish-stormray.png` | Charged Stormray Steak | Stormray |
| `dish-abyssal-leviathan.png` | Leviathan Feast | Abyssal Leviathan |

Dish stats/recipes live in `FISH_DISHES` in `shared/src/fishSpecies.ts`.
