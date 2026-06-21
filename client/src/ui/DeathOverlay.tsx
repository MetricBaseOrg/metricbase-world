import { RESPAWN_GOLD_COST } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function DeathOverlay() {
  const knockedOut = useGameStore((state) => state.knockedOut);
  const freeRespawnAt = useGameStore((state) => state.freeRespawnAt);
  const playerGold = useGameStore((state) => state.playerGold);
  const setProfile = useGameStore((state) => state.setProfile);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!knockedOut) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [knockedOut, freeRespawnAt]);

  if (!knockedOut) return null;

  const remainingMs = freeRespawnAt ? Math.max(0, freeRespawnAt - now) : 0;
  const canRespawnFree = remainingMs <= 0;
  const canPayGold = playerGold >= RESPAWN_GOLD_COST;

  const handleRespawn = async (payGold: boolean) => {
    setPending(true);
    setError(null);
    networkManager.sendRequestRespawn(payGold);
    const result = await new Promise<{
      ok: boolean;
      error?: string;
      gold?: number;
      hp?: number;
      maxHp?: number;
      knockedOut?: boolean;
      freeRespawnAt?: number | null;
    }>((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: "Respawn request timed out." }), 8000);
      const unsubscribe = networkManager.onRespawnResult((payload) => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(payload);
      });
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Could not respawn.");
      playSfx("shop_fail");
      return;
    }

    playSfx("respawn");
    const store = useGameStore.getState();
    setProfile(
      store.playerLevel,
      store.playerXp,
      result.gold,
      result.hp,
      result.maxHp,
      store.equippedWeaponId,
      result.knockedOut ?? false,
      result.freeRespawnAt ?? null,
    );
  };

  return (
    <div className="chibi-death-overlay" style={{ pointerEvents: "auto" }}>
      <div className="chibi-panel chibi-panel--death">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">Knocked Out</div>
        <p className="chibi-subtitle" style={{ marginTop: 10, lineHeight: 1.5 }}>
          You were defeated in combat. Pay <strong>{RESPAWN_GOLD_COST} gold</strong> to respawn now, or wait{" "}
          <strong>30 minutes</strong> for a free respawn.
        </p>

        <div className="chibi-card chibi-card--gold" style={{ marginTop: 14, fontWeight: 800 }}>
          Your gold: 🪙 {playerGold}
        </div>

        <div className="chibi-card" style={{ marginTop: 10, textAlign: "center", fontWeight: 700 }}>
          {canRespawnFree ? "Free respawn is ready!" : `Free respawn in ${formatCountdown(remainingMs)}`}
        </div>

        {error && (
          <div className="chibi-card chibi-card--error" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="chibi-btn chibi-btn--mint"
            disabled={pending || !canPayGold}
            onClick={() => void handleRespawn(true)}
          >
            Pay {RESPAWN_GOLD_COST} Gold to Respawn
          </button>
          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            disabled={pending || !canRespawnFree}
            onClick={() => void handleRespawn(false)}
          >
            Respawn for Free
          </button>
        </div>
      </div>
    </div>
  );
}