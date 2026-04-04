import path from "path";
import { test as setup, expect } from "@playwright/test";

const authFile = path.join(__dirname, "..", "playwright", ".auth", "user.json");

/**
 * Signs in via the real /login UI (Supabase signInWithPassword) and saves cookies/localStorage
 * to playwright/.auth/user.json so dependent tests reuse the session.
 *
 * Requires env:
 *   E2E_TEST_EMAIL
 *   E2E_TEST_PASSWORD
 *
 * Supabase: allow your dev origin under Authentication → URL Configuration (e.g. http://127.0.0.1:3000).
 */
setup("persist Supabase session", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL?.trim();
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in the environment, or add them to .env.local / .env.e2e (see .env.e2e.example).",
    );
  }

  await page.goto("/login?next=/dashboard");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator("form").locator('button[type="submit"]').click();

  // Do not use a `**/dashboard**` glob — it matches `/login?next=/dashboard` in the query string.
  await page.waitForURL(
    (url) => {
      try {
        const { pathname } = new URL(url);
        return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
      } catch {
        return false;
      }
    },
    { timeout: 45_000 },
  );
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 20_000 });

  await page.context().storageState({ path: authFile });
});
