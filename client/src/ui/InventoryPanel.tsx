import { getItemDefinition } from "@metricbase/shared";
import { useGameStore } from "../store/gameStore";
import { panelPosition } from "./chibiTheme";

export function InventoryPanel() {
  const inventory = useGameStore((state) => state.inventory);
  const open = useGameStore((state) => state.inventoryOpen);
  const setInventoryOpen = useGameStore((state) => state.setInventoryOpen);

  if (!open) return null;

  return (
    <div
      className="chibi-panel chibi-panel--floating"
      style={{ ...panelPosition("top-right"), width: 280, padding: "14px 16px", zIndex: 19 }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">Inventory</div>
        <button
          type="button"
          className="chibi-btn chibi-btn--ghost"
          onClick={() => setInventoryOpen(false)}
          aria-label="Close inventory"
        >
          ×
        </button>
      </div>

      <div className="chibi-text-muted" style={{ margin: "6px 0 12px" }}>
        {inventory.items.length} / {inventory.capacity} slots
      </div>

      {inventory.items.length === 0 ? (
        <div className="chibi-card chibi-text-muted" style={{ padding: "14px 0", textAlign: "center" }}>
          Empty. Defeat the training dummy to earn loot!
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {inventory.items.map((entry) => {
            const item = getItemDefinition(entry.itemId);
            return (
              <div key={entry.itemId} className="chibi-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>{item.name}</span>
                  <span className="chibi-stat-pill">x{entry.quantity}</span>
                </div>
                <div className="chibi-text-muted" style={{ marginTop: 4 }}>
                  {item.description}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}