import {
  CRAFT_RECIPES,
  ENHANCEABLE_SLOTS,
  MAX_ENHANCE_LEVEL,
  RARITY_COLORS,
  enhanceCost,
  enhanceSuccessRate,
  getCraftDurationMs,
  getDismantleRefund,
  getGearStat,
  getItemDefinition,
  getItemQuantity,
  type CraftRecipe,
  type EquipmentSlot,
} from "@metricbase/shared";
import { useEffect, useMemo, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { ItemIcon } from "./ItemIcon";

type Tab = "craft" | "refine" | "enhance" | "dismantle";

const TABS: { id: Tab; label: string }[] = [
  { id: "craft", label: "🔨 Craft" },
  { id: "refine", label: "🔥 Refine" },
  { id: "enhance", label: "⚒️ Enhance" },
  { id: "dismantle", label: "♻️ Dismantle" },
];

const SLOT_LABELS: Partial<Record<EquipmentSlot, string>> = {
  weapon: "Weapon",
  helmet: "Helmet",
  chest: "Armor",
  gloves: "Gloves",
  boots: "Boots",
  ring1: "Ring",
  ring2: "Ring",
  necklace: "Necklace",
  cape: "Cape",
};

/** Category of a craftable output, for the Craft-tab filter chips. */
function recipeCategory(recipe: CraftRecipe): string {
  const def = getItemDefinition(recipe.output.itemId);
  switch (def.kind) {
    case "weapon":
      return "weapon";
    case "tool":
      return "tool";
    case "mount":
      return "mount";
    case "consumable":
      return "consumable";
    case "armor": {
      const gear = getGearStat(recipe.output.itemId);
      if (gear && (gear.slot === "ring" || gear.slot === "necklace" || gear.slot === "cape")) return "accessory";
      return "armor";
    }
    default:
      return "other";
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  weapon: "Weapons",
  armor: "Armor",
  accessory: "Accessories",
  tool: "Tools",
  consumable: "Consumables",
  mount: "Mounts",
  other: "Others",
};

export function CraftPanel() {
  const inventory = useGameStore((state) => state.inventory);
  const playerGold = useGameStore((state) => state.playerGold);
  const equipment = useGameStore((state) => state.equipment);
  const open = useGameStore((state) => state.craftOpen);
  const setCraftOpen = useGameStore((state) => state.setCraftOpen);
  const setInventory = useGameStore((state) => state.setInventory);
  const setPlayerGold = useGameStore((state) => state.setPlayerGold);

  const [tab, setTab] = useState<Tab>("craft");
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enhanceMsg, setEnhanceMsg] = useState<string | null>(null);

  const refineRecipes = useMemo(
    () => CRAFT_RECIPES.filter((r) => getItemDefinition(r.output.itemId).kind === "material"),
    [],
  );
  const craftRecipes = useMemo(
    () => CRAFT_RECIPES.filter((r) => getItemDefinition(r.output.itemId).kind !== "material"),
    [],
  );
  const craftCategories = useMemo(() => {
    const set = new Set<string>(["all"]);
    for (const r of craftRecipes) set.add(recipeCategory(r));
    return ["all", "weapon", "armor", "accessory", "tool", "consumable", "mount", "other"].filter((c) => set.has(c));
  }, [craftRecipes]);

  // Equipped, enhanceable gear for the Enhance tab.
  const enhanceSlots = (equipment?.slots ?? []).filter((s) => ENHANCEABLE_SLOTS.includes(s.slot));
  // Bag items that have a recipe (can be salvaged) for the Dismantle tab.
  const dismantleItems = inventory.items.filter((entry) => getDismantleRefund(entry.itemId) !== null);

  useEffect(() => {
    const off = networkManager.onEnhanceResult((p) => {
      setBusy(false);
      if (!p.ok) {
        playSfx("shop_fail");
        setError(p.error ?? "Enhance failed.");
        return;
      }
      playSfx(p.success ? "level_up" : "shop_fail");
      setEnhanceMsg(p.success ? `✨ Enhanced to +${p.level}!` : `💥 Failed (still +${p.level}).`);
      window.setTimeout(() => setEnhanceMsg(null), 3000);
    });
    return () => {
      off();
    };
  }, []);

  if (!open) return null;

  const switchTab = (next: Tab) => {
    setTab(next);
    setSelected(null);
    setError(null);
  };

  const awaitCraftResult = () =>
    new Promise<{ ok: boolean; error?: string; gold?: number; inventory?: typeof inventory }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Request timed out." }), 20000);
      const unsubscribe = networkManager.onCraftResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });

  const handleCraft = async (recipeId: string) => {
    setBusy(true);
    setError(null);
    networkManager.sendCraft(recipeId);
    const result = await awaitCraftResult();
    setBusy(false);
    if (result.inventory) setInventory(result.inventory);
    if (typeof result.gold === "number") setPlayerGold(result.gold);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not craft.");
      return;
    }
    playSfx("craft");
  };

  const handleDismantle = async (itemId: string) => {
    setBusy(true);
    setError(null);
    networkManager.sendDismantle(itemId);
    const result = await awaitCraftResult();
    setBusy(false);
    if (result.inventory) setInventory(result.inventory);
    if (!result.ok) {
      playSfx("shop_fail");
      setError(result.error ?? "Could not dismantle.");
      return;
    }
    playSfx("craft");
    setSelected(null);
  };

  const renderRecipeList = (recipes: CraftRecipe[]) => {
    const filtered =
      tab === "craft" && category !== "all" ? recipes.filter((r) => recipeCategory(r) === category) : recipes;
    return filtered.map((recipe) => {
      const out = getItemDefinition(recipe.output.itemId);
      const gear = getGearStat(recipe.output.itemId);
      const canCraft =
        playerGold >= recipe.goldCost &&
        recipe.inputs.every((i) => getItemQuantity(inventory.items, i.itemId) >= i.quantity);
      return (
        <button
          key={recipe.id}
          type="button"
          className={`chibi-craft__row${selected === recipe.id ? " selected" : ""}`}
          onClick={() => setSelected(recipe.id)}
        >
          <span className="chibi-craft__rowmain">
            <span className="chibi-craft__rowicon">
              <ItemIcon itemId={recipe.output.itemId} size={26} />
            </span>
            <span style={{ color: gear ? RARITY_COLORS[gear.rarity] : undefined, fontWeight: 700 }}>{out.name}</span>
          </span>
          <span className={canCraft ? "chibi-craft__ok" : "chibi-craft__no"}>{canCraft ? "●" : "○"}</span>
        </button>
      );
    });
  };

  const renderDetail = () => {
    if (tab === "craft" || tab === "refine") {
      const recipe = CRAFT_RECIPES.find((r) => r.id === selected);
      if (!recipe) return <Empty text="Select a recipe." />;
      const out = getItemDefinition(recipe.output.itemId);
      const hasGold = playerGold >= recipe.goldCost;
      const hasMats = recipe.inputs.every((i) => getItemQuantity(inventory.items, i.itemId) >= i.quantity);
      return (
        <>
          <div className="chibi-craft__dhead">
            <span className="chibi-craft__dicon">
              <ItemIcon itemId={recipe.output.itemId} size={48} />
            </span>
            <div className="chibi-craft__dtitle">
              {out.name}
              {recipe.output.quantity > 1 ? ` ×${recipe.output.quantity}` : ""}
            </div>
          </div>
          <div className="chibi-text-muted" style={{ fontSize: "0.76rem", marginBottom: 8 }}>{out.description}</div>
          <div className="chibi-craft__sub">Materials</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {recipe.inputs.map((input) => {
              const def = getItemDefinition(input.itemId);
              const have = getItemQuantity(inventory.items, input.itemId);
              const enough = have >= input.quantity;
              return (
                <span key={input.itemId} className="chibi-stat-pill" style={{ fontSize: "0.7rem", color: enough ? "var(--chibi-mint-deep)" : "#d6453b" }}>
                  {def.name} {have}/{input.quantity}
                </span>
              );
            })}
          </div>
          <div className="chibi-text-muted" style={{ fontSize: "0.74rem", marginBottom: 10 }}>
            🪙 {recipe.goldCost} fee · ⏱ {(getCraftDurationMs(recipe) / 1000).toFixed(0)}s
          </div>
          <button
            type="button"
            className="chibi-btn chibi-btn--primary"
            disabled={busy || !hasGold || !hasMats}
            onClick={() => void handleCraft(recipe.id)}
            style={{ width: "100%", padding: "8px 10px" }}
          >
            {busy ? "Working…" : "Craft"}
          </button>
        </>
      );
    }

    if (tab === "enhance") {
      const slot = selected as EquipmentSlot | null;
      const eq = slot ? enhanceSlots.find((s) => s.slot === slot) : null;
      if (!eq) return <Empty text="Select an equipped item to enhance." />;
      const level = eq.enhance ?? 0;
      const atMax = level >= MAX_ENHANCE_LEVEL;
      const cost = enhanceCost(level);
      const rate = Math.round(enhanceSuccessRate(level) * 100);
      const name = getItemDefinition(eq.itemId).name;
      return (
        <>
          <div className="chibi-craft__dhead">
            <span className="chibi-craft__dicon">
              <ItemIcon itemId={eq.itemId} size={48} />
            </span>
            <div className="chibi-craft__dtitle">
              {name} {level > 0 && <span style={{ color: "var(--chibi-gold-deep)" }}>+{level}</span>}
            </div>
          </div>
          {atMax ? (
            <div className="chibi-stat-pill" style={{ marginBottom: 10 }}>Already at max +{MAX_ENHANCE_LEVEL}</div>
          ) : (
            <div className="chibi-text-muted" style={{ fontSize: "0.78rem", marginBottom: 10 }}>
              → +{level + 1} · 🪙 {cost.toLocaleString()} · {rate}% success
            </div>
          )}
          <button
            type="button"
            className="chibi-btn chibi-btn--gold"
            disabled={busy || atMax || playerGold < cost}
            onClick={() => {
              setBusy(true);
              setError(null);
              networkManager.sendEnhanceGear(slot!);
            }}
            style={{ width: "100%", padding: "8px 10px" }}
          >
            ⚒️ Enhance
          </button>
          {enhanceMsg && <div style={{ marginTop: 8, fontSize: "0.76rem", fontWeight: 700 }}>{enhanceMsg}</div>}
        </>
      );
    }

    // dismantle
    const itemId = selected;
    const refund = itemId ? getDismantleRefund(itemId) : null;
    if (!itemId || !refund) return <Empty text="Select a bag item to salvage." />;
    const name = getItemDefinition(itemId).name;
    return (
      <>
        <div className="chibi-craft__dhead">
          <span className="chibi-craft__dicon">
            <ItemIcon itemId={itemId} size={48} />
          </span>
          <div className="chibi-craft__dtitle">{name}</div>
        </div>
        <div className="chibi-text-muted" style={{ fontSize: "0.76rem", marginBottom: 8 }}>
          Breaks down 1× {name} and returns roughly half its materials.
        </div>
        <div className="chibi-craft__sub">Returns</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {refund.map((part) => (
            <span key={part.itemId} className="chibi-stat-pill" style={{ fontSize: "0.7rem" }}>
              {getItemDefinition(part.itemId).name} ×{part.quantity}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="chibi-btn chibi-btn--secondary"
          disabled={busy}
          onClick={() => void handleDismantle(itemId)}
          style={{ width: "100%", padding: "8px 10px" }}
        >
          {busy ? "Working…" : "♻️ Dismantle"}
        </button>
      </>
    );
  };

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="Crafting">
      <div className="chibi-panel chibi-panel--floating chibi-craft">
        <div className="chibi-close-row">
          <div className="chibi-craft__tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chibi-btn ${tab === t.id ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
                style={{ padding: "4px 9px", fontSize: "0.74rem" }}
                onClick={() => switchTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
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

        <div className="chibi-craft__body">
          <div className="chibi-craft__list">
            {tab === "craft" && (
              <div className="chibi-craft__cats">
                {craftCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chibi-btn ${category === c ? "chibi-btn--secondary" : "chibi-btn--ghost"}`}
                    style={{ padding: "2px 7px", fontSize: "0.68rem" }}
                    onClick={() => setCategory(c)}
                  >
                    {CATEGORY_LABELS[c] ?? c}
                  </button>
                ))}
              </div>
            )}
            {tab === "craft" && renderRecipeList(craftRecipes)}
            {tab === "refine" && renderRecipeList(refineRecipes)}
            {tab === "enhance" &&
              (enhanceSlots.length === 0 ? (
                <div className="chibi-text-muted" style={{ padding: 10, fontSize: "0.76rem" }}>
                  Equip some gear first.
                </div>
              ) : (
                enhanceSlots.map((s) => (
                  <button
                    key={s.slot}
                    type="button"
                    className={`chibi-craft__row${selected === s.slot ? " selected" : ""}`}
                    onClick={() => setSelected(s.slot)}
                  >
                    <span className="chibi-craft__rowmain">
                      <span className="chibi-craft__rowicon">
                        <ItemIcon itemId={s.itemId} size={26} />
                      </span>
                      <span style={{ fontWeight: 700 }}>
                        {getItemDefinition(s.itemId).name}
                        {(s.enhance ?? 0) > 0 && <span style={{ color: "var(--chibi-gold-deep)" }}> +{s.enhance}</span>}
                      </span>
                    </span>
                    <span className="chibi-text-muted" style={{ fontSize: "0.64rem" }}>{SLOT_LABELS[s.slot]}</span>
                  </button>
                ))
              ))}
            {tab === "dismantle" &&
              (dismantleItems.length === 0 ? (
                <div className="chibi-text-muted" style={{ padding: 10, fontSize: "0.76rem" }}>
                  No salvageable items in your bag.
                </div>
              ) : (
                dismantleItems.map((entry) => {
                  const gear = getGearStat(entry.itemId);
                  return (
                    <button
                      key={entry.itemId}
                      type="button"
                      className={`chibi-craft__row${selected === entry.itemId ? " selected" : ""}`}
                      onClick={() => setSelected(entry.itemId)}
                    >
                      <span className="chibi-craft__rowmain">
                        <span className="chibi-craft__rowicon">
                          <ItemIcon itemId={entry.itemId} size={26} />
                        </span>
                        <span style={{ color: gear ? RARITY_COLORS[gear.rarity] : undefined, fontWeight: 700 }}>
                          {getItemDefinition(entry.itemId).name}
                        </span>
                      </span>
                      <span className="chibi-text-muted" style={{ fontSize: "0.64rem" }}>×{entry.quantity}</span>
                    </button>
                  );
                })
              ))}
          </div>

          <div className="chibi-craft__detail">{renderDetail()}</div>
        </div>

        {error && (
          <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, fontSize: "0.78rem" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="chibi-text-muted" style={{ padding: "24px 8px", textAlign: "center", fontSize: "0.8rem" }}>
      {text}
    </div>
  );
}
