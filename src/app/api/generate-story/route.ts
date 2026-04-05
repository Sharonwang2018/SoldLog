/**
 * AI sold story — server-only. Default provider: Groq (`GROQ_API_KEY`, OpenAI-compatible API).
 * Optional fallbacks: Gemini (`GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_*`), OpenAI (`OPENAI_API_KEY`).
 * Never call LLM providers from the browser — keys must not ship to clients.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";
import { generateSoldStoryWithLlm, isTrustedPropertyImageUrl } from "@/lib/ai/sold-story-llm";
import { normalizeLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DraftPayload = {
  address?: unknown;
  city_state?: unknown;
  price?: unknown;
  days_on_market?: unknown;
  represented_side?: unknown;
  /** Output language (e.g. zh, en); overrides profile when set. */
  language?: unknown;
  /** Public Supabase property-images URLs (optional); must be under the signed-in user's folder. */
  property_image_urls?: unknown;
  /** Single listing image URL (same rules as property_image_urls). */
  property_image_url?: unknown;
};

type Body = { recordId?: string; draft?: DraftPayload };

/** Map upstream LLM errors to HTTP status + safe user-facing text (avoid raw stack dumps in UI). */
function mapGenerateStoryError(rawMessage: string): { status: number; error: string } {
  const m = rawMessage.toLowerCase();
  const rateLimited =
    rawMessage.includes("429") ||
    m.includes("too many requests") ||
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("rate-limit") ||
    m.includes("exceeded your current quota") ||
    m.includes("resource exhausted");
  if (rateLimited) {
    return {
      status: 429,
      error:
        "The AI service is temporarily busy (rate limit). Please wait a minute and try again. 当前使用人数较多或已达配额上限，请稍后再试。说明见 Groq: https://console.groq.com/docs/rate-limits · Gemini: https://ai.google.dev/gemini-api/docs/rate-limits",
    };
  }
  if (
    m.includes("api_key_invalid") ||
    m.includes("invalid api key") ||
    m.includes("incorrect api key") ||
    m.includes("api key expired")
  ) {
    return {
      status: 401,
      error:
        "AI API key is invalid or expired. Check GROQ_API_KEY (or your configured provider key) in .env.local. 请检查服务端 LLM API Key（如 GROQ_API_KEY）。",
    };
  }
  return {
    status: 503,
    error: rawMessage.length > 280 ? `${rawMessage.slice(0, 280)}…` : rawMessage,
  };
}

function parseDraft(d: DraftPayload): {
  address: string;
  cityState: string;
  priceUsd: number;
  daysOnMarket: number;
  representedSide: string | null;
} | null {
  const address = typeof d.address === "string" ? d.address.trim() : "";
  if (!address) return null;

  const cityState = typeof d.city_state === "string" ? d.city_state.trim() : "";
  const priceRaw = d.price;
  const daysRaw = d.days_on_market;
  const priceUsd =
    typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw >= 0
      ? Math.floor(priceRaw)
      : typeof priceRaw === "string"
        ? Math.floor(Number.parseInt(priceRaw.replace(/\D/g, ""), 10) || NaN)
        : NaN;
  const daysOnMarket =
    typeof daysRaw === "number" && Number.isFinite(daysRaw) && daysRaw >= 0
      ? Math.floor(daysRaw)
      : typeof daysRaw === "string"
        ? Math.floor(Number.parseInt(daysRaw, 10) || NaN)
        : NaN;

  if (Number.isNaN(priceUsd) || Number.isNaN(daysOnMarket)) return null;

  let representedSide: string | null = null;
  if (typeof d.represented_side === "string") {
    const t = d.represented_side.trim();
    representedSide = t.length > 0 ? t : null;
  }

  return { address, cityState, priceUsd, daysOnMarket, representedSide };
}

function collectDraftPropertyImageUrls(draft: DraftPayload, userId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (u: string) => {
    const t = u.trim();
    if (!t || seen.has(t) || !isTrustedPropertyImageUrl(t, userId)) return;
    seen.add(t);
    out.push(t);
  };
  if (typeof draft.property_image_url === "string") add(draft.property_image_url);
  if (Array.isArray(draft.property_image_urls)) {
    for (const item of draft.property_image_urls) {
      if (typeof item === "string") add(item);
      if (out.length >= 3) break;
    }
  }
  return out.slice(0, 3);
}

/**
 * POST /api/generate-story
 *
 * 1) `{ recordId }` — existing row; loads DB fields, generates, saves `sold_story`, revalidates.
 * 2) `{ draft: { …, property_image_urls?: string[] } }` — no save;
 *    uses `profiles.language` for output locale (Chinese / English / etc.).
 *
 * Env: GROQ_API_KEY (primary); or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_*; or OPENAI_API_KEY.
 */
export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (body.draft && typeof body.draft === "object") {
    const parsed = parseDraft(body.draft);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid draft: need address, valid price, and days on market." },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase.from("profiles").select("language").eq("id", user.id).maybeSingle();
    const draftLang = typeof body.draft.language === "string" ? body.draft.language.trim() : "";
    const outputLocale = draftLang
      ? normalizeLocale(draftLang)
      : normalizeLocale(profile?.language as string | null | undefined);
    const propertyImageUrls = collectDraftPropertyImageUrls(body.draft, user.id);

    try {
      const soldStory = await generateSoldStoryWithLlm({
        address: parsed.address,
        cityState: parsed.cityState,
        priceUsd: parsed.priceUsd,
        daysOnMarket: parsed.daysOnMarket,
        representedSide: parsed.representedSide,
        outputLocale,
        propertyImageUrls: propertyImageUrls.length ? propertyImageUrls : undefined,
      });
      return NextResponse.json({ ok: true, soldStory, saved: false });
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Generation failed.";
      const { status, error } = mapGenerateStoryError(raw);
      return NextResponse.json({ error }, { status });
    }
  }

  const recordId = typeof body.recordId === "string" ? body.recordId.trim() : "";
  if (!recordId || !UUID_RE.test(recordId)) {
    return NextResponse.json({ error: "Provide recordId or draft in the request body." }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("sold_records")
    .select(
      "id, slug, address, city_state, price, days_on_market, represented_side, language, agent_id, property_image_url",
    )
    .eq("id", recordId)
    .eq("agent_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("slug, language")
    .eq("id", user.id)
    .maybeSingle();

  const rowLang = typeof row.language === "string" ? row.language.trim() : "";
  const profileLang = typeof profile?.language === "string" ? profile.language.trim() : "";
  const outputLocale = normalizeLocale(rowLang || profileLang || undefined);

  const img = typeof row.property_image_url === "string" ? row.property_image_url.trim() : "";
  const propertyImageUrls =
    img && isTrustedPropertyImageUrl(img, user.id) ? [img] : undefined;

  let soldStory: string;
  try {
    soldStory = await generateSoldStoryWithLlm({
      address: row.address,
      cityState: row.city_state ?? "",
      priceUsd: Number(row.price),
      daysOnMarket: row.days_on_market,
      representedSide: row.represented_side,
      outputLocale,
      propertyImageUrls,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Generation failed.";
    const { status, error } = mapGenerateStoryError(raw);
    return NextResponse.json({ error }, { status });
  }

  const { error: updateErr } = await supabase
    .from("sold_records")
    .update({ sold_story: soldStory })
    .eq("id", recordId)
    .eq("agent_id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const agentSlug = profile?.slug as string | undefined;
  if (agentSlug) {
    revalidatePath(`/${agentSlug}`);
    revalidatePath(`/${agentSlug}/${row.slug}`);
  }
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, soldStory, saved: true });
}
