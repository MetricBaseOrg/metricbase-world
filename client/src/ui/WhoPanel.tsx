import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";

interface RosterEntry {
  name: string;
  level: number;
  you: boolean;
}

export function WhoPanel() {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<RosterEntry[]>([]);

  useEffect(() => {
    const unsubscribe = networkManager.onPlayersChange((list, localId) => {
      setPlayers(
        list
          .map((p) => ({ name: p.name, level: p.level, you: p.sessionId === localId }))
          .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)),
      );
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="chibi-who">
      <button
        type="button"
        className={`chibi-who-toggle${open ? " active" : ""}`}
        aria-label="Who's online"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          playSfx(open ? "ui_close" : "ui_open");
          setOpen((value) => !value);
        }}
      >
        👥 {players.length} online
      </button>
      {open && (
        <div className="chibi-who-list">
          <div className="chibi-who-title">Adventurers here</div>
          {players.map((p) => (
            <div key={p.name} className="chibi-who-row">
              <span className="chibi-who-name">
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
