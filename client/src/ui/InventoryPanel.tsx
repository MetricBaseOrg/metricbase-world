import {
  getItemDefinition,
  getGearStat,
  RARITY_COLORS,
  type EquipmentSlot,
} from "@metricbase/shared";
import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: "Weapon",
  tool: "Tool",
  helmet: "Helmet",
  chest: "Chest",
  gloves: "Gloves",
  boots: "Boots",
  ring1: "Ring",
  ring2: "Ring",
  necklace: "Necklace",
  cape: "Cape",
  offhand: "Offhand",
  mount: "Mount",
};

export function InventoryPanel() {
  const inventory = useGameStore((state) => state.inventory);
  const equipment = useGameStore((state) => state.equipment);
  const open = useGameStore((state) => state.inventoryOpen);
  const setInventoryOpen = useGameStore((state) => state.setInventoryOpen);
  const setInventory = useGameStore((state) => state.setInventory);
  const setPlayerVitals = useGameStore((state) => state.setPlayerVitals);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const equippedItemIds = new Set((equipment?.slots ?? []).map((slot) => slot.itemId));
  const needsRepair = (equipment?.slots ?? []).some(
    (slot) => slot.maxDurability !== undefined && (slot.durability ?? 0) < slot.maxDurability,
  );

  const awaitInventoryResult = () =>
    new Promise<{ ok: boolean; error?: string; hp?: number; maxHp?: number; inventory?: typeof inventory }>(
      (resolve) => {
        const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 8000);
        const unsubscribe = networkManager.onInventoryResult((payload) => {
          window.clearTimeout(timeout);
          unsubscribe();
          resolve(payload);
        });
      },
    );

  const handleUse = async (itemId: string) => {
    setPending(true);
    setError(null);
    networkManager.sendUseItem(itemId);
    const result = await awaitInventoryResult();
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

  const handleEquip = async (itemId: string | null, slot?: string) => {
    setPending(true);
    setError(null);
    networkManager.sendEquipItem(itemId, slot);
    const result = await awaitInventoryResult();
    setPending(false);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not equip item.");
      return;
    }
    playSfx("equip");
    if (result.inventory) setInventory(result.inventory);
  };

  const handleRepair = async () => {
    setPending(true);
    setError(null);
    networkManager.sendRepairGear();
    const result = await awaitInventoryResult();
    setPending(false);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not repair.");
      return;
    }
    playSfx("craft");
    if (result.inventory) setInventory(result.inventory);
  };

  const equipSlotFor = (itemId: string): string | undefined => {
    const item = getItemDefinition(itemId);
    if (item.kind === "tool") return "tool";
    if (item.kind === "weapon") return "weapon";
    if (item.kind === "mount") return "mount";
    return undefined; // armor — server resolves the slot
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

      {/* Combat stats from equipped gear */}
      {equipment && (
        <div className="chibi-card" style={{ margin: "6px 0 10px", display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.74rem", fontWeight: 700 }}>
          <span title="Attack power">⚔️ {Math.round(equipment.attack)}</span>
          <span title="Armor">🛡️ {Math.round(equipment.armor)}</span>
          <span title="Critical chance">🎯 {Math.round(equipment.critChance * 100)}%</span>
          <span title="Critical damage">💥 {equipment.critMult.toFixed(2)}×</span>
        </div>
      )}

      {/* Equipped gear with durability */}
      {equipment && equipment.slots.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {equipment.slots.map((slot) => {
            const item = getItemDefinition(slot.itemId);
            const gear = getGearStat(slot.itemId);
            const color = gear ? RARITY_COLORS[gear.rarity] : "var(--chibi-ink)";
            const durPct =
              slot.maxDurability && slot.maxDurability > 0
                ? Math.max(0, Math.min(1, (slot.durability ?? 0) / slot.maxDurability))
                : null;
            const low = durPct !== null && durPct <= 0.25;
            return (
              <div key={slot.slot} className="chibi-card" style={{ padding: "6px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: "0.62rem", opacity: 0.6, textTransform: "uppercase" }}>
                      {SLOT_LABELS[slot.slot]}
                    </span>
                    <div style={{ fontWeight: 800, fontSize: "0.78rem", color }}>{item.name}</div>
                  </div>
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--secondary"
                    disabled={pending}
                    onClick={() => void handleEquip(null, slot.slot)}
                    style={{ padding: "4px 8px", fontSize: "0.66rem" }}
                  >
                    Unequip
                  </button>
                </div>
                {durPct !== null && (
                  <div style={{ height: 4, borderRadius: 3, background: "var(--chibi-outline-light)", marginTop: 5, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${durPct * 100}%`,
                        height: "100%",
                        background: low ? "var(--chibi-danger)" : "var(--chibi-mint)",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {needsRepair && (
            <button
              type="button"
              className="chibi-btn chibi-btn--gold"
              disabled={pending}
              onClick={() => void handleRepair()}
              style={{ padding: "6px 10px", fontSize: "0.74rem" }}
            >
              🔧 Repair all gear
            </button>
          )}
        </div>
      )}

      <div className="chibi-text-muted" style={{ margin: "6px 0 8px" }}>
        {inventory.items.length} / {inventory.capacity} slots
      </div>

      {inventory.items.length === 0 ? (
        <div className="chibi-card chibi-text-muted" style={{ padding: "14px 0", textAlign: "center" }}>
          Empty. Defeat mobs in the Wilderness to earn loot!
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {inventory.items.map((entry) => {
            const item = getItemDefinition(entry.itemId);
            const gear = getGearStat(entry.itemId);
            const isEquipped = equippedItemIds.has(entry.itemId);
            const equippable =
              item.kind === "weapon" ||
              item.kind === "tool" ||
              item.kind === "armor" ||
              item.kind === "mount";
            const nameColor = gear ? RARITY_COLORS[gear.rarity] : undefined;
            return (
              <div key={entry.itemId} className="chibi-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: "0.85rem", color: nameColor }}>
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
                  {equippable && (
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--gold"
                      disabled={pending || isEquipped}
                      onClick={() => void handleEquip(entry.itemId, equipSlotFor(entry.itemId))}
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

      {error && (
        <div className="chibi-card chibi-card--danger" style={{ marginTop: 10, fontSize: "0.78rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
