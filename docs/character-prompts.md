# Character skin prompt templates

Copy-paste prompts for generating a full animation set for a MetricBase World
character. Fill in **§1 Character details** only — everything else is measured
from the art already in `client/public/assets/characters/` and must not drift,
or the new frames will jitter against the old ones.

> **Read this before generating 65 images.** The engine today renders exactly
> two characters, `boy` and `girl`, picked by the player's gender at login
> (`HdCharacter` in [client/src/character/handDrawnAvatar.ts](../client/src/character/handDrawnAvatar.ts)).
> A third named skin will not appear in game until there's a skin→character
> mapping and a way to equip it — `COSMETIC_SKINS` in
> [shared/src/chests.ts](../shared/src/chests.ts) is still an empty array.
> So a new set is either **(a)** a replacement look for `boy`/`girl`, which
> works the moment the files land, or **(b)** art banked ahead of the equip
> feature. Both are fine; just know which you're doing.

---

## 1. Character details — EDIT THIS BLOCK

Paste your character into these fields. Keep every line, even if short: the
generator holds a look far more consistently when identity is restated in every
prompt than when it has to infer it from a previous image.

```text
CHARACTER NAME:   {{e.g. Frost Scout}}
FILE PREFIX:      {{boy | girl | frost}}      ← becomes the filename prefix
BUILD:            {{e.g. small chibi child, same height and proportions as the reference}}
SKIN:             {{e.g. warm light beige}}
HAIR:             {{e.g. short tousled dark brown, thick spiky fringe, no parting}}
EYES:             {{e.g. plain black vertical diamond eyes, no iris, no highlights}}
TOP:              {{e.g. plain black short-sleeve t-shirt, no logo}}
BOTTOM:           {{e.g. navy blue knee-length shorts}}
FOOTWEAR:         {{e.g. white low-top sneakers with dark laces}}
ACCESSORIES:      {{e.g. none — or: small blue scarf, nothing on the head}}
PALETTE LIMITS:   {{e.g. no more than 5 colours; nothing neon}}
```

**Silhouette rule:** keep the outline clean and uncluttered. Hats, capes and
auras are meant to layer on top later, and they can't if the base already has
shoulder spikes or a trailing cloak.

---

## 2. Style bible — DO NOT EDIT

This block is transcribed from the shipped art. Paste it verbatim into every
prompt.

```text
STYLE: chibi game sprite, roughly 2.5 heads tall, big rounded head, small body,
short stubby limbs, no neck. Clean vector-like cartoon art.
LINEWORK: uniform thick dark-brown outline (not black) around every shape,
including interior shapes like sleeve hems and shoe soles.
SHADING: flat cel shading, one soft shadow tone per colour, a single subtle
gradient at most. No rendered highlights, no textures, no cross-hatching.
FACE: minimal. Two plain dark vertical diamond eyes, no pupils or catchlights.
Mouth is a tiny neutral line or omitted entirely. No nose. No blush.
EXPRESSION: calm and neutral in idle and walk; mildly determined (angled brows)
in chop, attack and fish.
MOOD: friendly, wholesome, readable at 60 pixels tall.
BACKGROUND: fully transparent. No ground shadow, no platform, no scenery, no
vignette, no frame, no drop shadow.
FORBIDDEN: text, watermarks, signatures, UI, borders, multiple characters,
multiple poses in one image, sprite sheets, grids, colour swatches.
```

**Always attach a reference image.** Use `boy-front-idle-0.webp` (or the closest
already-approved frame of your own set) as a style reference on every single
generation. Prompt text alone will not hold the line weight and proportions
across 65 images.

---

## 3. Technical spec — DO NOT EDIT

Measured from the shipped frames, not copied from the old prose spec in
[assets.md](assets.md) — that section describes a 768px canvas with feet at 87%,
and **no shipped frame matches it**. The art on disk is 512×512 with feet at
98–99.5%. New frames must match the art, not the doc.

