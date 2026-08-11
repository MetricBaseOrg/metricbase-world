import { Buffer } from "buffer";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
// Lazy so Phaser stays OUT of every route that isn't the game. It is a 1.5MB
// chunk and Vite was modulepreloading it on /board, /dao, /brands and the
// landing page — all of which render fine without it. Only /play pays for it.
const App = lazy(() => import("./App").then((m) => ({ default: m.App })));
import { getHttpServerUrl } from "./game/serverUrl";
// Every route is code-split. Without this, one page pulling a heavy dependency
// imposes it on all of them: DashboardPage → CharacterPreview → Phaser meant
// the 1.5MB Phaser chunk was modulepreloaded on the landing page, /dao,
// /brands and /board, none of which render a single sprite.
const BrandPortal = lazy(() => import("./ui/BrandPortal").then((m) => ({ default: m.BrandPortal })));
const DaoPage = lazy(() => import("./ui/DaoPage").then((m) => ({ default: m.DaoPage })));
const BoardPage = lazy(() => import("./ui/BoardPage").then((m) => ({ default: m.BoardPage })));
const DashboardPage = lazy(() => import("./ui/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const LandingPage = lazy(() => import("./ui/LandingPage").then((m) => ({ default: m.LandingPage })));
const ToolsPage = lazy(() => import("./ui/ToolsPage").then((m) => ({ default: m.ToolsPage })));
import { applyTelegramStartParam, initTelegramMiniApp, isTelegramMiniApp } from "./telegram/telegramApp";
import "./ui/chibiTheme.css";
import {
  registerMwa,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-standard-mobile";

// Signal the index.html self-heal watchdog that the bundle booted — without
// this flag it assumes a stale service-worker shell and clears caches.
(window as Window & { __MB_BOOTED?: boolean }).__MB_BOOTED = true;

// Solana web3.js / spl-token reference Node's Buffer global, which the browser
// doesn't provide. Polyfill it before any wallet/market code runs.
const globalScope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer;
}

// Telegram Mini App. The start-param fold MUST run synchronously here: it
// rewrites `?startapp=INV-…` into the `?invite=` param that LoginOverlay reads
// on first render, and that the wallet deep-link copies across to Phantom.
// Chrome setup (expand, colours, swipe-lock) is async and no-ops elsewhere.
applyTelegramStartParam();
void initTelegramMiniApp();

// Mobile Wallet Adapter registers itself as a wallet-standard wallet on any
// Android UA — including inside Telegram's webview, where it CANNOT work: MWA
// hands off to a wallet app by intent and needs the response routed back to
// the browser, a round trip Telegram's webview doesn't support. Registering it
// there hijacks the connect flow into a hang ("Verifying wallet…") instead of
// falling through to the Phantom/Solflare deep link, which is the only thing
// that actually works in Telegram. So: skip MWA entirely inside the Mini App.
if (!isTelegramMiniApp()) {
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
}

// Path-based routing (Vercel SPA fallback serves index.html for all of these):
//   /           → marketing landing page (front door)
//   /dashboard  → player dashboard (wallet sign-in lands here; Play Now → /play)
//   /play       → the game client
//   /brands     → standalone advertiser portal (wallet-only, never boots the game)
//   /dao        → MetricBase DAO: $BASE-holder polls (wallet-only, no game boot)
//   /tools      → Kakushie Maker: X hidden-image generator (no wallet, no game boot)
//   /board      → District Deeds: the property board game (no game boot, own transport)
const path = window.location.pathname.replace(/\/+$/, "");
const isBrandPortal = path === "/brands";
const isDao = path === "/dao";
const isDashboard = path === "/dashboard";
const isPlay = path === "/play";
const isTools = path === "/tools";
const isBoard = path === "/board";

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
      <Suspense fallback={null}>
      {isBoard ? <BoardPage /> : isBrandPortal ? <BrandPortal /> : isDao ? <DaoPage /> : isTools ? <ToolsPage /> : isDashboard ? <DashboardPage /> : isPlay ? <App /> : <LandingPage />}
      </Suspense>
    </StrictMode>,
  );
}