import { baseItemIdOf, getFishDishArt, getFishSpecies, qualityOf } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { drawItemIcon } from "./itemIcons";

/**
 * A small item icon. Fish species render their real PNG art (the same files
 * the catch celebration uses); everything else is procedurally drawn on a
 * canvas. If a species PNG is missing the canvas drawing is the fallback.
 */
export function ItemIcon({ itemId: rawItemId, size = 32 }: { itemId: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [artFailed, setArtFailed] = useState(false);

  // Craft-quality variants (item_x_fine / item_x_master) share the base
  // item's art; the quality shows in the name and a colored ring below.
  const quality = qualityOf(rawItemId);
  const itemId = baseItemIdOf(rawItemId);

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

  // Fine = silver ring, Master = gold ring.
  const qualityRing =
    quality === "master"
      ? "0 0 0 2px #d9a520, 0 0 6px rgba(217,165,32,0.55)"
      : quality === "fine"
        ? "0 0 0 2px #9aa7b8, 0 0 5px rgba(154,167,184,0.5)"
        : undefined;
  const ringStyle = qualityRing ? { boxShadow: qualityRing, borderRadius: 6 } : {};

  if (useArt) {
    return (
      <img
        src={itemImgSrc}
        alt=""
        onError={() => setArtFailed(true)}
        style={{ width: size, height: size, display: "block", objectFit: "contain", ...ringStyle }}
        aria-hidden="true"
      />
    );
  }

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size, display: "block", ...ringStyle }}
      aria-hidden="true"
    />
  );
}
