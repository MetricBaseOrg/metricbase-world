import { type SeasonStatePayload } from "@metricbase/shared";
import { useEffect, useRef } from "react";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";
import { isTelegramMiniApp, openExternalLink, shareToTelegram, TELEGRAM_BOT } from "../telegram/telegramApp";

const PLAY_URL = "world.metricbase.org";

/** A branded, downloadable personal Season card + one-tap X share. Drawn on a
 * canvas so there's no server-side image infra — the player can save the PNG
 * and attach it, and the "Share to X" button pre-fills their personal stats. */
export function SeasonShareModal({ season, onClose }: { season: SeasonStatePayload; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const name = useGameStore((s) => s.playerName);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    // Background + brand glows
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, W, H);
    const g1 = ctx.createRadialGradient(180, 120, 0, 180, 120, 620);
    g1.addColorStop(0, "rgba(79,184,168,0.20)");
    g1.addColorStop(1, "rgba(79,184,168,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(1050, 560, 0, 1050, 560, 560);
    g2.addColorStop(0, "rgba(201,168,76,0.18)");
    g2.addColorStop(1, "rgba(201,168,76,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(79,184,168,0.5)";
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // Brand mark (rotated gold diamond) + wordmark
    ctx.save();
    ctx.translate(78, 84);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = "#C9A84C";
    ctx.lineWidth = 4;
    ctx.strokeRect(-16, -16, 32, 32);
    ctx.fillStyle = "rgba(201,168,76,0.45)";
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.fillStyle = "#e5e5e5";
    ctx.font = "700 26px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("METRICBASE ", 112, 76);
    const mbW = ctx.measureText("METRICBASE ").width;
    ctx.fillStyle = "#C9A84C";
    ctx.fillText("WORLD", 112 + mbW, 76);

    // Season headline
    ctx.fillStyle = "#6FD4C2";
    ctx.font = "800 30px sans-serif";
    ctx.fillText(`SEASON ${season.seasonNumber}`, 78, 168);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 92px sans-serif";
    ctx.fillText(name, 78, 250);

    // Big rank
    const hasRank = season.points > 0 && season.rank > 0;
    ctx.fillStyle = "#C9A84C";
    ctx.font = "800 150px sans-serif";
    ctx.fillText(hasRank ? `#${season.rank}` : "—", 78, 400);
    ctx.fillStyle = "#999999";
    ctx.font = "600 30px sans-serif";
    ctx.fillText(hasRank ? `of ${season.totalPlayers.toLocaleString()} players` : "join the race", 82, 490);

    // Stat pills on the right
    const stat = (label: string, value: string, y: number) => {
      ctx.fillStyle = "#6FD4C2";
      ctx.font = "700 24px sans-serif";
      ctx.fillText(label, 720, y);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 58px sans-serif";
      ctx.fillText(value, 720, y + 52);
    };
    stat("SEASON POINTS", season.points.toLocaleString(), 300);
    stat("EST. REWARD", `${season.estimatedReward.toLocaleString()} $BASE`, 420);

    // Footer
    ctx.fillStyle = "#C9A84C";
    ctx.font = "700 30px sans-serif";
    ctx.fillText(`🏆 ${season.rewardPool.toLocaleString()} $BASE prize pool`, 78, 556);
    ctx.textAlign = "right";
    ctx.fillStyle = "#e5e5e5";
    ctx.font = "800 32px sans-serif";
    ctx.fillText(`▶ PLAY FREE · ${PLAY_URL}`, W - 78, 556);
    ctx.textAlign = "left";
  }, [season, name]);

  const shareText = () => {
    const hasRank = season.points > 0 && season.rank > 0;
    const line = hasRank
      ? `🏆 Ranked #${season.rank} of ${season.totalPlayers.toLocaleString()} in MetricBase World — Season ${season.seasonNumber}!\n\n${season.points.toLocaleString()} points · est. ${season.estimatedReward.toLocaleString()} $BASE from the prize pool.`
      : `🌍 Competing in MetricBase World Season ${season.seasonNumber} — a real player-run economy on Solana.`;
    return `${line}\n\nBuild, trade & climb → https://${PLAY_URL} #Solana`;
  };

  const shareToX = () => {
    playSfx("ui_click");
    // Inside Telegram, window.open is swallowed by the webview.
    openExternalLink(`https://x.com/intent/post?text=${encodeURIComponent(shareText())}`, true);
  };

  const shareToTg = () => {
    playSfx("ui_click");
    shareToTelegram(shareText(), { fallbackUrl: `https://${PLAY_URL}` });
  };

  // Offer Telegram sharing where it lands: always inside the Mini App, and on
  // the web only once a bot is configured (otherwise the link goes nowhere).
  const showTelegramShare = isTelegramMiniApp() || Boolean(TELEGRAM_BOT);

  const saveImage = () => {
    playSfx("ui_click");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `metricbase-world-season${season.seasonNumber}-${name}.png`;
    a.click();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", pointerEvents: "auto" }}
      onClick={onClose}
    >
      <div
        className="chibi-panel chibi-panel--floating"
        style={{ maxWidth: 440, width: "94vw", padding: "12px 14px 14px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chibi-close-row">
          <div className="chibi-title chibi-title--sm chibi-sparkle-title">📢 Share your Season</div>
          <button type="button" className="chibi-btn chibi-btn--ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", borderRadius: 10, marginTop: 8, border: "1px solid rgba(79,184,168,0.4)" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" className="chibi-btn chibi-btn--gold" style={{ flex: 1, padding: "10px 12px", fontWeight: 800 }} onClick={shareToX}>
            𝕏 Share to X
          </button>
          <button type="button" className="chibi-btn chibi-btn--secondary" style={{ flex: 1, padding: "10px 12px" }} onClick={saveImage}>
            🖼️ Save image
          </button>
        </div>
        {showTelegramShare && (
          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            style={{ width: "100%", padding: "10px 12px", marginTop: 8 }}
            onClick={shareToTg}
          >
            ✈️ Share to Telegram
          </button>
        )}
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 8, textAlign: "center" }}>
          Save the card and attach it to your post for the full flex.
        </div>
      </div>
    </div>
  );
}
