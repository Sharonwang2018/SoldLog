"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { SoldListing } from "@/lib/types/public-profile";
import { BLUR_DATA_URL } from "@/lib/constants/blur-placeholder";
import { VerificationBadge } from "@/components/features/verification-badge";
import { SharePropertyButton } from "@/components/features/share-property-button";
import { GenerateSoldPosterButton } from "@/components/features/generate-sold-poster-button";
import { cn } from "@/lib/utils";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type SoldCardProps = {
  agentSlug: string;
  agentDisplayName?: string;
  /** Brand color for the listing price (from profiles.accent_hex). */
  accentHex?: string;
  posterLabelsLocale?: string | null;
  /** Strip leading house number on generated posters only (Settings → poster privacy). */
  posterAddressPrivacy?: boolean;
  /** Public profile photo — poster small image prefers this over listing cover. */
  agentAvatarSrc?: string | null;
  listing: SoldListing;
  priority?: boolean;
  index?: number;
};

export function SoldCard({
  agentSlug,
  agentDisplayName,
  accentHex = "#0f172a",
  posterLabelsLocale,
  posterAddressPrivacy = false,
  agentAvatarSrc = null,
  listing,
  priority,
  index = 0,
}: SoldCardProps) {
  const href = `/${agentSlug}/${listing.id}`;
  const storyPath = href;
  const shareTitle = `${listing.addressLine} · Sold`;
  const shareText = `Just closed: ${listing.addressLine} — ${formatUsd(listing.finalPrice)}`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="relative list-none"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white",
          "shadow-[0_1px_2px_rgba(15,23,42,0.03),0_8px_28px_-6px_rgba(15,23,42,0.07)]",
          "transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:-translate-y-1 hover:border-slate-300/80",
          "hover:shadow-[0_2px_4px_rgba(15,23,42,0.02),0_16px_40px_-8px_rgba(15,23,42,0.1)]",
          "dark:border-slate-700/55 dark:bg-slate-950",
          "dark:shadow-[0_1px_2px_rgba(0,0,0,0.15),0_10px_32px_-8px_rgba(0,0,0,0.35)]",
          "dark:hover:border-slate-600/80 dark:hover:shadow-[0_2px_6px_rgba(0,0,0,0.2),0_18px_48px_-10px_rgba(0,0,0,0.45)]",
        )}
      >
        <div className="absolute left-3 top-3 z-10">
          <SharePropertyButton storyPath={storyPath} title={shareTitle} text={shareText} />
        </div>

        <Link
          href={href}
          className="group tap-highlight-none block outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
            <Image
              src={listing.coverImageSrc}
              alt={listing.coverImageAlt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
              priority={priority}
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent"
              aria-hidden
            />
            {listing.verified && (
              <span className="pointer-events-none absolute right-3 top-3 z-[1]">
                <VerificationBadge variant="on-dark" />
              </span>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-white/75">
                Sold
              </p>
              <p className="mt-1 font-sans text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                {listing.addressLine}
              </p>
              <p className="mt-0.5 font-sans text-sm text-white/85">{listing.cityState}</p>
            </div>
          </div>
        </Link>

        <div className="border-t border-slate-100 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-5 sm:py-5">
          <div className="grid grid-cols-2 gap-5 sm:gap-8">
            <div>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Price
              </p>
              <p
                className="mt-1.5 font-sans text-xl font-semibold tabular-nums tracking-tight sm:text-2xl"
                style={{ color: accentHex }}
              >
                {formatUsd(listing.finalPrice)}
              </p>
            </div>
            <div>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Days on market
              </p>
              <p className="mt-1.5 font-sans text-xl font-medium tabular-nums tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
                {listing.daysOnMarket}
              </p>
            </div>
          </div>
          <GenerateSoldPosterButton
            variant="compact"
            className="mt-4"
            agentPosterLabelsLocale={posterLabelsLocale}
            accentHex={accentHex}
            listing={{
              coverImageSrc: listing.coverImageSrc,
              addressLine: listing.addressLine,
              cityState: listing.cityState,
              finalPrice: listing.finalPrice,
              daysOnMarket: listing.daysOnMarket,
              soldStory: listing.soldStory,
              representedSide: listing.representedSide,
              agentDisplayName,
              agentAvatarSrc,
              language: listing.language,
              posterRedactStreetNumber: posterAddressPrivacy,
            }}
          />
        </div>
      </div>
    </motion.li>
  );
}
