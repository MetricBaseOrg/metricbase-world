import {
  getItemDefinition,
  getGearStat,
  RARITY_COLORS,
  ENHANCEABLE_SLOTS,
  MAX_ENHANCE_LEVEL,
  enhanceCost,
  enhanceSuccessRate,
  xpProgress,
  type EquipmentSlot,
  type ItemKind,
} from "@metricbase/shared";
import { useEffect, useMemo, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { PortraitCanvas } from "./PortraitCanvas";
import { ItemIcon } from "./ItemIcon";
import { hasItemIcon } from "./itemIcons";

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
  pet: "Pet",
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
  pet: "🐾",
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
  "pet",
];

const ITEM_ICONS: Record<string, string> = {
  // Consumables / food
  item_health_potion: "🧪",
  item_bread: "🍞",
  item_cooked_fish: "🍤",
  item_grilled_salmon: "🍣",
  item_lamp_oil: "🛢️",
  // Raw resources
  item_wood: "🪵",
  item_hardwood: "🌳",
  item_ore: "🪨",
  item_iron_ore: "⛰️",
  item_fish: "🐟",
  item_salmon: "🐠",
  item_wheat: "🌾",
  item_wheat_seed: "🌱",
  item_slime_gel: "🫧",
  item_slime_core: "💠",
  item_training_scrap: "🔩",
  // Refined materials
  item_plank: "🟫",
  item_hardwood_plank: "🟤",
  item_copper_bar: "🟧",
  item_iron_bar: "⬜",
  item_steel_bar: "⚙️",
  item_amber: "🟠",
  item_gemstone: "💎",
  item_pearl: "⚪",
  item_harvest_net: "🕸️",
  // Weapons
  item_rusty_blade: "⚔️",
  item_gel_knife: "🔪",
  item_copper_dagger: "🗡️",
  item_gem_blade: "🔱",
  // Tools
  item_copper_axe: "🪓",
  item_iron_axe: "🪓",
  item_steel_axe: "🪓",
  item_copper_pickaxe: "⛏️",
  item_iron_pickaxe: "⛏️",
  item_steel_pickaxe: "⛏️",
  item_fishing_rod: "🎣",
  item_pro_rod: "🎣",
  // Mounts
  item_pony: "🐴",
  item_steed: "🐎",
  item_dire_wolf: "🐺",
};

/** Icon per gear slot kind (covers all armour + accessories). */
const GEAR_KIND_ICONS: Record<string, string> = {
  helmet: "⛑️",
  chest: "🦺",
  gloves: "🧤",
  boots: "🥾",
  ring: "💍",
  necklace: "📿",
  cape: "🧣",
  offhand: "🛡️",
};