```text
CANVAS: square, transparent PNG. Generate at 1024×1024 or larger; it is
downscaled to 512×512 on import.
FRAMING: the character fills the frame almost edge to edge — top of the hair at
1–3% of the image height, soles of the feet at 98–99% of the image height.
BASELINE: the soles must sit at the SAME height in every frame of an action,
within half a percent of the image height. This is the one rule that cannot be
relaxed: a drifting baseline makes the character bob and jitter when the frames
play.
SCALE: identical body proportions and identical head size in every frame. The
character must not grow or shrink between frames.
CAMERA: straight-on, no perspective, no foreshortening, no camera tilt.
CENTRING: roughly horizontally centred; a tool or a swing arc may extend the
silhouette sideways, that is fine.
ONE POSE PER IMAGE.
```

---

## 4. The prompt

Assemble: **§2 style bible** + **§1 character details** + **§3 technical spec** +
one frame line from §5. Template:

```text
A single chibi game character sprite on a fully transparent background.

CHARACTER
Name: {{CHARACTER NAME}}
Build: {{BUILD}}
Skin: {{SKIN}}
Hair: {{HAIR}}
Eyes: {{EYES}}
Top: {{TOP}}
Bottom: {{BOTTOM}}
Footwear: {{FOOTWEAR}}
Accessories: {{ACCESSORIES}}
Palette: {{PALETTE LIMITS}}

STYLE
<paste §2 style bible verbatim>

FRAME
<paste one frame line from §5>

TECHNICAL
<paste §3 technical spec verbatim>
```

---

## 5. Frame lines — 65 per character

Four drawn directions. **Left-facing frames are not drawn** — the engine mirrors
`right` and `tqright` at render time (`drawnDirection()`), so drawing them
wastes half your budget and guarantees a mismatch.

| Direction token | What to say in the prompt |
|---|---|
| `front` | facing the camera straight on, full face visible |
| `back` | facing directly away from the camera, back of the head, no face at all |
| `right` | exact side profile facing the right edge of the image |
| `tqright` | three-quarter view, body angled toward the lower-right, both eyes visible |

Substitute `<DIR>` with the phrase above for the direction you're generating.

### idle — 2 frames × 4 directions

| Frame | Line |
|---|---|
| 0 | Standing still, `<DIR>`, arms hanging relaxed at the sides, feet together, weight even, calm neutral face. |
| 1 | The same standing pose, `<DIR>`, mid-breath: chest and shoulders lifted very slightly and the head raised a fraction. Everything else identical to the previous frame, feet unmoved. |

### walk — 4 frames × 4 directions

| Frame | Line |
|---|---|
| 0 | Walking, `<DIR>`, contact pose: left leg forward with the heel down, right leg back, arms swinging in opposition, body at its lowest point. |
| 1 | Walking, `<DIR>`, passing pose: legs together with the right leg lifting past the left, body at its highest point, arms near the sides. |
| 2 | Walking, `<DIR>`, contact pose mirrored: right leg forward with the heel down, left leg back, arms swinging in opposition, body at its lowest point. |
| 3 | Walking, `<DIR>`, passing pose: legs together with the left leg lifting past the right, body at its highest point, arms near the sides. |

### chop — 4 frames × 4 directions (axe in hand)

| Frame | Line |
|---|---|
| 0 | Holding a woodcutting axe, `<DIR>`, wind-up: axe raised high above and behind the head with both hands, torso coiled, knees slightly bent, determined face. |
| 1 | Swinging the axe, `<DIR>`, the axe starting down from overhead, torso beginning to rotate into the swing. |
| 2 | Mid-swing, `<DIR>`, the axe sweeping down through a diagonal arc in front of the body, with a soft pale-coral motion arc trailing the axe head. |
| 3 | Follow-through, `<DIR>`, the axe low across the body at the end of the swing, torso rotated through, the coral motion arc thin and fading. |

### attack — 4 frames × 4 directions (sword in hand)

