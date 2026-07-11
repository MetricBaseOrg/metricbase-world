import { CROP_MARKETS, ITEMS } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

/**
 * Trading window for a placed crop-market building (Wheat/Carrot Market):
 * buy that crop's seeds and sell its harvest. Opened by walking up to the
 * market in a World and interacting (E / ✨).
 */
export function CropMarketPanel() {
  const marketId = useGameStore((s) => s.cropMarketOpen);
  const setOpen = useGameStore((s) => s.setCropMarketOpen);
  const playerGold = useGameStore((s) => s.playerGold);
  const inventory = useGameStore((s) => s.inventory);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Live (supply/demand-adjusted) prices from the server; static base prices
  // are only the fallback for old servers.
  const [livePrices, setLivePrices] = useState<{ seed?: number; crop?: number }>({});

  useEffect(() => {
    const offOpen = networkManager.onOpenCropMarket((payload) => {
      playSfx("ui_open");
      setNotice(null);
      setLivePrices({ seed: payload.seedPrice, crop: payload.cropSellPrice });
      useGameStore.getState().setCropMarketOpen(payload.market);
    });
    const offResult = networkManager.onCropMarketResult((r) => {
      setPending(false);
      setNotice(r.ok ? r.message ?? "Done." : r.error ?? "Trade failed.");
      if (r.seedPrice || r.cropSellPrice) setLivePrices({ seed: r.seedPrice, crop: r.cropSellPrice });
    });
    return () => {
      offOpen();
      offResult();
    };
  }, []);

  if (!marketId) return null;
  const market = CROP_MARKETS[marketId];
  if (!market) return null;
  const seedPrice = livePrices.seed ?? market.seedPrice;
  const cropSellPrice = livePrices.crop ?? market.cropSellPrice;

  const qtyOf = (itemId: string) =>
    inventory.items.find((e) => e.itemId === itemId)?.quantity ?? 0;
  const seedsOwned = qtyOf(market.seedItemId);
  const cropsOwned = qtyOf(market.cropItemId);
  const seedName = ITEMS[market.seedItemId]?.name ?? "Seed";
  const cropName = ITEMS[market.cropItemId]?.name ?? "Crop";
  const emoji = marketId === "market-carrot" ? "🥕" : "🌾";

  const trade = (action: "buySeed" | "sellCrop", qty: number) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendCropMarketTrade(marketId, action, qty);
  };

  const close = () => {
    playSfx("ui_close");
    setOpen(null);
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 380, width: "92vw", maxHeight: "82vh", overflowY: "auto" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">
          {emoji} {market.label}
        </div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="chibi-text-muted" style={{ fontSize: "0.74rem", marginTop: 2 }}>
        You have {playerGold.toLocaleString()}g
      </div>
      {notice && (
        <div className="chibi-card" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>
          {notice}
        </div>
      )}

      {/* Buy seeds */}
      <div className="chibi-card" style={{ marginTop: 10, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>🌱 {seedName}</div>
            <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
              {seedPrice}g each · you own {seedsOwned}
            </div>
          </div>
          <button
            type="button"
            className="chibi-btn chibi-btn--gold"
            style={{ padding: "8px 12px" }}
            disabled={pending || playerGold < seedPrice}
            onClick={() => trade("buySeed", 1)}
          >
            Buy 1
          </button>
          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            style={{ padding: "8px 10px" }}
            disabled={pending || playerGold < seedPrice * 5}
            onClick={() => trade("buySeed", 5)}
          >
            ×5
          </button>
        </div>
      </div>

      {/* Sell crops */}
      <div className="chibi-card" style={{ marginTop: 8, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{emoji} {cropName}</div>
            <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
              sells for {cropSellPrice}g each · you own {cropsOwned}
            </div>
          </div>
          <button
            type="button"
            className="chibi-btn chibi-btn--mint"
            style={{ padding: "8px 12px" }}
            disabled={pending || cropsOwned < 1}
            onClick={() => trade("sellCrop", 1)}
          >
            Sell 1
          </button>
          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            style={{ padding: "8px 10px" }}
            disabled={pending || cropsOwned < 1}
            onClick={() => trade("sellCrop", cropsOwned)}
          >
            All
          </button>
        </div>
      </div>

      <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 8, lineHeight: 1.45 }}>
        🌱 Plant seeds in a farm plot, wait for them to grow, then sell the harvest here for a profit.
      </div>
    </div>
  );
}
