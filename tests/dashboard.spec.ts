import { test, expect } from "@playwright/test";

test.describe("authenticated dashboard", () => {
  test("loads overview without signing in again", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });
});
