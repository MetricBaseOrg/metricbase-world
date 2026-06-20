import { type CharacterAppearance } from "@metricbase/shared";
import { useEffect, useRef } from "react";
import { drawCharacter } from "../character/characterArt";

interface CharacterPreviewProps {
  appearance: CharacterAppearance;
  width?: number;
  height?: number;
}

export function CharacterPreview({ appearance, width = 200, height = 240 }: CharacterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#dff4ff");
    gradient.addColorStop(1, "#fff4e6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height - 42;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx + 42, cy);
    ctx.lineTo(cx, cy + 18);
    ctx.lineTo(cx - 42, cy);
    ctx.closePath();
    ctx.fillStyle = "rgba(126, 217, 87, 0.45)";
    ctx.fill();
    ctx.strokeStyle = "#4a3728";
    ctx.lineWidth = 2;
    ctx.stroke();

    drawCharacter(ctx, appearance, width, height);
  }, [appearance, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: "100%",
        height: "auto",
        borderRadius: 16,
        border: "3px solid var(--chibi-outline)",
        boxShadow: "0 5px 0 var(--chibi-shadow)",
        background: "#fff",
      }}
    />
  );
}