function itemIcon(itemId: string, kind: ItemKind): string {
  if (ITEM_ICONS[itemId]) return ITEM_ICONS[itemId];
  const gear = getGearStat(itemId);
  if (gear && GEAR_KIND_ICONS[gear.slot]) return GEAR_KIND_ICONS[gear.slot];
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

/** Playful tier label + colour for a gear score. */
function gearTier(score: number): { label: string; color: string } {
  if (score >= 1000) return { label: "Legendary", color: "#c14fe0" };
  if (score >= 600) return { label: "Gold", color: "#e0a92e" };
  if (score >= 300) return { label: "Silver", color: "#8a97a8" };
  if (score >= 100) return { label: "Bronze", color: "#b0793f" };
  return { label: "Novice", color: "#9c8a6d" };
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
  const playerXp = useGameStore((state) => state.playerXp);
  const playerMaxHp = useGameStore((state) => state.playerMaxHp);
  const playerMaxStamina = useGameStore((state) => state.playerMaxStamina);
  const open = useGameStore((state) => state.inventoryOpen);
  const setInventoryOpen = useGameStore((state) => state.setInventoryOpen);
  const setHonorShopOpen = useGameStore((state) => state.setHonorShopOpen);
  const setInventory = useGameStore((state) => state.setInventory);
  const setPlayerVitals = useGameStore((state) => state.setPlayerVitals);
  const playerGold = useGameStore((state) => state.playerGold);
  const honor = useGameStore((state) => state.honor);
  const guildCoin = useGameStore((state) => state.guildCoin);
  const gems = useGameStore((state) => state.gems);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sorted, setSorted] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [enhanceMsg, setEnhanceMsg] = useState<string | null>(null);

  const slotMap = useMemo(() => {
    const map = new Map<
      EquipmentSlot,
      { itemId: string; durability?: number; maxDurability?: number; enhance?: number }
    >();
    for (const s of equipment?.slots ?? []) map.set(s.slot, s);
    return map;
  }, [equipment]);

  useEffect(() => {
    const off = networkManager.onEnhanceResult((p) => {
      setPending(false);
      if (!p.ok) {
        playSfx("shop_fail");
        setError(p.error ?? "Enhance failed.");
        return;
      }
      if (p.success) {
        playSfx("level_up");
        setEnhanceMsg(`✨ Enhanced to +${p.level}!`);
      } else {
        playSfx("shop_fail");
        setEnhanceMsg(`💥 Enhancement failed (still +${p.level}).`);
      }
      window.setTimeout(() => setEnhanceMsg(null), 3000);
    });
    return () => {
      off();
    };
  }, []);

  if (!open) return null;

  const equippedItemIds = new Set((equipment?.slots ?? []).map((slot) => slot.itemId));
  const needsRepair = (equipment?.slots ?? []).some(
    (slot) => slot.maxDurability !== undefined && (slot.durability ?? 0) < slot.maxDurability,
  );
  const totalEnhance = (equipment?.slots ?? []).reduce((sum, s) => sum + (s.enhance ?? 0), 0);
  const gearScore = equipment
    ? Math.round(
        equipment.attack * 2 +
          equipment.armor * 2 +
          equipment.critChance * 300 +
          (equipment.critMult - 1) * 100 +
          totalEnhance * 25,
      )
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
    if (item.kind === "pet") return "pet";
    return undefined; // armor — server resolves the slot
  };

  const isEquippable = (kind: ItemKind) =>
    kind === "weapon" || kind === "tool" || kind === "armor" || kind === "mount" || kind === "pet";

  /** The primary action for an item (used by the detail card + double-click). */
  const quickAct = (itemId: string) => {
    if (pending) return;
    const item = getItemDefinition(itemId);
    if (item.kind === "consumable") void handleUse(itemId);
    else if (isEquippable(item.kind) && !equippedItemIds.has(itemId)) {
      void handleEquip(itemId, equipSlotFor(itemId));
    }
  };

  /** Single click selects (details + explicit buttons); double click quick-acts. */
  const onTileClick = (itemId: string) => {
    setSelectedItem((cur) => (cur === itemId ? null : itemId));
  };

  /** Stat deltas vs the currently equipped piece in the same slot kind. */
  const compareRows = (itemId: string) => {
    const gear = getGearStat(itemId);
    if (!gear) return null;
    let currentGear: ReturnType<typeof getGearStat> = null;
    for (const s of equipment?.slots ?? []) {
      const g = getGearStat(s.itemId);
      if (g && g.slot === gear.slot && s.itemId !== itemId) {
        currentGear = g;
        break;
      }
    }
    const rows: { icon: string; label: string; text: string; delta: number }[] = [];
    const push = (icon: string, label: string, val: number | undefined, cur: number | undefined, fmt: (n: number) => string) => {
      if (val === undefined && cur === undefined) return;
      const v = val ?? 0;
      rows.push({ icon, label, text: fmt(v), delta: v - (cur ?? 0) });
    };
    push("⚔️", "Atk", gear.attack, currentGear?.attack, (n) => `${Math.round(n)}`);
    push("🛡️", "Def", gear.armor, currentGear?.armor, (n) => `${Math.round(n)}`);
    push("🎯", "Crit", gear.critChance, currentGear?.critChance, (n) => `${Math.round(n * 100)}%`);
    push("💥", "CDmg", gear.critMult, currentGear?.critMult, (n) => `+${n.toFixed(2)}`);
    return rows;
  };

  const items = inventory.items.filter((entry) => {
    const kind = getItemDefinition(entry.itemId).kind;
    if (filter === "all") return true;
    if (filter === "equip")
      return kind === "weapon" || kind === "armor" || kind === "tool" || kind === "mount" || kind === "pet";
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
                <span className="chibi-inv__spark" style={{ top: 5, left: 6 }}>✦</span>
                <span className="chibi-inv__spark" style={{ top: 12, right: 8, animationDelay: "1.1s" }}>✦</span>
                <span className="chibi-inv__lvl">Lv {playerLevel}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="chibi-inv__heroname">{playerName}</div>
                <div className="chibi-inv__gearscore">
                  🛡️ Gear Score {gearScore.toLocaleString()}
                  {(() => {
                    const tier = gearTier(gearScore);
                    return (
                      <span className="chibi-tier-chip" style={{ color: tier.color }}>
                        {tier.label}
                      </span>
                    );
                  })()}
                </div>
                {(() => {
                  const xp = xpProgress(playerXp, playerLevel);
                  const pct = Math.round((xp.current / Math.max(1, xp.required)) * 100);
                  return (
                    <>
                      <div className="chibi-xpbar" title={`${xp.current.toLocaleString()} / ${xp.required.toLocaleString()} XP`}>
                        <div className="chibi-xpbar__fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="chibi-text-muted" style={{ fontSize: "0.64rem", marginTop: 2 }}>
                        {xp.required <= 1 ? "Max level!" : `${pct}% to Lv ${playerLevel + 1}`}
                      </div>
                    </>
                  );
                })()}
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
                const enh = eq?.enhance ?? 0;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`chibi-slot${eq ? " filled" : ""}${selectedSlot === slot ? " selected" : ""}`}
                    style={color ? { borderColor: color } : undefined}
                    title={eq ? getItemDefinition(eq.itemId).name : SLOT_LABELS[slot]}
                    disabled={pending || !eq}
                    onClick={() => setSelectedSlot((cur) => (cur === slot ? null : slot))}
                  >
                    <span className="chibi-slot__icon">
                      {eq && hasItemIcon(eq.itemId) ? (
                        <ItemIcon itemId={eq.itemId} size={30} />
                      ) : (
                        SLOT_ICONS[slot]
                      )}
                    </span>
                    <span className="chibi-slot__label">{SLOT_LABELS[slot]}</span>
                    {enh > 0 && <span className="chibi-slot__enh">+{enh}</span>}
                    {durPct !== null && (
                      <span className="chibi-slot__dur" style={{ width: `${durPct * 100}%`, background: durPct <= 0.25 ? "var(--chibi-danger)" : "var(--chibi-mint)" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected-slot actions: enhance + unequip */}
            {selectedSlot && slotMap.get(selectedSlot) && (() => {
              const eq = slotMap.get(selectedSlot)!;
              const level = eq.enhance ?? 0;
              const atMax = level >= MAX_ENHANCE_LEVEL || !ENHANCEABLE_SLOTS.includes(selectedSlot);
              const cost = enhanceCost(level);
              const rate = Math.round(enhanceSuccessRate(level) * 100);
              const name = getItemDefinition(eq.itemId).name;
              return (
                <div className="chibi-card" style={{ padding: "8px 10px", fontSize: "0.78rem" }}>
                  <div style={{ fontWeight: 800 }}>
                    {name} {level > 0 && <span style={{ color: "var(--chibi-gold-deep)" }}>+{level}</span>}
                  </div>
                  {!atMax && (
                    <div className="chibi-text-muted" style={{ fontSize: "0.72rem", margin: "2px 0 6px" }}>
                      → +{level + 1} · 🪙 {cost.toLocaleString()} · {rate}% success
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    {!atMax && (
                      <button
                        type="button"
                        className="chibi-btn chibi-btn--gold"
                        disabled={pending || playerGold < cost}
                        onClick={() => {
                          setPending(true);
                          setError(null);
                          networkManager.sendEnhanceGear(selectedSlot);
                        }}
                        style={{ flex: 1, padding: "5px 8px", fontSize: "0.74rem" }}
                      >
                        ⚒️ Enhance
                      </button>
                    )}
                    {atMax && (
                      <span className="chibi-stat-pill" style={{ flex: 1, textAlign: "center" }}>Max +{MAX_ENHANCE_LEVEL}</span>
                    )}
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--secondary"
                      disabled={pending}
                      onClick={() => {
                        void handleEquip(null, selectedSlot);
                        setSelectedSlot(null);
                      }}
                      style={{ flex: 1, padding: "5px 8px", fontSize: "0.74rem" }}
                    >
                      Unequip
                    </button>
                  </div>
                  {enhanceMsg && (
                    <div style={{ marginTop: 6, fontSize: "0.72rem", fontWeight: 700 }}>{enhanceMsg}</div>
                  )}
                </div>
              );
            })()}

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

            <div className="chibi-inv__currency">
              <span className="chibi-inv__cur" title="Gold">🪙 {playerGold.toLocaleString()}</span>
              <span className="chibi-inv__cur" title="Honor — from PvP wins" style={{ color: "#e0567a" }}>🎖️ {honor.toLocaleString()}</span>
              <span className="chibi-inv__cur" title="Guild Coin — PvP wins while in a guild" style={{ color: "#5aa7e0" }}>🔰 {guildCoin.toLocaleString()}</span>
              <span className="chibi-inv__cur" title="Gems — rare drops from strong foes" style={{ color: "#1f9d8a" }}>💎 {gems.toLocaleString()}</span>
              <button
                type="button"
                className="chibi-btn chibi-btn--gold"
                style={{ marginLeft: "auto", padding: "3px 9px", fontSize: "0.7rem" }}
                onClick={() => {
                  playSfx("ui_open");
                  setInventoryOpen(false);
                  setHonorShopOpen(true);
                }}
                title="Spend Honor / Guild Coin / Gems at the Quartermaster"
              >
                Spend ▸
              </button>
            </div>

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
                <span
                  className="chibi-capbar"
                  title={`${inventory.items.length}/${inventory.capacity} slots used`}
                >
                  <span
                    className={`chibi-capbar__fill${inventory.items.length >= inventory.capacity ? " full" : ""}`}
                    style={{ display: "block", width: `${Math.min(100, Math.round((inventory.items.length / Math.max(1, inventory.capacity)) * 100))}%` }}
                  />
                </span>
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
                      className={`chibi-itile${isEquipped ? " equipped" : ""}${selectedItem === entry.itemId ? " selected" : ""}`}
                      style={{
                        borderColor: color,
                        // Rarity glow: gear pieces softly radiate their rarity colour.
                        boxShadow: gear ? `0 0 8px ${color}66` : undefined,
                      }}
                      title={`${item.name}${gear ? ` (${gear.rarity})` : ""} — double-click to ${item.kind === "consumable" ? "use" : "equip"}`}
                      disabled={pending}
                      onClick={() => onTileClick(entry.itemId)}
                      onDoubleClick={() => quickAct(entry.itemId)}
                    >
                      <span className="chibi-itile__icon">
                        {hasItemIcon(entry.itemId) ? (
                          <ItemIcon itemId={entry.itemId} size={34} />
                        ) : (
                          itemIcon(entry.itemId, item.kind)
                        )}
                      </span>
                      <span className="chibi-itile__name">{item.name}</span>
                      {entry.quantity > 1 && <span className="chibi-itile__qty">{entry.quantity}</span>}
                      {isEquipped && <span className="chibi-itile__eq">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Item detail: what it is, how it compares, and explicit actions. */}
            {selectedItem &&
              (() => {
                const entry = inventory.items.find((e) => e.itemId === selectedItem);
                if (!entry) return null;
                const item = getItemDefinition(entry.itemId);
                const gear = getGearStat(entry.itemId);
                const rarityColor = gear ? RARITY_COLORS[gear.rarity] : undefined;
                const isEquipped = equippedItemIds.has(entry.itemId);
                const cmp = compareRows(entry.itemId);
                const equippedSlot = (equipment?.slots ?? []).find((s) => s.itemId === entry.itemId)?.slot;
                return (
                  <div className="chibi-inv__detail">
                    <div className="chibi-inv__detail-head">
                      <span className="chibi-inv__detail-icon" style={rarityColor ? { borderColor: rarityColor } : undefined}>
                        {hasItemIcon(entry.itemId) ? (
                          <ItemIcon itemId={entry.itemId} size={36} />
                        ) : (
                          itemIcon(entry.itemId, item.kind)
                        )}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                          {item.name}
                          {entry.quantity > 1 && <span className="chibi-text-muted"> ×{entry.quantity}</span>}
                          {gear && (
                            <span className="chibi-rarity-chip" style={{ color: rarityColor }}>
                              {gear.rarity}
                            </span>
                          )}
                        </div>
                        <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 2, lineHeight: 1.4 }}>
                          {item.description}
                        </div>
                        {cmp && cmp.length > 0 && (
                          <div className="chibi-inv__cmp">
                            {cmp.map((r) => (
                              <span key={r.label} className={r.delta > 0 ? "up" : r.delta < 0 ? "down" : "same"}>
                                {r.icon} {r.text}
                                {r.delta !== 0 && (
                                  <span style={{ marginLeft: 2 }}>
                                    ({r.delta > 0 ? "▲" : "▼"}
                                    {Math.abs(r.delta) < 1 ? Math.abs(Math.round(r.delta * 100)) + "%" : Math.abs(Math.round(r.delta))})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {item.kind === "consumable" && (
                          <button
                            type="button"
                            className="chibi-btn chibi-btn--mint"
                            style={{ padding: "6px 14px", fontSize: "0.74rem" }}
                            disabled={pending}
                            onClick={() => quickAct(entry.itemId)}
                          >
                            Use
                          </button>
                        )}
                        {isEquippable(item.kind) && !isEquipped && (
                          <button
                            type="button"
                            className="chibi-btn chibi-btn--gold"
                            style={{ padding: "6px 14px", fontSize: "0.74rem" }}
                            disabled={pending}
                            onClick={() => quickAct(entry.itemId)}
                          >
                            Equip
                          </button>
                        )}
                        {isEquipped && equippedSlot && (
                          <button
                            type="button"
                            className="chibi-btn chibi-btn--secondary"
                            style={{ padding: "6px 14px", fontSize: "0.74rem" }}
                            disabled={pending}
                            onClick={() => void handleEquip(null, equippedSlot)}
                          >
                            Unequip
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
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
