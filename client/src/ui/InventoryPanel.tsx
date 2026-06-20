import { getItemDefinition } from "@metricbase/shared";
import { useGameStore } from "../store/gameStore";

export function InventoryPanel() {
  const inventory = useGameStore((state) => state.inventory);
  const open = useGameStore((state) => state.inventoryOpen);
  const setInventoryOpen = useGameStore((state) => state.setInventoryOpen);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 280,
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(8, 12, 24, 0.88)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#f4f7ff",
        backdropFilter: "blur(8px)",
        pointerEvents: "auto",
        zIndex: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Inventory</div>
        <button
          type="button"
          onClick={() => setInventoryOpen(false)}
          style={{
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-label="Close inventory"
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 12, opacity: 0.6, margin: "6px 0 12px" }}>
        {inventory.items.length} / {inventory.capacity} slots
      </div>

      {inventory.items.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.65, padding: "12px 0" }}>
          Empty. Defeat the training dummy to earn loot.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {inventory.items.map((entry) => {
            const item = getItemDefinition(entry.itemId);
            return (
              <div
                key={entry.itemId}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>x{entry.quantity}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{item.description}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}