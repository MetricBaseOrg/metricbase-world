// Telegram Mini App integration.
//
// The game runs unchanged inside Telegram's in-app webview — Telegram just
// loads https://world.metricbase.org/play in a chromeless browser. Three things
// need special handling there:
//
//  1. THE SDK IS NOT PRESENT BY DEFAULT. `window.Telegram.WebApp` only exists
//     after telegram-web-app.js loads. We inject it lazily and ONLY when we
//     detect a Telegram launch, so the other 99% of page loads pay nothing.
//
//  2. NO SOLANA PROVIDER. Telegram's webview injects no wallet, exactly like a
//     plain mobile browser, so connect() can never succeed in-app. The token
//     gate deep-links out to Phantom/Solflare instead (see mobileWallet.ts).
//     Inside Telegram, plain `location.href = <universal link>` is unreliable —
//     use `openExternalLink()`, which routes through WebApp.openLink().
//
//  3. REFERRAL ATTRIBUTION. `t.me/<bot>/play?startapp=INV-1234-ABCD` surfaces
//     the code as `start_param`. We fold it into the page URL as `?invite=`,
//     which LoginOverlay already reads — and which survives the hop to the
//     wallet's in-app browser (a separate browser context: localStorage does
//     NOT carry across, the URL is the only channel).

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: { start_param?: string; user?: { id?: number } };
  platform?: string;
  version?: string;
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SDK_URL = "https://telegram.org/js/telegram-web-app.js";

/** Bot username that hosts the Mini App, e.g. "MetricBaseWorldBot". Set
 *  VITE_TELEGRAM_BOT at build time to enable Telegram share links. */
export const TELEGRAM_BOT: string = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined)?.trim() ?? "";

/** Short name of the Mini App as registered in BotFather (/newapp). */
export const TELEGRAM_APP_SHORT_NAME = "play";

function webApp(): TelegramWebApp | null {
  return (typeof window !== "undefined" && window.Telegram?.WebApp) || null;
}

/**
 * Whether this page was opened as a Telegram Mini App.
 *
 * Synchronous and SDK-independent: Telegram always appends `tgWebApp*`
 * parameters to the launch URL's hash, so this is reliable from the very first
 * line of main.tsx — before the SDK script has loaded.
 */
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  if (webApp()?.initData) return true;
  return /(?:^|[#?&])tgWebApp/.test(window.location.hash) || /(?:^|[#?&])tgWebApp/.test(window.location.search);
}

/** The `startapp` payload from `t.me/<bot>/<app>?startapp=<value>`, if any. */
export function getTelegramStartParam(): string | null {
  if (typeof window === "undefined") return null;
  const fromSdk = webApp()?.initDataUnsafe?.start_param;
  if (fromSdk) return fromSdk;
  // Pre-SDK fallback: parse the launch hash ourselves.
  const hash = window.location.hash.replace(/^#/, "");
  const direct = new URLSearchParams(hash).get("tgWebAppStartParam");
  if (direct) return direct;
  // Older clients nest it inside the URL-encoded tgWebAppData blob.
  const data = new URLSearchParams(hash).get("tgWebAppData");
  if (data) {
    const nested = new URLSearchParams(data).get("start_param");
    if (nested) return nested;
  }
  return null;
}

const INVITE_CODE_RE = /^INV-[0-9A-Z]{4}-[0-9A-Z]{4}$/i;

/**
 * Fold a Telegram `startapp` invite code into the page URL as `?invite=`.
 *
 * Called synchronously at boot so LoginOverlay's existing `?invite=` reader
 * picks it up on first render, and so the wallet deep-link (built from the
 * current URL) carries the referral across to Phantom's in-app browser.
 * Uses replaceState — no reload, and the launch hash is left intact for the SDK.
 */
export function applyTelegramStartParam(): void {
  if (typeof window === "undefined") return;
  const startParam = getTelegramStartParam();
  if (!startParam || !INVITE_CODE_RE.test(startParam)) return;

  const url = new URL(window.location.href);
  if (url.searchParams.get("invite") || url.searchParams.get("code")) return;
  url.searchParams.set("invite", startParam.toUpperCase());
  url.searchParams.set("src", "tg");
  window.history.replaceState(null, "", url.toString());
}

let sdkPromise: Promise<TelegramWebApp | null> | null = null;

/** Inject telegram-web-app.js once. Resolves null if it fails to load. */
function loadTelegramSdk(): Promise<TelegramWebApp | null> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve) => {
    const existing = webApp();
    if (existing) {
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve(webApp());
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/**
 * Boot the Mini App chrome: full height, brand colours, and — critically for a
 * touch game — vertical swipes disabled so dragging the D-pad doesn't dismiss
 * the app. Safe to call unconditionally; no-ops outside Telegram.
 */
export async function initTelegramMiniApp(): Promise<void> {
  if (!isTelegramMiniApp()) return;
  const app = await loadTelegramSdk();
  if (!app) return;
  try {
    app.ready?.();
    app.expand?.();
    // Added in Bot API 7.7; older clients simply don't expose it.
    app.disableVerticalSwipes?.();
    app.setHeaderColor?.("#0A0A0A");
    app.setBackgroundColor?.("#0A0A0A");
  } catch (error) {
    console.warn("[telegram] Mini App init failed:", error);
  }
}

/**
 * Open an external https URL. Inside Telegram, `location.href` to a universal
 * link (Phantom, Jupiter, X) is swallowed by the webview — WebApp.openLink()
 * hands it to the OS instead. Outside Telegram this is a normal navigation.
 */
export function openExternalLink(url: string, newTab = false): void {
  const app = webApp();
  if (app?.openLink) {
    app.openLink(url, { try_instant_view: false });
    return;
  }
  if (newTab) window.open(url, "_blank", "noopener");
  else window.location.href = url;
}

/**
 * The raw signed `initData` blob for this launch, or null outside Telegram.
 *
 * Loads the SDK first if needed — initData only exists once telegram-web-app.js
 * has run. This string is what the server HMAC-verifies against the bot token;
 * it must be sent verbatim (re-encoding it would break the signature).
 */
export async function getTelegramInitData(): Promise<string | null> {
  if (!isTelegramMiniApp()) return null;
  const app = (await loadTelegramSdk()) ?? webApp();
  const data = app?.initData;
  return data && data.length > 0 ? data : null;
}

/** Open a t.me link (share sheets, the bot itself) inside Telegram. */
export function openTelegramLink(url: string): void {
  const app = webApp();
  if (app?.openTelegramLink) {
    app.openTelegramLink(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}

/** Deep link that launches the Mini App, optionally carrying an invite code. */
export function telegramAppLink(startParam?: string): string | null {
  if (!TELEGRAM_BOT) return null;
  const base = `https://t.me/${TELEGRAM_BOT}/${TELEGRAM_APP_SHORT_NAME}`;
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}

/**
 * Open Telegram's native "forward to chat" sheet. Prefers the Mini App link
 * (recipients land straight in the game, referral attached) and falls back to
 * the plain web URL when no bot is configured.
 */
export function shareToTelegram(text: string, opts: { startParam?: string; fallbackUrl: string }): void {
  const url = telegramAppLink(opts.startParam) ?? opts.fallbackUrl;
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  openTelegramLink(share);
}
