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
    gradient.addColorStop(0, "rgba(79, 140, 255, 0.16)");
    gradient.addColorStop(1, "rgba(108, 92, 231, 0.1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    const cx = width / 2;
    const cy = height - 42;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx + 42, cy);
    ctx.lineTo(cx, cy + 18);
    ctx.lineTo(cx - 42, cy);
    ctx.closePath();
    ctx.fillStyle = "rgba(92, 184, 92, 0.28)";
    ctx.fill();
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
        borderRadius: 12,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        background: "rgba(0, 0, 0, 0.2)",
      }}
    />
  );
}