import { type CharacterAppearance } from "@metricbase/shared";
import { useEffect, useRef } from "react";
import { drawCharacter } from "../character/characterArt";

/** A small framed avatar portrait drawn from the player's appearance. */
export function PortraitCanvas({
  appearance,
  size = 60,
}: {
  appearance: CharacterAppearance | null;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !appearance) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    // Draw the character a bit larger than the frame and nudged up so the
    // head/torso fill the portrait nicely.
    drawCharacter(ctx, appearance, size, size * 1.7);
  }, [appearance, size]);

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
