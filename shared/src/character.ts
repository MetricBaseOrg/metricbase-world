export type HairStyle = "short" | "long" | "spiky" | "bald" | "mohawk" | "ponytail";
export type OutfitStyle = "robe" | "armor" | "casual" | "tunic" | "explorer";

export interface CharacterAppearance {
  bodyColor: number;
  hairColor: number;
  outfitColor: number;
  hairStyle: HairStyle;
  outfitStyle: OutfitStyle;
  weaponId?: string | null;
  toolId?: string | null;
  gender?: "male" | "female";
}

export const HAIR_STYLES: HairStyle[] = ["short", "long", "spiky", "bald", "mohawk", "ponytail"];
export const OUTFIT_STYLES: OutfitStyle[] = ["robe", "armor", "casual", "tunic", "explorer"];

export const SKIN_TONES = [
  0xffe0bd, 0xffd5b4, 0xffc857, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, 0x3b2417,
];
export const HAIR_COLORS = [
  0x2d3436, 0x1a1a1a, 0x6d4c41, 0x9b6a43, 0xffc857, 0xf6e58d, 0xe17055, 0xd63031, 0x74b9ff,
  0x0984e3, 0x00b894, 0xfd79a8, 0xa29bfe, 0x6c5ce7, 0xb2bec3,
];
export const OUTFIT_COLORS = [
  0x355070, 0x4f8cff, 0x0984e3, 0x6c5ce7, 0xa29bfe, 0x00b894, 0x00cec9, 0x55efc4, 0xe17055,
  0xd63031, 0xff7675, 0xfdcb6e, 0xf6b93b, 0xe84393, 0x2d3436, 0xdfe6e9,
];

/** Bump when avatar art changes so Phaser regenerates cached textures. */
export const CHARACTER_ART_VERSION = 12;

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  bodyColor: 0xffc857,
  hairColor: 0x2d3436,
  outfitColor: 0x355070,
  hairStyle: "short",
  outfitStyle: "robe",
  gender: "male",
};

/**
 * The two default heroes (new-player flow: wallet → name → gender). These
 * are what the hand-drawn character art depicts; existing players keep
 * whatever appearance they already saved.
 */
export const DEFAULT_APPEARANCE_BY_GENDER: Record<"male" | "female", CharacterAppearance> = {
  male: { ...DEFAULT_CHARACTER_APPEARANCE },
  female: {
    bodyColor: 0xffe0bd,
    hairColor: 0x6d4c41,
    outfitColor: 0xe84393,
    hairStyle: "long",
    outfitStyle: "casual",
    gender: "female",
  },
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
    weaponId: typeof raw.weaponId === "string" ? raw.weaponId : null,
    toolId: typeof raw.toolId === "string" ? raw.toolId : null,
    gender: raw.gender === "female" ? "female" : "male",
  };
}

function normalizeColor(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value >>> 0;
  }
  return fallback;
}

export function appearanceTextureKey(appearance: CharacterAppearance): string {
  const { bodyColor, hairColor, outfitColor, hairStyle, outfitStyle, weaponId, toolId, gender } = appearance;
  return `player-v${CHARACTER_ART_VERSION}-${bodyColor}-${hairColor}-${outfitColor}-${hairStyle}-${outfitStyle}-${weaponId || ""}-${toolId || ""}-${gender || "male"}`;
}

export function getGrantedCodesCount(invitedCount: number): number {
  if (invitedCount < 5) {
    return 5;
  }
  return 5 + 3 * (Math.floor((invitedCount - 5) / 3) + 1);
}