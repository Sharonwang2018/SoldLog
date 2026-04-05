/**
 * POST /api/crop-listing-photo — vision returns normalized bbox; client runs canvas crop.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";
import { extractListingHeroCropBoxVision } from "@/lib/ai/sold-story-llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function mapError(rawMessage: string): { status: number; error: string } {
  const m = rawMessage.toLowerCase();
  if (rawMessage.includes("429") || m.includes("rate limit") || m.includes("quota")) {
    return { status: 429, error: "AI service busy — try again shortly." };
  }
  return { status: 503, error: rawMessage.length > 220 ? `${rawMessage.slice(0, 220)}…` : rawMessage };
}

function normalizeMime(raw: string): string | null {
  const t = raw.split(";")[0].trim().toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg" || t === "image/png" || t === "image/webp" || t === "image/gif") {
    return t === "image/jpg" ? "image/jpeg" : t;
  }
  return null;
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: { mime_type?: unknown; image_base64?: unknown };
  try {
    body = (await request.json()) as { mime_type?: unknown; image_base64?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mimeType = normalizeMime(typeof body.mime_type === "string" ? body.mime_type.trim() : "");
  const b64 = typeof body.image_base64 === "string" ? body.image_base64.trim() : "";
  if (!mimeType || !b64) {
    return NextResponse.json({ error: "Provide mime_type and image_base64." }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return NextResponse.json({ error: "Invalid base64." }, { status: 400 });
  }
  if (buf.byteLength > MAX_IMAGE_BYTES || buf.byteLength < 256) {
    return NextResponse.json({ error: "Image size invalid." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const crop = await extractListingHeroCropBoxVision({
      mimeType,
      base64: buf.toString("base64"),
    });
    return NextResponse.json({ ok: true, x: crop.x, y: crop.y, w: crop.w, h: crop.h });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Crop detection failed.";
    const { status, error } = mapError(raw);
    return NextResponse.json({ error }, { status });
  }
}
