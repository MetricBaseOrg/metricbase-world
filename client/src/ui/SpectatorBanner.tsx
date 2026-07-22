import { METRICBASE_TOKEN_MINT } from "@metricbase/shared";
import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";

const JUPITER_BUY = `https://jup.ag/swap/So11111111111111111111111111111111111111112-${METRICBASE_TOKEN_MINT}`;

/**
 * Shown only to spectators (the wallet-free "watch the world" mode). A gentle,
 * always-visible reminder that they're just watching, plus a one-tap path to
 * convert: buy $BASE on Jupiter, then connect a wallet and actually play.
 */
export function SpectatorBanner() {
  const spectator = useGameStore((s) => s.spectator);
  const [open, setOpen] = useState(false);

  if (!spectator) return null;

  const play = () => {
    playSfx("ui_click");
    // Drop the spectate flag and return to the login/connect screen.
    window.location.href = "/play";
  };

  return (
    <>
      {/* Slim always-visible spectating pill */}
      <button
        type="button"
        onClick={() => {
          playSfx("ui_open");
          setOpen(true);
        }}
        className="chibi-btn chibi-btn--gold"
        style={{
          position: "fixed",
          top: 74,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          padding: "8px 16px",
          fontSize: "0.8rem",
          fontWeight: 800,
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          pointerEvents: "auto",
        }}
      >
        👀 Spectating · 🔓 Unlock full play
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            pointerEvents: "auto",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="chibi-panel chibi-panel--floating"
            style={{ maxWidth: 380, width: "92vw", padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chibi-close-row" style={{ padding: "12px 14px 0" }}>
              <div className="chibi-title chibi-title--sm chibi-sparkle-title">🔓 Play for real</div>
              <button type="button" className="chibi-btn chibi-btn--ghost" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div style={{ padding: "6px 16px 16px" }}>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "6px 0 4px" }}>
                You're <b>watching</b> a live player-run economy. To gather, craft, trade on the exchange, build your own
                world, and earn <b>Season points</b> toward the $BASE prize pool — you need to actually play.
              </p>
              <div className="chibi-card" style={{ padding: "10px 12px", margin: "10px 0", fontSize: "0.78rem" }}>
                <b>It's free — one step:</b>
                <div style={{ marginTop: 4 }}>
                  Connect a Solana wallet and jump in. <b>No tokens needed</b> — your wallet just saves
                  your character and collects your Season rewards.
                </div>
              </div>
              {/* Entry is free, so playing is the primary action — buying
                  $BASE is now an optional upsell (gold, VIP, land), not a
                  prerequisite, and must not sit above the play button. */}
              <button
                type="button"
                className="chibi-btn chibi-btn--mint"
                style={{ width: "100%", padding: "11px 12px", marginBottom: 8, fontWeight: 800 }}
                onClick={play}
              >
                🎮 Connect wallet &amp; play free
              </button>
              <a
                href={JUPITER_BUY}
                target="_blank"
                rel="noopener"
                className="chibi-btn chibi-btn--secondary"
                style={{ display: "block", textAlign: "center", padding: "9px 12px", textDecoration: "none", fontSize: "0.8rem" }}
                onClick={() => playSfx("ui_click")}
              >
                💰 Get $BASE on Jupiter ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
