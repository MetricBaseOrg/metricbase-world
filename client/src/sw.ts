/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  matchPrecache,
  precacheAndRoute,
  type PrecacheEntry,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

/**
 * Custom service worker (vite-plugin-pwa injectManifest).
 *
 * Strategy: hashed assets are precached (instant loads, offline play), but
 * page NAVIGATIONS are network-first — every deploy is visible immediately
 * instead of after a full "open old shell, update in background, reopen"
 * cycle, which stranded PWA/TWA users on a stale (or blank, when the old
 * assets were purged mid-update) page after each release.
 */

self.skipWaiting();
clientsClaim();

// IMPORTANT: register the navigation route BEFORE precacheAndRoute — Workbox
// matches routes in registration order, and the precache route would otherwise
// serve "/" from the cached index.html (via its directoryIndex mapping),
// putting navigations right back on the stale-shell path.
registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      try {
        return await fetch(request);
      } catch {
        // Offline: fall back to the precached app shell so the installed
        // PWA/TWA still opens (the SPA renders whatever route it was given).
        const shell = await matchPrecache("index.html");
        return shell ?? Response.error();
      }
    },
    {
      // Server-rendered/proxied routes (vercel.json → Railway): never answer
      // these with the SPA shell.
      denylist: [/^\/stats/, /^\/api/, /^\/docs/],
    },
  ),
);

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
