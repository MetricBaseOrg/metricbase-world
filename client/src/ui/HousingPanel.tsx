import { PLOT_PRICE, structureLabel } from "@metricbase/shared";
import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

export function HousingPanel() {
  const open = useGameStore((state) => state.housingOpen);
  const plotId = useGameStore((state) => state.housingPlotId);
  const plots = useGameStore((state) => state.housingPlots);
  const playerGold = useGameStore((state) => state.playerGold);
  const playerName = useGameStore((state) => state.playerName);
  const setHousingOpen = useGameStore((state) => state.setHousingOpen);
  const setPlayerGold = useGameStore((state) => state.setPlayerGold);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open || !plotId) return null;

  const plot = plots.find((entry) => entry.plotId === plotId);
  const owned = plot && plot.structure !== "none";
  const isMine = owned && plot?.ownerName === playerName;
  const canAfford = playerGold >= PLOT_PRICE;

  const close = () => {
    playSfx("ui_close");
    setHousingOpen(false);
    setError(null);
  };

  const buy = async (structure: "house" | "shop") => {
    setPending(true);
    setError(null);
    networkManager.sendHousingBuy(plotId, structure);
    const result = await new Promise<{ ok: boolean; error?: string; gold?: number }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 8000);
      const unsubscribe = networkManager.onHousingResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });
    setPending(false);
    if (typeof result.gold === "number") setPlayerGold(result.gold);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not buy the plot.");
      return;
    }
    playSfx("craft");
    setHousingOpen(false);
  };

  return (
    <div className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center" style={{ pointerEvents: "auto", maxWidth: 360 }}>
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🏠 Land Plot</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ×
        </button>
      </div>

      {owned ? (
        <div className="chibi-card" style={{ marginTop: 12, padding: "12px 14px" }}>
          <div style={{ fontWeight: 800 }}>
            {isMine ? "Your " : `${plot?.ownerName}'s `}
            {structureLabel(plot?.structure ?? "house")}
          </div>
          <div className="chibi-text-muted" style={{ marginTop: 6, fontSize: "0.82rem" }}>
            {isMine
              ? "This plot is yours. More building options are coming soon."
              : "This plot is already owned by another resident."}
          </div>
        </div>
      ) : (
        <>
          <div className="chibi-card chibi-card--info" style={{ marginTop: 12, padding: "12px 14px" }}>
            <div style={{ fontWeight: 800 }}>An empty plot of land</div>
            <div className="chibi-text-muted" style={{ marginTop: 6, fontSize: "0.82rem" }}>
              Buy it to build your own place. Cost:{" "}
              <span style={{ color: "var(--chibi-gold-deep)", fontWeight: 800 }}>🪙 {PLOT_PRICE}</span>
            </div>
            <div className="chibi-text-muted" style={{ marginTop: 4, fontSize: "0.78rem" }}>
              Your gold: 🪙 {playerGold}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 12, gridTemplateColumns: "1fr 1fr" }}>
            <button
              type="button"
              className="chibi-btn chibi-btn--primary"
              disabled={pending || !canAfford}
              onClick={() => void buy("house")}
              style={{ padding: "10px 12px" }}
            >
              🏠 Build House
            </button>
            <button
              type="button"
              className="chibi-btn chibi-btn--gold"
              disabled={pending || !canAfford}
              onClick={() => void buy("shop")}
              style={{ padding: "10px 12px" }}
            >
              🏪 Build Shop
            </button>
          </div>
          {!canAfford && (
            <div className="chibi-text-muted" style={{ marginTop: 8, fontSize: "0.78rem", textAlign: "center" }}>
              You need {PLOT_PRICE - playerGold} more gold.
            </div>
          )}
        </>
      )}

      {error && (
        <div className="chibi-card chibi-card--danger" style={{ marginTop: 12, fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
