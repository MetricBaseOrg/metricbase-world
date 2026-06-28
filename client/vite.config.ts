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
    },
  },
});