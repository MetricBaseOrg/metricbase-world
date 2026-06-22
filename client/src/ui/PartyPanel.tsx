import { type PartyStatePayload } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { setUiTypingActive } from "../game/inputControl";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

export function PartyPanel() {
  const mobileLayout = useMobileLayout();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PartyStatePayload>({ party: null });
  const [invite, setInvite] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Track party state + incoming invites at all times so the invite banner can
  // pop even when the panel is closed.
  useEffect(() => {
    const unsubState = networkManager.onPartyState((payload) => setState(payload));
    const unsubInvite = networkManager.onPartyInvite((payload) => {
      playSfx("ui_open");
      setInvite(payload.fromName);
    });
    const unsubResult = networkManager.onPartyResult((payload) => {
      if (payload.ok) {
        setError(null);
        setTarget("");
      } else {
        playSfx("shop_fail");
        setError(payload.error ?? "Action failed.");
      }
    });
    networkManager.requestParty();
    return () => {
      unsubState();
      unsubInvite();
      unsubResult();
    };
  }, []);

  const party = state.party;
  const myName = useGameName();

  const accept = () => {
    playSfx("craft");
    networkManager.sendPartyAccept();
    setInvite(null);
    setOpen(true);
  };
  const decline = () => {
    networkManager.sendPartyDecline();
    setInvite(null);
  };

  return (
    <>
      {invite && (
        <div className="chibi-party-invite">
          <span>
            <strong>{invite}</strong> invited you to a party.
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="chibi-btn chibi-btn--primary" style={{ padding: "4px 10px", fontSize: "0.74rem" }} onClick={accept}>
              Accept
            </button>
            <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "4px 10px", fontSize: "0.74rem" }} onClick={decline}>
              Decline
            </button>
          </div>
        </div>
      )}

      <div className="chibi-party">
        <button
          type="button"
          className={`chibi-who-toggle${open ? " active" : ""}${mobileLayout ? " chibi-who-toggle--fab" : ""}`}
          aria-label="Party"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            playSfx(open ? "ui_close" : "ui_open");
            setOpen((v) => !v);
          }}
        >
          {mobileLayout ? "🎉" : party ? `🎉 Party (${party.members.length})` : "🎉 Party"}
        </button>

        {open && (
          <div className="chibi-who-list" style={{ width: 224 }}>
            {party ? (
              <>
                <div className="chibi-who-title">Your Party</div>
                {party.members.map((member) => (
                  <div key={member} className="chibi-who-row">
                    <span className="chibi-who-name">
                      {member}
                      {member === party.leaderName ? " 👑" : ""}
                      {member === myName ? " (you)" : ""}
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  className="chibi-btn chibi-btn--secondary"
                  style={{ marginTop: 8, width: "100%", padding: "6px 10px", fontSize: "0.76rem" }}
                  onClick={() => networkManager.sendPartyLeave()}
                >
                  Leave Party
                </button>
              </>
            ) : (
              <div className="chibi-text-muted" style={{ fontSize: "0.78rem", marginBottom: 6 }}>
                Invite someone by name to start a party.
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                className="chibi-input"
                value={target}
                maxLength={16}
                placeholder="Player name"
                onChange={(e) => setTarget(e.target.value)}
                onFocus={() => setUiTypingActive(true)}
                onBlur={() => setUiTypingActive(false)}
                style={{ flex: 1, padding: "6px 8px", fontSize: "0.8rem" }}
                aria-label="Player to invite"
              />
              <button
                type="button"
                className="chibi-btn chibi-btn--primary"
                disabled={!target.trim()}
                style={{ padding: "6px 10px", fontSize: "0.76rem" }}
                onClick={() => networkManager.sendPartyInvite(target.trim())}
              >
                Invite
              </button>
            </div>

            {error && (
              <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, fontSize: "0.74rem" }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function useGameName(): string {
  return useGameStore((s) => s.playerName);
}
