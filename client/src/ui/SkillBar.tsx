import { useCallback, useEffect, useRef, useState } from "react";
import { ATTACK_COOLDOWN_MS, CONSUMABLE_HEAL, getAbilitiesForWeapon } from "@metricbase/shared";
import { playSfx } from "../audio/soundEffects";
import {
  isUiTypingActive,
  triggerAbility,
  triggerPrimaryAttack,
} from "../game/inputControl";
import { networkManager } from "../game/network";
import { isAnyPanelOpen, useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

/** Emoji per heal consumable for the quick-slot. */
const CONSUMABLE_ICONS: Record<string, string> = {
  item_health_potion: "🧪",
  item_bread: "🍞",
  item_cooked_fish: "🐟",
  item_grilled_salmon: "🍣",
};

/**
 * Combat hotbar. The primary "Strike" slot fires the basic attack; the
 * remaining slots are the abilities granted by the equipped weapon (swap your
 * weapon, swap your kit). Cooldowns animate as a conic sweep. WASD movement +
 * Space/right-click attack remain untouched.
 */
interface RenderSlot {
  id: string;
  keyLabel: string;
  keyCode: string | null;
  name: string;
  icon: string;
  cooldownMs: number;
  /** null = primary basic attack; otherwise a weapon ability id. */
  abilityId: string | null;
}

export function SkillBar() {
  const mobile = useMobileLayout();
  const spectator = useGameStore((state) => state.spectator);
  const knockedOut = useGameStore((state) => state.knockedOut);
  const panelOpen = useGameStore(isAnyPanelOpen);
  const worldEditing = useGameStore((state) => state.worldEditing);
  const equippedWeaponId = useGameStore((state) => state.equippedWeaponId);
  const inventory = useGameStore((state) => state.inventory);

  // Best heal consumable on hand (highest heal you actually carry) for the quick-slot.
  let bestConsumable: { itemId: string; quantity: number; heal: number } | null = null;
  for (const entry of inventory.items) {
    const heal = CONSUMABLE_HEAL[entry.itemId];
    if (heal && (!bestConsumable || heal > bestConsumable.heal)) {
      bestConsumable = { itemId: entry.itemId, quantity: entry.quantity, heal };
    }
  }

  const cooldowns = useRef<Map<string, { endsAt: number; durationMs: number }>>(new Map());
  const [, forceTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const [shake, setShake] = useState<string | null>(null);

  const slots: RenderSlot[] = [
    {
      id: "primary",
      keyLabel: "RMB",
      keyCode: null,
      name: "Strike",
      icon: "⚔️",
      cooldownMs: ATTACK_COOLDOWN_MS,
      abilityId: null,
    },
    ...getAbilitiesForWeapon(equippedWeaponId).map((ability) => ({
      id: ability.id,
      keyLabel: ability.key,
      keyCode: ability.key,
      name: ability.name,
      icon: ability.icon,
      cooldownMs: ability.cooldownMs,
      abilityId: ability.id,
    })),
  ];

  const animate = useCallback(() => {
    const now = Date.now();
    for (const [id, cd] of cooldowns.current) {
      if (now >= cd.endsAt) cooldowns.current.delete(id);
    }
    forceTick((value) => (value + 1) & 0xffff);
    rafRef.current = cooldowns.current.size > 0 ? requestAnimationFrame(animate) : null;
  }, []);

  const startCooldown = useCallback(
    (id: string, durationMs: number) => {
      cooldowns.current.set(id, { endsAt: Date.now() + durationMs, durationMs });
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(animate);
    },
    [animate],
  );

  const activate = useCallback(
    (slot: RenderSlot) => {
      if (cooldowns.current.has(slot.id)) return;
      const fired = slot.abilityId === null ? (triggerPrimaryAttack(), true) : triggerAbility(slot.abilityId);
      if (!fired) {
        // No valid target in range — nudge the player rather than burn the cooldown.
        playSfx("shop_fail");
        setShake(slot.id);
        window.setTimeout(() => setShake((current) => (current === slot.id ? null : current)), 260);
        return;
      }
      playSfx("attack_swing");
      startCooldown(slot.id, slot.cooldownMs);
    },
    [startCooldown],
  );

  const useConsumable = useCallback(() => {
    if (cooldowns.current.has("consumable")) return;
    const best = bestConsumable;
    if (!best) {
      playSfx("shop_fail");
      setShake("consumable");
      window.setTimeout(() => setShake((c) => (c === "consumable" ? null : c)), 260);
      return;
    }
    networkManager.sendUseItem(best.itemId);
    playSfx("item_use");
    startCooldown("consumable", 1000);
  }, [bestConsumable, startCooldown]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isUiTypingActive() || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "t") {
        useConsumable();
        return;
      }
      const slot = slots.find((entry) => entry.keyCode === key);
      if (slot) activate(slot);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // slots are recomputed each render from equippedWeaponId; activate is stable.
  }, [activate, useConsumable, equippedWeaponId]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (spectator || knockedOut) return null;
  if (panelOpen || worldEditing) return null;

  const now = Date.now();

  return (
    <div className={`chibi-skillbar${mobile ? " is-mobile" : ""}`} aria-label="Combat skills">
      {slots.map((slot) => {
        const cd = cooldowns.current.get(slot.id);
        const remaining = cd ? Math.max(0, cd.endsAt - now) : 0;
        const progress = cd ? remaining / cd.durationMs : 0;
        const sweepDeg = progress * 360;
        const secondsLeft = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
        return (
          <button
            key={slot.id}
            type="button"
            className={`chibi-skill-slot${slot.id === "primary" ? " primary" : ""}${shake === slot.id ? " shake" : ""}`}
            title={`${slot.name} (${slot.keyLabel})`}
            aria-label={`${slot.name} ${slot.keyLabel}`}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => activate(slot)}
          >
            <span className="chibi-skill-icon" aria-hidden="true">
              {slot.icon}
            </span>
            <span className="chibi-skill-key">{slot.keyLabel}</span>
            {remaining > 0 && (
              <span
                className="chibi-skill-cooldown"
                style={{ background: `conic-gradient(rgba(20,12,8,0.62) ${sweepDeg}deg, transparent 0deg)` }}
              >
                <span className="chibi-skill-cooldown-text">{secondsLeft}</span>
              </span>
            )}
          </button>
        );
      })}

      {/* Consumable quick-slot — uses your best heal item on hand. */}
      {(() => {
        const cd = cooldowns.current.get("consumable");
        const remaining = cd ? Math.max(0, cd.endsAt - now) : 0;
        const icon = bestConsumable ? CONSUMABLE_ICONS[bestConsumable.itemId] ?? "🍖" : "🍖";
        return (
          <button
            type="button"
            className={`chibi-skill-slot consumable${bestConsumable ? "" : " locked"}${shake === "consumable" ? " shake" : ""}`}
            title={bestConsumable ? `Use heal item (T)` : "No heal items"}
            aria-label="Use consumable"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => useConsumable()}
          >
            <span className="chibi-skill-icon" aria-hidden="true">{icon}</span>
            <span className="chibi-skill-key">T</span>
            {bestConsumable && <span className="chibi-skill-count">{bestConsumable.quantity}</span>}
            {remaining > 0 && (
              <span
                className="chibi-skill-cooldown"
                style={{ background: `conic-gradient(rgba(20,12,8,0.62) ${(remaining / 1000) * 360}deg, transparent 0deg)` }}
              />
            )}
          </button>
        );
      })()}
    </div>
  );
}
