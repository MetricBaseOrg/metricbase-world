export type HairStyle = "short" | "long" | "spiky";
export type OutfitStyle = "robe" | "armor" | "casual";

export interface CharacterAppearance {
  bodyColor: number;
  hairColor: number;
  outfitColor: number;
  hairStyle: HairStyle;
  outfitStyle: OutfitStyle;
}

export const HAIR_STYLES: HairStyle[] = ["short", "long", "spiky"];
export const OUTFIT_STYLES: OutfitStyle[] = ["robe", "armor", "casual"];

export const SKIN_TONES = [0xffd5b4, 0xffc857, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21];
export const HAIR_COLORS = [0x2d3436, 0x6d4c41, 0xffc857, 0xe17055, 0x74b9ff, 0xfd79a8, 0xa29bfe];
export const OUTFIT_COLORS = [0x355070, 0x4f8cff, 0x6c5ce7, 0x00b894, 0xe17055, 0xd63031, 0x2d3436];

/** Bump when avatar art changes so Phaser regenerates cached textures. */
export const CHARACTER_ART_VERSION = 2;

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  bodyColor: 0xffc857,
  hairColor: 0x2d3436,
  outfitColor: 0x355070,
  hairStyle: "short",
  outfitStyle: "robe",
};

export function normalizeCharacterAppearance(
  raw: Partial<CharacterAppearance> | null | undefined,
): CharacterAppearance {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CHARACTER_APPEARANCE };
  }

  return {
    bodyColor: normalizeColor(raw.bodyColor, DEFAULT_CHARACTER_APPEARANCE.bodyColor),
    hairColor: normalizeColor(raw.hairColor, DEFAULT_CHARACTER_APPEARANCE.hairColor),
    outfitColor: normalizeColor(raw.outfitColor, DEFAULT_CHARACTER_APPEARANCE.outfitColor),
    hairStyle: HAIR_STYLES.includes(raw.hairStyle as HairStyle)
      ? (raw.hairStyle as HairStyle)
      : DEFAULT_CHARACTER_APPEARANCE.hairStyle,
    outfitStyle: OUTFIT_STYLES.includes(raw.outfitStyle as OutfitStyle)
      ? (raw.outfitStyle as OutfitStyle)
      : DEFAULT_CHARACTER_APPEARANCE.outfitStyle,
  };
}

function normalizeColor(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value >>> 0;
  }
  return fallback;
}

export function appearanceTextureKey(appearance: CharacterAppearance): string {
  const { bodyColor, hairColor, outfitColor, hairStyle, outfitStyle } = appearance;
  return `player-v${CHARACTER_ART_VERSION}-${bodyColor}-${hairColor}-${outfitColor}-${hairStyle}-${outfitStyle}`;
}