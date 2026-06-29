import {
  getItemDefinition,
  getGearStat,
  RARITY_COLORS,
  type EquipmentSlot,
  type ItemKind,
} from "@metricbase/shared";
import { useMemo, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { PortraitCanvas } from "./PortraitCanvas";

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: "Weapon",
  tool: "Tool",
  helmet: "Helmet",
  chest: "Armor",
  gloves: "Gloves",
  boots: "Boots",
  ring1: "Ring",
  ring2: "Ring",
  necklace: "Necklace",
  cape: "Cape",
  offhand: "Offhand",
  mount: "Mount",
};

const SLOT_ICONS: Record<EquipmentSlot, string> = {
  weapon: "⚔️",
  tool: "🛠️",
  helmet: "⛑️",
  chest: "🦺",
  gloves: "🧤",
  boots: "🥾",
  ring1: "💍",
  ring2: "💍",
  necklace: "📿",
  cape: "🧣",
  offhand: "🛡️",
  mount: "🐎",
};

/** Paper-doll slot order shown around the character. */
const DOLL_SLOTS: EquipmentSlot[] = [
  "helmet",
  "necklace",
  "weapon",
  "chest",
  "gloves",
  "tool",
  "boots",
  "ring1",
  "ring2",
  "cape",
  "mount",
];

const ITEM_ICONS: Record<string, string> = {
  item_health_potion: "🧪",
  item_bread: "🍞",
  item_cooked_fish: "🐟",
  item_grilled_salmon: "🍣",
  item_pony: "🐴",
  item_steed: "🐎",
  item_dire_wolf: "🐺",
};

function itemIcon(itemId: string, kind: ItemKind): string {
  if (ITEM_ICONS[itemId]) return ITEM_ICONS[itemId];
  switch (kind) {
    case "weapon":
      return "⚔️";
    case "armor":
      return "🛡️";
    case "tool":
      return "🛠️";
    case "mount":
      return "🐎";
    case "consumable":
      return "🧪";
    default:
      return "📦";
  }
}

type Filter = "all" | "equip" | "consumable" | "material";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "equip", label: "⚔️ Gear" },
  { id: "consumable", label: "🧪 Use" },
  { id: "material", label: "📦 Mats" },
];