| Frame | Line |
|---|---|
| 0 | Holding a short sword, `<DIR>`, wind-up: sword drawn back beside the shoulder, front foot planted, guard up, determined face. |
| 1 | Stepping into the strike, `<DIR>`, weight shifting onto the front foot, the sword beginning to travel forward. |
| 2 | The strike, `<DIR>`, arm fully extended with the sword thrust forward at full reach, a soft pale-coral slash arc along the blade's path. |
| 3 | Recovery, `<DIR>`, the sword lowering back toward a guard position, weight settling, the coral arc thin and fading. |

### fish — 2 frames × 4 directions (rod in hand)

| Frame | Line |
|---|---|
| 0 | Holding a fishing rod, `<DIR>`, the rod angled up and out ahead of the body, line hanging, relaxed patient stance. |
| 1 | The rod bent under a bite, `<DIR>`, leaning back with both hands on the rod, heels dug in, the tip pulled sharply down. |

### portrait — 1 per character

| File | Line |
|---|---|
| `<prefix>-portrait.png` | Bust portrait, head and shoulders only, facing the camera, calm friendly neutral expression, cropped just below the shoulders, filling the frame. Same style and colours as the full-body frames. |

---

## 6. Naming, install, and the manifest

**Filenames** — `<prefix>-<direction>-<action>-<frame>.png`, frames 0-indexed:

```text
boy-front-idle-0.png     boy-front-walk-0.png    boy-tqright-chop-3.png
girl-back-attack-2.png   girl-right-fish-1.png   girl-portrait.png
```

**Install:**

```bash
# 1. Drop the PNGs straight into the shipped folder
#    (there is no assets/characters source folder — characters skip the
#     process-items.mjs pipeline that item icons use)
cp *.png client/public/assets/characters/

# 2. Convert to WebP at 512px. WITHOUT --keep this DELETES the source PNGs,
#    so archive your originals somewhere else first.
node scripts/optimize-art.mjs --keep

# 3. Check the batch before trusting it (see §7)
node scripts/check-character-frames.mjs boy
```

**Then update the manifest** — `client/public/assets/characters/manifest.json`:

```json
{ "characters": { "boy": { "idle": 2, "walk": 4, "chop": 4, "attack": 4, "fish": 2 } } }
```

⚠️ **The count is per action, and the loader applies it to all four
directions.** Declaring `"fish": 2` queues 8 files (2 frames × 4 directions). Any
that don't exist fall back to that direction's idle pose — a silent
half-animation, not an error. Only raise a count once all four directions of
that action are drawn.

---

## 7. QA before you commit

`scripts/check-character-frames.mjs` verifies the two things that ruin an
animation and can't be seen in a thumbnail — baseline drift and scale drift:

```bash
node scripts/check-character-frames.mjs boy        # one character
node scripts/check-character-frames.mjs            # every character in the manifest
```

It reports, per action, the foot baseline of every frame, and flags:

- a frame missing from a declared action (silently plays that direction's idle);
- a baseline that moves more than the per-action tolerance — **0.5% for idle,
  1% for walk, 4% for chop/attack/fish**. Locomotion is held tight because the
  feet are planted, so any movement is drift; a swing legitimately crouches and
  rises, and the shipped chop moves 3.5% on purpose;
- a character height that changes more than 2% (idle), 4% (walk) or 6% (action);
- a non-square canvas, or a frame with opaque corners (background not cut out).

**It does not exit clean on the current art, and that's the report, not a bug:**

- `boy-back-attack-0..3` don't exist while the manifest declares `attack: 4`, so
  a boy attacking with his back to you currently plays his idle pose. That's the
  designed fallback, not a crash — but it's silent, which is why it's listed.
- `boy right/walk` drifts 1.37%, over the 1% walk tolerance. It's an outlier;
  every other walk cycle in the game sits between 0.2% and 0.6%.

So treat a non-zero exit as "read the list", not "the batch is broken". Compare
a new batch against those numbers rather than against zero.

By eye, check the things a script can't: the hair reads at 60px, the outline
weight matches the reference, and `back` frames genuinely have no face on them.
