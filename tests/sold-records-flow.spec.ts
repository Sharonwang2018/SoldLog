import { existsSync, readFileSync } from "fs";
import path from "path";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * App routes: overview lives at `/dashboard` (there is no `/dashboard/records`).
 * Prereqs: `auth-setup` (E2E_TEST_EMAIL / E2E_TEST_PASSWORD), Supabase configured,
 * `GROQ_API_KEY` (or Gemini / OpenAI key) in `.env.local` for the dev server (AI step).
 */

const TEST_ADDRESS = "123 AI Test Street, San Ramon, CA";

function readEnvLocalValue(key: string): string | undefined {
  const p = path.join(__dirname, "..", ".env.local");
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    if (k !== key) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return undefined;
}

function hasLlmKeyForE2E(): boolean {
  for (const key of ["GROQ_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] as const) {
    if (process.env[key]?.trim()) return true;
    if (readEnvLocalValue(key)?.trim()) return true;
  }
  return false;
}

/**
 * LLM providers (Groq, Gemini, etc.) may return 429; wait longer per attempt and retry with backoff.
 */
async function clickAiGenerateUntilStoryFilled(
  page: Page,
  story: Locator,
  options: {
    maxAttempts?: number;
    responseTimeoutMs?: number;
    backoffScheduleMs?: number[];
  } = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 4;
  const responseTimeoutMs = options.responseTimeoutMs ?? 120_000;
  const backoffScheduleMs = options.backoffScheduleMs ?? [0, 22_000, 40_000, 60_000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pauseMs = backoffScheduleMs[attempt] ?? 25_000 * attempt;
    if (pauseMs > 0) {
      await page.waitForTimeout(pauseMs);
    }

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/generate-story") && r.request().method() === "POST",
      { timeout: responseTimeoutMs },
    );

    await page.getByRole("button", { name: /AI Generate|AI 生成/i }).click();
    const genRes = await responsePromise;
    const genBody = await genRes.text();

    if (genRes.ok()) {
      await expect
        .poll(async () => (await story.inputValue()).trim().length, {
          timeout: 45_000,
          intervals: [100, 250, 500, 1000, 2000],
        })
        .toBeGreaterThanOrEqual(80);
      return;
    }

    const rateLimited =
      genRes.status() === 429 ||
      /429|too many requests|quota|rate limit|exceeded your current quota|resource exhausted|限流/i.test(
        genBody,
      );

    if (!rateLimited) {
      expect(
        genRes.ok(),
        `POST /api/generate-story expected success: ${genRes.status()} — ${genBody.slice(0, 700)}`,
      ).toBeTruthy();
      return;
    }

    if (attempt === maxAttempts - 1) {
      expect(
        genRes.ok(),
        `Still rate-limited after ${maxAttempts} tries. Last: ${genRes.status()} — ${genBody.slice(0, 700)}`,
      ).toBeTruthy();
    }
  }
}

async function deleteSoldRecordByAddressIfPossible(address: string): Promise<void> {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || readEnvLocalValue("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey =
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    readEnvLocalValue("E2E_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return;
  }
  const supabase = createClient(url, serviceKey);
  const { error } = await supabase.from("sold_records").delete().eq("address", address);
  if (error) {
    console.warn("[e2e cleanup] sold_records delete:", error.message);
  }
}

test.describe("sold record creation + AI sold story", () => {
  test("login state → new form → AI generate → submit → list shows address", async ({ page }) => {
    test.skip(
      !!process.env.E2E_SKIP_AI_STORY,
      "Skipped: E2E_SKIP_AI_STORY=1 (e.g. CI without LLM keys).",
    );
    test.skip(
      !hasLlmKeyForE2E(),
      "No LLM key in process.env or .env.local — add GROQ_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY) so /api/generate-story can run.",
    );

    test.setTimeout(420_000);

    await test.step("Open dashboard overview (authenticated via storageState)", async () => {
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    });

    await test.step('Open "New sold record" form', async () => {
      await page.getByRole("link", { name: /New sold record/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/new$/);
      await expect(page.getByRole("heading", { name: /New sold record/i })).toBeVisible();
    });

    await test.step("Fill required fields", async () => {
      await page.locator("#address").fill(TEST_ADDRESS);
      await page.getByLabel("Sold price in USD").fill("2500000");
      await page.locator("#days_on_market").fill("21");
      await page.locator("#represented_side").selectOption("Seller");
    });

    const story = page.locator("#sold_story");

    await test.step("AI Generate fills sold_story (retry + long timeout on 429)", async () => {
      await expect(story).toHaveValue("");
      await clickAiGenerateUntilStoryFilled(page, story, {
        maxAttempts: 4,
        responseTimeoutMs: 120_000,
      });

      const err = page.locator('p[role="alert"]:not(#__next-route-announcer__)');
      await expect(err).toHaveCount(0);

      const value = (await story.inputValue()).trim();
      // 真实模型不会固定输出「AI 生成文案」；断言为「由空变为有实质内容的成交故事」。
      expect(value.length).toBeGreaterThanOrEqual(80);
    });

    await test.step("Submit and land on dashboard list with new address", async () => {
      await page.getByRole("button", { name: "Submit sale" }).click();
      await page.waitForURL(
        (u) => {
          try {
            return new URL(u).pathname === "/dashboard";
          } catch {
            return false;
          }
        },
        { timeout: 90_000 },
      );
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your closings" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(TEST_ADDRESS, { exact: true })).toBeVisible({ timeout: 30_000 });
    });

    await test.step("Optional cleanup: remove test row (service role)", async () => {
      await deleteSoldRecordByAddressIfPossible(TEST_ADDRESS);
    });
  });
});
