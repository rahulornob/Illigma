import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 3,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