export function InventoryPanel() {
  const inventory = useGameStore((state) => state.inventory);
  const equipment = useGameStore((state) => state.equipment);
  const appearance = useGameStore((state) => state.characterAppearance);
  const playerName = useGameStore((state) => state.playerName);
  const playerLevel = useGameStore((state) => state.playerLevel);
  const playerMaxHp = useGameStore((state) => state.playerMaxHp);
  const playerMaxStamina = useGameStore((state) => state.playerMaxStamina);
  const open = useGameStore((state) => state.inventoryOpen);
  const setInventoryOpen = useGameStore((state) => state.setInventoryOpen);
  const setInventory = useGameStore((state) => state.setInventory);
  const setPlayerVitals = useGameStore((state) => state.setPlayerVitals);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sorted, setSorted] = useState(false);

  const slotMap = useMemo(() => {
    const map = new Map<EquipmentSlot, { itemId: string; durability?: number; maxDurability?: number }>();
    for (const s of equipment?.slots ?? []) map.set(s.slot, s);
    return map;
  }, [equipment]);

  if (!open) return null;

  const equippedItemIds = new Set((equipment?.slots ?? []).map((slot) => slot.itemId));
  const needsRepair = (equipment?.slots ?? []).some(
    (slot) => slot.maxDurability !== undefined && (slot.durability ?? 0) < slot.maxDurability,
  );
  const gearScore = equipment
    ? Math.round(equipment.attack + equipment.armor + equipment.critChance * 100 + equipment.critMult * 10)
    : 0;

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
    if (result.hp !== undefined && result.maxHp !== undefined) setPlayerVitals(result.hp, result.maxHp);
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

  /** Click an inventory tile: equip gear/mounts, use consumables. */
  const onTileClick = (itemId: string) => {
    if (pending) return;
    const item = getItemDefinition(itemId);
    if (item.kind === "consumable") void handleUse(itemId);
    else if (item.kind === "weapon" || item.kind === "tool" || item.kind === "armor" || item.kind === "mount") {
      if (!equippedItemIds.has(itemId)) void handleEquip(itemId, equipSlotFor(itemId));
    }
  };

  const items = inventory.items.filter((entry) => {
    const kind = getItemDefinition(entry.itemId).kind;
    if (filter === "all") return true;
    if (filter === "equip") return kind === "weapon" || kind === "armor" || kind === "tool" || kind === "mount";
    if (filter === "consumable") return kind === "consumable";
    return kind === "material";
  });
  const displayItems = sorted
    ? [...items].sort((a, b) => getItemDefinition(a.itemId).name.localeCompare(getItemDefinition(b.itemId).name))
    : items;

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="Inventory">
      <div className="chibi-panel chibi-panel--floating chibi-inv">
        <div className="chibi-close-row">
          <div className="chibi-title chibi-title--sm chibi-sparkle-title">Character</div>
          <button
            type="button"
            className="chibi-btn chibi-btn--ghost"
            onClick={() => {
              playSfx("ui_close");
              setInventoryOpen(false);
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="chibi-inv__body">
          {/* Paper-doll + stats */}
          <section className="chibi-inv__doll">
            <div className="chibi-inv__hero">
              <div className="chibi-inv__portrait">
                <PortraitCanvas appearance={appearance} size={84} />
              </div>
              <div>
                <div className="chibi-inv__heroname">{playerName}</div>
                <div className="chibi-text-muted" style={{ fontSize: "0.74rem" }}>Lv {playerLevel}</div>
                <div className="chibi-inv__gearscore">🛡️ Gear Score {gearScore.toLocaleString()}</div>
              </div>
            </div>

            <div className="chibi-inv__slots">
              {DOLL_SLOTS.map((slot) => {
                const eq = slotMap.get(slot);
                const gear = eq ? getGearStat(eq.itemId) : null;
                const color = gear ? RARITY_COLORS[gear.rarity] : undefined;
                const durPct =
                  eq && eq.maxDurability && eq.maxDurability > 0
                    ? Math.max(0, Math.min(1, (eq.durability ?? 0) / eq.maxDurability))
                    : null;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`chibi-slot${eq ? " filled" : ""}`}
                    style={color ? { borderColor: color } : undefined}
                    title={eq ? `${getItemDefinition(eq.itemId).name} — click to unequip` : SLOT_LABELS[slot]}
                    disabled={pending || !eq}
                    onClick={() => eq && void handleEquip(null, slot)}
                  >
                    <span className="chibi-slot__icon">{SLOT_ICONS[slot]}</span>
                    <span className="chibi-slot__label">{SLOT_LABELS[slot]}</span>
                    {durPct !== null && (
                      <span className="chibi-slot__dur" style={{ width: `${durPct * 100}%`, background: durPct <= 0.25 ? "var(--chibi-danger)" : "var(--chibi-mint)" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {equipment && (
              <div className="chibi-inv__stats">
                <Stat label="Attack" value={Math.round(equipment.attack)} icon="⚔️" />
                <Stat label="Defense" value={Math.round(equipment.armor)} icon="🛡️" />
                <Stat label="Crit Rate" value={`${Math.round(equipment.critChance * 100)}%`} icon="🎯" />
                <Stat label="Crit Dmg" value={`${equipment.critMult.toFixed(2)}×`} icon="💥" />
                <Stat label="Health" value={playerMaxHp} icon="❤️" />
                <Stat label="Energy" value={playerMaxStamina} icon="🍗" />
              </div>
            )}

            {needsRepair && (
              <button
                type="button"
                className="chibi-btn chibi-btn--gold"
                disabled={pending}
                onClick={() => void handleRepair()}
                style={{ width: "100%", padding: "6px 10px", fontSize: "0.76rem" }}
              >
                🔧 Repair all gear
              </button>
            )}
          </section>

          {/* Bag */}
          <section className="chibi-inv__bag">
            <div className="chibi-inv__baghead">
              <div className="chibi-inv__filters">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`chibi-btn ${filter === f.id ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
                    style={{ padding: "3px 8px", fontSize: "0.7rem" }}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="chibi-text-muted" style={{ fontSize: "0.72rem" }}>
                  {inventory.items.length}/{inventory.capacity}
                </span>
                <button
                  type="button"
                  className="chibi-btn chibi-btn--secondary"
                  style={{ padding: "3px 8px", fontSize: "0.7rem" }}
                  onClick={() => setSorted((v) => !v)}
                  title="Sort by name"
                >
                  ⇅ Sort
                </button>
              </div>
            </div>

            {displayItems.length === 0 ? (
              <div className="chibi-card chibi-text-muted" style={{ padding: "18px 0", textAlign: "center" }}>
                Nothing here. Defeat mobs and gather to fill your bag!
              </div>
            ) : (
              <div className="chibi-inv__grid">
                {displayItems.map((entry) => {
                  const item = getItemDefinition(entry.itemId);
                  const gear = getGearStat(entry.itemId);
                  const color = gear ? RARITY_COLORS[gear.rarity] : "var(--chibi-outline-light)";
                  const isEquipped = equippedItemIds.has(entry.itemId);
                  return (
                    <button
                      key={entry.itemId}
                      type="button"
                      className={`chibi-itile${isEquipped ? " equipped" : ""}`}
                      style={{ borderColor: color }}
                      title={`${item.name}${gear ? ` (${gear.rarity})` : ""} — ${item.description}`}
                      disabled={pending}
                      onClick={() => onTileClick(entry.itemId)}
                    >
                      <span className="chibi-itile__icon">{itemIcon(entry.itemId, item.kind)}</span>
                      {entry.quantity > 1 && <span className="chibi-itile__qty">{entry.quantity}</span>}
                      {isEquipped && <span className="chibi-itile__eq">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
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

function Stat({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="chibi-inv__stat">
      <span className="chibi-inv__stat-l">
        {icon} {label}
      </span>
      <span className="chibi-inv__stat-v">{value}</span>
    </div>
  );
}
