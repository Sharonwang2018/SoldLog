import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerificationBadge } from "@/components/features/verification-badge";
import { SharePropertyButton } from "@/components/features/share-property-button";
import { GenerateSoldPosterButton } from "@/components/features/generate-sold-poster-button";
import { BLUR_DATA_URL } from "@/lib/constants/blur-placeholder";
import { intlDateLocale } from "@/lib/i18n/locale";
import { soldStoryStrings } from "@/lib/i18n/sold-story-copy";
import { listStaticRecordParams } from "@/lib/data/mock-public-agent";
import { resolveSoldRecord } from "@/lib/data/resolve-public-agent";
import { absoluteAssetUrlForMetadata } from "@/lib/metadata/absolute-asset-url";

export const dynamic = "force-dynamic";

type PageProps = { params: { "agent-slug": string; "record-id": string } };

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function generateStaticParams() {
  return listStaticRecordParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await resolveSoldRecord(params["agent-slug"], params["record-id"]);
  if (!data) return { title: "Sold story" };
  const { agent, listing } = data;
  const title = `${listing.addressLine} · ${agent.displayName}`;
  const description = `Sold ${formatUsd(listing.finalPrice)} · ${listing.cityState}`;
  const ogImage = absoluteAssetUrlForMetadata(listing.coverImageSrc);
  const images = ogImage ? [{ url: ogImage, alt: listing.coverImageAlt }] : undefined;
  return {
    title,
    description,
    openGraph: { title, description: listing.addressLine, images },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function SoldStoryPage({ params }: PageProps) {
  const data = await resolveSoldRecord(params["agent-slug"], params["record-id"]);
  if (!data) notFound();
  const { agent, listing } = data;
  const storyPath = `/${agent.slug}/${listing.id}`;
  const shareTitle = `${listing.addressLine} · Sold`;
  const shareText = `Just closed: ${listing.addressLine} — ${formatUsd(listing.finalPrice)}`;

  const copy = soldStoryStrings("en");
  const dateLocale = intlDateLocale("en");

  return (
    <div
      lang="en"
      className="min-h-dvh bg-[var(--sl-bg)] text-[var(--sl-fg)] [background-image:radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(120,113,108,0.06),transparent)] dark:[background-image:radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(255,255,255,0.03),transparent)]"
    >
      <div className="relative aspect-[4/3] w-full sm:mx-auto sm:max-w-3xl sm:overflow-hidden sm:rounded-b-[2rem] sm:shadow-[0_24px_80px_-40px_rgba(0,0,0,0.35)] sm:ring-1 sm:ring-black/[0.06] dark:sm:ring-white/[0.08]">
        <Image
          src={listing.coverImageSrc}
          alt={listing.coverImageAlt}
          fill
          priority
          className="object-cover"
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"
          aria-hidden
        />
        <Link
          href={`/${agent.slug}`}
          className="tap-highlight-none absolute left-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/12 px-4 font-sans text-sm font-medium text-white backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/20"
        >
          ← Back
        </Link>
        <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10">
          <SharePropertyButton storyPath={storyPath} title={shareTitle} text={shareText} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-10">
          {listing.verified && (
            <span className="mb-3 inline-block">
              <VerificationBadge variant="on-dark" />
            </span>
          )}
          <h1 className="text-balance text-2xl font-semibold leading-[1.15] tracking-tight sm:text-4xl sm:leading-tight">
            {listing.addressLine}
          </h1>
          <p className="mt-2 font-sans text-[15px] text-white/88 sm:text-base">{listing.cityState}</p>

          <div className="mt-7 grid max-w-md grid-cols-2 gap-8 border-t border-white/15 pt-7">
            <div>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
                {copy.soldFor}
              </p>
              <p className="mt-2 font-sans text-2xl font-medium tabular-nums tracking-tight sm:text-3xl">
                {formatUsd(listing.finalPrice)}
              </p>
            </div>
            <div>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
                {copy.daysOnMarket}
              </p>
              <p className="mt-2 font-sans text-2xl font-medium tabular-nums tracking-tight sm:text-3xl">
                {listing.daysOnMarket}
              </p>
            </div>
          </div>

          <p className="mt-7 font-sans text-sm text-white/70">{copy.closed(formatDate(listing.closedAt, dateLocale))}</p>
        </div>
      </div>

      <article className="mx-auto max-w-lg border-t border-slate-200/70 px-6 py-14 sm:max-w-2xl sm:border-t-0 sm:px-8 sm:py-20 dark:border-slate-800/80">
        <p className="font-sans text-[13px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          {copy.listedBy(agent.displayName)}
        </p>
        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:mt-10 sm:text-[1.75rem]">
          {copy.theStory}
        </h2>
        <p className="mt-5 font-sans text-[17px] leading-[1.75] text-slate-600 dark:text-slate-300">
          {listing.soldStory?.trim() ? listing.soldStory.trim() : copy.storyFallback}
        </p>
        <div className="mt-12 flex flex-col gap-3 sm:max-w-md">
          <GenerateSoldPosterButton
            agentPosterLabelsLocale={agent.posterLabelsLocale}
            listing={{
              coverImageSrc: listing.coverImageSrc,
              addressLine: listing.addressLine,
              cityState: listing.cityState,
              finalPrice: listing.finalPrice,
              daysOnMarket: listing.daysOnMarket,
              agentDisplayName: agent.displayName,
              language: listing.language,
            }}
          />
          <Link
            href={`/${agent.slug}`}
            className="tap-highlight-none inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-900 px-6 font-sans text-[15px] font-medium text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-stone-100"
          >
            {copy.viewAllSales}
          </Link>
        </div>
      </article>

      <footer className="pb-16 pt-4 text-center">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.25em] text-slate-400 dark:text-slate-600">
          SoldLog
        </p>
      </footer>
    </div>
  );
}
