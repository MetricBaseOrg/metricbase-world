import { zoneAssetPrice } from "@metricbase/shared";
import { useEffect, useMemo, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager, type AssetListingView } from "../game/network";
import { getZoneAsset, ZONE_ASSETS, type ZoneAssetCategory } from "../game/zoneAssets";
import { useGameStore } from "../store/gameStore";

const CATS: { id: ZoneAssetCategory; label: string }[] = [
  { id: "ground", label: "Ground" },
  { id: "structure", label: "Build" },
  { id: "resource", label: "Nodes" },
  { id: "decor", label: "Decor" },
];

type Mode = "shop" | "market" | "sell";

/** Buy assets from the game (gold sink), trade them P2P, and list your own. */
export function BuildShopPanel() {
  const open = useGameStore((s) => s.buildShopOpen);
  const setOpen = useGameStore((s) => s.setBuildShopOpen);
  const playerName = useGameStore((s) => s.playerName);
  const playerGold = useGameStore((s) => s.playerGold);
  const [mode, setMode] = useState<Mode>("shop");
  const [tab, setTab] = useState<ZoneAssetCategory>("structure");
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [listings, setListings] = useState<AssetListingView[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // Sell form: qty + price per selected owned asset.
  const [sell, setSell] = useState<Record<string, { qty: string; price: string }>>({});

  useEffect(() => {
    const off = networkManager.onAssetInventory(setOwned);
    const offMarket = networkManager.onAssetMarket(setListings);
    const offShop = networkManager.onBuildShopResult((r) => setNotice(r.ok ? null : r.error ?? "Purchase failed."));
    const offZone = networkManager.onZoneResult((r) => {
      if (r.message) setNotice(r.message);
      else if (r.error) setNotice(r.error);
    });
    return () => {
      off();
      offMarket();
      offShop();
      offZone();
    };
  }, []);

  useEffect(() => {
    if (open) {
      networkManager.requestAssetInventory();
      networkManager.requestAssetMarket();
      setNotice(null);
    }
  }, [open]);

  const ownedList = useMemo(() => Object.entries(owned).filter(([, n]) => n > 0), [owned]);

  if (!open) return null;

  const label = (id: string) => getZoneAsset(id)?.label ?? id;
  const shopItems = ZONE_ASSETS.filter((a) => a.category === tab && zoneAssetPrice(a.id) > 0);

  return (
    <div className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center" style={{ pointerEvents: "auto", maxWidth: 460, width: "94vw" }}>
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🛒 Build Market</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={() => { playSfx("ui_close"); setOpen(false); }} aria-label="Close">✕</button>
      </div>
      <div className="chibi-text-muted" style={{ fontSize: "0.74rem", marginTop: 2 }}>{playerGold.toLocaleString()}g</div>
      {notice && <div className="chibi-card" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>{notice}</div>}

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {(["shop", "market", "sell"] as Mode[]).map((m) => (
          <button key={m} type="button" className={`chibi-btn ${mode === m ? "chibi-btn--primary" : "chibi-btn--ghost"}`} style={{ flex: 1, padding: "8px 4px", fontSize: "0.74rem" }} onClick={() => setMode(m)}>
            {m === "shop" ? "Shop" : m === "market" ? "P2P Market" : "Sell"}
          </button>
        ))}
      </div>

      {mode === "shop" && (
        <>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {CATS.map((c) => (
              <button key={c.id} type="button" className={`chibi-btn ${tab === c.id ? "chibi-btn--mint" : "chibi-btn--ghost"}`} style={{ flex: 1, padding: "6px 4px", fontSize: "0.72rem" }} onClick={() => setTab(c.id)}>{c.label}</button>
            ))}
          </div>
          <div style={{ marginTop: 10, maxHeight: "48vh", overflowY: "auto", display: "grid", gap: 6 }}>
            {shopItems.map((a) => {
              const price = zoneAssetPrice(a.id);
              return (
                <div key={a.id} className="chibi-card" title={a.desc} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
                  {a.file ? (
                    <img src={`/assets/${a.file}`} alt="" style={{ width: 38, height: 38, objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: "1.7rem", width: 38, textAlign: "center" }}>{a.emoji ?? "❓"}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                      {a.label}
                      {a.footprint > 1 && (
                        <span className="chibi-text-muted" style={{ fontWeight: 600, fontSize: "0.66rem", marginLeft: 5 }}>
                          {a.footprint}×{a.footprint}
                        </span>
                      )}
                    </div>
                    <div className="chibi-text-muted" style={{ fontSize: "0.68rem", lineHeight: 1.35 }}>{a.desc}</div>
                    <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 1 }}>{price.toLocaleString()}g · owned {owned[a.id] ?? 0}</div>
                  </div>
                  <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "6px 10px" }} disabled={playerGold < price} onClick={() => { playSfx("ui_click"); networkManager.sendBuildShopBuy(a.id, 1); }}>Buy</button>
                  <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "6px 8px" }} disabled={playerGold < price * 5} onClick={() => { playSfx("ui_click"); networkManager.sendBuildShopBuy(a.id, 5); }}>×5</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {mode === "market" && (
        <div style={{ marginTop: 10, maxHeight: "52vh", overflowY: "auto", display: "grid", gap: 6 }}>
          {listings.length === 0 && <div className="chibi-text-muted" style={{ fontSize: "0.8rem" }}>No listings yet. Sell some assets to start the market!</div>}
          {listings.map((l) => (
            <div key={l.id} className="chibi-card" title={getZoneAsset(l.assetId)?.desc} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
              <img src={`/assets/${getZoneAsset(l.assetId)?.file ?? ""}`} alt="" style={{ width: 38, height: 38, objectFit: "contain" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{l.qty}× {label(l.assetId)}</div>
                <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>by {l.sellerName} · shop {l.shopPrice.toLocaleString()}g</div>
              </div>
              {l.sellerName === playerName ? (
                <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "6px 10px" }} onClick={() => { playSfx("ui_click"); networkManager.sendAssetMarketCancel(l.id); }}>Cancel</button>
              ) : (
                <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "6px 10px" }} disabled={playerGold < l.price} onClick={() => { playSfx("ui_click"); networkManager.sendAssetMarketBuy(l.id); }}>{l.price.toLocaleString()}g</button>
              )}
            </div>
          ))}
        </div>
      )}

      {mode === "sell" && (
        <div style={{ marginTop: 10, maxHeight: "52vh", overflowY: "auto", display: "grid", gap: 6 }}>
          {ownedList.length === 0 && <div className="chibi-text-muted" style={{ fontSize: "0.8rem" }}>You don't own any assets to sell. Buy some in the Shop first.</div>}
          {ownedList.map(([id, count]) => {
            const s = sell[id] ?? { qty: "1", price: String(zoneAssetPrice(id)) };
            return (
              <div key={id} className="chibi-card" title={getZoneAsset(id)?.desc} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px" }}>
                <img src={`/assets/${getZoneAsset(id)?.file ?? ""}`} alt="" style={{ width: 34, height: 34, objectFit: "contain" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.78rem" }}>{label(id)} <span className="chibi-text-muted">×{count}</span></div>
                  <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                    <input className="chibi-input" inputMode="numeric" placeholder="Qty" value={s.qty} style={{ width: 52, padding: "4px 6px" }} onChange={(e) => setSell((p) => ({ ...p, [id]: { ...s, qty: e.target.value.replace(/[^0-9]/g, "") } }))} />
                    <input className="chibi-input" inputMode="numeric" placeholder="Total gold" value={s.price} style={{ flex: 1, padding: "4px 6px" }} onChange={(e) => setSell((p) => ({ ...p, [id]: { ...s, price: e.target.value.replace(/[^0-9]/g, "") } }))} />
                  </div>
                </div>
                <button type="button" className="chibi-btn chibi-btn--mint" style={{ padding: "6px 10px" }} disabled={(Number(s.qty) || 0) < 1 || (Number(s.qty) || 0) > count || (Number(s.price) || 0) < 1} onClick={() => { playSfx("ui_click"); networkManager.sendAssetMarketList(id, Number(s.qty) || 0, Number(s.price) || 0); }}>List</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
