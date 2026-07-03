import { zoneAssetPrice } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { ZONE_ASSETS, type ZoneAssetCategory } from "../game/zoneAssets";
import { useGameStore } from "../store/gameStore";

const TABS: { id: ZoneAssetCategory; label: string }[] = [
  { id: "ground", label: "Ground" },
  { id: "structure", label: "Build" },
  { id: "resource", label: "Nodes" },
  { id: "decor", label: "Decor" },
];

/** Buy build assets for gold; they land in your asset inventory to place. */
export function BuildShopPanel() {
  const open = useGameStore((s) => s.buildShopOpen);
  const setOpen = useGameStore((s) => s.setBuildShopOpen);
  const playerGold = useGameStore((s) => s.playerGold);
  const [tab, setTab] = useState<ZoneAssetCategory>("structure");
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const off = networkManager.onAssetInventory(setOwned);
    const offResult = networkManager.onBuildShopResult((r) => {
      if (!r.ok && r.error) setNotice(r.error);
      else setNotice(null);
    });
    return () => {
      off();
      offResult();
    };
  }, []);

  useEffect(() => {
    if (open) networkManager.requestAssetInventory();
  }, [open]);

  if (!open) return null;

  const buy = (id: string, qty: number) => {
    playSfx("ui_click");
    networkManager.sendBuildShopBuy(id, qty);
  };

  const items = ZONE_ASSETS.filter((a) => a.category === tab && zoneAssetPrice(a.id) > 0);

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 440, width: "94vw" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🛒 Build Shop</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={() => { playSfx("ui_close"); setOpen(false); }} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="chibi-text-muted" style={{ fontSize: "0.74rem", marginTop: 2 }}>
        {playerGold.toLocaleString()}g · buy assets, then place them in your World (removing returns them).
      </div>
      {notice && (
        <div className="chibi-card" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>{notice}</div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chibi-btn ${tab === t.id ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
            style={{ flex: 1, padding: "8px 4px", fontSize: "0.74rem" }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 10, maxHeight: "52vh", overflowY: "auto", display: "grid", gap: 6 }}>
        {items.map((a) => {
          const price = zoneAssetPrice(a.id);
          return (
            <div key={a.id} className="chibi-card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
              <img src={`/assets/${a.file}`} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{a.label}</div>
                <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
                  {price.toLocaleString()}g each · owned {owned[a.id] ?? 0}
                </div>
              </div>
              <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "6px 10px" }} disabled={playerGold < price} onClick={() => buy(a.id, 1)}>
                Buy
              </button>
              <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "6px 8px" }} disabled={playerGold < price * 5} onClick={() => buy(a.id, 5)}>
                ×5
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
