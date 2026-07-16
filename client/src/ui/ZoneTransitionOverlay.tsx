import { useEffect, useRef, useState } from "react";
import { networkManager } from "../game/network";

/** Minimum time the travel screen stays up, so it never flickers even on an
 *  instant room switch. The GameScene departure FX (~400ms) plays under it. */
const MIN_VISIBLE_MS = 1100;
const FADE_MS = 350;

/**
 * Full-screen "traveling" transition shown while a portal moves the player
 * between zones: appears on the `transfer` message (as the departure swirl
 * plays), covers the room switch + zone render, and fades out over the arrival
 * swirl. Purely visual — the transfer itself is driven by the network layer.
 */
export function ZoneTransitionOverlay() {
  const [label, setLabel] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const shownAtRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };

    const offTransfer = networkManager.onTransfer((payload) => {
      clearTimers();
      shownAtRef.current = Date.now();
      setFading(false);
      setLabel(payload.label || "a new zone");
    });

    // The new zone has rendered — hold until the minimum display time, then
    // fade out (the arrival swirl plays underneath as this lifts).
    const offZone = networkManager.onZoneChange(() => {
      if (shownAtRef.current === 0) return; // initial login, not a portal trip
      const elapsed = Date.now() - shownAtRef.current;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      timersRef.current.push(
        window.setTimeout(() => {
          setFading(true);
          timersRef.current.push(
            window.setTimeout(() => {
              setLabel(null);
              setFading(false);
              shownAtRef.current = 0;
            }, FADE_MS),
          );
        }, wait),
      );
    });

    return () => {
      offTransfer();
      offZone();
      clearTimers();
    };
  }, []);

  if (!label) return null;

  return (
    <div className={`mb-zone-transition${fading ? " mb-zone-transition--out" : ""}`}>
      <div className="mb-zone-transition__swirl">🌀</div>
      <div className="mb-zone-transition__title">Traveling to {label}</div>
      <div className="mb-zone-transition__dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
