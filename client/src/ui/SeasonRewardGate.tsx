// "Connect X to receive your Season reward" — the in-game half of
// SEASON_REWARD_REQUIRES_X (see shared/src/season.ts).
//
// This card exists so the requirement is never a surprise. The payout is PUSHED
// by an admin, not claimed by the player, so someone who never links would
// otherwise just quietly not be paid. Showing it here, every time they open the
// Season panel, is what makes the gate fair.
//
// It only renders when the server says X connect is actually configured
// (`xRequiredForReward`), so it can never nag for something impossible.
//
// Connect flow mirrors DashboardPage: open X sign-in in whatever browser the
// shell allows, keep THIS view open, and poll /x/status until the link lands —
// the OAuth redirect coming back to this exact webview is unreliable on Android.
import { type SeasonStatePayload } from "@metricbase/shared";
import { useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { getHttpServerUrl } from "../game/serverUrl";
import { openExternalLink } from "../telegram/telegramApp";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { getStoredAccessToken } from "../wallet/tokenGate";

const POLL_TIMEOUT_MS = 150_000;
const POLL_EVERY_MS = 2500;

export function SeasonRewardGate({
  season,
  onLinked,
}: {
  season: SeasonStatePayload;
  onLinked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);

  // Nothing to ask for: either the season doesn't gate on X, or the server has
  // no X app configured and the payout correspondingly doesn't enforce it.
  if (!season.xRequiredForReward) return null;

  if (season.xLinked) {
    return (
      <div
        className="chibi-card"
        style={{ marginTop: 10, padding: "10px 12px", borderColor: "#4FB8A8", background: "rgba(79,184,168,0.08)" }}
      >
        <div style={{ fontWeight: 800, fontSize: "0.78rem" }}>
          ✅ Ready to be paid{season.xUsername ? ` — @${season.xUsername}` : ""}
        </div>
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
          Your Season {season.seasonNumber} reward can be sent to your wallet.
        </div>
      </div>
    );
  }

  const connect = async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("Connect your wallet first — the X link attaches to your character.");
      return;
    }
    playSfx("ui_click");
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${getHttpServerUrl()}/api/x/link/start`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? "Couldn't start X connect.");
      // New tab / Custom Tab / Telegram external browser — never navigates away
      // from the game, so the poll below keeps running.
      openExternalLink(body.url, true);
      poll(token);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't connect X.");
    }
  };

  const poll = (token: string) => {
    if (polling.current) return;
    polling.current = true;
    const startedAt = Date.now();
    const tick = async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        polling.current = false;
        setBusy(false);
        setError("Didn't detect the connection. If you finished on X, reopen this panel.");
        return;
      }
      try {
        const res = await fetchWithTimeout(`${getHttpServerUrl()}/api/x/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as { linked?: boolean };
        if (body.linked) {
          polling.current = false;
          setBusy(false);
          playSfx("ui_open");
          // Re-read season state so xLinked flips and the card becomes the
          // "ready to be paid" confirmation, then let the parent celebrate.
          networkManager.requestSeasonState();
          onLinked();
          return;
        }
      } catch {
        /* transient — keep polling until the timeout */
      }
      window.setTimeout(() => void tick(), POLL_EVERY_MS);
    };
    window.setTimeout(() => void tick(), POLL_EVERY_MS);
  };

  return (
    <div
      className="chibi-card"
      style={{ marginTop: 10, padding: "10px 12px", borderColor: "#C9A84C", background: "rgba(201,168,76,0.10)" }}
    >
      <div style={{ fontWeight: 800, fontSize: "0.78rem" }}>𝕏 Connect X to receive your reward</div>
      <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
        Season {season.seasonNumber} rewards are paid to players with a connected X account. It's
        free, takes one tap, and also pays <b>+50 season points</b> the first time.
        {season.points > 0 && (
          <>
            {" "}
            Your <b>{season.points.toLocaleString()} points</b> are safe either way — your share is
            held, not given away, until you connect.
          </>
        )}
      </div>
      <button
        type="button"
        className="chibi-btn chibi-btn--gold"
        style={{ width: "100%", padding: "9px 12px", marginTop: 8, fontWeight: 800 }}
        onClick={() => void connect()}
        disabled={busy}
      >
        {busy ? "Waiting for X…" : "𝕏 Connect X"}
      </button>
      {error && (
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
