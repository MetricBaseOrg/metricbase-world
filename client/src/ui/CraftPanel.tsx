import { CRAFT_RECIPES, getItemDefinition, getItemQuantity } from "@metricbase/shared";
import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

export function CraftPanel() {
  const inventory = useGameStore((state) => state.inventory);
  const open = useGameStore((state) => state.craftOpen);
  const setCraftOpen = useGameStore((state) => state.setCraftOpen);
  const setInventory = useGameStore((state) => state.setInventory);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const handleCraft = async (recipeId: string) => {
    setPending(true);
    setError(null);
    networkManager.sendCraft(recipeId);
    const result = await new Promise<{
      ok: boolean;
      error?: string;
      inventory?: typeof inventory;
    }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 8000);
      const unsubscribe = networkManager.onCraftResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });
    setPending(false);
    if (result.inventory) setInventory(result.inventory);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not craft.");
      return;
    }
    playSfx("craft");
  };

  return (
    <div className="chibi-panel chibi-panel--floating chibi-panel--side chibi-anchor chibi-anchor--top-right chibi-panel--inventory">
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🔨 Crafting</div>
        <button
          type="button"
          className="chibi-btn chibi-btn--ghost"
          onClick={() => {
            playSfx("ui_close");
            setCraftOpen(false);
          }}
          aria-label="Close crafting"
        >
          ×
        </button>
      </div>

      <div className="chibi-text-muted" style={{ margin: "6px 0 10px", fontSize: "0.78rem" }}>
        Turn gathered materials into tools, food, and gear.
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {CRAFT_RECIPES.map((recipe) => {
          const output = getItemDefinition(recipe.output.itemId);
          const canCraft = recipe.inputs.every(
            (input) => getItemQuantity(inventory.items, input.itemId) >= input.quantity,
          );
          return (
            <div key={recipe.id} className="chibi-card" style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>
                  {output.name}
                  {recipe.output.quantity > 1 ? ` x${recipe.output.quantity}` : ""}
                </div>
                <button
                  type="button"
                  className="chibi-btn chibi-btn--primary"
                  disabled={pending || !canCraft}
                  onClick={() => void handleCraft(recipe.id)}
                  style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                >
                  Craft
                </button>
              </div>
              <div className="chibi-text-muted" style={{ fontSize: "0.74rem", marginTop: 4 }}>
                {recipe.description}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {recipe.inputs.map((input) => {
                  const def = getItemDefinition(input.itemId);
                  const have = getItemQuantity(inventory.items, input.itemId);
                  const enough = have >= input.quantity;
                  return (
                    <span
                      key={input.itemId}
                      className="chibi-stat-pill"
                      style={{
                        fontSize: "0.7rem",
                        color: enough ? "var(--chibi-mint-deep)" : "#d6453b",
                      }}
                    >
                      {def.name} {have}/{input.quantity}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="chibi-card chibi-card--danger" style={{ marginTop: 12, fontSize: "0.78rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
