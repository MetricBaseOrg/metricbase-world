// The bridge between the world and /board.
//
// District Deeds runs on its own page, so the in-world table is a doorway, not
// a game. It does the one thing that can ONLY be done from inside the world:
// move gold into the table bank. ZoneRoom is authoritative over live gold, so a
// standalone page debiting `characters.gold` directly would be silently
// overwritten the next time this room persisted the player.
//
// The handoff navigates IN PLACE. The access token lives in sessionStorage and
// a noopener tab does not inherit it, which would strand a Telegram-only player
// on a page they cannot sign into.

import { useEffect, useState } from "react";

import { networkManager } from "../game/network";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";

export function BoardHandoffModal() {
  // Store-backed rather than local state so the flag can join isAnyPanelOpen —
  // a panel missing from that list gets covered by the HUD, which is the
  // classic bug in this codebase.
  const open = useGameStore((s) => s.boardHandoffOpen);
  const onClose = () => useGameStore.getState().setBoardHandoffOpen(false);
  const [gold, setGold] = useState<number | null>(null);
  const [bank, setBank] = useState<number | null>(null);
  const [amount, setAmount] = useState(10000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const offState = networkManager.onBoardBankState((p) => {
      setGold(p.gold);
      setBank(p.bank);
    });
    const offResult = networkManager.onBoardBankResult((p) => {
      setBusy(false);
      if (!p.ok) return setError(p.error ?? "That didn't go through.");
      setError(null);
      setMoved(p.moved ?? 0);
      if (typeof p.gold === "number") setGold(p.gold);
      if (typeof p.bank === "number") setBank(p.bank);
      playSfx("ui_click");
    });
    networkManager.sendBoardBankState();
    return () => {
      offState();
      offResult();
    };
  }, [open]);

  if (!open) return null;

  const fund = () => {
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter an amount above zero.");
    setBusy(true);
    setError(null);
    // A fresh id per press: the server keys idempotency on it, so a double-tap
    // (two clicks per tap is normal on touch) can't move the gold twice.
    networkManager.sendBoardBankFund(Math.floor(amount), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  };

  return (
    <div className="chibi-overlay" style={{ position: "fixed", inset: 0, zIndex: 42, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(61,43,31,.55)" }}>
      <div className="chibi-panel" style={{ maxWidth: 420, width: "92%", padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>🎲 District Deeds</h2>
        <p style={{ fontSize: "0.88rem", lineHeight: 1.5 }}>
          A property board game — buy districts, charge rent, and be the last one standing. It opens on its own
          page because a table runs the best part of an hour.
        </p>
        <p style={{ fontSize: "0.85rem", opacity: 0.85 }}>
          Deeds and credits on the board exist only inside that game. They grant nothing out here.
        </p>

        <div style={{ margin: "12px 0", fontSize: "0.9rem" }}>
          <div>Your gold: <strong>{gold === null ? "…" : gold.toLocaleString()}</strong></div>
          <div>In the table bank: <strong>{bank === null ? "…" : bank.toLocaleString()}</strong></div>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem" }}>
          <span>Move gold to the table bank</span>
          <input
            type="number"
            className="chibi-input"
            min={1}
            max={gold ?? undefined}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>

        {error && <p style={{ color: "#e07a5f", fontSize: "0.85rem" }}>{error}</p>}
        {moved !== null && !error && (
          <p style={{ color: "#6ac48a", fontSize: "0.85rem" }}>
            Moved {moved.toLocaleString()} gold. You can take it back out from the board page any time you're not
            sat at a table.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button className="chibi-btn" disabled={busy || !gold} onClick={fund}>
            Move gold
          </button>
          <button
            className="chibi-btn chibi-btn--gold"
            onClick={() => {
              playSfx("ui_click");
              window.location.assign("/board");
            }}
          >
            Open District Deeds →
          </button>
          <button className="chibi-btn chibi-btn--ghost" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
