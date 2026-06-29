import {
  SOFT_CURRENCIES,
  SOFT_SHOP_OFFERS,
  getItemDefinition,
  type SoftCurrencyId,
} from "@metricbase/shared";
import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { ItemIcon } from "./ItemIcon";

const CURRENCY_ORDER: SoftCurrencyId[] = ["honor", "guildCoin", "gems"];

export function SoftShopPanel() {
  const open = useGameStore((state) => state.honorShopOpen);
  const setOpen = useGameStore((state) => state.setHonorShopOpen);
  const honor = useGameStore((state) => state.honor);
  const guildCoin = useGameStore((state) => state.guildCoin);
  const gems = useGameStore((state) => state.gems);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const balanceOf = (c: SoftCurrencyId) => (c === "honor" ? honor : c === "guildCoin" ? guildCoin : gems);

  const buy = async (offerId: string, cost: number, currency: SoftCurrencyId) => {
    if (balanceOf(currency) < cost) {
      playSfx("shop_fail");
      setError("You can't afford that yet.");
      return;
    }
    setBusy(offerId);
    setError(null);
    networkManager.sendBuySoftItem(offerId);
    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 8000);
      const off = networkManager.onSoftShopResult((payload) => {
        window.clearTimeout(timeout);
        off();
        resolve(payload);
      });
    });
    setBusy(null);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Purchase failed.");
      return;
    }
    playSfx("shop_buy");
  };

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="Quartermaster">
      <div className="chibi-panel chibi-panel--floating chibi-softshop">
        <div className="chibi-close-row">
          <div className="chibi-title chibi-title--sm chibi-sparkle-title">🎖️ Quartermaster</div>
          <button
            type="button"
            className="chibi-btn chibi-btn--ghost"
            onClick={() => {
              playSfx("ui_close");
              setOpen(false);
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="chibi-softshop__bal">
          {SOFT_CURRENCIES.map((c) => (
            <span key={c.id} className="chibi-softshop__balchip" style={{ color: c.color }} title={c.hint}>
              {c.icon} {balanceOf(c.id).toLocaleString()} {c.label}
            </span>
          ))}
        </div>

        {CURRENCY_ORDER.map((cur) => {
          const meta = SOFT_CURRENCIES.find((c) => c.id === cur)!;
          const offers = SOFT_SHOP_OFFERS.filter((o) => o.currency === cur);
          return (
            <div key={cur} className="chibi-softshop__group">
              <div className="chibi-softshop__grouphead" style={{ color: meta.color }}>
                {meta.icon} {meta.label}
              </div>
              <div className="chibi-softshop__grid">
                {offers.map((offer) => {
                  const item = getItemDefinition(offer.itemId);
                  const afford = balanceOf(cur) >= offer.cost;
                  return (
                    <div key={offer.id} className="chibi-softshop__card">
                      <span className="chibi-softshop__icon">
                        <ItemIcon itemId={offer.itemId} size={40} />
                      </span>
                      <div className="chibi-softshop__info">
                        <div className="chibi-softshop__name">
                          {item.name}
                          {offer.quantity > 1 ? ` ×${offer.quantity}` : ""}
                        </div>
                        <div className="chibi-softshop__blurb">{offer.blurb}</div>
                      </div>
                      <button
                        type="button"
                        className={`chibi-btn ${afford ? "chibi-btn--gold" : "chibi-btn--ghost"}`}
                        disabled={busy !== null || !afford}
                        onClick={() => void buy(offer.id, offer.cost, cur)}
                        style={{ padding: "5px 9px", fontSize: "0.72rem", whiteSpace: "nowrap" }}
                      >
                        {busy === offer.id ? "…" : `${meta.icon} ${offer.cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {error && (
          <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, fontSize: "0.78rem" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
