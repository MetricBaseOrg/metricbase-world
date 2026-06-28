import { useCallback, useEffect, useRef, useState } from "react";
import { ATTACK_COOLDOWN_MS } from "@metricbase/shared";
import { playSfx } from "../audio/soundEffects";
import { triggerPrimaryAttack } from "../game/inputControl";
import { isUiTypingActive } from "../game/inputControl";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

/**
 * Combat hotbar (Phase 0 shell). The primary "Strike" slot fires the real
 * basic attack; weapon skill slots (1–5 / Q / E / R) are placeholders that
 * light up and animate cooldowns now — they bind to weapon-driven abilities in
 * Phase 1. Keeps WASD movement + Space/right-click attack untouched.
 */
interface SkillSlot {
  /** Stable id used for cooldown tracking. */
  id: string;
  /** Keybind label shown on the slot. */
  keyLabel: string;
  /** Lowercased keyboard key that triggers it, or null for the primary slot. */
  keyCode: string | null;
  name: string;
  icon: string;
  cooldownMs: number;
  /** Phase 1+ ability — visually locked until the ability system lands. */
  locked?: boolean;
}

const SLOTS: SkillSlot[] = [
  { id: "primary", keyLabel: "RMB", keyCode: null, name: "Strike", icon: "⚔️", cooldownMs: ATTACK_COOLDOWN_MS },
  { id: "skill1", keyLabel: "1", keyCode: "1", name: "Slash", icon: "🗡️", cooldownMs: 4000, locked: true },
  { id: "skill2", keyLabel: "2", keyCode: "2", name: "Charge", icon: "💨", cooldownMs: 6000, locked: true },
  { id: "skill3", keyLabel: "3", keyCode: "3", name: "Spin", icon: "🌀", cooldownMs: 8000, locked: true },
  { id: "skill4", keyLabel: "4", keyCode: "4", name: "Guard", icon: "🛡️", cooldownMs: 10000, locked: true },
  { id: "skill5", keyLabel: "5", keyCode: "5", name: "Quake", icon: "💥", cooldownMs: 15000, locked: true },
  { id: "dash", keyLabel: "Q", keyCode: "q", name: "Dash", icon: "🌬️", cooldownMs: 5000, locked: true },
  { id: "utility", keyLabel: "E", keyCode: "e", name: "Utility", icon: "✨", cooldownMs: 7000, locked: true },
  { id: "ultimate", keyLabel: "R", keyCode: "r", name: "Ultimate", icon: "🔥", cooldownMs: 30000, locked: true },
];

export function SkillBar() {
  const mobile = useMobileLayout();
  const spectator = useGameStore((state) => state.spectator);
  const knockedOut = useGameStore((state) => state.knockedOut);
  const shopOpen = useGameStore((state) => state.shopOpen);
  const craftOpen = useGameStore((state) => state.craftOpen);
  const housingOpen = useGameStore((state) => state.housingOpen);
  const playerShopOpen = useGameStore((state) => state.playerShopOpen);

  // Map of slot id -> { endsAt, durationMs }. Drives the cooldown sweep.
  const cooldowns = useRef<Map<string, { endsAt: number; durationMs: number }>>(new Map());
  const [, forceTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const [shake, setShake] = useState<string | null>(null);

  const animate = useCallback(() => {
    const now = Date.now();
    for (const [id, cd] of cooldowns.current) {
      if (now >= cd.endsAt) cooldowns.current.delete(id);
    }
    forceTick((value) => (value + 1) & 0xffff);
    rafRef.current = cooldowns.current.size > 0 ? requestAnimationFrame(animate) : null;
  }, []);

  const startCooldown = useCallback(
    (slot: SkillSlot) => {
      cooldowns.current.set(slot.id, { endsAt: Date.now() + slot.cooldownMs, durationMs: slot.cooldownMs });
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(animate);
    },
    [animate],
  );

  const activate = useCallback(
    (slot: SkillSlot) => {
      if (cooldowns.current.has(slot.id)) return;
      if (slot.locked) {
        // Not yet implemented — give clear feedback without faking a cast.
        playSfx("shop_fail");
        setShake(slot.id);
        window.setTimeout(() => setShake((current) => (current === slot.id ? null : current)), 260);
        return;
      }
      triggerPrimaryAttack();
      playSfx("attack_swing");
      startCooldown(slot);
    },
    [startCooldown],
  );

  // Keyboard activation for skill slots (respects the typing guard).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isUiTypingActive() || event.repeat) return;
      const key = event.key.toLowerCase();
      const slot = SLOTS.find((entry) => entry.keyCode === key);
      if (slot) activate(slot);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activate]);

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
      {SLOTS.map((slot) => {
        const cd = cooldowns.current.get(slot.id);
        const remaining = cd ? Math.max(0, cd.endsAt - now) : 0;
        const progress = cd ? remaining / cd.durationMs : 0;
        const sweepDeg = progress * 360;
        const secondsLeft = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
        return (
          <button
            key={slot.id}
            type="button"
            className={`chibi-skill-slot${slot.locked ? " locked" : ""}${slot.id === "primary" ? " primary" : ""}${shake === slot.id ? " shake" : ""}`}
            title={slot.locked ? `${slot.name} — unlocks in Phase 1` : `${slot.name} (${slot.keyLabel})`}
            aria-label={`${slot.name} ${slot.keyLabel}`}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => activate(slot)}
          >
            <span className="chibi-skill-icon" aria-hidden="true">
              {slot.icon}
            </span>
            <span className="chibi-skill-key">{slot.keyLabel}</span>
            {slot.locked && <span className="chibi-skill-lock" aria-hidden="true">🔒</span>}
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
