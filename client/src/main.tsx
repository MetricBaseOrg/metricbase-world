import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { getHttpServerUrl } from "./game/serverUrl";
import { BrandPortal } from "./ui/BrandPortal";
import { LandingPage } from "./ui/LandingPage";
import "./ui/chibiTheme.css";
import {
  registerMwa,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-standard-mobile";

// Solana web3.js / spl-token reference Node's Buffer global, which the browser
// doesn't provide. Polyfill it before any wallet/market code runs.
const globalScope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer;
}

registerMwa({
  appIdentity: {
    name: "MetricBase World",
    uri: "https://world.metricbase.org",
    icon: "pwa-512x512.png",
  },
  authorizationCache: createDefaultAuthorizationCache(),
  chains: ["solana:mainnet", "solana:devnet"],
  chainSelector: createDefaultChainSelector(),
  onWalletNotFound: createDefaultWalletNotFoundHandler(),
});

// Path-based routing (Vercel SPA fallback serves index.html for all of these):
//   /        → marketing landing page (front door)
//   /play    → the game client
//   /brands  → standalone advertiser portal (wallet-only, never boots the game)
const path = window.location.pathname.replace(/\/+$/, "");
const isBrandPortal = path === "/brands";
const isPlay = path === "/play";

// /stats is a server-rendered page (proxied to the backend by vercel.json), not
// a SPA route. If the SPA still boots here it means the request never reached
// the network — an installed PWA/TWA service worker served the cached index.html
// as its navigation fallback — and we'd otherwise render the marketing landing
// page. Bounce to the backend origin: it's cross-origin, so the same-origin
// service worker can't intercept it (no redirect loop), and the real dashboard
// shows regardless of whether the service worker has updated.
if (path === "/stats") {
  window.location.replace(`${getHttpServerUrl()}/stats`);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {isBrandPortal ? <BrandPortal /> : isPlay ? <App /> : <LandingPage />}
    </StrictMode>,
  );
}