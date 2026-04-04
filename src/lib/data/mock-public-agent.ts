import type { AgentPublicProfile } from "@/lib/types/public-profile";
import { sumVerifiedVolumeUsd } from "@/lib/data/public-profile-stats";

const MOCK_AGENTS_RAW: Record<string, Omit<AgentPublicProfile, "verifiedVolumeUsd">> = {
  "jane-doe": {
    slug: "jane-doe",
    language: "en",
    displayName: "Jane Doe",
    title: "Luxury Real Estate Advisor",
    brokerage: "Compass · San Francisco",
    avatarSrc:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&q=80",
    avatarAlt: "Jane Doe professional portrait",
    accentHex: "#1c1917",
    bio: "Closed $120M+ in Bay Area residential. Your move, elevated.",
    contactHref: "mailto:jane.doe@example.com?subject=Real%20estate%20inquiry",
    soldListings: [
      {
        id: "sf-pac-heights",
        addressLine: "2845 Pacific Ave",
        cityState: "San Francisco, CA",
        finalPrice: 4_850_000,
        daysOnMarket: 12,
        closedAt: "2025-11-18",
        coverImageSrc:
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=900&fit=crop&q=80",
        coverImageAlt: "Modern home exterior at dusk",
        verified: true,
        language: "en",
      },
      {
        id: "marin-hills",
        addressLine: "12 Ridgecrest Way",
        cityState: "Mill Valley, CA",
        finalPrice: 2_195_000,
        daysOnMarket: 45,
        closedAt: "2025-09-02",
        coverImageSrc:
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=900&fit=crop&q=80",
        coverImageAlt: "Hillside contemporary residence",
        verified: true,
        language: "en",
      },
      {
        id: "oakland-loft",
        addressLine: "428 4th St · Unit 12",
        cityState: "Oakland, CA",
        finalPrice: 925_000,
        daysOnMarket: 8,
        closedAt: "2025-06-14",
        coverImageSrc:
          "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=900&fit=crop&q=80",
        coverImageAlt: "Bright loft interior with city views",
        verified: false,
        language: "en",
      },
      {
        id: "jingan-tower",
        addressLine: "1788 Nanjing West Road, Jing'an District",
        cityState: "Shanghai, China",
        finalPrice: 2_150_000,
        daysOnMarket: 18,
        closedAt: "2025-08-01",
        coverImageSrc:
          "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=900&fit=crop&q=80",
        coverImageAlt: "High-rise residence and city skyline",
        verified: true,
        language: "en",
        soldStory:
          "Demo: a cross-border buyer and local seller aligned quickly—three weeks from offer to close in a competitive corridor.",
      },
    ],
  },
  "jack-wang": {
    slug: "jack-wang",
    language: "en",
    displayName: "Jack Wang",
    title: "Principal Agent · Estates",
    brokerage: "Sotheby's · Los Angeles",
    avatarSrc:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&q=80",
    avatarAlt: "Jack Wang portrait",
    accentHex: "#292524",
    bio: "Architectural homes from the Hills to the coast.",
    contactHref: "mailto:jack.wang@example.com?subject=Real%20estate%20inquiry",
    soldListings: [
      {
        id: "beverly-view",
        addressLine: "1821 Stone Canyon Rd",
        cityState: "Los Angeles, CA",
        finalPrice: 6_200_000,
        daysOnMarket: 21,
        closedAt: "2025-10-01",
        coverImageSrc:
          "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&h=900&fit=crop&q=80",
        coverImageAlt: "Pool and modern home at golden hour",
        verified: true,
        language: "en",
      },
    ],
  },
};

function withVolume(agent: Omit<AgentPublicProfile, "verifiedVolumeUsd">): AgentPublicProfile {
  return {
    ...agent,
    verifiedVolumeUsd: sumVerifiedVolumeUsd(agent.soldListings),
  };
}

export function getPublicAgentBySlug(slug: string): AgentPublicProfile | null {
  const raw = MOCK_AGENTS_RAW[slug];
  if (!raw) return null;
  return withVolume(raw);
}

export function listDemoSlugs(): string[] {
  return Object.keys(MOCK_AGENTS_RAW);
}

export function getSoldListing(
  agentSlug: string,
  recordId: string,
): { agent: AgentPublicProfile; listing: AgentPublicProfile["soldListings"][number] } | null {
  const agent = getPublicAgentBySlug(agentSlug);
  if (!agent) return null;
  const listing = agent.soldListings.find((s) => s.id === recordId);
  if (!listing) return null;
  return { agent, listing };
}

export function listStaticRecordParams(): { "agent-slug": string; "record-id": string }[] {
  return listDemoSlugs().flatMap((slug) => {
    const agent = getPublicAgentBySlug(slug);
    if (!agent) return [];
    return agent.soldListings.map((l) => ({
      "agent-slug": slug,
      "record-id": l.id,
    }));
  });
}
