import type { CSSProperties } from "react";

export const CHIBI_FONT = "var(--chibi-font)";
export const CHIBI_FONT_DISPLAY = "var(--chibi-font-display)";

export function panelPosition(
  position: "top-left" | "top-right" | "bottom-left" | "center",
): CSSProperties {
  const base: CSSProperties = { position: "absolute", zIndex: 18 };
  switch (position) {
    case "top-left":
      return { ...base, top: 16, left: 16 };
    case "top-right":
      return { ...base, top: 16, right: 16 };
    case "bottom-left":
      return { ...base, left: 16, bottom: 16 };
    case "center":
      return {
        ...base,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 22,
      };
  }
}