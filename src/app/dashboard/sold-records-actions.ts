"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";
import { randomSlugSuffix, slugifyRecordPart } from "@/lib/slug";
import { normalizeLocale } from "@/lib/i18n/locale";
import { mockTranslateClosingNote } from "@/lib/i18n/mock-translate-closing";

export type CreateSoldRecordResult =
  | { ok: true; agentSlug: string; recordSlug: string }
  | { ok: false; error: string };

function parsePrice(raw: string): number | null {
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function parseDays(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export async function createSoldRecord(formData: FormData): Promise<CreateSoldRecordResult> {
  if (!isSupabaseServerConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  const address = String(formData.get("address") ?? "").trim();
  const cityState = String(formData.get("city_state") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "");
  const daysRaw = String(formData.get("days_on_market") ?? "");
  const represented = String(formData.get("represented_side") ?? "").trim() || null;
  const closedAtRaw = String(formData.get("closed_at") ?? "").trim();
  const closedAt = closedAtRaw.length > 0 ? closedAtRaw : null;
  const propertyImageUrl = String(formData.get("property_image_url") ?? "").trim() || null;
  const verificationDocUrl = String(formData.get("verification_doc_url") ?? "").trim() || null;
  const soldStoryRaw = String(formData.get("sold_story") ?? "").trim();
  let soldStory = soldStoryRaw.length > 0 ? soldStoryRaw : null;
  const translateClosing =
    String(formData.get("translate_to_my_language") ?? "") === "on" ||
    String(formData.get("translate_to_my_language") ?? "") === "true";

  if (!address) {
    return { ok: false, error: "Please enter a street address." };
  }

  const price = parsePrice(priceRaw);
  if (price === null) {
    return { ok: false, error: "Sold price format is invalid." };
  }

  const daysOnMarket = parseDays(daysRaw);
  if (daysOnMarket === null) {
    return { ok: false, error: "Days on market must be a valid number." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("slug, language")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.slug) {
    return { ok: false, error: "Profile not found. Please contact support." };
  }

  const profileLang = normalizeLocale(profile.language as string | null | undefined);
  const recordLanguage = profileLang;

  if (translateClosing && profileLang !== "en" && soldStory) {
    soldStory = await mockTranslateClosingNote(soldStory, profileLang);
  }

  const baseSlug = slugifyRecordPart(address);
  let recordSlug = baseSlug;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await supabase.from("sold_records").insert({
      agent_id: user.id,
      slug: recordSlug,
      address,
      city_state: cityState,
      price,
      days_on_market: daysOnMarket,
      property_image_url: propertyImageUrl,
      verification_doc_url: verificationDocUrl,
      sold_story: soldStory,
      language: recordLanguage,
      is_verified: false,
      represented_side: represented,
      closed_at: closedAt,
    });

    if (!error) {
      revalidatePath(`/${profile.slug}`);
      revalidatePath(`/${profile.slug}/${recordSlug}`);
      return { ok: true, agentSlug: profile.slug, recordSlug };
    }

    lastError = error.message;
    if (error.code === "23505" || error.message?.includes("duplicate")) {
      recordSlug = `${baseSlug}-${randomSlugSuffix()}`;
      continue;
    }
    break;
  }

  return { ok: false, error: lastError ?? "Could not save. Please try again." };
}
