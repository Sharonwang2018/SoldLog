export type SupportedLocale = "en" | "zh" | "ru" | "es";

const ALLOWED = new Set<string>(["en", "zh", "ru", "es"]);

/** Normalize DB / user input to a supported locale code. */
export function normalizeLocale(code: string | null | undefined): SupportedLocale {
  const base = (code ?? "en").toLowerCase().split("-")[0] ?? "en";
  if (ALLOWED.has(base)) return base as SupportedLocale;
  return "en";
}

export function isChineseLocale(code: string | null | undefined): boolean {
  return normalizeLocale(code) === "zh";
}

export function parseLocaleFromForm(raw: string | null | undefined): SupportedLocale {
  return normalizeLocale(raw ?? "en");
}

/** Instagram-style square; Chinese locale uses 3:4 for WeChat / Xiaohongshu-style feeds. */
export function posterCanvasSpec(locale: SupportedLocale): {
  width: number;
  height: number;
  imageHeight: number;
} {
  if (locale === "zh") {
    return { width: 1080, height: 1440, imageHeight: 960 };
  }
  return { width: 1080, height: 1080, imageHeight: 756 };
}

export function intlDateLocale(locale: SupportedLocale): string {
  const map: Record<SupportedLocale, string> = {
    en: "en-US",
    zh: "zh-CN",
    ru: "ru-RU",
    es: "es-ES",
  };
  return map[locale];
}

/** Dashboard poster toggle: 'en' | 'zh' forces labels; null/empty follows listing.language. */
export function resolvePosterLocale(
  listingLanguage: string | null | undefined,
  agentPosterOverride: string | null | undefined,
): SupportedLocale {
  const o = (agentPosterOverride ?? "").trim().toLowerCase();
  if (o === "en" || o === "zh") return o;
  return normalizeLocale(listingLanguage);
}
