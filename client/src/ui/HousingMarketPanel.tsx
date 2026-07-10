import { structureLabel, type HousingMarketListing } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager, type PipGoldInfoPayload } from "../game/network";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";
import { useGameStore } from "../store/gameStore";

// A $BASE payment is real money: if the tab reloads between paying the seller and
// the server confirming the transfer, we must not lose the signature. Stash the
// last unconfirmed house payment so the panel can finish it on next open.
const PENDING_KEY = "mb.pendingHousePurchase";
type PendingBase = { plotId: string; signature: string };
function loadPending(): PendingBase | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    return raw && typeof raw.signature === "string" ? raw : null;
  } catch {
    return null;
  }
}
function savePending(p: PendingBase | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function HousingMarketPanel() {
  const open = useGameStore((state) => state.housingMarketOpen);
  const setOpen = useGameStore((state) => state.setHousingMarketOpen);
  const playerName = useGameStore((state) => state.playerName);
  const playerGold = useGameStore((state) => state.playerGold);
  const setPlayerGold = useGameStore((state) => state.setPlayerGold);
  const walletAddress = useGameStore((state) => state.walletAddress);

  const [listings, setListings] = useState<HousingMarketListing[]>([]);
  const [pipInfo, setPipInfo] = useState<PipGoldInfoPayload | null>(null);
  const [busyPlot, setBusyPlot] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const offMarket = networkManager.onHousingMarket((payload) => setListings(payload.listings));
    const offChanged = networkManager.onHousingMarketChanged(() => networkManager.requestHousingMarket());
    const offPip = networkManager.onPipGoldInfo(setPipInfo);
    networkManager.requestHousingMarket();
    networkManager.requestPipGoldInfo();
    return () => {
      offMarket();
      offChanged();
      offPip();
    };
  }, [open]);

  const awaitResult = () =>
    new Promise<{ ok: boolean; error?: string; gold?: number; retryable?: boolean; signature?: string }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 30000);
      const unsub = networkManager.onHousingResult((payload) => {
        window.clearTimeout(timeout);
        unsub();
        resolve(payload);
      });
    });

  // Finish an interrupted $BASE purchase left over from a reload.
  useEffect(() => {
    if (!open) return;
    const pending = loadPending();
    if (!pending) return;
    (async () => {
      setBusyPlot(pending.plotId);
      setNotice("Finishing your earlier $BASE purchase…");
      networkManager.sendHousingBuyResaleBase(pending.plotId, pending.signature);
      const result = await awaitResult();
      setBusyPlot(null);
      if (result.ok || !result.retryable) savePending(null);
      setNotice(result.ok ? "Purchase completed!" : result.error ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const close = () => {
    playSfx("ui_close");
    setOpen(false);
    setNotice(null);
  };

  const buyGold = async (l: HousingMarketListing) => {
    if (l.saleGold == null) return;
    if (playerGold < l.saleGold) return setNotice(`You need ${l.saleGold.toLocaleString()} gold.`);
    playSfx("ui_click");
    setBusyPlot(l.plotId);
    setNotice(null);
    networkManager.sendHousingBuyResale(l.plotId);
    const result = await awaitResult();
    setBusyPlot(null);
    if (typeof result.gold === "number") setPlayerGold(result.gold);
    if (result.ok) {
      playSfx("craft");
      setNotice(`You bought a ${structureLabel(l.structure)} in ${l.zoneName}!`);
    } else {
      playSfx("shop_fail");
      setNotice(result.error ?? "Could not buy.");
    }
  };

  const buyBase = async (l: HousingMarketListing) => {
    if (l.saleBase == null) return;
    if (!walletAddress) return setNotice("Connect your wallet to pay with $BASE.");
    if (!l.ownerWallet) return setNotice("This seller has no wallet to receive $BASE.");
    if (!pipInfo?.mint) return setNotice("Wallet services are unavailable right now.");
    playSfx("ui_click");
    setBusyPlot(l.plotId);
    setNotice("Sending $BASE to the seller…");
    try {
      const signature = await sendMetricbaseTokenPayment({
        payerWallet: walletAddress,
        recipientWallet: l.ownerWallet,
        mint: pipInfo.mint,
        uiAmount: l.saleBase,
        decimals: pipInfo.decimals,
        rpcUrl: pipInfo.rpcUrl,
      });
      // Persist BEFORE asking the server, so a reload can't strand a real payment.
      savePending({ plotId: l.plotId, signature });
      setNotice("Confirming your payment on-chain…");
      networkManager.sendHousingBuyResaleBase(l.plotId, signature);
      const result = await awaitResult();
      setBusyPlot(null);
      if (result.ok || !result.retryable) savePending(null);
      if (result.ok) {
        playSfx("craft");
        setNotice(`You bought a ${structureLabel(l.structure)} in ${l.zoneName} with $BASE!`);
      } else {
        playSfx("shop_fail");
        setNotice(result.error ?? "Could not complete the $BASE purchase.");
      }
    } catch (err) {
      setBusyPlot(null);
      setNotice(err instanceof Error ? err.message : "Payment was cancelled.");
    }
  };

  return (
    <div className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center" style={{ pointerEvents: "auto", maxWidth: 440, width: "94vw" }}>
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🏘️ Housing Market</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="chibi-text-muted" style={{ fontSize: "0.78rem", marginTop: 6 }}>
        Buy houses & shops other players have listed. Gold is spent in-game; $BASE goes straight to the seller's wallet. Your gold: 🪙 {playerGold.toLocaleString()}
      </div>

      {notice && (
        <div className="chibi-card chibi-card--info" style={{ marginTop: 10, fontSize: "0.8rem" }}>
          {notice}
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gap: 8, maxHeight: "56vh", overflowY: "auto" }}>
        {listings.length === 0 && (
          <div className="chibi-card" style={{ padding: "14px", textAlign: "center", fontSize: "0.82rem" }}>
            No properties are for sale right now.
          </div>
        )}
        {listings.map((l) => {
          const mine = l.ownerName === playerName;
          const busy = busyPlot === l.plotId;
          return (
            <div key={l.plotId} className="chibi-card" style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <div style={{ fontWeight: 800 }}>
                  {l.structure === "shop" ? "🏪" : "🏠"} {l.sign || `${l.ownerName}'s ${structureLabel(l.structure)}`}
                </div>
                <div className="chibi-text-muted" style={{ fontSize: "0.72rem" }}>{l.zoneName}</div>
              </div>
              <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>
                Seller: {l.ownerName}
                {mine && " (you)"}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {l.saleGold != null && (
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--primary"
                    disabled={mine || busy || playerGold < l.saleGold}
                    onClick={() => void buyGold(l)}
                    style={{ flex: 1, minWidth: 130, padding: "8px 10px", fontSize: "0.8rem" }}
                  >
                    🪙 Buy · {l.saleGold.toLocaleString()}
                  </button>
                )}
                {l.saleBase != null && (
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--gold"
                    disabled={mine || busy || !walletAddress}
                    onClick={() => void buyBase(l)}
                    style={{ flex: 1, minWidth: 130, padding: "8px 10px", fontSize: "0.8rem" }}
                  >
                    💠 Buy · {l.saleBase.toLocaleString()} $BASE
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
