import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Custom worker (src/sw.ts): navigations are network-first (deploys show
      // up immediately on PWA/TWA instead of one stale session later) with the
      // precached shell as the offline fallback; hashed assets stay precached.
      // The /stats,/api,/docs denylist lives in sw.ts.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html}"],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
      manifest: {
        name: "MetricBase World",
        short_name: "MetricBase World",
        description: "Browser-based isometric MMO",
        theme_color: "#b8e8fc",
        background_color: "#b8e8fc",
        display: "standalone",
        orientation: "landscape",
        start_url: "/play",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  // Some Solana deps reference the Node `global`; map it to the browser global.
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@metricbase/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      buffer: "buffer",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Only isolate Phaser (a ~1.5 MB self-contained engine) into its own
    // cacheable chunk. It's a leaf dependency so there's no init-order cycle —
    // splitting React/Solana out previously caused a circular chunk that broke
    // module evaluation and left a blank page, so we deliberately don't.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules") && id.includes("phaser")) return "phaser";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:2567",
      // Prod rewrites these to the Railway server (see vercel.json). In dev,
      // proxy them to the local game server so /stats and the /api/* routes
      // resolve instead of falling through to the SPA index.html.
      "/stats": "http://localhost:2567",
      "/api": "http://localhost:2567",
    },
  },
});