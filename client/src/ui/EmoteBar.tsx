import { EMOTES } from "@metricbase/shared";
import { useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

export function EmoteBar() {
  const [open, setOpen] = useState(false);
  const shopOpen = useGameStore((state) => state.shopOpen);
  const craftOpen = useGameStore((state) => state.craftOpen);
  const housingOpen = useGameStore((state) => state.housingOpen);

  if (shopOpen || craftOpen || housingOpen) return null;

  const sendEmote = (id: string) => {
    networkManager.sendEmote(id);
    playSfx("ui_click");
    setOpen(false);
  };

  return (
    <div className="chibi-emote-bar" aria-label="Emotes">
      {open && (
        <div className="chibi-emote-tray">
          {EMOTES.map((emote) => (
            <button
              key={emote.id}
              type="button"
              className="chibi-emote-btn"
              title={emote.label}
              aria-label={emote.label}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => sendEmote(emote.id)}
            >
              {emote.emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className={`chibi-emote-toggle${open ? " active" : ""}`}
        aria-label={open ? "Close emotes" : "Open emotes"}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          playSfx(open ? "ui_close" : "ui_open");
          setOpen((value) => !value);
        }}
      >
        😀
      </button>
    </div>
  );
}
