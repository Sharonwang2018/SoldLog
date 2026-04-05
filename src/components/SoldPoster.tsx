"use client";

import type { CSSProperties, RefObject } from "react";
import type { SoldListing } from "@/lib/types/public-profile";
import { posterCanvasSpec, type SupportedLocale } from "@/lib/i18n/locale";
import { posterFontFamily, posterWordmarkFontFamily, soldStoryStrings } from "@/lib/i18n/sold-story-copy";
import { posterDisplayAddressLine } from "@/lib/poster-address-privacy";
import { type RepresentationRole, inferRepresentationRole } from "@/lib/representation-role";

export type PosterPayload = Pick<
  SoldListing,
  | "coverImageSrc"
  | "addressLine"
  | "cityState"
  | "finalPrice"
  | "daysOnMarket"
  | "soldStory"
  | "representedSide"
> & {
  agentDisplayName?: string | null;
  /** Profile headshot (`profiles.photo_url`); when set, poster thumb prefers this over listing art. */
  agentAvatarSrc?: string | null;
  language?: string | null;
  /** Strip leading street number on the poster image only (profile poster privacy). */
  posterRedactStreetNumber?: boolean;
};

/** True when we should load `coverImageSrc` for the small listing thumbnail (never full-bleed). */
export function hasListingThumbnail(url: string | null | undefined): boolean {
  const raw = url?.trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** URL actually used for the small poster image (avatar wins over listing cover). */
export function getPosterThumbSrc(payload: PosterPayload): string | null {
  if (hasListingThumbnail(payload.agentAvatarSrc)) return payload.agentAvatarSrc!.trim();
  if (hasListingThumbnail(payload.coverImageSrc)) return payload.coverImageSrc!.trim();
  return null;
}

export function posterThumbNeedsDecode(payload: PosterPayload): boolean {
  return getPosterThumbSrc(payload) !== null;
}

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(87, 83, 78, ${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function safeAccentHex(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(t) ? t : "#57534e";
}

function posterRepresentationLabel(locale: SupportedLocale, role: RepresentationRole): string | null {
  if (role === "neutral") return null;
  if (locale === "zh") {
    if (role === "buyer") return "买方经纪";
    if (role === "seller") return "卖方经纪";
    return "双边代理";
  }
  if (role === "buyer") return "Represented buyer";
  if (role === "seller") return "Represented seller";
  return "Dual agency";
}

function posterHeroFallbackStyle(accentHex: string): CSSProperties {
  const accent = safeAccentHex(accentHex);
  return {
    position: "absolute",
    inset: 0,
    background: [
      `radial-gradient(ellipse 95% 75% at 50% -5%, ${rgbaFromHex(accent, 0.38)} 0%, transparent 58%)`,
      `radial-gradient(ellipse 70% 55% at 100% 35%, ${rgbaFromHex(accent, 0.14)} 0%, transparent 50%)`,
      "linear-gradient(180deg, #292524 0%, #1c1917 36%, #141211 72%, #0c0a09 100%)",
    ].join(","),
  };
}

const THUMB_SIZE = 108;
const THUMB_RADIUS = 22;

export function SoldPosterDom({
  payload,
  listingImageRef,
  rootRef,
  spec,
  locale,
  accentHex,
}: {
  payload: PosterPayload;
  /** Ref on the optional small listing thumbnail `<img>` (for export wait / CORS). */
  listingImageRef: RefObject<HTMLImageElement>;
  rootRef: RefObject<HTMLDivElement>;
  spec: ReturnType<typeof posterCanvasSpec>;
  locale: SupportedLocale;
  /** Profile accent for hero gradient. */
  accentHex?: string | null;
}) {
  const price = formatUsd(payload.finalPrice);
  const copy = soldStoryStrings(locale);
  const bodyFont = posterFontFamily(locale);
  const brandFont = posterWordmarkFontFamily(locale);
  const labelUpper = locale !== "zh";
  const trimmedEndStory = payload.soldStory?.trim() ?? "";
  const storyLen = trimmedEndStory.length;
  /** Relaxed line height; font scales down when copy is long so the poster stays balanced. */
  const storyLineHeight = 1.65;
  const storyFontPx =
    locale === "zh"
      ? storyLen > 240
        ? 19
        : storyLen > 140
          ? 22
          : 24
      : storyLen > 320
        ? 17
        : storyLen > 180
          ? 20
          : 22;
  const storyMaxLines = locale === "zh" ? 6 : 5;
  const storyBlockMaxHeight = Math.round(storyFontPx * storyLineHeight * storyMaxLines);
  const showAgentAvatar = hasListingThumbnail(payload.agentAvatarSrc);
  const thumbSrc = getPosterThumbSrc(payload);
  const showListingThumb = thumbSrc !== null;
  const repRole = inferRepresentationRole(payload.representedSide);
  const repBadgeText = posterRepresentationLabel(locale, repRole);
  const posterStreetLine = posterDisplayAddressLine(
    payload.addressLine,
    Boolean(payload.posterRedactStreetNumber),
  );

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
      {/* Hero: always gradient — never full-bleed listing photo (content unknown / may be decorative). */}
      <div style={{ position: "relative", height: spec.imageHeight, width: "100%", flexShrink: 0 }}>
        <div style={posterHeroFallbackStyle(accentHex ?? "")} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(12,10,9,0.88) 0%, rgba(12,10,9,0.22) 50%, transparent 78%)",
          }}
        />
        {repBadgeText ? (
          <div
            style={{
              position: "absolute",
              left: 36,
              bottom: 28,
              padding: "8px 14px",
              borderRadius: 12,
              backgroundColor: "rgba(12,10,9,0.55)",
              color: "#e7e5e4",
              fontSize: locale === "zh" ? 18 : 12,
              fontWeight: 600,
              letterSpacing: locale === "zh" ? "0.04em" : "0.12em",
              textTransform: locale === "zh" ? "none" : "uppercase",
              maxWidth: "46%",
              lineHeight: 1.25,
            }}
          >
            {repBadgeText}
          </div>
        ) : null}
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
          overflow: "hidden",
          backgroundColor: "#0c0a09",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: showListingThumb ? `1fr 1fr ${THUMB_SIZE}px` : "1fr 1fr",
            gap: showListingThumb ? (locale === "zh" ? 20 : 24) : locale === "zh" ? 28 : 32,
            alignItems: "start",
            columnGap: showListingThumb ? (locale === "zh" ? 24 : 28) : undefined,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: locale === "zh" ? 22 : 24,
                fontWeight: 600,
                letterSpacing: labelUpper ? "0.18em" : "0.08em",
                textTransform: labelUpper ? "uppercase" : "none",
                color: "#d6d3d1",
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
                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
              }}
            >
              {price}
            </p>
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: locale === "zh" ? 22 : 24,
                fontWeight: 600,
                letterSpacing: labelUpper ? "0.18em" : "0.08em",
                textTransform: labelUpper ? "uppercase" : "none",
                color: "#d6d3d1",
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
                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
              }}
            >
              {payload.daysOnMarket}
            </p>
          </div>
          {showListingThumb && thumbSrc ? (
            <div
              style={{
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                flexShrink: 0,
                justifySelf: "end",
                borderRadius: showAgentAvatar ? "50%" : THUMB_RADIUS,
                padding: 3,
                background: showAgentAvatar
                  ? `linear-gradient(145deg, ${rgbaFromHex(safeAccentHex(accentHex ?? ""), 0.55)} 0%, rgba(255,255,255,0.12) 50%, rgba(12,10,9,0.4) 100%)`
                  : "linear-gradient(145deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.06) 100%)",
                boxShadow: showAgentAvatar
                  ? `0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.14), inset 0 1px 0 rgba(255,255,255,0.18)`
                  : "0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- canvas capture needs native img + CORS */}
              <img
                ref={listingImageRef}
                src={thumbSrc}
                alt=""
                crossOrigin="anonymous"
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  borderRadius: showAgentAvatar ? "50%" : THUMB_RADIUS - 3,
                  objectFit: "cover",
                  objectPosition: showAgentAvatar ? "center 18%" : "center",
                  backgroundColor: "#1c1917",
                }}
              />
            </div>
          ) : null}
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
          {posterStreetLine}
        </p>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: locale === "zh" ? 26 : 28,
            fontWeight: 500,
            color: "#a8a29e",
          }}
        >
          {payload.cityState.trim()}
        </p>
        {trimmedEndStory ? (
          <div style={{ margin: "22px 0 0", minWidth: 0, maxWidth: "100%" }}>
            <p
              style={{
                margin: 0,
                fontSize: storyFontPx,
                fontWeight: 400,
                lineHeight: storyLineHeight,
                color: "#d6d3d1",
                minWidth: 0,
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                maxHeight: storyBlockMaxHeight,
                overflow: "hidden",
              }}
            >
              {trimmedEndStory}
            </p>
          </div>
        ) : null}
        {payload.agentDisplayName?.trim() ? (
          <p
            style={{
              margin: trimmedEndStory ? "18px 0 0" : "28px 0 0",
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
