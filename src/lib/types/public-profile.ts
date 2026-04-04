export type SoldListing = {
  id: string;
  addressLine: string;
  cityState: string;
  finalPrice: number;
  /** Calendar days on market until close */
  daysOnMarket: number;
  /** ISO date for display */
  closedAt: string;
  coverImageSrc: string;
  coverImageAlt: string;
  verified: boolean;
  /** Optional narrative shown on the sold story page */
  soldStory?: string | null;
  /** Public display locale (labels, poster, formatting) */
  language?: string;
};

export type AgentPublicProfile = {
  slug: string;
  displayName: string;
  title: string;
  brokerage: string;
  /** Public headshot or logo */
  avatarSrc: string;
  avatarAlt: string;
  accentHex: string;
  bio: string;
  /** Primary contact link, e.g. mailto:agent@example.com */
  contactHref?: string | null;
  /** Sum of verified sold prices (USD) */
  verifiedVolumeUsd: number;
  /** Preferred language for new records and dashboard copy */
  language?: string;
  /** null = poster labels follow each sale's language; en | zh = force poster locale */
  posterLabelsLocale?: string | null;
  soldListings: SoldListing[];
};
