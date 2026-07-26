// Entry loading screen — covers the gap between "joined" and "the world is on
// screen", which until now was a blank dark canvas for several seconds.
//
// The bar is REAL: it tracks Phaser's loader across BootScene's world art (see
// game/loadingProgress.ts), not a timed animation. The zone-portal transition
// has its own overlay (ZoneTransitionOverlay) and deliberately ignores the
// initial login, so the two never fight over the screen.
import { useEffect, useState } from "react";
import { getLoadingState, onLoadingProgress, type LoadingState } from "../game/loadingProgress";

/** After this long we lift the overlay regardless. A player who hits a failing
 * asset or a slow CDN must still get into the world — a stuck loading screen is
 * worse than a half-decorated one, and Phaser renders what it has either way. */
const SAFETY_TIMEOUT_MS = 20_000;
/** Fade duration; keep in sync with the CSS transition below. */
const FADE_MS = 420;

const TIPS = [
  "Press F to gather, G to fish, Space to attack.",
  "Rudi buys and sells almost everything — prices move with supply and demand.",
  "Your wallet is your character: log in from any device and pick up where you left off.",
  "Land plots are 3×3. Build a house to rest, or a shop to trade while you're away.",
  "Towns are safe. The Wilderness and the Grotto are where the fights are.",
  "Fine and Master gear only comes from specialist crafters — trade for it.",
];

export function GameLoadingOverlay() {
  const [state, setState] = useState<LoadingState>(getLoadingState);
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => onLoadingProgress(setState), []);

  // Fade out once done, then unmount so the canvas gets all its pixels back.
  useEffect(() => {
    if (!state.done) return;
    setFading(true);
    const t = window.setTimeout(() => setHidden(true), FADE_MS);
    return () => window.clearTimeout(t);
  }, [state.done]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFading(true);
      window.setTimeout(() => setHidden(true), FADE_MS);
    }, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (hidden) return null;

  const pct = Math.round(state.progress * 100);

  return (
    <div
      className={`mb-loading${fading ? " mb-loading--out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Loading MetricBase World, ${pct} percent`}
    >
      <div className="mb-loading__mark">🌍</div>
      <div className="mb-loading__title">Entering MetricBase World</div>

      <div className="mb-loading__track">
        <div className="mb-loading__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="mb-loading__meta">
        <span>{state.label}</span>
        <span className="mb-loading__pct">{pct}%</span>
      </div>

      <div className="mb-loading__tip">💡 {tip}</div>
    </div>
  );
}
