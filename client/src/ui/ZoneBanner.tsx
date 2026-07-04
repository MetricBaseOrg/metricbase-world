import { getDangerTierMeta } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { isAnyPanelOpen, useGameStore } from "../store/gameStore";

/**
 * Shows the current zone's PvP danger tier: a brief full banner on entry plus a
 * persistent corner chip, and a screen-edge tint for non-safe zones so players
 * always know the stakes.
 */
export function ZoneBanner() {
  const zoneId = useGameStore((state) => state.zoneId);
  const zoneName = useGameStore((state) => state.zoneName);
  const worldEditing = useGameStore((state) => state.worldEditing);
  const panelOpen = useGameStore(isAnyPanelOpen);
  const [showBanner, setShowBanner] = useState(false);
  const lastZone = useRef<string | null>(null);

  const meta = getDangerTierMeta(zoneId);

  useEffect(() => {
    if (lastZone.current === zoneId) return;
    lastZone.current = zoneId;
    setShowBanner(true);
    const timer = window.setTimeout(() => setShowBanner(false), 3200);
    return () => window.clearTimeout(timer);
  }, [zoneId]);

  // Keep the corner chip / banner out of the way while building or in any panel.
  if (worldEditing || panelOpen) return null;

  return (
    <>
      {meta.tier !== "safe" && (
        <div
          className="chibi-zone-tint"
          style={{ boxShadow: `inset 0 0 120px 18px ${meta.color}55` }}
          aria-hidden="true"
        />
      )}

      <div className="chibi-zone-chip" style={{ borderColor: meta.color }}>
        <span className="chibi-zone-chip__dot" style={{ background: meta.color }} />
        <span className="chibi-zone-chip__label">{meta.label}</span>
      </div>

      {showBanner && (
        <div className="chibi-zone-banner" style={{ borderColor: meta.color }}>
          <div className="chibi-zone-banner__title" style={{ color: meta.color }}>
            {zoneName}
          </div>
          <div className="chibi-zone-banner__tier" style={{ color: meta.color }}>
            {meta.label}
          </div>
          <div className="chibi-zone-banner__rule">{meta.rule}</div>
        </div>
      )}
    </>
  );
}
