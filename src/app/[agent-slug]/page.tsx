import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentStickyHeader } from "@/components/shared/agent-sticky-header";
import { MobileContactAgentBar } from "@/components/shared/mobile-contact-agent-bar";
import { ShareProfileButton } from "@/components/features/share-profile-button";
import { SoldCard } from "@/components/features/sold-card";
import { formatVerifiedVolumeShort } from "@/lib/data/public-profile-stats";
import { listDemoSlugs } from "@/lib/data/mock-public-agent";
import { resolvePublicAgent } from "@/lib/data/resolve-public-agent";
import { absoluteAssetUrlForMetadata } from "@/lib/metadata/absolute-asset-url";

export const dynamic = "force-dynamic";

type PageProps = { params: { "agent-slug": string } };

export function generateStaticParams() {
  return listDemoSlugs().map((slug) => ({ "agent-slug": slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const agent = await resolvePublicAgent(params["agent-slug"]);
  if (!agent) return { title: "Profile" };
  const title = `${agent.displayName} · SoldLog`;
  const description = agent.bio?.trim() || `Recent sales by ${agent.displayName}`;
  const ogImage = absoluteAssetUrlForMetadata(agent.avatarSrc);
  const images = ogImage ? [{ url: ogImage, alt: agent.avatarAlt }] : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PublicAgentProfilePage({ params }: PageProps) {
  const slug = params["agent-slug"];
  const agent = await resolvePublicAgent(slug);
  if (!agent) notFound();

  const sharePath = `/${agent.slug}`;
  const shareTitle = `${agent.displayName} on SoldLog`;
  const shareText = `See ${agent.displayName}'s recent sales — ${agent.bio}`;

  return (
    <div className="min-h-dvh bg-[var(--sl-bg)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-[var(--sl-fg)] md:pb-0 [background-image:radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(120,113,108,0.07),transparent)] dark:[background-image:radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,255,255,0.04),transparent)]">
      <AgentStickyHeader
        agentSlug={agent.slug}
        displayName={agent.displayName}
        avatarSrc={agent.avatarSrc}
        avatarAlt={agent.avatarAlt}
        shareTitle={shareTitle}
        shareText={shareText}
        contactHref={agent.contactHref}
      />

      <a
        href="#sold-grid"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-stone-900 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to sold properties
      </a>

      <header className="border-b border-slate-200/80 bg-[var(--sl-header)] backdrop-blur-xl dark:border-slate-800/80">
        <div className="mx-auto flex max-w-lg flex-col items-center px-6 pb-16 pt-16 sm:max-w-2xl sm:px-8 sm:pb-20 sm:pt-20">
          <div
            className="relative aspect-square h-40 w-40 shrink-0 overflow-hidden rounded-[2rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5 dark:ring-white/10 sm:h-44 sm:w-44"
            style={{ backgroundColor: agent.accentHex }}
          >
            <Image
              src={agent.avatarSrc}
              alt={agent.avatarAlt}
              width={352}
              height={352}
              priority
              className="h-full w-full min-h-0 min-w-0 object-cover object-center"
              sizes="(max-width: 640px) 160px, 176px"
            />
          </div>

          <h1 className="mt-8 text-balance text-center text-3xl font-semibold tracking-tight sm:text-[2.25rem]">
            {agent.displayName}
          </h1>
          <p className="mt-2 text-center font-sans text-[15px] text-slate-600 dark:text-slate-400">
            {agent.title}
          </p>
          <p className="mt-1 text-center font-sans text-sm text-slate-500 dark:text-slate-500">
            {agent.brokerage}
          </p>

          <div className="mt-10 w-full max-w-md">
            <div className="rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/90 via-white to-stone-50/95 px-6 py-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-24px_rgba(0,0,0,0.12)] dark:border-amber-900/35 dark:from-amber-950/40 dark:via-stone-950 dark:to-stone-950 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] sm:px-8 sm:py-7">
              <p className="text-center font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-200/90">
                Verified volume
              </p>
              <p className="mt-3 text-center font-display text-4xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-5xl dark:text-slate-50">
                {formatVerifiedVolumeShort(agent.verifiedVolumeUsd)}
              </p>
              <p className="mt-2 text-center font-sans text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Sum of verified sale prices on SoldLog
              </p>
            </div>
          </div>

          <p className="mx-auto mt-10 max-w-md text-center font-sans text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            {agent.bio}
          </p>

          <div className="mt-10 hidden w-full max-w-sm sm:block">
            <ShareProfileButton sharePath={sharePath} title={shareTitle} text={shareText} />
          </div>
        </div>
      </header>

      <main
        id="sold-grid"
        className="mx-auto max-w-lg scroll-mt-4 px-5 py-10 sm:max-w-5xl sm:px-8 sm:py-16 lg:py-20"
      >
        <div className="mb-8 flex items-end justify-between gap-6 border-b border-slate-200/60 pb-8 sm:mb-12 sm:pb-10 lg:mb-14 lg:pb-12 dark:border-slate-800/80">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              Recent closings
            </h2>
            <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Verified sales carry the SoldLog seal. Open a card for the full story.
            </p>
          </div>
        </div>

        {agent.soldListings.length === 0 ? (
          <p className="text-center font-sans text-slate-500 dark:text-slate-400">No public closings yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3 lg:gap-12 xl:gap-14">
            {agent.soldListings.map((listing, i) => (
              <SoldCard
                key={listing.id}
                agentSlug={agent.slug}
                agentDisplayName={agent.displayName}
                accentHex={agent.accentHex}
                posterLabelsLocale={agent.posterLabelsLocale}
                listing={listing}
                priority={i < 2}
                index={i}
              />
            ))}
          </ul>
        )}
      </main>

      <footer className="pb-[max(6.5rem,env(safe-area-inset-bottom))] pt-12 text-center md:pb-[max(3rem,env(safe-area-inset-bottom))]">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.25em] text-slate-400 dark:text-slate-600">
          SoldLog
        </p>
      </footer>

      <MobileContactAgentBar
        contactHref={agent.contactHref}
        sharePath={sharePath}
        shareTitle={shareTitle}
        shareText={shareText}
      />
    </div>
  );
}
