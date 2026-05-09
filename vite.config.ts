import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),

    // Rewrite ./transport.js imports inside Envoy client package
    // to use our browser-compatible BrowserTransport instead
    {
      name: "envoy-transport-rewrite",
      resolveId(source, importer) {
        if (
          importer &&
          importer.includes(path.normalize("Envoy/packages/client/")) &&
          source.endsWith("transport.js")
        ) {
          return path.resolve(__dirname, "src/envoy/BrowserTransport.ts");
        }
      },
    },
  ],

  resolve: {
    alias: {
      "@envoy/core": path.resolve(__dirname, "Envoy/packages/core/index.ts"),
      "@envoy/client": path.resolve(__dirname, "Envoy/packages/client/index.ts"),
      "@envoy/teams": path.resolve(__dirname, "Envoy/packages/teams/index.ts"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
