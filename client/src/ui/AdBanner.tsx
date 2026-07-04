import { type AdServedCreative } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { networkManager } from "../game/network";
import { isAnyPanelOpen, useGameStore } from "../store/gameStore";

/** The persistent global ad banner (the "global_banner" slot creative). */
export function AdBanner() {
  const setAdsOpen = useGameStore((s) => s.setAdsOpen);
  const panelOpen = useGameStore(isAnyPanelOpen);
  const worldEditing = useGameStore((s) => s.worldEditing);
  const [creative, setCreative] = useState<AdServedCreative | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const off = networkManager.onAdServing((payload) => {
      // Prefer the banner slot, but fall back to the top-ranked ad so the banner
      // always shows an ad whenever any campaign is serving.
      setCreative(
        payload.creatives.find((c) => c.slotId === "global_banner") ?? payload.creatives[0] ?? null,
      );
    });
    networkManager.requestAdServing();
    return () => {
      off();
    };
  }, []);

  if (dismissed || panelOpen || worldEditing) return null;

  // Empty slot → a house "advertise here" promo that opens the Ads panel.
  if (!creative) {
    return (
      <button type="button" className="chibi-adbanner chibi-adbanner--house" onClick={() => setAdsOpen(true)}>
        <span className="chibi-adbanner__tag">AD</span>
        <span className="chibi-adbanner__text">📣 Your ad here — advertise to every player. Tap to learn more.</span>
      </button>
    );
  }

  return (
    <div className="chibi-adbanner">
      <span className="chibi-adbanner__tag">AD</span>
      {creative.imageUrl && (
        <img className="chibi-adbanner__img" src={creative.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
      )}
      <a className="chibi-adbanner__text" href={creative.clickUrl} target="_blank" rel="noopener noreferrer nofollow">
        {creative.headline || "Sponsored"}
      </a>
      <button
        type="button"
        className="chibi-adbanner__x"
        onClick={() => setDismissed(true)}
        aria-label="Hide ad"
        title="Hide"
      >
        ×
      </button>
    </div>
  );
}
