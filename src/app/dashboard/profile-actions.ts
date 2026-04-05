"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";
import { parseLocaleFromForm, type SupportedLocale } from "@/lib/i18n/locale";

const ALLOWED: SupportedLocale[] = ["en", "zh", "ru", "es"];

export async function updateProfileLanguage(formData: FormData): Promise<void> {
  if (!isSupabaseServerConfigured()) {
    return;
  }

  const raw = String(formData.get("language") ?? "en");
  const language = parseLocaleFromForm(raw);
  if (!ALLOWED.includes(language)) {
    return;
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase.from("profiles").update({ language }).eq("id", user.id);

  if (error) {
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/settings");
}

/** EN/CN poster label toggle: match each sale, or force English / Chinese layout + copy. */
export async function updateProfilePosterLabels(formData: FormData): Promise<void> {
  if (!isSupabaseServerConfigured()) {
    return;
  }

  const raw = String(formData.get("poster_labels_locale") ?? "match").toLowerCase();
  const poster_labels_locale = raw === "zh" ? "zh" : raw === "en" ? "en" : null;

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase.from("profiles").update({ poster_labels_locale }).eq("id", user.id);

  if (error) {
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
}

/** Poster-only: omit leading street number on exported images; city/state line unchanged. */
export async function updateProfilePosterAddressPrivacy(formData: FormData): Promise<void> {
  if (!isSupabaseServerConfigured()) {
    return;
  }

  const poster_address_privacy = formData.get("poster_address_privacy") === "on";

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { data: profile } = await supabase.from("profiles").select("slug").eq("id", user.id).maybeSingle();
  const agentSlug = profile?.slug as string | undefined;

  const { error } = await supabase
    .from("profiles")
    .update({ poster_address_privacy })
    .eq("id", user.id);

  if (error) {
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  if (agentSlug) {
    revalidatePath(`/${agentSlug}`);
    const { data: records } = await supabase.from("sold_records").select("slug").eq("agent_id", user.id);
    for (const row of records ?? []) {
      const s = row.slug as string | undefined;
      if (s) revalidatePath(`/${agentSlug}/${s}`);
    }
  }
  revalidatePath("/", "layout");
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function identityErrorRedirect(message: string): never {
  redirect(`/dashboard/settings?identity_error=${encodeURIComponent(message)}`);
}

/** Next.js `redirect()` throws this digest; must rethrow from catch blocks. */
function isNextRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** PostgREST / Postgres when `profiles.accent_hex` migration was not applied. */
function isMissingAccentHexColumnError(err: { code?: string; message?: string }): boolean {
  const msg = (err.message ?? "").toLowerCase();
  if (err.code === "42703" && msg.includes("accent_hex")) return true;
  if (err.code === "PGRST204" && msg.includes("accent_hex")) return true;
  if (/could not find.*accent_hex/.test(msg)) return true;
  if (msg.includes("accent_hex") && (msg.includes("does not exist") || msg.includes("schema cache"))) return true;
  return false;
}

type IdentityPayload = {
  slug: string;
  name: string;
  title: string | null;
  brokerage: string;
  bio: string;
  accent_hex: string | null;
};

/**
 * Maps UI fields to existing columns: slug, name, title, brokerage, bio, accent_hex.
 *
 * Duplicate slug:
 * - If the new handle is already owned by another row, we redirect with "Handle already taken."
 *   (pre-check when slug changed, plus 23505 / unique violation on update for race conditions).
 * - Updates are always scoped with .eq("id", actorId) where actorId comes only from auth.getUser().
 */
export async function updateProfileIdentity(formData: FormData): Promise<void> {
  if (!isSupabaseServerConfigured()) {
    identityErrorRedirect("Supabase is not configured.");
  }

  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login?next=/dashboard/settings");
    }

    // Single source of truth for who is being updated — never read user id from FormData.
    const actorId = user.id;

    const slug = String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const titleRaw = String(formData.get("title") ?? "").trim();
    const brokerage = String(formData.get("brokerage") ?? "").trim();
    const bio = String(formData.get("bio") ?? "").trim();
    const accentRaw = String(formData.get("accent_hex") ?? "").trim();

    if (!SLUG_PATTERN.test(slug) || slug.length < 2 || slug.length > 48) {
      identityErrorRedirect(
        "Handle must be 2–48 characters: lowercase letters, numbers, and single hyphens between segments (e.g. jane-doe).",
      );
    }

    if (!name) {
      identityErrorRedirect("Display name is required.");
    }

    let accent_hex: string | null = null;
    if (accentRaw) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(accentRaw)) {
        identityErrorRedirect("Accent color must be a valid hex value (e.g. #1c1917).");
      }
      accent_hex = accentRaw.toLowerCase();
    }

    const { data: current, error: readErr } = await supabase
      .from("profiles")
      .select("slug")
      .eq("id", actorId)
      .maybeSingle();

    if (readErr || !current?.slug) {
      identityErrorRedirect("Could not load your profile.");
    }

    const oldSlug = current.slug;

    if (slug !== oldSlug) {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("slug", slug)
        .neq("id", actorId)
        .maybeSingle();
      if (taken) {
        identityErrorRedirect("Handle already taken.");
      }
    }

    const payload: IdentityPayload = {
      slug,
      name,
      title: titleRaw.length > 0 ? titleRaw : null,
      brokerage,
      bio,
      accent_hex,
    };

    const { error: updateErr } = await supabase.from("profiles").update(payload).eq("id", actorId);

    let finalError = updateErr;

    if (finalError && isMissingAccentHexColumnError(finalError)) {
      const withoutAccent: Omit<IdentityPayload, "accent_hex"> = {
        slug: payload.slug,
        name: payload.name,
        title: payload.title,
        brokerage: payload.brokerage,
        bio: payload.bio,
      };
      const { error: retryErr } = await supabase.from("profiles").update(withoutAccent).eq("id", actorId);
      finalError = retryErr;
    }

    if (finalError) {
      if (finalError.code === "23505" || /duplicate|unique/i.test(finalError.message)) {
        identityErrorRedirect("Handle already taken.");
      }
      identityErrorRedirect(finalError.message || "Could not save profile.");
    }

    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    revalidatePath(`/${oldSlug}`);
    if (oldSlug !== slug) {
      revalidatePath(`/${slug}`);
    }
    revalidatePath("/", "layout");

    redirect("/dashboard/settings?saved=identity");
  } catch (e) {
    if (isNextRedirectError(e)) {
      throw e;
    }
    console.error("[updateProfileIdentity]", e);
    identityErrorRedirect("Could not save profile. Please try again.");
  }
}
