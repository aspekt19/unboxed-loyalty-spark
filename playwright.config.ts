import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the Vite dev server on http://localhost:8080.
 * If no server is running yet, Playwright starts one automatically.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: process.env.CI ? 120_000 : 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-412",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-portrait",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-landscape",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // npm-only: CI images have Node but not Bun (see .github/workflows/ci.yml).
    // On CI serve the production build — the dev server is far too slow on 2-core runners.
    command: process.env.CI
      ? "npm run build && npm run preview -- --host 127.0.0.1 --port 8080 --strictPort"
      : "npm run dev -- --host 127.0.0.1 --port 8080 --strictPort",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});

