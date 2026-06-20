import {
  buildShopOpenPayload,
  getShopDefinition,
  METRICBASE_TOKEN_MINT,
  type MarketOrderView,
  type MarketStatePayload,
  type ShopOpenPayload,
} from "@metricbase/shared";
import { useState } from "react";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";
import { panelPosition } from "./chibiTheme";
import { GoldMarketChart } from "./GoldMarketChart";
import { WalletConnectBar } from "./WalletConnectBar";

type ShopTab = "gold" | "market";

function refreshShopCatalog(
  shop: ShopOpenPayload,
  gold: number,
  inventory: { items: Array<{ itemId: string; quantity: number }> },
  market?: MarketStatePayload,
): ShopOpenPayload {
  const definition = getShopDefinition(shop.shopId);
  return buildShopOpenPayload(
    definition,
    shop.merchantName,
    shop.greeting,
    gold,
    inventory.items,
    market ?? shop.market,
  );
}

function orderRowStyle(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  };
}

async function waitForMarketResult() {
  return new Promise<{
    ok: boolean;
    error?: string;
    gold?: number;
    market?: MarketStatePayload;
    payment?: MarketStatePayload extends never ? never : import("@metricbase/shared").MarketResultPayload["payment"];
  }>((resolve) => {
    const timeout = window.setTimeout(() => resolve({ ok: false, error: "Market request timed out." }), 30000);
    const unsubscribe = networkManager.onMarketResult((payload) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(payload);
    });
  });
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
  const [bidGold, setBidGold] = useState("100");
  const [bidTokens, setBidTokens] = useState("50");
  const [askGold, setAskGold] = useState("100");
  const [askTokens, setAskTokens] = useState("60");

  if (!open || !shop) return null;

  const market = shop.market;
  const tokenMint = market?.mint ?? METRICBASE_TOKEN_MINT;

  const applyMarketResult = (result: Awaited<ReturnType<typeof waitForMarketResult>>) => {
    if (result.gold !== undefined) setPlayerGold(result.gold);
    if (result.market) {
      setShop(refreshShopCatalog(shop, result.gold ?? playerGold, inventory, result.market));
    }
  };

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
    setShop(refreshShopCatalog(shop, nextGold, inventory, market));
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
    setPlayerGold(nextGold);
    setShop(refreshShopCatalog(shop, nextGold, useGameStore.getState().inventory, market));
  };

  const handlePlaceOrder = async (side: "bid" | "ask") => {
    const goldAmount = Math.floor(Number(side === "bid" ? bidGold : askGold));
    const tokenPrice = Number(side === "bid" ? bidTokens : askTokens);
    setPending(true);
    setError(null);
    const linked = await networkManager.ensureWalletLinked();
    if (!linked.ok) {
      setPending(false);
      setError(linked.error ?? "Connect your wallet to use the gold market.");
      return;
    }
    if (linked.wallet) {
      useGameStore.getState().setWalletAddress(linked.wallet);
    }
    networkManager.sendMarketPlace(side, goldAmount, tokenPrice);
    const result = await waitForMarketResult();
    setPending(false);
    if (!result.ok) {
      const message = result.error ?? "Could not place order.";
      setError(
        /connect your wallet/i.test(message)
          ? `${message} Use the Connect Wallet button above.`
          : message,
      );
      return;
    }
    applyMarketResult(result);
    setError(null);
  };

  const handleCancelOrder = async (orderId: string) => {
    setPending(true);
    setError(null);
    networkManager.sendMarketCancel(orderId);
    const result = await waitForMarketResult();
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not cancel order.");
      return;
    }
    applyMarketResult(result);
  };

  const payTokens = async (recipientWallet: string, tokenAmount: number) => {
    if (!walletAddress || !market) {
      throw new Error("Wallet not connected.");
    }
    return sendMetricbaseTokenPayment({
      payerWallet: walletAddress,
      recipientWallet,
      mint: market.mint,
      uiAmount: tokenAmount,
      decimals: market.decimals,
      rpcUrl: market.rpcUrl,
    });
  };

  const handleBuyOffer = async (order: MarketOrderView) => {
    if (!walletAddress) {
      setError("Connect your wallet to buy gold.");
      return;
    }
    setPending(true);
    setError(null);
    setStatus(`Pay ${order.tokenPrice} tokens to ${order.playerName}...`);
    try {
      const signature = await payTokens(order.wallet, order.tokenPrice);
      setStatus("Verifying payment...");
      networkManager.sendMarketFillAsk(order.id, signature);
      const result = await waitForMarketResult();
      setPending(false);
      setStatus(null);
      if (!result.ok) {
        setError(result.error ?? "Purchase failed.");
        return;
      }
      applyMarketResult(result);
    } catch (paymentError) {
      setPending(false);
      setStatus(null);
      setError(paymentError instanceof Error ? paymentError.message : "Payment failed.");
    }
  };

  const handleSellToBid = async (order: MarketOrderView) => {
    setPending(true);
    setError(null);
    networkManager.sendMarketAcceptBid(order.id);
    const result = await waitForMarketResult();
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not accept bid.");
      return;
    }
    applyMarketResult(result);
    setStatus(`${order.playerName} must pay you ${order.tokenPrice} tokens to complete the trade.`);
  };

  const handlePayBid = async (order: MarketOrderView) => {
    if (!order.payToWallet) {
      setError("Seller wallet unavailable.");
      return;
    }
    setPending(true);
    setError(null);
    setStatus(`Pay ${order.tokenPrice} tokens to seller...`);
    try {
      const signature = await payTokens(order.payToWallet, order.tokenPrice);
      setStatus("Verifying payment...");
      networkManager.sendMarketPayBid(order.id, signature);
      const result = await waitForMarketResult();
      setPending(false);
      setStatus(null);
      if (!result.ok) {
        setError(result.error ?? "Payment failed.");
        return;
      }
      applyMarketResult(result);
    } catch (paymentError) {
      setPending(false);
      setStatus(null);
      setError(paymentError instanceof Error ? paymentError.message : "Payment failed.");
    }
  };

  const renderOrderActions = (order: MarketOrderView, mode: "book" | "mine") => {
    if (mode === "mine") {
      if (order.status === "open") {
        return (
          <button type="button" disabled={pending} onClick={() => void handleCancelOrder(order.id)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 11, cursor: "pointer" }}>
            Cancel
          </button>
        );
      }
      if (order.status === "pending" && order.side === "bid" && order.wallet === walletAddress) {
        return (
          <button type="button" disabled={pending} onClick={() => void handlePayBid(order)} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #2ecc71, #27ae60)", color: "#fff", fontSize: 11, cursor: "pointer" }}>
            Pay Now
          </button>
        );
      }
      return <span style={{ fontSize: 11, opacity: 0.6 }}>{order.status}</span>;
    }

    if (order.side === "ask") {
      return (
        <button type="button" disabled={pending || !walletAddress || order.wallet === walletAddress} onClick={() => void handleBuyOffer(order)} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #2ecc71, #27ae60)", color: "#fff", fontSize: 11, cursor: "pointer" }}>
          Buy
        </button>
      );
    }

    return (
      <button type="button" disabled={pending || !walletAddress || order.wallet === walletAddress} onClick={() => void handleSellToBid(order)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 11, cursor: "pointer" }}>
        Sell
      </button>
    );
  };

  return (
    <div className="chibi-panel chibi-panel--shop" style={{ ...panelPosition("center"), pointerEvents: "auto" }}>
      <div className="chibi-close-row">
        <div>
          <div className="chibi-title chibi-title--sm chibi-sparkle-title">{shop.merchantName}'s Shop</div>
          <div className="chibi-subtitle" style={{ marginTop: 4 }}>{shop.greeting}</div>
        </div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={handleClose}>×</button>
      </div>

      <div className="chibi-tabs">
        <button type="button" className={`chibi-btn chibi-btn--tab${tab === "gold" ? " active" : ""}`} onClick={() => setTab("gold")}>🪙 Gold Shop</button>
        <button type="button" className={`chibi-btn chibi-btn--tab${tab === "market" ? " active" : ""}`} onClick={() => setTab("market")}>📈 Gold Market</button>
      </div>

      {tab === "gold" ? (
        <>
          <div className="chibi-card chibi-card--gold" style={{ marginTop: 14, fontWeight: 800 }}>Your gold: 🪙 {playerGold}</div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Buy</div>
            <div style={{ display: "grid", gap: 8 }}>
              {shop.buyOffers.map((offer) => (
                <div key={offer.itemId} className="chibi-card" style={orderRowStyle()}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>{offer.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--chibi-gold-deep)", marginTop: 4 }}>{offer.price} gold</div>
                  </div>
                  <button type="button" className="chibi-btn chibi-btn--primary" disabled={pending || playerGold < offer.price} onClick={() => void handleBuy(offer.itemId, offer.price)} style={{ padding: "8px 12px", fontSize: "0.78rem" }}>Buy</button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Sell</div>
            {shop.sellOffers.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.6 }}>No sellable items.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {shop.sellOffers.map((offer) => (
                  <div key={offer.itemId} className="chibi-card" style={orderRowStyle()}>
                    <div><div style={{ fontWeight: 800, fontSize: "0.85rem" }}>{offer.name} x{offer.owned}</div><div className="chibi-text-muted" style={{ marginTop: 4 }}>{offer.price} gold each</div></div>
                    <button type="button" className="chibi-btn chibi-btn--secondary" disabled={pending} onClick={() => void handleSell(offer.itemId)} style={{ padding: "8px 12px", fontSize: "0.78rem" }}>Sell 1</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="chibi-card chibi-card--info" style={{ marginTop: 14, fontSize: "0.85rem" }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Open peer-to-peer gold market</div>
            <div style={{ fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", opacity: 0.85 }}>{tokenMint}</div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>Tokens go directly player-to-player. Pip does not take a cut.</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <WalletConnectBar />
          </div>

          {market?.enabled && <GoldMarketChart chart={market.chart} />}

          {!market?.enabled ? (
            <div style={{ marginTop: 16, fontSize: 13, opacity: 0.7 }}>Gold market requires wallet login and database persistence.</div>
          ) : (
            <>
              <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#9ad7ff" }}>Place Bid (buy gold)</div>
                  <input value={bidGold} onChange={(e) => setBidGold(e.target.value)} placeholder="Gold amount" style={{ width: "100%", marginBottom: 6, padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff" }} />
                  <input value={bidTokens} onChange={(e) => setBidTokens(e.target.value)} placeholder="Max tokens" style={{ width: "100%", marginBottom: 8, padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff" }} />
                  <button type="button" disabled={pending || !walletAddress} onClick={() => void handlePlaceOrder("bid")} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #4f8cff, #6c5ce7)", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Post Bid</button>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#ffd27a" }}>Place Offer (sell gold)</div>
                  <input value={askGold} onChange={(e) => setAskGold(e.target.value)} placeholder="Gold amount" style={{ width: "100%", marginBottom: 6, padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff" }} />
                  <input value={askTokens} onChange={(e) => setAskTokens(e.target.value)} placeholder="Ask tokens" style={{ width: "100%", marginBottom: 8, padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff" }} />
                  <button type="button" disabled={pending || !walletAddress} onClick={() => void handlePlaceOrder("ask")} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #f39c12, #e67e22)", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Post Offer</button>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Offers (sellers)</div>
                {market.asks.length === 0 ? <div style={{ fontSize: 12, opacity: 0.6 }}>No offers yet.</div> : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {market.asks.map((order) => (
                      <div key={order.id} style={orderRowStyle()}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{order.playerName}</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{order.goldAmount} gold for {order.tokenPrice} tokens</div>
                          <div style={{ fontSize: 11, opacity: 0.6 }}>{order.tokenPerGold} tokens/gold</div>
                        </div>
                        {renderOrderActions(order, "book")}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Bids (buyers)</div>
                {market.bids.length === 0 ? <div style={{ fontSize: 12, opacity: 0.6 }}>No bids yet.</div> : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {market.bids.map((order) => (
                      <div key={order.id} style={orderRowStyle()}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{order.playerName}</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>Wants {order.goldAmount} gold for {order.tokenPrice} tokens</div>
                          <div style={{ fontSize: 11, opacity: 0.6 }}>{order.tokenPerGold} tokens/gold</div>
                        </div>
                        {renderOrderActions(order, "book")}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {market.myOrders.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Your orders</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {market.myOrders.map((order) => (
                      <div key={order.id} style={orderRowStyle()}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{order.side === "ask" ? "Offer" : "Bid"} · {order.goldAmount} gold @ {order.tokenPrice} tokens</div>
                          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{order.status}</div>
                        </div>
                        {renderOrderActions(order, "mine")}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {status && <div className="chibi-card chibi-card--info" style={{ marginTop: 14, fontSize: "0.82rem" }}>{status}</div>}
      {error && <div className="chibi-card chibi-card--danger" style={{ marginTop: 14, fontSize: "0.82rem" }}>{error}</div>}
    </div>
  );
}