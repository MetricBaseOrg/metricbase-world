import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

interface RosterEntry {
  name: string;
  level: number;
  you: boolean;
}

export function WhoPanel() {
  const mobileLayout = useMobileLayout();
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<RosterEntry[]>([]);
  const [globalOnline, setGlobalOnline] = useState(() => networkManager.getWorldStats().online);

  useEffect(() => {
    const unsubscribe = networkManager.onPlayersChange((list, localId) => {
      setPlayers(
        list
          .map((p) => ({ name: p.name, level: p.level, you: p.sessionId === localId }))
          .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)),
      );
    });
    const unsubscribeStats = networkManager.onWorldStats((payload) => {
      setGlobalOnline(payload.online);
    });
    return () => {
      unsubscribe();
      unsubscribeStats();
    };
  }, []);

  // Global count across every zone; the zone roster is the floor while the
  // first worldStats broadcast is still in flight.
  const onlineCount = Math.max(globalOnline, players.length);

  return (
    <div className="chibi-who">
      <button
        type="button"
        className={`chibi-who-toggle${open ? " active" : ""}${mobileLayout ? " chibi-who-toggle--fab" : ""}`}
        aria-label={`Who's online (${onlineCount})`}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          playSfx(open ? "ui_close" : "ui_open");
          setOpen((value) => !value);
        }}
      >
        {mobileLayout ? (
          <>
            👥
            {onlineCount > 0 && (
              <span className="chibi-chat-fab__badge">{onlineCount}</span>
            )}
          </>
        ) : (
          <>👥 {onlineCount} online</>
        )}
      </button>
      {open && (
        <div className="chibi-who-list">
          <div className="chibi-who-title">Adventurers here</div>
          {players.map((p) => (
            <div key={p.name} className="chibi-who-row">
              <span
                className={`chibi-who-name${p.you ? "" : " chibi-chat-name-btn"}`}
                style={p.you ? undefined : { cursor: "pointer" }}
                onClick={p.you ? undefined : () => useGameStore.getState().setProfileFor(p.name)}
              >
                {p.name}
                {p.you ? " (you)" : ""}
              </span>
              <span className="chibi-who-lvl">Lv {p.level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
