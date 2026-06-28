import { type SiegeStatePayload } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { networkManager } from "../game/network";

/**
 * Compact Castle Siege indicator: a live banner with King Crystal HP while a
 * siege window is open, otherwise a small crown chip naming the reigning
 * Sovereign guild.
 */
export function SiegeBanner() {
  const [siege, setSiege] = useState<SiegeStatePayload | null>(null);

  useEffect(() => {
    const off = networkManager.onSiegeState((payload) => setSiege(payload));
    return () => {
      off();
    };
  }, []);

  if (!siege) return null;
  const pct = siege.maxHp > 0 ? Math.max(0, Math.round((siege.hp / siege.maxHp) * 100)) : 0;

  if (siege.active) {
    return (
      <div className="chibi-siege-banner">
        ⚔️ CASTLE SIEGE LIVE · King Crystal {pct}%
        <span className="chibi-siege-sub">Strike it in the Obsidian Reach!</span>
      </div>
    );
  }

  if (siege.sovereignTag) {
    return <div className="chibi-siege-chip">👑 Sovereign: [{siege.sovereignTag}]</div>;
  }

  return null;
}
