import { type DuelStartPayload } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

/**
 * Duel UI: a "Duel" button on a targeted player, an accept/decline invite
 * prompt, a live duel banner with countdown, and a result toast.
 */
export function DuelControls() {
  const selectedPlayer = useGameStore((s) => s.selectedPlayer);
  const playerName = useGameStore((s) => s.playerName);
  const knockedOut = useGameStore((s) => s.knockedOut);
  const spectator = useGameStore((s) => s.spectator);

  const [invite, setInvite] = useState<string | null>(null);
  const [duel, setDuel] = useState<DuelStartPayload | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [, tick] = useState(0);
  const resultTimer = useRef<number | null>(null);

  useEffect(() => {
    const offInvite = networkManager.onDuelInvite((p) => {
      playSfx("notify");
      setInvite(p.fromName);
      useGameStore.getState().addNotification("🤺", `${p.fromName} challenged you to a duel`);
    });
    const offStart = networkManager.onDuelStart((p) => {
      playSfx("level_up");
      setInvite(null);
      setResult(null);
      setDuel(p);
    });
    const offEnd = networkManager.onDuelEnd((p) => {
      setDuel(null);
      setResult(p.result === "win" ? "🏅 You won the duel!" : p.result === "loss" ? "Defeated in the duel." : "Duel drawn.");
      playSfx(p.result === "win" ? "quest_complete" : "ui_close");
      if (resultTimer.current) window.clearTimeout(resultTimer.current);
      resultTimer.current = window.setTimeout(() => setResult(null), 4000);
    });
    return () => {
      offInvite();
      offStart();
      offEnd();
    };
  }, []);

  // Drive the duel countdown.
  useEffect(() => {
    if (!duel) return;
    const id = window.setInterval(() => tick((n) => (n + 1) & 0xffff), 1000);
    return () => window.clearInterval(id);
  }, [duel]);

  const canChallenge =
    !!selectedPlayer && selectedPlayer !== playerName && !duel && !knockedOut && !spectator;

  return (
    <>
      {/* Challenge button on the current target */}
      {canChallenge && (
        <button
          type="button"
          className="chibi-duel-challenge"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            networkManager.sendDuelChallenge(selectedPlayer!);
            playSfx("ui_click");
          }}
        >
          ⚔️ Duel {selectedPlayer}
        </button>
      )}

      {/* Incoming challenge */}
      {invite && (
        <div className="chibi-overlay-scrim" role="dialog" aria-label="Duel challenge">
          <div className="chibi-panel chibi-panel--floating" style={{ maxWidth: 320, textAlign: "center" }}>
            <div className="chibi-title chibi-title--sm">⚔️ Duel Challenge</div>
            <p style={{ margin: "12px 0", fontSize: "0.9rem" }}>
              <strong>{invite}</strong> challenges you to a duel — no loot, just glory.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="chibi-btn chibi-btn--secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  networkManager.sendDuelRespond(invite, false);
                  setInvite(null);
                }}
              >
                Decline
              </button>
              <button
                type="button"
                className="chibi-btn chibi-btn--danger"
                style={{ flex: 1 }}
                onClick={() => {
                  networkManager.sendDuelRespond(invite, true);
                  setInvite(null);
                }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active duel banner */}
      {duel && (
        <div className="chibi-duel-banner">
          ⚔️ DUEL vs {duel.opponent}
          <span className="chibi-siege-sub">
            {Math.max(0, Math.ceil((duel.endsAt - Date.now()) / 1000))}s left · attack to win
          </span>
        </div>
      )}

      {/* Result toast */}
      {result && !duel && <div className="chibi-duel-result">{result}</div>}
    </>
  );
}
