import {
  buildShopOpenPayload,
  getCurrency,
  getShopDefinition,
  METRICBASE_TOKEN_MINT,
  normalizeMarketState,
  PAYMENT_CURRENCIES,
  type MarketOrderView,
  type MarketResultPayload,
  type MarketStatePayload,
  type ShopOpenPayload,
  type ShopResultPayload,
} from "@metricbase/shared";
import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { sendSolPayment } from "../wallet/solPayment";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";

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
  // Preserve the current dynamic sell prices the server last sent, so a buy
  // doesn't visually reset them to the base prices.
  const sellPriceOverrides: Record<string, number> = {};
  for (const offer of shop.sellOffers) {
    sellPriceOverrides[offer.itemId] = offer.price;
  }
  return buildShopOpenPayload(
    definition,
    shop.merchantName,
    shop.greeting,
    gold,
    inventory.items,
    market ? normalizeMarketState(market) : shop.market,
    sellPriceOverrides,
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
  return new Promise<MarketResultPayload>((resolve) => {
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
  const [currency, setCurrency] = useState("base");

  if (!open || !shop) return null;

  const market = shop.market ? normalizeMarketState(shop.market) : undefined;
  const tokenMint = market?.mint ?? METRICBASE_TOKEN_MINT;

  const applyMarketResult = (result: Awaited<ReturnType<typeof waitForMarketResult>>) => {
    if (result.gold !== undefined) setPlayerGold(result.gold);
    if (result.market) {
      setShop(refreshShopCatalog(shop, result.gold ?? playerGold, inventory, result.market));
    }
    if (result.fee && result.fee > 0) {
      setStatus(`Trade complete — ${result.fee} gold market fee.`);
    }
  };

  const handleClose = () => {
    playSfx("ui_close");
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
      playSfx("shop_fail");
      setError(result.error ?? "Purchase failed.");
      return;
    }
    playSfx("shop_buy");
    const nextGold = result.gold ?? playerGold;
    setPlayerGold(nextGold);
    setShop(refreshShopCatalog(shop, nextGold, inventory, market));
  };

  const handleSell = async (itemId: string) => {
    setPending(true);
    setError(null);
    networkManager.sendShopSell(shop.shopId, itemId, 1);
    const result = await new Promise<ShopResultPayload>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Shop request timed out." }), 8000);
      const unsubscribe = networkManager.onShopResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });
    setPending(false);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Sale failed.");
      return;
    }
    playSfx("shop_sell");
    playSfx("coin");
    const nextGold = result.gold ?? playerGold;
    setPlayerGold(nextGold);
    // Prefer the server's dynamic catalog so the price drop shows immediately.
    if (result.sellOffers) {
      setShop({
        ...shop,
        gold: nextGold,
        sellOffers: result.sellOffers,
        buyOffers: result.buyOffers ?? shop.buyOffers,
      });
    } else {
      setShop(refreshShopCatalog(shop, nextGold, useGameStore.getState().inventory, market));
    }
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
    networkManager.sendMarketPlace(side, goldAmount, tokenPrice, currency);
    const result = await waitForMarketResult();
    setPending(false);
    if (!result.ok) {
      playSfx("market_fail");
      const message = result.error ?? "Could not place order.";
      setError(
        /connect your wallet/i.test(message)
          ? `${message} Use the Connect Wallet button above.`
          : message,
      );
      return;
    }
    playSfx("market_success");
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
      playSfx("market_fail");
      setError(result.error ?? "Could not cancel order.");
      return;
    }
    playSfx("ui_click");
    applyMarketResult(result);
  };

  const payCurrency = async (recipientWallet: string, amount: number, currencyId: string) => {
    if (!walletAddress || !market) {
      throw new Error("Wallet not connected.");
    }
    const cur = getCurrency(currencyId);
    if (cur.native) {
      return sendSolPayment({
        payerWallet: walletAddress,
        recipientWallet,
        uiAmount: amount,
        rpcUrl: market.rpcUrl,
      });
    }
    return sendMetricbaseTokenPayment({
      payerWallet: walletAddress,
      recipientWallet,
      mint: cur.id === "base" ? market.mint : cur.mint ?? market.mint,
      uiAmount: amount,
      decimals: cur.decimals,
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
    setStatus(`Pay ${order.tokenPrice} ${getCurrency(order.currency).label} to ${order.playerName}...`);
    try {
      const signature = await payCurrency(order.wallet, order.tokenPrice, order.currency);
      setStatus("Verifying payment...");
      networkManager.sendMarketFillAsk(order.id, signature);
      const result = await waitForMarketResult();
      setPending(false);
      setStatus(null);
      if (!result.ok) {
        playSfx("market_fail");
        setError(result.error ?? "Purchase failed.");
        return;
      }
      playSfx("market_success");
      applyMarketResult(result);
    } catch (paymentError) {
      setPending(false);
      setStatus(null);
      playSfx("market_fail");
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
      playSfx("market_fail");
      setError(result.error ?? "Could not accept bid.");
      return;
    }
    playSfx("market_success");
    applyMarketResult(result);
    setStatus(`${order.playerName} must pay you ${order.tokenPrice} ${getCurrency(order.currency).label} to complete the trade.`);
  };

  const handlePayBid = async (order: MarketOrderView) => {
    if (!order.payToWallet) {
      setError("Seller wallet unavailable.");
      return;
    }
    setPending(true);
    setError(null);
    setStatus(`Pay ${order.tokenPrice} ${getCurrency(order.currency).label} to seller...`);
    try {
      const signature = await payCurrency(order.payToWallet, order.tokenPrice, order.currency);
      setStatus("Verifying payment...");
      networkManager.sendMarketPayBid(order.id, signature);
      const result = await waitForMarketResult();
      setPending(false);
      setStatus(null);
      if (!result.ok) {
        playSfx("market_fail");
        setError(result.error ?? "Payment failed.");
        return;
      }
      playSfx("market_success");
      applyMarketResult(result);
    } catch (paymentError) {
      setPending(false);
      setStatus(null);
      playSfx("market_fail");
      setError(paymentError instanceof Error ? paymentError.message : "Payment failed.");
    }
  };

  const compactBtnStyle: React.CSSProperties = { padding: "6px 10px", fontSize: "0.72rem" };

  const renderOrderActions = (order: MarketOrderView, mode: "book" | "mine") => {
    if (mode === "mine") {
      if (order.status === "open") {
        return (
          <button type="button" className="chibi-btn chibi-btn--secondary" disabled={pending} onClick={() => void handleCancelOrder(order.id)} style={compactBtnStyle}>
            Cancel
          </button>
        );
      }
      if (order.status === "pending" && order.side === "bid" && order.wallet === walletAddress) {
        return (
          <button type="button" className="chibi-btn chibi-btn--mint" disabled={pending} onClick={() => void handlePayBid(order)} style={compactBtnStyle}>
            Pay Now
          </button>
        );
      }
      return <span className="chibi-text-muted">{order.status}</span>;
    }

    if (order.side === "ask") {
      return (
        <button type="button" className="chibi-btn chibi-btn--mint" disabled={pending || !walletAddress || order.wallet === walletAddress} onClick={() => void handleBuyOffer(order)} style={compactBtnStyle}>
          Buy
        </button>
      );
    }

    return (
      <button type="button" className="chibi-btn chibi-btn--secondary" disabled={pending || !walletAddress || order.wallet === walletAddress} onClick={() => void handleSellToBid(order)} style={compactBtnStyle}>
        Sell
      </button>
    );
  };

  return (
    <div className="chibi-panel chibi-panel--shop chibi-anchor chibi-anchor--center" style={{ pointerEvents: "auto" }}>
      <div className="chibi-close-row">
        <div>
          <div className="chibi-title chibi-title--sm chibi-sparkle-title">{shop.merchantName}'s Shop</div>
          <div className="chibi-subtitle" style={{ marginTop: 4 }}>{shop.greeting}</div>
        </div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={handleClose}>×</button>
      </div>

      <div className="chibi-tabs">
        <button type="button" className={`chibi-btn chibi-btn--tab${tab === "gold" ? " active" : ""}`} onClick={() => { playSfx("ui_click"); setTab("gold"); }}>🪙 Gold Shop</button>
        <button type="button" className={`chibi-btn chibi-btn--tab${tab === "market" ? " active" : ""}`} onClick={() => { playSfx("ui_click"); setTab("market"); }}>📈 Gold Market</button>
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
              <div style={{ marginTop: 16 }}>
                <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0, marginBottom: 6 }}>
                  Pay / receive in
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PAYMENT_CURRENCIES.map((cur) => (
                    <button
                      key={cur.id}
                      type="button"
                      className={`chibi-btn ${currency === cur.id ? "chibi-btn--primary" : "chibi-btn--secondary"}`}
                      onClick={() => { playSfx("ui_click"); setCurrency(cur.id); }}
                      style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                    >
                      {cur.label}
                    </button>
                  ))}
                </div>
                <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 6 }}>
                  New orders you post are priced in {getCurrency(currency).label}. Tokens/SOL settle directly between wallets.
                </div>
              </div>

              <div className="chibi-grid-2" style={{ marginTop: 16 }}>
                <div className="chibi-card chibi-card--info">
                  <div className="chibi-label" style={{ color: "var(--chibi-sky-deep)", textTransform: "none", letterSpacing: 0 }}>Place Bid (buy gold)</div>
                  <input className="chibi-input" value={bidGold} onChange={(e) => setBidGold(e.target.value)} placeholder="Gold amount" style={{ marginBottom: 6, fontSize: "0.82rem", padding: "8px 10px" }} />
                  <input className="chibi-input" value={bidTokens} onChange={(e) => setBidTokens(e.target.value)} placeholder={`Max ${getCurrency(currency).label}`} style={{ marginBottom: 10, fontSize: "0.82rem", padding: "8px 10px" }} />
                  <button type="button" className="chibi-btn chibi-btn--primary" disabled={pending || !walletAddress} onClick={() => void handlePlaceOrder("bid")} style={{ width: "100%", padding: "8px 10px", fontSize: "0.8rem" }}>Post Bid</button>
                </div>
                <div className="chibi-card chibi-card--gold">
                  <div className="chibi-label" style={{ color: "var(--chibi-gold-deep)", textTransform: "none", letterSpacing: 0 }}>Place Offer (sell gold)</div>
                  <input className="chibi-input" value={askGold} onChange={(e) => setAskGold(e.target.value)} placeholder="Gold amount" style={{ marginBottom: 6, fontSize: "0.82rem", padding: "8px 10px" }} />
                  <input className="chibi-input" value={askTokens} onChange={(e) => setAskTokens(e.target.value)} placeholder={`Ask ${getCurrency(currency).label}`} style={{ marginBottom: 10, fontSize: "0.82rem", padding: "8px 10px" }} />
                  <button type="button" className="chibi-btn chibi-btn--gold" disabled={pending || !walletAddress} onClick={() => void handlePlaceOrder("ask")} style={{ width: "100%", padding: "8px 10px", fontSize: "0.8rem" }}>Post Offer</button>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0, fontSize: "0.9rem" }}>Offers (sellers)</div>
                {market.asks.length === 0 ? <div className="chibi-text-muted">No offers yet.</div> : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {market.asks.map((order) => (
                      <div key={order.id} className="chibi-card" style={orderRowStyle()}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{order.playerName}</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{order.goldAmount} gold for {order.tokenPrice} {getCurrency(order.currency).label}</div>
                          <div className="chibi-text-muted">{order.tokenPerGold} {getCurrency(order.currency).label}/gold</div>
                        </div>
                        {renderOrderActions(order, "book")}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0, fontSize: "0.9rem" }}>Bids (buyers)</div>
                {market.bids.length === 0 ? <div className="chibi-text-muted">No bids yet.</div> : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {market.bids.map((order) => (
                      <div key={order.id} className="chibi-card" style={orderRowStyle()}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{order.playerName}</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>Wants {order.goldAmount} gold for {order.tokenPrice} {getCurrency(order.currency).label}</div>
                          <div className="chibi-text-muted">{order.tokenPerGold} {getCurrency(order.currency).label}/gold</div>
                        </div>
                        {renderOrderActions(order, "book")}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {market.myOrders.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0, fontSize: "0.9rem" }}>Your orders</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {market.myOrders.map((order) => (
                      <div key={order.id} className="chibi-card" style={orderRowStyle()}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{order.side === "ask" ? "Offer" : "Bid"} · {order.goldAmount} gold @ {order.tokenPrice} {getCurrency(order.currency).label}</div>
                          <div className="chibi-text-muted" style={{ marginTop: 4 }}>{order.status}</div>
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