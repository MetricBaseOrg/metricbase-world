// Mobile wallet connection helper.
//
// Solana wallets inject a provider (window.solana / wallet-standard) ONLY on
// desktop extensions or inside a wallet app's in-app browser. On a normal
// mobile browser (Safari/Chrome) there is no provider, so a standalone dApp
// page like /dao or /brands can't connect. The fix is a universal "browse"
// deep link that reopens the current page INSIDE the wallet app's in-app
// browser, where the provider exists and connecting works normally.

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
 * Deep links that open `pageUrl` in each wallet's in-app browser. Phantom and
 * Solflare both expose a `/browse/<url>?ref=<ref>` universal link.
 */
export function walletBrowserLinks(pageUrl: string = typeof window !== "undefined" ? window.location.href : ""): MobileWalletLink[] {
  const url = encodeURIComponent(pageUrl);
  const ref = encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "");
  return [
    { name: "Phantom", url: `https://phantom.app/ul/browse/${url}?ref=${ref}` },
    { name: "Solflare", url: `https://solflare.com/ul/v1/browse/${url}?ref=${ref}` },
  ];
}

/** Navigate to a wallet's in-app browser with the current page. */
export function openInWalletBrowser(link: MobileWalletLink): void {
  if (typeof window !== "undefined") window.location.href = link.url;
}
