import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";

/**
 * Full-screen arcade cabinet — embeds an external MetricBase game (e.g. Base
 * Rush) in an iframe when the player interacts with the Lodge arcade machine.
 * Works on mobile (fills the viewport) with a clear close + open-in-tab.
 */
export function ArcadeModal() {
  const [arcade, setArcade] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    const unsubscribe = networkManager.onArcade((payload) => {
      playSfx("ui_open");
      setArcade(payload);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!arcade) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setArcade(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arcade]);

  if (!arcade) return null;

  const close = () => {
    playSfx("ui_close");
    setArcade(null);
  };

  return (
    <div className="chibi-arcade-overlay" role="dialog" aria-label={arcade.name}>
      <div className="chibi-arcade-bar">
        <span className="chibi-arcade-title">🕹️ {arcade.name}</span>
        <div className="chibi-arcade-actions">
          <a
            className="chibi-btn chibi-btn--secondary"
            href={arcade.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => playSfx("ui_click")}
          >
            Open in new tab ↗
          </a>
          <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close arcade">
            ×
          </button>
        </div>
      </div>
      <iframe
        className="chibi-arcade-frame"
        src={arcade.url}
        title={arcade.name}
        allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope"
      />
    </div>
  );
}
