import { getItemDefinition } from "@metricbase/shared";
import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

export function InventoryPanel() {
  const inventory = useGameStore((state) => state.inventory);
  const equippedWeaponId = useGameStore((state) => state.equippedWeaponId);
  const open = useGameStore((state) => state.inventoryOpen);
  const setInventoryOpen = useGameStore((state) => state.setInventoryOpen);
  const setInventory = useGameStore((state) => state.setInventory);
  const setPlayerVitals = useGameStore((state) => state.setPlayerVitals);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const handleUse = async (itemId: string) => {
    setPending(true);
    setError(null);
    networkManager.sendUseItem(itemId);
    const result = await new Promise<{ ok: boolean; error?: string; hp?: number; maxHp?: number; inventory?: typeof inventory }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 8000);
      const unsubscribe = networkManager.onInventoryResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });
    setPending(false);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not use item.");
      return;
    }
    playSfx("item_use");
    if (result.inventory) setInventory(result.inventory);
    if (result.hp !== undefined && result.maxHp !== undefined) {
      setPlayerVitals(result.hp, result.maxHp);
    }
  };

  const handleEquip = async (itemId: string | null) => {
    setPending(true);
    setError(null);
    networkManager.sendEquipItem(itemId);
    const result = await new Promise<{ ok: boolean; error?: string; inventory?: typeof inventory }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 8000);
      const unsubscribe = networkManager.onInventoryResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });
    setPending(false);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not equip item.");
      return;
    }
    playSfx("ui_click");
    if (result.inventory) setInventory(result.inventory);
  };

  return (
    <div className="chibi-panel chibi-panel--floating chibi-panel--side chibi-anchor chibi-anchor--top-right chibi-panel--inventory">
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">Inventory</div>
        <button
          type="button"
          className="chibi-btn chibi-btn--ghost"
          onClick={() => {
            playSfx("ui_close");
            setInventoryOpen(false);
          }}
          aria-label="Close inventory"
        >
          ×
        </button>
      </div>

      <div className="chibi-text-muted" style={{ margin: "6px 0 12px" }}>
        {inventory.items.length} / {inventory.capacity} slots
        {equippedWeaponId && (
          <span style={{ display: "block", marginTop: 4, color: "var(--chibi-gold-deep)", fontWeight: 700 }}>
            Equipped: {getItemDefinition(equippedWeaponId).name}
          </span>
        )}
      </div>

      {inventory.items.length === 0 ? (
        <div className="chibi-card chibi-text-muted" style={{ padding: "14px 0", textAlign: "center" }}>
          Empty. Defeat mobs in the Wilderness to earn loot!
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {inventory.items.map((entry) => {
            const item = getItemDefinition(entry.itemId);
            const isEquipped = equippedWeaponId === entry.itemId;
            return (
              <div key={entry.itemId} className="chibi-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                      {item.name}
                      {isEquipped && <span style={{ color: "var(--chibi-mint-deep)" }}> (equipped)</span>}
                    </span>
                    <div className="chibi-text-muted" style={{ marginTop: 4 }}>
                      {item.description}
                    </div>
                  </div>
                  <span className="chibi-stat-pill">x{entry.quantity}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {item.kind === "consumable" && (
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--mint"
                      disabled={pending}
                      onClick={() => void handleUse(entry.itemId)}
                      style={{ padding: "6px 10px", fontSize: "0.72rem" }}
                    >
                      Use
                    </button>
                  )}
                  {item.kind === "weapon" && (
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--gold"
                      disabled={pending || isEquipped}
                      onClick={() => void handleEquip(entry.itemId)}
                      style={{ padding: "6px 10px", fontSize: "0.72rem" }}
                    >
                      {isEquipped ? "Equipped" : "Equip"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {equippedWeaponId && (
        <button
          type="button"
          className="chibi-btn chibi-btn--secondary"
          disabled={pending}
          onClick={() => void handleEquip(null)}
          style={{ marginTop: 12, width: "100%", padding: "8px 10px", fontSize: "0.78rem" }}
        >
          Unequip weapon
        </button>
      )}

      {error && (
        <div className="chibi-card chibi-card--danger" style={{ marginTop: 10, fontSize: "0.78rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}