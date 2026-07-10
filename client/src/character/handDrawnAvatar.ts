import type { AvatarAction, AvatarDirection, CharacterAppearance } from "@metricbase/shared";
import type Phaser from "phaser";

/**
 * Hand-drawn character frames — the art-upgrade replacement for the
 * procedural paper-doll. Frames live in client/public/assets/characters/
 * named `<char>-<direction>-<action>-<frame>.png` (char: boy|girl;
 * directions drawn: front/back/right/tqright — left variants are mirrored
 * at render time via sprite.flipX).
 *
 * Availability is declared by /assets/characters/manifest.json:
 *   { "characters": { "boy": { "idle": 2, "walk": 4, "chop": 2, "fish": 2, "attack": 2 } } }
 * A character absent from the manifest keeps the procedural renderer, so
 * existing players lose nothing while art lands piecemeal.
 */

export type HdCharacter = "boy" | "girl";

type FrameCounts = Partial<Record<AvatarAction, number>>;

let manifest: Record<string, FrameCounts> | null = null;
let manifestRequested = false;

/** Kick the manifest fetch (idempotent). Call once at app start. */
export function initHandDrawnAvatars(): void {
  if (manifestRequested) return;
  manifestRequested = true;
  void fetch("/assets/characters/manifest.json", { cache: "no-store" })
    .then(async (res) => (res.ok ? res.json() : null))
    .then((json) => {
      manifest = json && typeof json === "object" ? (json.characters ?? {}) : {};
    })
    .catch(() => {
      manifest = {};
    });
}

export function hdCharacterFor(appearance: CharacterAppearance): HdCharacter {
  return appearance.gender === "female" ? "girl" : "boy";
}

/** True when hand-drawn frames are declared for this character. */
export function hdReadyFor(character: HdCharacter): boolean {
  return !!manifest && !!manifest[character];
}

/** Portrait art URL for the character, or null while not declared. */
export function hdPortraitUrl(character: HdCharacter): string | null {
  return hdReadyFor(character) ? `/assets/characters/${character}-portrait.png` : null;
}

/** Drawn-direction (art file) + mirror flag for an engine direction. */
function drawnDirection(direction: AvatarDirection): { dir: string; flip: boolean } {
  switch (direction) {
    case "back":
      return { dir: "back", flip: false };
    case "left":
      return { dir: "right", flip: true };
    case "right":
      return { dir: "right", flip: false };
    case "threeQuarterLeft":
      return { dir: "tqright", flip: true };
    case "threeQuarterRight":
      return { dir: "tqright", flip: false };
    default:
      return { dir: "front", flip: false };
  }
}

/**
 * On-screen size for a hand-drawn frame (square canvases; the character
 * stands ~600px on a 768px frame with feet at 87%). Tune on first art drop.
 */
export const HD_DISPLAY_SIZE = 60;
/** Feet baseline within the frame (matches the 87% art spec). */
export const HD_ORIGIN_Y = 0.87;

const loadKicked = new Set<string>();

/**
 * Resolve the texture for a pose. Starts the (one-time) lazy load of the
 * character's frames on first call; returns null until the specific texture
 * is ready, letting callers fall back to the procedural renderer meanwhile.
 */
export function resolveHdPose(
  scene: Phaser.Scene,
  character: HdCharacter,
  direction: AvatarDirection,
  action: AvatarAction,
  frame: number,
): { key: string; flip: boolean } | null {
  const counts = manifest?.[character];
  if (!counts) return null;

  const { dir, flip } = drawnDirection(direction);

  // One lazy batch-load per character: queue every declared frame at once.
  if (!loadKicked.has(character)) {
    loadKicked.add(character);
    for (const [act, count] of Object.entries(counts)) {
      for (const d of ["front", "back", "right", "tqright"]) {
        for (let f = 0; f < (count ?? 0); f++) {
          scene.load.image(`hd-${character}-${d}-${act}-${f}`, `/assets/characters/${character}-${d}-${act}-${f}.png`);
        }
      }
    }
    scene.load.start();
  }

  const pick = (act: AvatarAction, f: number): string | null => {
    const count = counts[act] ?? 0;
    if (count <= 0) return null;
    const key = `hd-${character}-${dir}-${act}-${f % count}`;
    return scene.textures.exists(key) ? key : null;
  };

  // Show the requested action, but fall back to this direction's idle pose for any
  // frame that hasn't been drawn yet — an undrawn action (e.g. a back-facing chop)
  // holds the HD idle instead of dropping to the procedural doll.
  const key = pick(action, frame) ?? pick("idle", 0);
  return key ? { key, flip } : null;
}
