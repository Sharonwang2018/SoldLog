import { test, expect, type Page } from "@playwright/test";

/**
 * Red identity_error banner on settings — Next.js also renders `p#__next-route-announcer__[role=alert]`, so avoid a bare `[role="alert"]`.
 */
function settingsIdentityErrorAlert(page: Page) {
  return page.locator('p[role="alert"]:not(#__next-route-announcer__)');
}

async function clickSaveLanguageAndWaitForAction(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/dashboard/settings") && res.request().method() === "POST",
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name: "Save language" }).click(),
  ]);
}

/**
 * Mutates the logged-in user’s profile (same storageState as auth-setup).
 * Runs serially to avoid cross-test races on one account.
 *
 * Optional env for duplicate-slug coverage:
 *   E2E_CONFLICT_SLUG — a slug already owned by another row in `public.profiles`
 *   (e.g. a staging seed like `jane-doe`). If unset, that test is skipped.
 *
 * Note: `profiles.bio` is Postgres TEXT without a max length in schema, so there is no
 * practical “bio too long for DB” failure; errors are asserted via handle validation instead.
 */
test.describe("Dashboard /settings", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  const settingsPath = "/dashboard/settings";

  test("Identity: save handle and bio → URL has saved=identity and green success banner", async ({ page }) => {
    await page.goto(settingsPath);

    const uniqueSlug = `e2e-${Date.now()}`;
    const bioMarker = `E2E identity bio @ ${new Date().toISOString()}`;

    await page.locator("#slug").fill(uniqueSlug);
    await page.locator("#bio").fill(bioMarker);

    await Promise.all([
      page.waitForURL(
        (url) => {
          try {
            const u = new URL(url);
            return u.pathname === settingsPath && u.searchParams.get("saved") === "identity";
          } catch {
            return false;
          }
        },
        { timeout: 45_000 },
      ),
      page.getByRole("button", { name: "Save identity" }).click(),
    ]);

    expect(page.url()).toContain("saved=identity");

    // URL alone is not enough — assert the success strip actually rendered.
    await expect(page.locator("text=Identity saved.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("status")).toContainText("Identity saved.");
  });

  test("Language: switch EN → Chinese (zh), save, reload — value persists", async ({ page }) => {
    await page.goto(settingsPath);

    await page.locator("#language").selectOption("zh");
    await clickSaveLanguageAndWaitForAction(page);

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#language")).toHaveValue("zh", { timeout: 15_000 });

    await page.locator("#language").selectOption("en");
    await clickSaveLanguageAndWaitForAction(page);

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#language")).toHaveValue("en", { timeout: 15_000 });
  });

  test("Identity error: invalid handle (underscore) shows red identity_error alert", async ({ page }) => {
    await page.goto(settingsPath);

    await page.locator("#slug").fill("bad_wolf_handle");
    await page.locator("#name").fill("E2E QA");

    await Promise.all([
      page.waitForURL(
        (url) => {
          try {
            return new URL(url).searchParams.has("identity_error");
          } catch {
            return false;
          }
        },
        { timeout: 45_000 },
      ),
      page.getByRole("button", { name: "Save identity" }).click(),
    ]);

    const alert = settingsIdentityErrorAlert(page);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/handle|characters|hyphen/i);
  });

  test("Identity error: handle longer than 48 characters shows red alert", async ({ page }) => {
    await page.goto(settingsPath);

    const tooLong = "a".repeat(49);
    await page.locator("#slug").fill(tooLong);
    await page.locator("#name").fill("E2E QA");

    await Promise.all([
      page.waitForURL(
        (url) => {
          try {
            return new URL(url).searchParams.has("identity_error");
          } catch {
            return false;
          }
        },
        { timeout: 45_000 },
      ),
      page.getByRole("button", { name: "Save identity" }).click(),
    ]);

    const alert = settingsIdentityErrorAlert(page);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/handle|48|characters/i);
  });

  test("Identity error: empty display name shows red alert", async ({ page }) => {
    await page.goto(settingsPath);

    await page.locator("#name").fill("");
    await page.locator("#slug").fill(`e2e-keep-${Date.now()}`);

    await Promise.all([
      page.waitForURL(
        (url) => {
          try {
            return new URL(url).searchParams.has("identity_error");
          } catch {
            return false;
          }
        },
        { timeout: 45_000 },
      ),
      page.getByRole("button", { name: "Save identity" }).click(),
    ]);

    const alert = settingsIdentityErrorAlert(page);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/display name|required/i);
  });

  test("Identity error: duplicate slug shows red alert", async ({ page }) => {
    const conflictSlug = process.env.E2E_CONFLICT_SLUG?.trim();
    test.skip(
      !conflictSlug,
      "Set E2E_CONFLICT_SLUG to a slug already taken by another profile (e.g. jane-doe on shared DB).",
    );

    const takenSlug = conflictSlug as string;

    await page.goto(settingsPath);

    await page.locator("#slug").fill(takenSlug);
    await page.locator("#name").fill("E2E QA");

    await Promise.all([
      page.waitForURL(
        (url) => {
          try {
            return new URL(url).searchParams.has("identity_error");
          } catch {
            return false;
          }
        },
        { timeout: 45_000 },
      ),
      page.getByRole("button", { name: "Save identity" }).click(),
    ]);

    const alert = settingsIdentityErrorAlert(page);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/handle|taken/i);
  });
});
