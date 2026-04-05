"use client";

import { useCallback, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { ImageDown, Loader2 } from "lucide-react";
import { SoldPosterDom, posterThumbNeedsDecode, type PosterPayload } from "@/components/SoldPoster";
import { posterDisplayAddressLine } from "@/lib/poster-address-privacy";
import { posterCanvasSpec, resolvePosterLocale, type SupportedLocale } from "@/lib/i18n/locale";
import { soldStoryStrings } from "@/lib/i18n/sold-story-copy";
import { cn } from "@/lib/utils";

export type { PosterPayload } from "@/components/SoldPoster";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function slugifyFilePart(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "sale"
  );
}

function waitForImage(img: HTMLImageElement | null) {
  if (!img) return Promise.resolve();
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Poster image could not be loaded (check photo URL / CORS)."));
  });
}

const FONT_STYLESHEETS: Partial<Record<SupportedLocale, string>> = {
  zh: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@500;600;700&display=swap",
  ru: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@500;600;700&subset=cyrillic,latin&display=swap",
  es: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@500;600;700&subset=latin&display=swap",
};

async function ensurePosterFonts(locale: SupportedLocale): Promise<void> {
  if (typeof document === "undefined") return;
  const href = FONT_STYLESHEETS[locale];
  if (!href) return;

  const attr = `data-soldlog-poster-font-${locale}`;
  if (!document.querySelector(`link[${attr}]`)) {
    await new Promise<void>((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute(attr, "1");
      link.onload = () => resolve();
      link.onerror = () => reject(new Error("Could not load poster fonts."));
      document.head.appendChild(link);
    });
  }
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

export type GenerateSoldPosterButtonProps = {
  listing: PosterPayload;
  /** From Dashboard → Poster labels (EN / Chinese / match each sale). */
  agentPosterLabelsLocale?: string | null;
  /** Profile accent mixed into hero gradient; listing photos are never full-bleed. */
  accentHex?: string | null;
  className?: string;
  variant?: "default" | "compact";
};

export function GenerateSoldPosterButton({
  listing,
  agentPosterLabelsLocale,
  accentHex,
  className,
  variant = "default",
}: GenerateSoldPosterButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const listingImageRef = useRef<HTMLImageElement>(null);

  const locale = resolvePosterLocale(listing.language, agentPosterLabelsLocale);
  const spec = posterCanvasSpec(locale);
  const uiCopy = soldStoryStrings("en");

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    const node = posterRef.current;
    if (!node) {
      setBusy(false);
      return;
    }
    try {
      if (locale !== "en") {
        await ensurePosterFonts(locale);
      }
      if (posterThumbNeedsDecode(listing)) {
        await waitForImage(listingImageRef.current);
      }
      await new Promise((r) => setTimeout(r, 120));
      const blob = await toBlob(node, {
        cacheBust: true,
        pixelRatio: 1,
        width: spec.width,
        height: spec.height,
        canvasWidth: spec.width,
        canvasHeight: spec.height,
        backgroundColor: "#0c0a09",
        skipFonts: locale === "en",
      });
      if (!blob) throw new Error("Could not render poster.");

      const lineForPoster = posterDisplayAddressLine(
        listing.addressLine,
        Boolean(listing.posterRedactStreetNumber),
      );
      const filename = `soldlog-${slugifyFilePart(lineForPoster)}-${spec.width}x${spec.height}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: lineForPoster,
            text: `${formatUsd(listing.finalPrice)} · ${listing.cityState}`,
          });
        } catch (e) {
          const err = e as Error;
          if (err?.name === "AbortError") return;
          fallbackDownload(blob, filename);
        }
      } else {
        fallbackDownload(blob, filename);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create poster.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [listing, locale, spec.height, spec.width]);

  const btnClass =
    variant === "default"
      ? cn(
          "tap-highlight-none inline-flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-5 font-sans text-[15px] font-semibold text-slate-900",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 ease-out will-change-transform",
          "hover:scale-[1.02] hover:bg-slate-50 hover:shadow-[0_4px_14px_-4px_rgba(15,23,42,0.1)]",
          "active:scale-[0.98] disabled:pointer-events-none disabled:cursor-wait disabled:hover:scale-100 disabled:hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
          "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800 dark:hover:shadow-[0_4px_18px_-4px_rgba(0,0,0,0.35)]",
        )
      : cn(
          "tap-highlight-none inline-flex min-h-[44px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50 px-4 font-sans text-sm font-semibold text-slate-800",
          "transition-all duration-200 ease-out will-change-transform",
          "hover:scale-[1.02] hover:bg-slate-100 hover:shadow-[0_3px_12px_-3px_rgba(15,23,42,0.08)]",
          "active:scale-[0.98] disabled:pointer-events-none disabled:cursor-wait disabled:hover:scale-100 disabled:hover:shadow-none",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:shadow-[0_3px_14px_-3px_rgba(0,0,0,0.3)]",
        );

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={cn(
          btnClass,
          busy &&
            "opacity-95 ring-2 ring-slate-400/25 ring-offset-2 ring-offset-white dark:ring-slate-500/30 dark:ring-offset-slate-950",
          className,
        )}
        aria-busy={busy}
      >
        {busy ? (
          <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-slate-600 dark:text-slate-300" aria-hidden />
        ) : (
          <ImageDown className="h-[18px] w-[18px] shrink-0 opacity-90" aria-hidden />
        )}
        <span className="truncate">{busy ? uiCopy.creatingPoster : uiCopy.generatePoster}</span>
      </button>
      {error ? (
        <p className="mt-2 font-sans text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="pointer-events-none fixed left-[-12000px] top-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <SoldPosterDom
          rootRef={posterRef}
          listingImageRef={listingImageRef}
          payload={listing}
          spec={spec}
          locale={locale}
          accentHex={accentHex}
        />
      </div>
    </>
  );
}

function fallbackDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
