import { useCallback, useEffect, useRef, useState } from "react";
import { ATTACK_COOLDOWN_MS, getAbilitiesForWeapon } from "@metricbase/shared";
import { playSfx } from "../audio/soundEffects";
import {
  isUiTypingActive,
  triggerAbility,
  triggerPrimaryAttack,
} from "../game/inputControl";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

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
  const shopOpen = useGameStore((state) => state.shopOpen);
  const craftOpen = useGameStore((state) => state.craftOpen);
  const housingOpen = useGameStore((state) => state.housingOpen);
  const playerShopOpen = useGameStore((state) => state.playerShopOpen);
  const equippedWeaponId = useGameStore((state) => state.equippedWeaponId);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isUiTypingActive() || event.repeat) return;
      const key = event.key.toLowerCase();
      const slot = slots.find((entry) => entry.keyCode === key);
      if (slot) activate(slot);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // slots are recomputed each render from equippedWeaponId; activate is stable.
  }, [activate, equippedWeaponId]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (mobile || spectator || knockedOut) return null;
  if (shopOpen || craftOpen || housingOpen || playerShopOpen) return null;

  const now = Date.now();

  return (
    <div className="chibi-skillbar" aria-label="Combat skills">
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
    </div>
  );
}
