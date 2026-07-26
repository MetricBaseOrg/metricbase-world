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
import {
  SEASON_POST_REQUIRED_TAG,
  seasonPostText,
  type SeasonStatePayload,
} from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { getHttpServerUrl } from "../game/serverUrl";
import { openExternalLink } from "../telegram/telegramApp";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { getStoredAccessToken } from "../wallet/tokenGate";

const POLL_TIMEOUT_MS = 150_000;
const POLL_EVERY_MS = 2500;
/** Kept in sync with SeasonShareModal's PLAY_URL. */
const PLAY_URL = "world.metricbase.org";

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

  // Step 2 of 2 — linked, but a verified post is still outstanding.
  if (season.xLinked && season.postRequiredForReward && !season.posted) {
    return <SeasonPostStep season={season} />;
  }

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
      <div style={{ fontWeight: 800, fontSize: "0.78rem" }}>
        𝕏 Step 1 of {season.postRequiredForReward ? "2" : "1"} — connect X
      </div>
      <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
        Season {season.seasonNumber} rewards are paid to players with a connected X account
        {season.postRequiredForReward ? " who share their season" : ""}. Connecting is free, takes
        one tap, and also pays <b>+50 season points</b> the first time.
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

/**
 * Step 2: publish a post about the season and paste the link back.
 *
 * We hand them the exact copy (with their code already in it) rather than asking
 * them to compose something, for two reasons: the code and the
 * SEASON_POST_REQUIRED_TAG must both be present for verification to pass, and
 * the wording has to make clear they're collecting a reward — the post is
 * compensated, so it needs to read as an endorsement, not a spontaneous rave.
 */
function SeasonPostStep({ season }: { season: SeasonStatePayload }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const off = networkManager.onSeasonPostResult((r) => {
      setBusy(false);
      setNotice(r.ok ? r.message ?? "Verified!" : r.error ?? "Couldn't verify that post.");
      if (r.ok) {
        playSfx("ui_open");
        setUrl("");
      }
    });
    return () => {
      off();
    };
  }, []);

  const text = seasonPostText(season.seasonNumber, season.postCode, PLAY_URL);

  const openCompose = () => {
    playSfx("ui_click");
    openExternalLink(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, true);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Couldn't copy — select the text above manually.");
    }
  };

  const submit = () => {
    if (!url.trim()) return setNotice("Paste the link to your post first.");
    playSfx("ui_click");
    setBusy(true);
    setNotice(null);
    networkManager.sendSeasonPostVerify(url.trim());
  };

  return (
    <div
      className="chibi-card"
      style={{ marginTop: 10, padding: "10px 12px", borderColor: "#C9A84C", background: "rgba(201,168,76,0.10)" }}
    >
      <div style={{ fontWeight: 800, fontSize: "0.78rem" }}>📢 Step 2 of 2 — share your season</div>
      <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
        Post this on X as <b>@{season.xUsername}</b>, then paste the link back here. Your code{" "}
        <b style={{ fontFamily: "monospace" }}>{season.postCode}</b> and {SEASON_POST_REQUIRED_TAG}{" "}
        must stay in the post — that's how we verify it's yours.
      </div>
      <div
        style={{
          marginTop: 8,
          padding: "8px 10px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.05)",
          fontSize: "0.68rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          className="chibi-btn chibi-btn--gold"
          style={{ flex: 1, padding: "9px 12px", fontWeight: 800 }}
          onClick={openCompose}
        >
          𝕏 Post it
        </button>
        <button
          type="button"
          className="chibi-btn chibi-btn--secondary"
          style={{ padding: "9px 12px" }}
          onClick={() => void copyText()}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          className="chibi-input"
          style={{ flex: 1, fontSize: "0.72rem" }}
          placeholder="https://x.com/you/status/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="button"
          className="chibi-btn chibi-btn--primary"
          style={{ padding: "9px 12px" }}
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Checking…" : "Verify"}
        </button>
      </div>
      <div className="chibi-text-muted" style={{ fontSize: "0.64rem", marginTop: 6 }}>
        Your {season.points.toLocaleString()} points and your share are held for you until this is
        done — nothing is lost, and nobody else's share grows.
      </div>
      {notice && (
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
          {notice}
        </div>
      )}
    </div>
  );
}
