import {
  getItemQuantity,
  LIGHT_MAX_ENERGY,
  LIGHT_OIL_ITEM,
  PLOT_DECORATIONS,
  PLOT_PRICE,
  ROOF_COLORS,
  SIGN_MAX_LENGTH,
  structureLabel,
} from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

export function HousingPanel() {
  const open = useGameStore((state) => state.housingOpen);
  const plotId = useGameStore((state) => state.housingPlotId);
  const plots = useGameStore((state) => state.housingPlots);
  const playerGold = useGameStore((state) => state.playerGold);
  const inventory = useGameStore((state) => state.inventory);
  const playerName = useGameStore((state) => state.playerName);
  const setHousingOpen = useGameStore((state) => state.setHousingOpen);
  const setPlayerGold = useGameStore((state) => state.setPlayerGold);
  const setHousingMarketOpen = useGameStore((state) => state.setHousingMarketOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [signDraft, setSignDraft] = useState("");
  const [goldPrice, setGoldPrice] = useState("");
  const [basePrice, setBasePrice] = useState("");

  const plot = plots.find((entry) => entry.plotId === plotId);

  // Keep the sign input in sync with the plot's current name when it changes.
  useEffect(() => {
    setSignDraft(plot?.sign ?? "");
  }, [plot?.sign, plotId]);

  // Prefill the sale inputs from the plot's current listing.
  useEffect(() => {
    setGoldPrice(plot?.saleGold != null ? String(plot.saleGold) : "");
    setBasePrice(plot?.saleBase != null ? String(plot.saleBase) : "");
  }, [plot?.saleGold, plot?.saleBase, plotId]);

  const awaitHousingResult = () =>
    new Promise<{ ok: boolean; error?: string; message?: string }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 8000);
      const unsubscribe = networkManager.onHousingResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });

  const listForSale = async () => {
    if (!plotId) return;
    const gold = Number(goldPrice) > 0 ? Math.floor(Number(goldPrice)) : null;
    const base = Number(basePrice) > 0 ? Number(basePrice) : null;
    if (gold === null && base === null) {
      setError("Set a gold and/or $BASE price first.");
      return;
    }
    playSfx("ui_click");
    setError(null);
    networkManager.sendHousingListSale(plotId, gold, base);
    const result = await awaitHousingResult();
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not list the property.");
    } else {
      playSfx("craft");
    }
  };

  const withdrawListing = async () => {
    if (!plotId) return;
    playSfx("ui_click");
    setError(null);
    networkManager.sendHousingUnlistSale(plotId);
    await awaitHousingResult();
  };

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

  const decorate = (slot: number, propId: string | null) => {
    if (!plotId) return;
    playSfx("ui_click");
    networkManager.sendHousingDecorate(plotId, slot, propId);
  };

  const toggleLight = () => {
    if (!plotId) return;
    playSfx("ui_click");
    networkManager.sendHousingLight(plotId, !plot?.lightOn);
  };

  const refuelLight = () => {
    if (!plotId) return;
    playSfx("ui_click");
    networkManager.sendHousingRefuel(plotId);
  };

  const rest = async () => {
    if (!plotId) return;
    playSfx("ui_click");
    setError(null);
    networkManager.sendHousingRest(plotId);
    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 6000);
      const unsubscribe = networkManager.onHousingResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });
    if (result.ok) {
      playSfx("level_up");
      setHousingOpen(false);
    } else {
      playSfx("shop_fail");
      setError(result.error ?? "Could not rest.");
    }
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
    <div className="chibi-panel chibi-panel--floating chibi-panel--modal chibi-anchor chibi-anchor--center" style={{ pointerEvents: "auto", maxWidth: 360, width: "92vw" }}>
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🏠 Land Plot</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ×
        </button>
      </div>

      <div className="chibi-modal-body">
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
              {plot?.structure === "house" && (
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--primary"
                    onClick={() => void rest()}
                    style={{ width: "100%", padding: "10px 12px" }}
                  >
                    😴 Rest here (restore energy + HP)
                  </button>
                  <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
                    A good rest at home refills your energy and health. Available every 8 minutes.
                  </div>
                </div>
              )}

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

              <div style={{ marginTop: 12 }}>
                <div className="chibi-label" style={{ marginBottom: 6 }}>
                  Corner decorations
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {["NW", "NE", "SW", "SE"].map((corner, slot) => (
                    <div key={corner} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 28, fontSize: "0.74rem", fontWeight: 700 }}>{corner}</span>
                      <select
                        className="chibi-input"
                        style={{ flex: 1, padding: "6px 8px" }}
                        value={plot?.decor?.[slot] ?? ""}
                        onChange={(e) => decorate(slot, e.target.value || null)}
                        aria-label={`Decoration for ${corner} corner`}
                      >
                        <option value="">— Empty —</option>
                        {PLOT_DECORATIONS.map((prop) => (
                          <option key={prop.id} value={prop.id}>
                            {prop.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="chibi-label" style={{ marginBottom: 6 }}>
                  Building light
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className={`chibi-btn ${plot?.lightOn ? "chibi-btn--gold" : "chibi-btn--secondary"}`}
                    onClick={toggleLight}
                    style={{ padding: "8px 12px", fontSize: "0.8rem" }}
                  >
                    {plot?.lightOn ? "💡 On" : "🌑 Off"}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 10, borderRadius: 6, background: "rgba(0,0,0,0.18)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.round(((plot?.energy ?? 0) / LIGHT_MAX_ENERGY) * 100)}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #f5a623, #ffe08a)",
                        }}
                      />
                    </div>
                    <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 2 }}>
                      Energy {plot?.energy ?? 0}/{LIGHT_MAX_ENERGY}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--mint"
                    onClick={refuelLight}
                    disabled={getItemQuantity(inventory.items, LIGHT_OIL_ITEM) <= 0 || (plot?.energy ?? 0) >= LIGHT_MAX_ENERGY}
                    title="Refuel with 1 Lamp Oil"
                    style={{ padding: "8px 10px", fontSize: "0.76rem" }}
                  >
                    ⛽ Oil ({getItemQuantity(inventory.items, LIGHT_OIL_ITEM)})
                  </button>
                </div>
                <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
                  A lit building glows at night for everyone — it burns energy while on. Refuel with
                  <strong> Lamp Oil</strong> (craft it: 2 River Fish + 1 Wood).
                </div>
              </div>

              <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.12)", paddingTop: 12 }}>
                <div className="chibi-label" style={{ marginBottom: 6 }}>
                  💰 Sell on the housing market
                </div>
                {(plot?.saleGold != null || plot?.saleBase != null) && (
                  <div className="chibi-card chibi-card--info" style={{ padding: "6px 10px", marginBottom: 8, fontSize: "0.76rem" }}>
                    Listed for{" "}
                    {plot?.saleGold != null && <strong>🪙 {plot.saleGold.toLocaleString()}</strong>}
                    {plot?.saleGold != null && plot?.saleBase != null && " or "}
                    {plot?.saleBase != null && <strong>💠 {plot.saleBase.toLocaleString()} $BASE</strong>}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="chibi-input"
                    type="number"
                    min={0}
                    value={goldPrice}
                    placeholder="Gold price"
                    onChange={(e) => setGoldPrice(e.target.value)}
                    style={{ flex: 1 }}
                    aria-label="Sale price in gold"
                  />
                  <input
                    className="chibi-input"
                    type="number"
                    min={0}
                    value={basePrice}
                    placeholder="$BASE price"
                    onChange={(e) => setBasePrice(e.target.value)}
                    style={{ flex: 1 }}
                    aria-label="Sale price in $BASE"
                  />
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button type="button" className="chibi-btn chibi-btn--primary" onClick={() => void listForSale()} style={{ flex: 1, padding: "8px 10px", fontSize: "0.8rem" }}>
                    List for sale
                  </button>
                  {(plot?.saleGold != null || plot?.saleBase != null) && (
                    <button type="button" className="chibi-btn chibi-btn--secondary" onClick={() => void withdrawListing()} style={{ padding: "8px 10px", fontSize: "0.8rem" }}>
                      Withdraw
                    </button>
                  )}
                </div>
                <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
                  Leave a field blank to skip that currency. Buyers browse listings in the
                  <strong> 🏘️ Housing Market</strong>. $BASE is paid straight to your wallet.
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

      <button
        type="button"
        className="chibi-btn chibi-btn--ghost"
        onClick={() => {
          playSfx("ui_open");
          setHousingMarketOpen(true);
        }}
        style={{ width: "100%", marginTop: 12, padding: "8px 10px", fontSize: "0.82rem" }}
      >
        🏘️ Browse Housing Market
      </button>

      {error && (
        <div className="chibi-card chibi-card--danger" style={{ marginTop: 12, fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
      </div>
    </div>
  );
}
