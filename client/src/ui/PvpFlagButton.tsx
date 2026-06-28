import { getDangerTierMeta } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

/**
 * PvP flag toggle. Only shown in PvP-enabled zones. In Yellow zones both
 * fighters must be flagged to fight; in Red/Black it's a readiness indicator.
 */
export function PvpFlagButton() {
  const zoneId = useGameStore((state) => state.zoneId);
  const spectator = useGameStore((state) => state.spectator);
  const knockedOut = useGameStore((state) => state.knockedOut);
  const [flagged, setFlagged] = useState(false);

  const meta = getDangerTierMeta(zoneId);

  // Reset the optimistic flag when leaving to a safe zone.
  useEffect(() => {
    if (!meta.pvp) setFlagged(false);
  }, [meta.pvp]);

  if (!meta.pvp || spectator || knockedOut) return null;

  const toggle = () => {
    const next = !flagged;
    setFlagged(next);
    networkManager.sendTogglePvpFlag(next);
    playSfx("ui_click");
  };

  return (
    <button
      type="button"
      className={`chibi-pvp-flag${flagged ? " active" : ""}`}
      onClick={toggle}
      onPointerDown={(event) => event.preventDefault()}
      title={flagged ? "PvP enabled — click to stand down" : "Flag for PvP"}
    >
      {flagged ? "⚔️ PvP ON" : "🛡️ PvP OFF"}
    </button>
  );
}
