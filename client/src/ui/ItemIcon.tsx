import { getFishDishArt, getFishSpecies } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { drawItemIcon } from "./itemIcons";

/**
 * A small item icon. Fish species render their real PNG art (the same files
 * the catch celebration uses); everything else is procedurally drawn on a
 * canvas. If a species PNG is missing the canvas drawing is the fallback.
 */
export function ItemIcon({ itemId, size = 32 }: { itemId: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [artFailed, setArtFailed] = useState(false);
  
  const fishArtFile = getFishSpecies(itemId)?.art ?? getFishDishArt(itemId);
  const isFishOrDish = fishArtFile !== null && fishArtFile !== undefined;
  
  let itemImgSrc: string | undefined = undefined;
  if (isFishOrDish && !artFailed) {
    itemImgSrc = `/assets/fish/${fishArtFile}`;
  } else if (itemId.startsWith("item_") && !artFailed) {
    const filename = itemId.substring(5).replace(/_/g, "-");
    itemImgSrc = `/assets/items/${filename}.png`;
  }
  
  const useArt = itemImgSrc !== undefined;

  useEffect(() => {
    setArtFailed(false);
  }, [itemId]);

  useEffect(() => {
    if (useArt) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawItemIcon(ctx, itemId, size);
  }, [itemId, size, useArt]);

  if (useArt) {
    return (
      <img
        src={itemImgSrc}
        alt=""
        onError={() => setArtFailed(true)}
        style={{ width: size, height: size, display: "block", objectFit: "contain" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size, display: "block" }}
      aria-hidden="true"
    />
  );
}
