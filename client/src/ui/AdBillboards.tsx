import { billboardSlotForZone, type AdServedCreative } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

/**
 * Two large angled billboards flanking the play area (top-left + top-right),
 * both showing the current zone's billboard creative (assigned by bid rank).
 * Falls back to an "advertise here" house promo when the slot is empty.
 */
export function AdBillboards() {
  const zoneId = useGameStore((s) => s.zoneId);
  const setAdsOpen = useGameStore((s) => s.setAdsOpen);
  const [serving, setServing] = useState<AdServedCreative[]>([]);

  useEffect(() => {
    const off = networkManager.onAdServing((p) => setServing(p.creatives));
    networkManager.requestAdServing();
    return () => {
      off();
    };
  }, []);

  const slotId = billboardSlotForZone(zoneId);
  if (!slotId) return null; // zones without a billboard (lodge, jail)
  const creative = serving.find((c) => c.slotId === slotId) ?? null;

  const face = () =>
    creative ? (
      <a
        className="chibi-bb__face"
        href={creative.clickUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        style={creative.imageUrl ? { backgroundImage: `url(${creative.imageUrl})` } : undefined}
      >
        {!creative.imageUrl && <span className="chibi-bb__text">{creative.headline || "Sponsored"}</span>}
        <span className="chibi-bb__tag">AD</span>
      </a>
    ) : (
      <button type="button" className="chibi-bb__face chibi-bb__face--house" onClick={() => setAdsOpen(true)}>
        <span className="chibi-bb__text">📣 Ads here</span>
      </button>
    );

  return (
    <>
      <div className="chibi-bb chibi-bb--left">{face()}</div>
      <div className="chibi-bb chibi-bb--right">{face()}</div>
    </>
  );
}
