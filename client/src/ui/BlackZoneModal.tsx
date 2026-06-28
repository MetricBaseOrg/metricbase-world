import { getCurrency } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { burnMetricbaseToken } from "../wallet/tokenBurn";

/**
 * Prompts the player to burn $BASE to unlock the Black Zone. Opens when the
 * server reports the gate is locked; on a verified burn the server grants a
 * one-hour access pass and the player can step through the Black Gate.
 */
export function BlackZoneModal() {
  const walletAddress = useGameStore((state) => state.walletAddress);
  const [gate, setGate] = useState<{ mint: string; amount: number; rpcUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const offLocked = networkManager.onBlackZoneLocked((payload) => {
      playSfx("ui_open");
      setError(null);
      setDone(false);
      setGate(payload);
    });
    const offResult = networkManager.onBlackPassResult((payload) => {
      setBusy(false);
      if (payload.ok) {
        playSfx("quest_complete");
        setDone(true);
      } else {
        playSfx("shop_fail");
        setError(payload.error ?? "Burn could not be verified.");
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

  const handleBurn = async () => {
    if (!walletAddress) {
      setError("Connect your wallet first to burn $BASE.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signature = await burnMetricbaseToken({
        ownerWallet: walletAddress,
        mint: gate.mint,
        uiAmount: gate.amount,
        decimals: getCurrency("base").decimals,
        rpcUrl: gate.rpcUrl,
      });
      networkManager.sendBurnForBlackPass(signature);
      // Server replies via onBlackPassResult; keep busy until then.
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Burn failed.");
    }
  };

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="Black Zone gate">
      <div className="chibi-panel chibi-panel--floating" style={{ maxWidth: 380, textAlign: "center" }}>
        <div className="chibi-title chibi-title--sm" style={{ color: "#b15cff" }}>
          ⚫ The Black Gate
        </div>
        {done ? (
          <>
            <p style={{ margin: "12px 0", fontSize: "0.9rem" }}>
              🔥 Burn verified — the Obsidian Reach is yours forever. Step through the Black Gate!
            </p>
            <button type="button" className="chibi-btn chibi-btn--gold" onClick={close} style={{ width: "100%" }}>
              Enter
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: "12px 0", fontSize: "0.88rem" }}>
              The Obsidian Reach is full-loot territory — fall here and you lose everything you carry.
              Passage demands a one-time sacrifice: <strong>burn {gate.amount.toLocaleString()} $BASE</strong> to
              unlock the Reach <strong>forever</strong>.
            </p>
            {error && (
              <div className="chibi-card chibi-card--danger" style={{ fontSize: "0.78rem", marginBottom: 10 }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="chibi-btn chibi-btn--secondary"
                onClick={close}
                disabled={busy}
                style={{ flex: 1 }}
              >
                Not yet
              </button>
              <button
                type="button"
                className="chibi-btn chibi-btn--gold"
                onClick={() => void handleBurn()}
                disabled={busy}
                style={{ flex: 1 }}
              >
                {busy ? "Burning…" : `Burn ${gate.amount.toLocaleString()} $BASE`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
