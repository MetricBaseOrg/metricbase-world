import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { BrandPortal } from "./ui/BrandPortal";
import { LandingPage } from "./ui/LandingPage";
import "./ui/chibiTheme.css";

// Solana web3.js / spl-token reference Node's Buffer global, which the browser
// doesn't provide. Polyfill it before any wallet/market code runs.
const globalScope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer;
}

// Path-based routing (Vercel SPA fallback serves index.html for all of these):
//   /        → marketing landing page (front door)
//   /play    → the game client
//   /brands  → standalone advertiser portal (wallet-only, never boots the game)
const path = window.location.pathname.replace(/\/+$/, "");
const isBrandPortal = path === "/brands";
const isPlay = path === "/play";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isBrandPortal ? <BrandPortal /> : isPlay ? <App /> : <LandingPage />}
  </StrictMode>,
);