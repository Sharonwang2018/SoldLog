import type { AgentPublicProfile, SoldListing } from "@/lib/types/public-profile";
import { sumVerifiedVolumeUsd } from "@/lib/data/public-profile-stats";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=900&fit=crop&q=80";
const PLACEHOLDER_AVATAR =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&q=80";

type ProfileRow = {
  id: string;
  name: string;
  title: string | null;
  brokerage: string;
  bio: string;
  photo_url: string | null;
  slug: string;
  contact_href: string | null;
  language?: string | null;
  poster_labels_locale?: string | null;
  accent_hex?: string | null;
  poster_address_privacy?: boolean | null;
};

/** Columns that exist on all migrated DBs; keep separate from optional `poster_address_privacy` so a missing column does not 404 the whole public site. */
const PROFILE_CORE_SELECT =
  "id, name, title, brokerage, bio, photo_url, slug, contact_href, language, poster_labels_locale, accent_hex";

async function loadProfileRowBySlug(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  slug: string,
): Promise<ProfileRow | null> {
  const { data: profile, error: pe } = await supabase
    .from("profiles")
    .select(PROFILE_CORE_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (pe || !profile) return null;

  const { data: privacy, error: privacyErr } = await supabase
    .from("profiles")
    .select("poster_address_privacy")
    .eq("id", profile.id)
    .maybeSingle();

  const poster_address_privacy =
    !privacyErr && privacy && typeof privacy.poster_address_privacy === "boolean"
      ? privacy.poster_address_privacy
      : null;

  return { ...(profile as ProfileRow), poster_address_privacy };
}

type SoldRecordRow = {
  slug: string;
  address: string;
  city_state: string;
  price: number;
  days_on_market: number;
  property_image_url: string | null;
  is_verified: boolean;
  closed_at: string | null;
  created_at: string;
  sold_story?: string | null;
  language?: string | null;
  represented_side?: string | null;
};

function mapListing(r: SoldRecordRow): SoldListing {
  const closed =
    r.closed_at ??
    (r.created_at ? r.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
  return {
    id: r.slug,
    addressLine: r.address,
    cityState: r.city_state || "",
    finalPrice: Number(r.price),
    daysOnMarket: r.days_on_market,
    closedAt: closed,
    coverImageSrc: r.property_image_url || PLACEHOLDER_IMAGE,
    coverImageAlt: r.address,
    verified: r.is_verified,
    soldStory: r.sold_story ?? undefined,
    language: r.language ?? "en",
    representedSide: r.represented_side?.trim() || undefined,
  };
}

function mapAgent(p: ProfileRow, listings: SoldListing[]): AgentPublicProfile {
  return {
    slug: p.slug,
    displayName: p.name || "Agent",
    title: p.title || "",
    brokerage: p.brokerage || "",
    avatarSrc: p.photo_url || PLACEHOLDER_AVATAR,
    avatarAlt: p.name || "Agent",
    accentHex: p.accent_hex && /^#[0-9A-Fa-f]{6}$/.test(p.accent_hex) ? p.accent_hex : "#1c1917",
    bio: p.bio || "",
    contactHref: p.contact_href ?? undefined,
    verifiedVolumeUsd: sumVerifiedVolumeUsd(listings),
    language: p.language ?? "en",
    posterLabelsLocale: p.poster_labels_locale ?? null,
    posterAddressPrivacy: Boolean(p.poster_address_privacy),
    soldListings: listings,
  };
}

export async function loadPublicAgentFromDb(slug: string): Promise<AgentPublicProfile | null> {
  if (!isSupabaseServerConfigured()) return null;

  const supabase = createServerSupabaseClient();

  const profile = await loadProfileRowBySlug(supabase, slug);
  if (!profile) return null;

  const { data: records, error: re } = await supabase
    .from("sold_records")
    .select(
      "slug, address, city_state, price, days_on_market, property_image_url, is_verified, closed_at, created_at, sold_story, language, represented_side",
    )
    .eq("agent_id", profile.id)
    .order("created_at", { ascending: false });

  if (re) return null;

  return mapAgent(profile as ProfileRow, (records as SoldRecordRow[] | null)?.map(mapListing) ?? []);
}

export async function loadSoldRecordFromDb(
  agentSlug: string,
  recordSlug: string,
): Promise<{ agent: AgentPublicProfile; listing: SoldListing } | null> {
  if (!isSupabaseServerConfigured()) return null;

  const supabase = createServerSupabaseClient();

  const profile = await loadProfileRowBySlug(supabase, agentSlug);
  if (!profile) return null;

  const { data: r, error: re } = await supabase
    .from("sold_records")
    .select(
      "slug, address, city_state, price, days_on_market, property_image_url, is_verified, closed_at, created_at, sold_story, language, represented_side",
    )
    .eq("agent_id", profile.id)
    .eq("slug", recordSlug)
    .maybeSingle();

  if (re || !r) return null;

  const listing = mapListing(r as SoldRecordRow);
  const agent = mapAgent(profile as ProfileRow, []);
  return { agent, listing };
}
