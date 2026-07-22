import { useEffect, useRef, useState } from "react";
import { getHttpServerUrl } from "../game/serverUrl";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { TELEGRAM_BOT } from "../telegram/telegramApp";

/**
 * "Log in with Telegram" for people who are NOT inside the Mini App — the
 * website and the Android app, where Telegram injects no initData.
 *
 * Telegram renders this button itself from a script tag with data-* attributes;
 * it cannot be styled or replaced, and it calls a global callback on success.
 * We give each instance its own callback name so two mounts can't fight over
 * one global.
 *
 * REQUIRES `/setdomain` in BotFather. Telegram refuses to render the widget on
 * a domain that isn't registered to the bot — silently, with an empty iframe —
 * so if the button never appears, that is the first thing to check.
 */

interface TelegramAuthUser {
  id: number;
  hash: string;
  auth_date: number;
  [k: string]: unknown;
}

declare global {
  interface Window {
    [key: string]: unknown;
  }
}

const WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";

export function TelegramLoginButton({
  onSuccess,
  onError,
}: {
  onSuccess: (session: { accessToken: string; wallet: string }) => void;
  onError: (message: string) => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!TELEGRAM_BOT || !holder.current) return;
    const node = holder.current;
    const callbackName = `onTelegramAuth_${Math.random().toString(36).slice(2, 10)}`;

    window[callbackName] = async (user: TelegramAuthUser) => {
      setPending(true);
      try {
        const res = await fetchWithTimeout(
          `${getHttpServerUrl()}/api/auth/telegram/widget`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Sent verbatim: the payload IS the signed material, so adding,
            // renaming or dropping a field would invalidate the hash.
            body: JSON.stringify(user),
          },
          45_000,
        );
        const body = (await res.json()) as {
          accessToken?: string;
          wallet?: string;
          error?: string;
        };
        if (!res.ok || !body.accessToken || !body.wallet) {
          throw new Error(body.error ?? "Telegram sign-in failed.");
        }
        sessionStorage.setItem("metricbase_access_token", body.accessToken);
        onSuccess({ accessToken: body.accessToken, wallet: body.wallet });
      } catch (error) {
        onError(error instanceof Error ? error.message : "Telegram sign-in failed.");
      } finally {
        setPending(false);
      }
    };

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    node.appendChild(script);

    return () => {
      node.innerHTML = "";
      delete window[callbackName];
    };
  }, [onSuccess, onError]);

  // No bot configured — render nothing rather than an inert button.
  if (!TELEGRAM_BOT) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div ref={holder} style={{ display: "flex", justifyContent: "center", minHeight: 40 }} />
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, textAlign: "center" }}>
        {pending ? "Signing you in…" : "Play free with your Telegram account — no wallet needed."}
      </div>
    </div>
  );
}
