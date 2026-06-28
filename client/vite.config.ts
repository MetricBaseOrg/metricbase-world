import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
    // Phaser is a ~1.5 MB engine isolated in its own cacheable chunk; that's
    // expected, so keep the advisory limit above it.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Split heavy vendors into their own cacheable chunks so the initial
        // load parallelises and returning players get long-lived cache hits.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("phaser")) return "phaser";
          if (
            id.includes("@solana") ||
            id.includes("@wallet-standard") ||
            id.includes("bs58") ||
            id.includes("buffer")
          ) {
            return "solana";
          }
          if (id.includes("react") || id.includes("zustand") || id.includes("scheduler")) {
            return "react";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:2567",
    },
  },
});