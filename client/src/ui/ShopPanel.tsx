import {
  buildShopOpenPayload,
  getShopDefinition,
  METRICBASE_TOKEN_MINT,
  type ShopOpenPayload,
} from "@metricbase/shared";
import { useState } from "react";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";

type ShopTab = "gold" | "token";

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
    shop.tokenShop,
  );
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 8,
    border: active ? "1px solid rgba(79,140,255,0.8)" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(79,140,255,0.2)" : "rgba(255,255,255,0.04)",
    color: "#fff",
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: "pointer",
  };
}

export function ShopPanel() {
  const shop = useGameStore((state) => state.shop);
  const open = useGameStore((state) => state.shopOpen);
  const playerGold = useGameStore((state) => state.playerGold);
  const walletAddress = useGameStore((state) => state.walletAddress);
  const inventory = useGameStore((state) => state.inventory);
  const setShop = useGameStore((state) => state.setShop);
  const setShopOpen = useGameStore((state) => state.setShopOpen);
  const setPlayerGold = useGameStore((state) => state.setPlayerGold);
  const [tab, setTab] = useState<ShopTab>("gold");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!open || !shop) return null;

  const tokenShop = shop.tokenShop;
  const tokenMint = tokenShop?.mint ?? METRICBASE_TOKEN_MINT;

  const handleClose = () => {
    setShopOpen(false);
    setShop(null);
    setError(null);
    setStatus(null);
    setTab("gold");
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

  const handleTokenBuy = async (productId: string, tokenPrice: number) => {
    if (!tokenShop?.enabled || !tokenShop.treasuryWallet) {
      setError("Token shop is not available yet.");
      return;
    }
    if (!walletAddress) {
      setError("Your wallet must be connected to pay with tokens.");
      return;
    }
    if (tokenShop.walletBalance !== null && tokenShop.walletBalance < tokenPrice) {
      setError(`Need at least ${tokenPrice} tokens in your wallet.`);
      return;
    }

    setPending(true);
    setError(null);
    setStatus("Approve the token transfer in your wallet...");

    try {
      const signature = await sendMetricbaseTokenPayment({
        payerWallet: walletAddress,
        treasuryWallet: tokenShop.treasuryWallet,
        mint: tokenShop.mint,
        uiAmount: tokenPrice,
        decimals: tokenShop.decimals,
        rpcUrl: tokenShop.rpcUrl,
      });

      setStatus("Verifying payment on-chain...");
      networkManager.sendTokenShopBuy(productId, signature);

      const result = await new Promise<{
        ok: boolean;
        error?: string;
        gold?: number;
        tokenBalance?: number | null;
      }>((resolve) => {
        const timeout = window.setTimeout(
          () => resolve({ ok: false, error: "Token purchase timed out." }),
          30000,
        );
        const unsubscribe = networkManager.onTokenShopResult((payload) => {
          window.clearTimeout(timeout);
          unsubscribe();
          resolve(payload);
        });
      });

      setPending(false);
      setStatus(null);

      if (!result.ok) {
        setError(result.error ?? "Token purchase failed.");
        return;
      }

      const nextGold = result.gold ?? playerGold;
      const nextInventory = useGameStore.getState().inventory;
      setPlayerGold(nextGold);
      setShop({
        ...refreshShopCatalog(shop, nextGold, nextInventory),
        tokenShop: tokenShop
          ? {
              ...tokenShop,
              walletBalance: result.tokenBalance ?? tokenShop.walletBalance,
            }
          : undefined,
      });
      setError(null);
    } catch (paymentError) {
      setPending(false);
      setStatus(null);
      const message =
        paymentError instanceof Error ? paymentError.message : "Token payment failed.";
      setError(message);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(460px, calc(100% - 32px))",
        maxHeight: "min(80vh, 720px)",
        overflowY: "auto",
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

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" style={tabButtonStyle(tab === "gold")} onClick={() => setTab("gold")}>
          Gold Shop
        </button>
        <button type="button" style={tabButtonStyle(tab === "token")} onClick={() => setTab("token")}>
          Token Shop
        </button>
      </div>

      {tab === "gold" ? (
        <>
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
        </>
      ) : (
        <>
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(79, 140, 255, 0.12)",
              border: "1px solid rgba(79, 140, 255, 0.25)",
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Pay with MetricBase token</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", opacity: 0.85 }}>
              {tokenMint}
            </div>
            {tokenShop?.walletBalance !== null && tokenShop?.walletBalance !== undefined && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                Wallet balance: <span style={{ color: "#9ad7ff" }}>{tokenShop.walletBalance}</span>
              </div>
            )}
          </div>

          {!tokenShop?.enabled ? (
            <div style={{ marginTop: 16, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
              Token payments are not live yet. The server needs a treasury wallet configured.
            </div>
          ) : (
            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
              {tokenShop.products.map((product) => (
                <div
                  key={product.id}
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
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{product.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{product.description}</div>
                    <div style={{ fontSize: 12, color: "#9ad7ff", marginTop: 4 }}>
                      Grants: {product.grantsLabel}
                    </div>
                    <div style={{ fontSize: 12, color: "#b8f0c8", marginTop: 4 }}>
                      {product.tokenPrice} tokens
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      pending ||
                      !walletAddress ||
                      (tokenShop.walletBalance !== null &&
                        tokenShop.walletBalance < product.tokenPrice)
                    }
                    onClick={() => void handleTokenBuy(product.id, product.tokenPrice)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background:
                        pending ||
                        !walletAddress ||
                        (tokenShop.walletBalance !== null &&
                          tokenShop.walletBalance < product.tokenPrice)
                          ? "rgba(79, 140, 255, 0.35)"
                          : "linear-gradient(135deg, #2ecc71, #27ae60)",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: pending ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Pay Tokens
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {status && (
        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75, color: "#9ad7ff" }}>{status}</div>
      )}

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