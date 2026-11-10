import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  plugins: [tailwindcss()],
  build: {
    target: "chrome105",
    sourcemap: false,
    minify: "esbuild",
    outDir: "dist",
    emptyOutDir: true,
  },
});
