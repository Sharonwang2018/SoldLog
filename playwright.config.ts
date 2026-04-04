import { existsSync, readFileSync } from "fs";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

const authFile = path.join(__dirname, "playwright", ".auth", "user.json");

/** Dedicated port so `next dev` never silently falls back to 3001 while Playwright waits on 3000. */
const e2ePort = process.env.PLAYWRIGHT_DEV_PORT ?? "3333";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

/**
 * Load E2E_TEST_* from .env.local / .env.e2e without adding a dotenv dependency (values not committed).
 */
function hydrateE2eEnvFromFiles() {
  for (const name of [".env.e2e", ".env.local"]) {
    const p = path.join(__dirname, name);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      if (!key.startsWith("E2E_")) continue;
      if (process.env[key]) continue;
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

hydrateE2eEnvFromFiles();

/**
 * E2E: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (in env or .env.local / .env.e2e).
 * Dev server: PLAYWRIGHT_DEV_PORT (default 3333) or PLAYWRIGHT_BASE_URL for an already-running app.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth-setup\.ts$/, retries: 0, timeout: 120_000 },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
      dependencies: ["setup"],
      testIgnore: /auth-setup\.ts$/,
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `npx next dev -p ${e2ePort}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
