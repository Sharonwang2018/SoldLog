/**
 * POST /api/generate-listing-promo — vision + LLM writes buyer-facing listing promo from a portal screenshot.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";
import { normalizeLocale } from "@/lib/i18n/locale";
import { generateListingPromoPosterCopy } from "@/lib/ai/listing-promo-llm";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function mapError(rawMessage: string): { status: number; error: string } {
  const m = rawMessage.toLowerCase();
  if (
    rawMessage.includes("429") ||
    m.includes("rate limit") ||
    m.includes("quota") ||
    m.includes("too many requests")
  ) {
    return { status: 429, error: "AI service busy — try again in a minute." };
  }
  if (
    m.includes("api_key_invalid") ||
    m.includes("invalid api key") ||
    m.includes("incorrect api key")
  ) {
    return {
      status: 401,
      error: "Invalid or missing AI API key on server. Check GROQ_API_KEY in .env.local.",
    };
  }
  return { status: 503, error: rawMessage.length > 280 ? `${rawMessage.slice(0, 280)}…` : rawMessage };
}

function normalizeMime(raw: string): string | null {
  const t = raw.split(";")[0].trim().toLowerCase();
  if (
    t === "image/jpeg" ||
    t === "image/jpg" ||
    t === "image/png" ||
    t === "image/webp" ||
    t === "image/gif"
  ) {
    return t === "image/jpg" ? "image/jpeg" : t;
  }
  return null;
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: {
    mime_type?: unknown;
    image_base64?: unknown;
    language?: unknown;
    audience_note?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mimeRaw = typeof body.mime_type === "string" ? body.mime_type.trim() : "";
  const mimeType = normalizeMime(mimeRaw);
  const b64 = typeof body.image_base64 === "string" ? body.image_base64.trim() : "";
  const langRaw = typeof body.language === "string" ? body.language.trim() : "";
  const audience =
    typeof body.audience_note === "string" ? body.audience_note.trim().slice(0, 2000) : "";

  if (!mimeType || !b64) {
    return NextResponse.json(
      { error: "Provide mime_type and image_base64 (raw base64, no data: prefix)." },
      { status: 400 },
    );
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return NextResponse.json({ error: "image_base64 is not valid base64." }, { status: 400 });
  }
  if (buf.byteLength > MAX_IMAGE_BYTES || buf.byteLength < 256) {
    return NextResponse.json(
      { error: `Image must be between 256 bytes and ${MAX_IMAGE_BYTES} bytes.` },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let profileLang: string | null = null;
  const { data: prof } = await supabase.from("profiles").select("language").eq("id", user.id).maybeSingle();
  if (prof && typeof (prof as { language?: string }).language === "string") {
    profileLang = (prof as { language: string }).language;
  }

  const outputLocale = normalizeLocale(langRaw || profileLang);

  try {
    const promo_text = await generateListingPromoPosterCopy({
      part: { mimeType, base64: buf.toString("base64") },
      outputLocale,
      audienceNote: audience || null,
    });
    return NextResponse.json({ ok: true, promo_text });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Generation failed.";
    const { status, error } = mapError(raw);
    return NextResponse.json({ error }, { status });
  }
}
