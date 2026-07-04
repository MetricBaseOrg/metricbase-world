import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { BrandPortal } from "./ui/BrandPortal";
import "./ui/chibiTheme.css";

// Solana web3.js / spl-token reference Node's Buffer global, which the browser
// doesn't provide. Polyfill it before any wallet/market code runs.
const globalScope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer;
}

// /brands is the standalone advertiser portal — a wallet-only web page that
// never boots the game (brands shouldn't need to play to run ads).
const isBrandPortal = window.location.pathname.replace(/\/+$/, "") === "/brands";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isBrandPortal ? <BrandPortal /> : <App />}</StrictMode>,
);