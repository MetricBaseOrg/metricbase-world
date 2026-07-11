import { type CharacterAppearance } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { drawCharacter } from "../character/characterArt";
import { hdCharacterFor, hdReadyFor } from "../character/handDrawnAvatar";

interface CharacterPreviewProps {
  appearance: CharacterAppearance;
  width?: number;
  height?: number;
}

export function CharacterPreview({ appearance, width = 200, height = 240 }: CharacterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [artFailed, setArtFailed] = useState(false);
  // When hand-drawn art exists, show the front-idle frame over the scene
  // (fireflies/glow stay for atmosphere). Falls back to the drawn character.
  const character = hdCharacterFor(appearance);
  const hdUrl = !artFailed && hdReadyFor(character) ? `/assets/characters/${character}-front-idle-0.webp` : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#aed6f1"); // soft blue sky
    gradient.addColorStop(0.5, "#d2f1ff"); // light blue
    gradient.addColorStop(1, "#fef5e7"); // warm sunlit cream
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // draw a beautiful, warm sun in the upper right
    const sunX = width - 35;
    const sunY = 35;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 15);
    sunGlow.addColorStop(0, "rgba(255, 235, 120, 1)");
    sunGlow.addColorStop(0.3, "rgba(255, 215, 0, 0.5)");
    sunGlow.addColorStop(1, "rgba(255, 215, 0, 0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
    ctx.fill();

    // draw fluffy drifting clouds
    const drawCloud = (x: number, y: number, r: number) => {
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x - r * 0.7, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
      ctx.arc(x + r * 0.7, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.8, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    };
    drawCloud(40, 45, 9);
    drawCloud(130, 60, 7);

    const cx = width / 2;
    const cy = height - 42;
    const hw = 44;
    const hh = 19;

    // shadow beneath tile
    ctx.fillStyle = "rgba(74, 55, 40, 0.08)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh + 4);
    ctx.lineTo(cx + hw + 4, cy + 4);
    ctx.lineTo(cx, cy + hh + 4);
    ctx.lineTo(cx - hw - 4, cy + 4);
    ctx.closePath();
    ctx.fill();

    // tile base wall/dirt side
    ctx.fillStyle = "#8d6a42"; // brown dirt
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx + hw, cy + 8);
    ctx.lineTo(cx, cy + hh + 8);
    ctx.lineTo(cx - hw, cy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4a3728";
    ctx.lineWidth = 2;
    ctx.stroke();

    // grass top face
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.fillStyle = "#8ac35d"; // cozy grass green
    ctx.fill();
    ctx.strokeStyle = "#4a3728";
    ctx.lineWidth = 2;
    ctx.stroke();

    // inner grass highlight
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh + 3);
    ctx.lineTo(cx + hw - 6, cy);
    ctx.lineTo(cx, cy + hh - 3);
    ctx.lineTo(cx - hw + 6, cy);
    ctx.closePath();
    ctx.strokeStyle = "#aad97c"; // light grass highlight
    ctx.lineWidth = 1;
    ctx.stroke();

    // draw a tiny pebble on the grass
    ctx.fillStyle = "#a69cb0";
    ctx.beginPath();
    ctx.ellipse(cx - 24, cy + 2, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4a3728";
    ctx.lineWidth = 1;
    ctx.stroke();

    // draw a tiny flower
    const fx = cx + 22;
    const fy = cy - 2;
    // stem
    ctx.strokeStyle = "#46742d";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx + 2, fy - 5, fx + 1, fy - 8);
    ctx.stroke();
    // petals
    ctx.fillStyle = "#ff6b9d"; // pink petals
    for (let angle = 0; angle < Math.PI * 2; angle += (Math.PI * 2) / 5) {
      ctx.beginPath();
      ctx.arc(fx + 1 + Math.cos(angle) * 1.8, fy - 8 + Math.sin(angle) * 1.8, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // center
    ctx.fillStyle = "#ffc93c"; // yellow center
    ctx.beginPath();
    ctx.arc(fx + 1, fy - 8, 1, 0, Math.PI * 2);
    ctx.fill();

    // draw character (skipped when hand-drawn art overlays the scene)
    if (!hdUrl) drawCharacter(ctx, appearance, width, height);

    // draw floating fireflies
    const fireflies = [
      { x: cx - 50, y: height - 110, size: 2.2, alpha: 0.65 },
      { x: cx + 45, y: height - 140, size: 2.8, alpha: 0.8 },
      { x: cx - 25, y: height - 170, size: 1.8, alpha: 0.5 },
      { x: cx + 15, y: height - 90, size: 2.4, alpha: 0.7 },
      { x: cx + 55, y: height - 70, size: 1.6, alpha: 0.45 },
    ];
    for (const ff of fireflies) {
      const glow = ctx.createRadialGradient(ff.x, ff.y, 0.5, ff.x, ff.y, ff.size * 3.5);
      glow.addColorStop(0, `rgba(255, 235, 120, ${ff.alpha})`);
      glow.addColorStop(0.3, `rgba(255, 215, 0, ${ff.alpha * 0.4})`);
      glow.addColorStop(1, "rgba(255, 215, 0, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, ff.size * 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 220, ${ff.alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, ff.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [appearance, width, height, hdUrl]);

  return (
    <div style={{ position: "relative", width, maxWidth: "100%" }}>
      <canvas
        ref={canvasRef}
        className="chibi-character-preview"
        width={width}
        height={height}
        style={{ width, maxWidth: "100%", height: "auto", display: "block" }}
      />
      {hdUrl && (
        <img
          src={hdUrl}
          alt=""
          onError={() => setArtFailed(true)}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "6%",
            transform: "translateX(-50%)",
            width: "78%",
            height: "auto",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}