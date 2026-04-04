import type { SoldListing } from "@/lib/types/public-profile";

/** Sum of `finalPrice` for listings where `verified` is true */
export function sumVerifiedVolumeUsd(listings: SoldListing[]): number {
  return listings.filter((l) => l.verified).reduce((sum, l) => sum + l.finalPrice, 0);
}

export function formatUsdFull(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Readable headline stat e.g. $7.9M */
export function formatVerifiedVolumeShort(n: number): string {
  if (n <= 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return formatUsdFull(n);
}
