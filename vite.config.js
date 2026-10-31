import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Path relatif, agar aplikasi jalan di GitHub Pages (/notes-app/)
  base: "./",
  plugins: [
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectRegister: false,
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png}"] },
      manifest: {
        name: "Catatan",
        short_name: "Catatan",
        lang: "id",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1d4ed8",
        icons: [
          { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  test: {
    // Vitest hanya menjalankan unit test; e2e dijalankan Playwright
    include: ["tests/unit/**/*.test.js"],
  },
});
