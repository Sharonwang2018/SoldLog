"use client";

import { useCallback, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { ImageDown, Loader2 } from "lucide-react";
import type { SoldListing } from "@/lib/types/public-profile";
import { posterCanvasSpec, resolvePosterLocale, type SupportedLocale } from "@/lib/i18n/locale";
import { posterFontFamily, posterWordmarkFontFamily, soldStoryStrings } from "@/lib/i18n/sold-story-copy";
import { cn } from "@/lib/utils";

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
    img.onerror = () => reject(new Error("Property photo could not be loaded for the poster."));
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

export type PosterPayload = Pick<
  SoldListing,
  "coverImageSrc" | "addressLine" | "cityState" | "finalPrice" | "daysOnMarket"
> & {
  agentDisplayName?: string | null;
  language?: string | null;
};

function SoldPosterDom({
  payload,
  imgRef,
  rootRef,
  spec,
  locale,
}: {
  payload: PosterPayload;
  imgRef: React.RefObject<HTMLImageElement>;
  rootRef: React.RefObject<HTMLDivElement>;
  spec: ReturnType<typeof posterCanvasSpec>;
  locale: SupportedLocale;
}) {
  const price = formatUsd(payload.finalPrice);
  const copy = soldStoryStrings(locale);
  const bodyFont = posterFontFamily(locale);
  const brandFont = posterWordmarkFontFamily(locale);
  const labelUpper = locale !== "zh";

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{
        width: spec.width,
        height: spec.height,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0c0a09",
        overflow: "hidden",
        fontFamily: bodyFont,
      }}
    >
      <div style={{ position: "relative", height: spec.imageHeight, width: "100%", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- canvas capture needs native img + CORS */}
        <img
          ref={imgRef}
          src={payload.coverImageSrc}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(12,10,9,0.92) 0%, rgba(12,10,9,0.35) 42%, transparent 72%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 36,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 18px",
            borderRadius: 18,
            backgroundColor: "rgba(12,10,9,0.55)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 13,
              background: "linear-gradient(145deg, #1c1917 0%, #292524 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fafaf9",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              fontFamily: bodyFont,
            }}
          >
            SL
          </div>
          <span
            style={{
              fontFamily: brandFont,
              fontSize: locale === "zh" ? 30 : 32,
              fontWeight: 600,
              color: "#fafaf9",
              letterSpacing: "-0.02em",
            }}
          >
            SoldLog
          </span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: locale === "zh" ? "40px 48px 48px" : "44px 52px 52px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: locale === "zh" ? 28 : 32,
            alignItems: "start",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: locale === "zh" ? 22 : 24,
                fontWeight: 600,
                letterSpacing: labelUpper ? "0.18em" : "0.08em",
                textTransform: labelUpper ? "uppercase" : "none",
                color: "#a8a29e",
              }}
            >
              {copy.soldFor}
            </p>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: locale === "zh" ? 56 : 64,
                fontWeight: 600,
                color: "#fafaf9",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              {price}
            </p>
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: locale === "zh" ? 22 : 24,
                fontWeight: 600,
                letterSpacing: labelUpper ? "0.18em" : "0.08em",
                textTransform: labelUpper ? "uppercase" : "none",
                color: "#a8a29e",
              }}
            >
              {copy.daysOnMarket}
            </p>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: locale === "zh" ? 56 : 64,
                fontWeight: 600,
                color: "#fafaf9",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
              }}
            >
              {payload.daysOnMarket}
            </p>
          </div>
        </div>

        <p
          style={{
            margin: "28px 0 0",
            fontSize: locale === "zh" ? 34 : 38,
            fontWeight: 600,
            color: "#e7e5e4",
            lineHeight: 1.28,
            maxWidth: 980,
          }}
        >
          {payload.addressLine}
        </p>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: locale === "zh" ? 26 : 28,
            fontWeight: 500,
            color: "#a8a29e",
          }}
        >
          {payload.cityState}
        </p>
        {payload.agentDisplayName?.trim() ? (
          <p
            style={{
              margin: "28px 0 0",
              fontSize: locale === "zh" ? 24 : 24,
              color: "#78716c",
            }}
          >
            {copy.listedBy(payload.agentDisplayName.trim())}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type GenerateSoldPosterButtonProps = {
  listing: PosterPayload;
  /** From Dashboard → Poster labels (EN / Chinese / match each sale). */
  agentPosterLabelsLocale?: string | null;
  className?: string;
  variant?: "default" | "compact";
};

export function GenerateSoldPosterButton({
  listing,
  agentPosterLabelsLocale,
  className,
  variant = "default",
}: GenerateSoldPosterButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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
      await waitForImage(imgRef.current);
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

      const filename = `soldlog-${slugifyFilePart(listing.addressLine)}-${spec.width}x${spec.height}.png`;
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
            title: listing.addressLine,
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
          imgRef={imgRef}
          payload={listing}
          spec={spec}
          locale={locale}
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
