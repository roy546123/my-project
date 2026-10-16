import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8011",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "python scripts/serve_test.py",
    url: "http://127.0.0.1:8011/api/state",
    reuseExistingServer: false,
  },
});
