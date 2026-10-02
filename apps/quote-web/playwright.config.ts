import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Optional: point at a pre-installed Chromium (e.g. a locked-down machine or container).
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /journey\.spec\.ts/ },
  ],
  webServer: {
    // Tests run against a production build: run `pnpm build` first.
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/quote/start`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
