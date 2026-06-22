import { PLOT_PRICE, ROOF_COLORS, SIGN_MAX_LENGTH, structureLabel } from "@metricbase/shared";
import { useEffect, useState } from "react";
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
  const [signDraft, setSignDraft] = useState("");

  const plot = plots.find((entry) => entry.plotId === plotId);

  // Keep the sign input in sync with the plot's current name when it changes.
  useEffect(() => {
    setSignDraft(plot?.sign ?? "");
  }, [plot?.sign, plotId]);

  if (!open || !plotId) return null;
  const owned = plot && plot.structure !== "none";
  const isMine = owned && plot?.ownerName === playerName;
  const canAfford = playerGold >= PLOT_PRICE;

  const close = () => {
    playSfx("ui_close");
    setHousingOpen(false);
    setError(null);
  };

  const paint = (roof: string | null) => {
    if (!plotId) return;
    playSfx("ui_click");
    networkManager.sendHousingCustomize(plotId, roof);
  };

  const saveSign = () => {
    if (!plotId) return;
    playSfx("ui_click");
    const trimmed = signDraft.trim();
    networkManager.sendHousingSign(plotId, trimmed.length > 0 ? trimmed : null);
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
              ? "This plot is yours. Repaint the roof to make it your own."
              : "This plot is already owned by another resident."}
          </div>

          {isMine && (
            <>
              <div style={{ marginTop: 12 }}>
                <div className="chibi-label" style={{ marginBottom: 6 }}>
                  Sign
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="chibi-input"
                    value={signDraft}
                    maxLength={SIGN_MAX_LENGTH}
                    placeholder={`${playerName}'s ${structureLabel(plot?.structure ?? "house")}`}
                    onChange={(e) => setSignDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveSign();
                    }}
                    style={{ flex: 1 }}
                    aria-label="Building sign name"
                  />
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--mint"
                    onClick={saveSign}
                    disabled={(signDraft.trim() || null) === (plot?.sign ?? null)}
                    style={{ padding: "8px 12px", fontSize: "0.78rem" }}
                  >
                    Save
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="chibi-label" style={{ marginBottom: 6 }}>
                  Roof paint
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ROOF_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      className={`chibi-swatch${plot?.roof === color.id ? " active" : ""}`}
                      style={{ background: `#${color.roof.toString(16).padStart(6, "0")}` }}
                      title={color.name}
                      aria-label={`Paint roof ${color.name}`}
                      onClick={() => paint(color.id)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
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
