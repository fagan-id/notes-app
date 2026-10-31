import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:4173" },
  // Semua e2e test dijalankan di layar HP (emulasi Pixel 5)
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 5"] } }],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
