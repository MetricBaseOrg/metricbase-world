import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { getHttpServerUrl } from "../game/serverUrl";
import { useGameStore } from "../store/gameStore";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { getStoredAccessToken } from "../wallet/tokenGate";

/**
 * Redeem a Telegram link code from inside the game.
 *
 * Linking is deliberately two-step (a code minted in Telegram, redeemed against
 * a wallet session) because the two proofs can't coexist in one browser
 * context. But step 2 lived only on /dashboard, and the ⚙️ menu links to /docs
 * and /stats — never /dashboard. On mobile, inside a wallet's in-app browser,
 * there is no address bar either, so the redemption step was simply
 * unreachable. Players reported exactly that.
 *
 * Same lesson as the reward-wallet card: if a flow is required to finish
 * something, it has to be reachable from where the player already is.
 */
export function TelegramLinkPanel() {
  const open = useGameStore((s) => s.telegramLinkOpen);
  const setOpen = useGameStore((s) => s.setTelegramLinkOpen);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    const token = getStoredAccessToken();
    if (!token) return;
    void (async () => {
      try {
        const r = await fetchWithTimeout(`${getHttpServerUrl()}/api/dashboard/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const d = (await r.json()) as { telegramLinked?: boolean };
        setLinked(Boolean(d.telegramLinked));
      } catch {
        /* status is a nicety; the action below still works */
      }
    })();
  }, [open]);

  if (!open) return null;

  const submit = async (unlink = false) => {
    const token = getStoredAccessToken();
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      const path = unlink ? "telegram-unlink" : "telegram-link";
      const r = await fetchWithTimeout(`${getHttpServerUrl()}/api/dashboard/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(unlink ? {} : { code }),
      });
      const b = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(b.error ?? "Could not update the Telegram link.");
      setLinked(!unlink);
      setCode("");
      setMsg({
        ok: true,
        text: unlink
          ? "Unlinked."
          : "✓ Linked! Open the Mini App and tap “Continue with Telegram” — you'll land straight in this character.",
      });
      playSfx("ui_open");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not update the Telegram link." });
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    playSfx("ui_close");
    setOpen(false);
  };

  return (
    <div className="chibi-overlay" style={{ zIndex: 100 }}>
      <div className="chibi-panel chibi-panel--modal" style={{ maxWidth: 440, position: "relative" }}>
        <div className="chibi-close-row">
          <div className="chibi-title chibi-title--sm chibi-sparkle-title">✈️ Link Telegram</div>
          <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {linked ? (
          <>
            <p style={{ fontSize: "0.82rem", lineHeight: 1.5, marginTop: 8 }}>
              ✓ Your Telegram account is linked. Open the Mini App and tap{" "}
              <b>Continue with Telegram</b> to play as this character — no wallet needed each time.
            </p>
            <button
              type="button"
              className="chibi-btn chibi-btn--secondary"
              style={{ width: "100%", marginTop: 10, padding: "9px 12px" }}
              onClick={() => void submit(true)}
              disabled={busy}
            >
              {busy ? "..." : "Unlink Telegram"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: "0.82rem", lineHeight: 1.5, marginTop: 8 }}>
              Play from inside Telegram without connecting your wallet every time.
            </p>
            <div className="chibi-card" style={{ padding: "10px 12px", margin: "10px 0", fontSize: "0.78rem" }}>
              <div>
                <b>1.</b> Open <b>t.me/MetricBaseWorldBot/play</b> in Telegram.
              </div>
              <div style={{ marginTop: 4 }}>
                <b>2.</b> Tap “Already play with a wallet? Link this Telegram”.
              </div>
              <div style={{ marginTop: 4 }}>
                <b>3.</b> Type the 6-character code here.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="chibi-input"
                style={{ flex: 1, fontFamily: "monospace", letterSpacing: 3, textTransform: "uppercase" }}
                value={code}
                maxLength={6}
                spellCheck={false}
                autoComplete="off"
                placeholder="ABC123"
                onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
              />
              <button
                type="button"
                className="chibi-btn chibi-btn--primary"
                style={{ padding: "9px 18px" }}
                onClick={() => void submit()}
                disabled={busy || code.length < 6}
              >
                {busy ? "..." : "Link"}
              </button>
            </div>
          </>
        )}

        {msg && (
          <p
            className="chibi-card"
            style={{
              margin: "10px 0 0",
              padding: "8px 12px",
              fontSize: "0.78rem",
              color: msg.ok ? "#7ed6df" : "#ff9d7a",
            }}
          >
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
