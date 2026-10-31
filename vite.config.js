import { defineConfig } from "vite";

export default defineConfig({
  // Path relatif, agar aplikasi jalan di GitHub Pages (/notes-app/)
  base: "./",
  test: {
    // Vitest hanya menjalankan unit test; e2e dijalankan Playwright
    include: ["tests/unit/**/*.test.js"],
  },
});
