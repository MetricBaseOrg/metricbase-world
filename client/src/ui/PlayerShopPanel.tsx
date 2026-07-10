import { getItemDefinition, type ShopListing } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

function itemName(itemId: string): string {
  try {
    return getItemDefinition(itemId).name;
  } catch {
    return itemId;
  }
}

export function PlayerShopPanel() {
  const open = useGameStore((s) => s.playerShopOpen);
  const plotId = useGameStore((s) => s.playerShopPlotId);
  const plots = useGameStore((s) => s.housingPlots);
  const playerName = useGameStore((s) => s.playerName);
  const playerGold = useGameStore((s) => s.playerGold);
  const inventory = useGameStore((s) => s.inventory);
  const setOpen = useGameStore((s) => s.setPlayerShopOpen);
  const setPlayerGold = useGameStore((s) => s.setPlayerGold);

  const setHousingMarketOpen = useGameStore((s) => s.setHousingMarketOpen);
  const [error, setError] = useState<string | null>(null);
  const [stockItem, setStockItem] = useState("");
  const [stockQty, setStockQty] = useState(1);
  const [stockPrice, setStockPrice] = useState(10);
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});
  const [goldPrice, setGoldPrice] = useState("");
  const [basePrice, setBasePrice] = useState("");

  useEffect(() => {
    if (!open) return;
    const unsubscribe = networkManager.onPlayerShopResult((payload) => {
      if (typeof payload.gold === "number") setPlayerGold(payload.gold);
      if (!payload.ok) {
        playSfx("shop_fail");
        setError(payload.error ?? "Action failed.");
      } else {
        playSfx("coin");
        setError(null);
      }
    });
    // List/unlist for resale replies via housingResult (shared with the Land Plot panel).
    const offHousing = networkManager.onHousingResult((payload) => {
      if (!payload.ok) {
        playSfx("shop_fail");
        setError(payload.error ?? "Could not update the listing.");
      } else {
        playSfx("craft");
        setError(null);
      }
    });
    return () => {
      unsubscribe();
      offHousing();
    };
  }, [open, setPlayerGold]);

  // Default the stock dropdown to the first inventory item.
  useEffect(() => {
    if (!stockItem && inventory.items.length > 0) setStockItem(inventory.items[0].itemId);
  }, [inventory.items, stockItem]);

  const plotForSale = plots.find((entry) => entry.plotId === plotId);
  // Prefill the resale price inputs from the shop's current listing.
  useEffect(() => {
    setGoldPrice(plotForSale?.saleGold != null ? String(plotForSale.saleGold) : "");
    setBasePrice(plotForSale?.saleBase != null ? String(plotForSale.saleBase) : "");
  }, [plotForSale?.saleGold, plotForSale?.saleBase, plotId]);

  if (!open || !plotId) return null;
  const plot = plots.find((entry) => entry.plotId === plotId);
  if (!plot || plot.structure !== "shop") return null;

  const isMine = plot.ownerName === playerName;

  const listForSale = () => {
    const gold = Number(goldPrice) > 0 ? Math.floor(Number(goldPrice)) : null;
    const base = Number(basePrice) > 0 ? Number(basePrice) : null;
    if (gold === null && base === null) {
      setError("Set a gold and/or $BASE price first.");
      return;
    }
    playSfx("ui_click");
    setError(null);
    networkManager.sendHousingListSale(plotId, gold, base);
  };

  const withdrawListing = () => {
    playSfx("ui_click");
    setError(null);
    networkManager.sendHousingUnlistSale(plotId);
  };
  const listings: ShopListing[] = plot.listings ?? [];
  const earnings = plot.earnings ?? 0;

  const close = () => {
    playSfx("ui_close");
    setOpen(false);
    setError(null);
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-panel--sheet chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 380, width: "92vw" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">
          🏪 {plot.sign || (isMine ? "Your Shop" : `${plot.ownerName}'s Shop`)}
        </div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ×
        </button>
      </div>

      <div className="chibi-modal-body">
      {!isMine && (
        <div className="chibi-text-muted" style={{ marginTop: 6, fontSize: "0.78rem" }}>
          Your gold: <span style={{ color: "var(--chibi-gold-deep)", fontWeight: 800 }}>🪙 {playerGold}</span>
        </div>
      )}

      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {listings.length === 0 && (
          <div className="chibi-text-muted" style={{ fontSize: "0.82rem", textAlign: "center", padding: "8px 0" }}>
            {isMine ? "Your shelves are empty — list something below." : "This shop has nothing for sale yet."}
          </div>
        )}
        {listings.map((listing) => (
          <div
            key={listing.itemId}
            className="chibi-card"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>{itemName(listing.itemId)}</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.74rem" }}>
                🪙 {listing.price} each · {listing.quantity} left
              </div>
            </div>
            {isMine ? (
              <button
                type="button"
                className="chibi-btn chibi-btn--ghost"
                style={{ padding: "6px 10px", fontSize: "0.76rem" }}
                onClick={() => networkManager.sendShopUnstock(plotId, listing.itemId)}
              >
                Take back
              </button>
            ) : (
              (() => {
                const qty = Math.min(Math.max(1, buyQty[listing.itemId] ?? 1), listing.quantity);
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      min={1}
                      max={listing.quantity}
                      value={qty}
                      onChange={(e) =>
                        setBuyQty((m) => ({ ...m, [listing.itemId]: Number(e.target.value) || 1 }))
                      }
                      className="chibi-input"
                      style={{ width: 44, padding: "4px 6px" }}
                      aria-label="Quantity to buy"
                    />
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--primary"
                      style={{ padding: "6px 8px", fontSize: "0.76rem" }}
                      disabled={playerGold < listing.price}
                      onClick={() => networkManager.sendShopBuyListing(plotId, listing.itemId, qty)}
                    >
                      Buy 🪙{qty * listing.price}
                    </button>
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--ghost"
                      style={{ padding: "6px 8px", fontSize: "0.72rem" }}
                      disabled={playerGold < listing.price}
                      onClick={() =>
                        networkManager.sendShopBuyListing(plotId, listing.itemId, listing.quantity)
                      }
                      title="Buy as many as you can afford"
                    >
                      All
                    </button>
                  </div>
                );
              })()
            )}
          </div>
        ))}
      </div>

      {isMine && (
        <>
          <div
            className="chibi-card chibi-card--info"
            style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}
          >
            <div style={{ flex: 1, fontSize: "0.84rem" }}>
              Earnings: <span style={{ color: "var(--chibi-gold-deep)", fontWeight: 800 }}>🪙 {earnings}</span>
            </div>
            <button
              type="button"
              className="chibi-btn chibi-btn--gold"
              style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              disabled={earnings <= 0}
              onClick={() => networkManager.sendShopCollect(plotId)}
            >
              Collect
            </button>
          </div>

          <div className="chibi-card" style={{ marginTop: 8, padding: "10px 12px" }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 6 }}>Stock an item</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={stockItem}
                onChange={(e) => setStockItem(e.target.value)}
                className="chibi-input"
                style={{ flex: "1 1 120px", padding: "6px 8px" }}
              >
                {inventory.items.length === 0 && <option value="">(inventory empty)</option>}
                {inventory.items.map((item) => (
                  <option key={item.itemId} value={item.itemId}>
                    {itemName(item.itemId)} ×{item.quantity}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={stockQty}
                onChange={(e) => setStockQty(Math.max(1, Number(e.target.value) || 1))}
                className="chibi-input"
                style={{ width: 56, padding: "6px 8px" }}
                aria-label="Quantity"
              />
              <input
                type="number"
                min={1}
                value={stockPrice}
                onChange={(e) => setStockPrice(Math.max(1, Number(e.target.value) || 1))}
                className="chibi-input"
                style={{ width: 64, padding: "6px 8px" }}
                aria-label="Price each"
              />
              <button
                type="button"
                className="chibi-btn chibi-btn--primary"
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                disabled={!stockItem}
                onClick={() => networkManager.sendShopStock(plotId, stockItem, stockQty, stockPrice)}
              >
                List
              </button>
            </div>
            <div className="chibi-text-muted" style={{ marginTop: 4, fontSize: "0.72rem" }}>
              Price is per item. Buyers pay you; collect your earnings here.
            </div>
          </div>

          <div className="chibi-card" style={{ marginTop: 8, padding: "10px 12px" }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 6 }}>💰 Sell this shop</div>
            {(plot.saleGold != null || plot.saleBase != null) && (
              <div className="chibi-card chibi-card--info" style={{ padding: "6px 10px", marginBottom: 8, fontSize: "0.76rem" }}>
                Listed for{" "}
                {plot.saleGold != null && <strong>🪙 {plot.saleGold.toLocaleString()}</strong>}
                {plot.saleGold != null && plot.saleBase != null && " or "}
                {plot.saleBase != null && <strong>💠 {plot.saleBase.toLocaleString()} $BASE</strong>}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                min={0}
                value={goldPrice}
                placeholder="Gold price"
                onChange={(e) => setGoldPrice(e.target.value)}
                className="chibi-input"
                style={{ flex: 1, padding: "6px 8px" }}
                aria-label="Sale price in gold"
              />
              <input
                type="number"
                min={0}
                value={basePrice}
                placeholder="$BASE price"
                onChange={(e) => setBasePrice(e.target.value)}
                className="chibi-input"
                style={{ flex: 1, padding: "6px 8px" }}
                aria-label="Sale price in $BASE"
              />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="button" className="chibi-btn chibi-btn--primary" onClick={listForSale} style={{ flex: 1, padding: "6px 10px", fontSize: "0.78rem" }}>
                List for sale
              </button>
              {(plot.saleGold != null || plot.saleBase != null) && (
                <button type="button" className="chibi-btn chibi-btn--secondary" onClick={withdrawListing} style={{ padding: "6px 10px", fontSize: "0.78rem" }}>
                  Withdraw
                </button>
              )}
            </div>
            <div className="chibi-text-muted" style={{ marginTop: 4, fontSize: "0.72rem" }}>
              Sells the whole shop (building + plot). Buyers browse the <strong>🏘️ Housing Market</strong>; $BASE is paid straight to your wallet.
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        className="chibi-btn chibi-btn--ghost"
        onClick={() => {
          playSfx("ui_open");
          setHousingMarketOpen(true);
        }}
        style={{ width: "100%", marginTop: 10, padding: "7px 10px", fontSize: "0.8rem" }}
      >
        🏘️ Browse Housing Market
      </button>

      {error && (
        <div className="chibi-card chibi-card--danger" style={{ marginTop: 10, fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
      </div>
    </div>
  );
}
