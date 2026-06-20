import { buildShopOpenPayload, getShopDefinition, type ShopOpenPayload } from "@metricbase/shared";
import { useState } from "react";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

function refreshShopCatalog(
  shop: ShopOpenPayload,
  gold: number,
  inventory: { items: Array<{ itemId: string; quantity: number }> },
): ShopOpenPayload {
  const definition = getShopDefinition(shop.shopId);
  return buildShopOpenPayload(
    definition,
    shop.merchantName,
    shop.greeting,
    gold,
    inventory.items,
  );
}

export function ShopPanel() {
  const shop = useGameStore((state) => state.shop);
  const open = useGameStore((state) => state.shopOpen);
  const playerGold = useGameStore((state) => state.playerGold);
  const inventory = useGameStore((state) => state.inventory);
  const setShop = useGameStore((state) => state.setShop);
  const setShopOpen = useGameStore((state) => state.setShopOpen);
  const setPlayerGold = useGameStore((state) => state.setPlayerGold);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open || !shop) return null;

  const handleClose = () => {
    setShopOpen(false);
    setShop(null);
    setError(null);
  };

  const handleBuy = async (itemId: string, price: number) => {
    if (playerGold < price) {
      setError("Not enough gold.");
      return;
    }

    setPending(true);
    setError(null);
    networkManager.sendShopBuy(shop.shopId, itemId);

    const result = await new Promise<{ ok: boolean; error?: string; gold?: number }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Shop request timed out." }), 8000);
      const unsubscribe = networkManager.onShopResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Purchase failed.");
      return;
    }

    const nextGold = result.gold ?? playerGold;
    setPlayerGold(nextGold);
    setShop(refreshShopCatalog(shop, nextGold, inventory));
    setError(null);
  };

  const handleSell = async (itemId: string) => {
    setPending(true);
    setError(null);
    networkManager.sendShopSell(shop.shopId, itemId, 1);

    const result = await new Promise<{ ok: boolean; error?: string; gold?: number }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Shop request timed out." }), 8000);
      const unsubscribe = networkManager.onShopResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Sale failed.");
      return;
    }

    const nextGold = result.gold ?? playerGold;
    const nextInventory = useGameStore.getState().inventory;
    setPlayerGold(nextGold);
    setShop(refreshShopCatalog(shop, nextGold, nextInventory));
    setError(null);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(420px, calc(100% - 32px))",
        padding: "18px 20px",
        borderRadius: 14,
        background: "rgba(8, 12, 24, 0.94)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        color: "#f4f7ff",
        backdropFilter: "blur(10px)",
        pointerEvents: "auto",
        zIndex: 22,
        boxShadow: "0 24px 80px rgba(0, 0, 0, 0.55)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{shop.merchantName}'s Shop</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>{shop.greeting}</div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          style={{
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            fontSize: 22,
            lineHeight: 1,
          }}
          aria-label="Close shop"
        >
          ×
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(255, 200, 80, 0.1)",
          border: "1px solid rgba(255, 200, 80, 0.25)",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Your gold: {playerGold}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, opacity: 0.85 }}>Buy</div>
        <div style={{ display: "grid", gap: 8 }}>
          {shop.buyOffers.map((offer) => (
            <div
              key={offer.itemId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{offer.name}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{offer.description}</div>
                <div style={{ fontSize: 12, color: "#ffd27a", marginTop: 4 }}>{offer.price} gold</div>
              </div>
              <button
                type="button"
                disabled={pending || playerGold < offer.price}
                onClick={() => void handleBuy(offer.itemId, offer.price)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    pending || playerGold < offer.price
                      ? "rgba(79, 140, 255, 0.35)"
                      : "linear-gradient(135deg, #4f8cff, #6c5ce7)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: pending || playerGold < offer.price ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Buy
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, opacity: 0.85 }}>Sell</div>
        {shop.sellOffers.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>
            No sellable items. Loot training scrap in the Wilderness.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {shop.sellOffers.map((offer) => (
              <div
                key={offer.itemId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {offer.name} <span style={{ opacity: 0.65 }}>x{offer.owned}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#9ad7ff", marginTop: 4 }}>
                    {offer.price} gold each
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleSell(offer.itemId)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: pending ? "wait" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Sell 1
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(255, 80, 80, 0.12)",
            border: "1px solid rgba(255, 120, 120, 0.35)",
            color: "#ffb4b4",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}