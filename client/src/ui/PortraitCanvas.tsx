import { type CharacterAppearance } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { drawCharacter } from "../character/characterArt";
import { hdCharacterFor } from "../character/handDrawnAvatar";

/** A small framed avatar: the character's standing front-idle art when it
 *  exists (tried directly — no manifest wait), else the drawn fallback. */
export function PortraitCanvas({
  appearance,
  size = 60,
}: {
  appearance: CharacterAppearance | null;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [artFailed, setArtFailed] = useState(false);
  const artUrl =
    appearance && !artFailed ? `/assets/characters/${hdCharacterFor(appearance)}-front-idle-0.webp` : null;

  useEffect(() => {
    if (artUrl) return;
    const canvas = ref.current;
    if (!canvas || !appearance) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    // Draw the character a bit larger than the frame and nudged up so the
    // head/torso fill the portrait nicely.
    drawCharacter(ctx, appearance, size, size * 1.7);
  }, [appearance, size, artUrl]);

  if (artUrl) {
    return (
      <img
        src={artUrl}
        alt=""
        onError={() => setArtFailed(true)}
        className="chibi-portrait-canvas"
        style={{ width: size, height: size, objectFit: "contain" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="chibi-portrait-canvas"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
