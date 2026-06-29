import { getCurrency } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager, type VipLodgeLockedPayload } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { burnMetricbaseToken } from "../wallet/tokenBurn";

/**
 * Shown when a non-VIP tries to enter the Community Lodge. Offers two ways in:
 * hold the minimum $BASE, or buy a timed VIP pass (gold + a $BASE burn).
 */
export function VipLodgeModal() {
  const walletAddress = useGameStore((state) => state.walletAddress);
  const playerGold = useGameStore((state) => state.playerGold);
  const [gate, setGate] = useState<VipLodgeLockedPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const offLocked = networkManager.onVipLodgeLocked((payload) => {
      playSfx("ui_open");
      setError(null);
      setDone(false);
      setGate(payload);
    });
    const offResult = networkManager.onVipPassResult((payload) => {
      setBusy(false);
      if (payload.ok) {
        playSfx("quest_complete");
        setDone(true);
      } else {
        playSfx("shop_fail");
        setError(payload.error ?? "Could not buy the VIP pass.");
      }
    });
    return () => {
      offLocked();
      offResult();
    };
  }, []);

  if (!gate) return null;

  const close = () => {
    playSfx("ui_close");
    setGate(null);
  };

  const enoughGold = playerGold >= gate.passGold;

  const handleBuy = async () => {
    if (!walletAddress) {
      setError("Connect your wallet first to burn $BASE.");
      return;
    }
    if (!enoughGold) {
      setError(`You need ${gate.passGold.toLocaleString()} gold for the pass.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signature = await burnMetricbaseToken({
        ownerWallet: walletAddress,
        mint: gate.mint,
        uiAmount: gate.passBurn,
        decimals: getCurrency("base").decimals,
        rpcUrl: gate.rpcUrl,
      });
      networkManager.sendBuyVipPass(signature);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Burn failed.");
    }
  };

  const handleBuyGold = () => {
    if (!gate) return;
    if (playerGold < gate.passGoldOnly) {
      setError(`You need ${gate.passGoldOnly.toLocaleString()} gold for the gold pass.`);
      return;
    }
    setBusy(true);
    setError(null);
    networkManager.sendBuyVipPassGold();
  };

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="VIP Lodge">
      <div className="chibi-panel chibi-panel--floating" style={{ maxWidth: 380, textAlign: "center" }}>
        <div className="chibi-title chibi-title--sm" style={{ color: "var(--chibi-gold-deep)" }}>
          ✨ {gate.displayName} — VIP only
        </div>
        {done ? (
          <>
            <p style={{ margin: "12px 0", fontSize: "0.9rem" }}>
              🎟️ VIP pass active for {gate.passDays} days — head back through the door to enter!
            </p>
            <button type="button" className="chibi-btn chibi-btn--gold" onClick={close} style={{ width: "100%" }}>
              Got it
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: "10px 0", fontSize: "0.86rem" }}>
              Enter by holding <strong>{gate.minHold.toLocaleString()} $BASE</strong>, or buy a{" "}
              <strong>{gate.passDays}-day VIP pass</strong>:
            </p>
            {error && (
              <div className="chibi-card chibi-card--danger" style={{ fontSize: "0.78rem", marginBottom: 10 }}>
                {error}
              </div>
            )}

            {/* Tier 1: cheap gold + a $BASE burn */}
            <div className="chibi-card" style={{ fontSize: "0.82rem", marginBottom: 8 }}>
              <div style={{ marginBottom: 6 }}>
                🔥 <strong>Burn pass</strong> — {gate.passGold.toLocaleString()} gold + burn{" "}
                {gate.passBurn.toLocaleString()} $BASE
              </div>
              <button
                type="button"
                className="chibi-btn chibi-btn--gold"
                onClick={() => void handleBuy()}
                disabled={busy || !enoughGold}
                style={{ width: "100%" }}
              >
                {busy ? "Processing…" : `Burn pass (${gate.passGold.toLocaleString()}g + burn)`}
              </button>
            </div>

            {/* Tier 2: gold only, no burn */}
            <div className="chibi-card" style={{ fontSize: "0.82rem", marginBottom: 8 }}>
              <div style={{ marginBottom: 6 }}>
                💰 <strong>Gold pass</strong> — {gate.passGoldOnly.toLocaleString()} gold, no burn
              </div>
              <button
                type="button"
                className="chibi-btn chibi-btn--mint"
                onClick={() => void handleBuyGold()}
                disabled={busy || playerGold < gate.passGoldOnly}
                style={{ width: "100%" }}
              >
                {busy ? "Processing…" : `Gold pass (${gate.passGoldOnly.toLocaleString()}g)`}
              </button>
            </div>

            <div style={{ fontSize: "0.74rem", opacity: 0.8, marginBottom: 8, textAlign: "center" }}>
              You have {playerGold.toLocaleString()} gold.
            </div>
            <button
              type="button"
              className="chibi-btn chibi-btn--secondary"
              onClick={close}
              disabled={busy}
              style={{ width: "100%" }}
            >
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
