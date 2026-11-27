import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/a11y",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3005",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npx next start -p 3005 -H 127.0.0.1",
    url: "http://127.0.0.1:3005/sign-in",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Explicit invalid local address ensures Playwright server never connects to Neon/production DB
      DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:59999/aipm_dummy",
      DIRECT_URL: "postgresql://invalid:invalid@127.0.0.1:59999/aipm_dummy",
      BETTER_AUTH_SECRET: "a11y-playwright-dummy-secret-at-least-32-chars",
      BETTER_AUTH_URL: "http://127.0.0.1:3005",
    },
  },
});
