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
  },
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:2567",
    },
  },
});