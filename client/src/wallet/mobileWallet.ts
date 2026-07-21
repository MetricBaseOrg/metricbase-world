// Mobile wallet connection helper.
//
// Solana wallets inject a provider (window.solana / wallet-standard) ONLY on
// desktop extensions or inside a wallet app's in-app browser. On a normal
// mobile browser (Safari/Chrome) — and inside Telegram's Mini App webview —
// there is no provider, so the page can't connect. The fix is a universal
// "browse" deep link that reopens the current page INSIDE the wallet app's
// in-app browser, where the provider exists and connecting works normally.

import { isTelegramMiniApp, openExternalLink } from "../telegram/telegramApp";

export interface MobileWalletLink {
  name: string;
  /** Universal link that opens the current page in the wallet's in-app browser. */
  url: string;
}

/** Heuristic: a phone/tablet browser (where deep links make sense). */
export function isLikelyMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) || (typeof window !== "undefined" && "ontouchstart" in window && window.innerWidth < 1024);
}

/**
 * Whether to offer the "open in wallet browser" escape hatch. Telegram is
 * included regardless of device: Telegram Desktop's webview has no provider
 * either, so `isLikelyMobile()` alone would leave desktop TG users stranded.
 */
export function shouldOfferWalletDeepLink(): boolean {
  return isLikelyMobile() || isTelegramMiniApp();
}

/**
 * The URL to hand the wallet's in-app browser.
 *
 * That browser is a SEPARATE context — localStorage and session state do not
 * carry across — so anything the destination page needs must ride in the URL.
 * We keep `invite`/`code` (referral attribution from a Telegram `startapp` or
 * a shared link) and drop Telegram's `tgWebApp*` launch hash, which is
 * meaningless outside Telegram and would trip the Mini App detection.
 */
export function walletDeepLinkTarget(): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

/**
 * Deep links that open `pageUrl` in each wallet's in-app browser. Phantom and
 * Solflare both expose a `/browse/<url>?ref=<ref>` universal link.
 */
export function walletBrowserLinks(pageUrl: string = walletDeepLinkTarget()): MobileWalletLink[] {
  const url = encodeURIComponent(pageUrl);
  const ref = encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "");
  return [
    { name: "Phantom", url: `https://phantom.app/ul/browse/${url}?ref=${ref}` },
    { name: "Solflare", url: `https://solflare.com/ul/v1/browse/${url}?ref=${ref}` },
  ];
}

/** Navigate to a wallet's in-app browser with the current page. */
export function openInWalletBrowser(link: MobileWalletLink): void {
  if (typeof window === "undefined") return;
  // Inside Telegram a plain location.href to a universal link is swallowed by
  // the webview; openExternalLink routes it through WebApp.openLink().
  openExternalLink(link.url);
}
