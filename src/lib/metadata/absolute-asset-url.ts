/**
 * Open Graph / Twitter cards require absolute image URLs.
 * Set NEXT_PUBLIC_SITE_URL (e.g. https://soldlog.com) in production; Vercel sets VERCEL_URL.
 */
export function absoluteAssetUrlForMetadata(pathOrUrl: string | null | undefined): string | undefined {
  const t = (pathOrUrl ?? "").trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;

  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "").trim();
  if (!raw) return undefined;

  const origin = /^https?:\/\//i.test(raw) ? raw.replace(/\/+$/, "") : `https://${raw.replace(/\/+$/, "")}`;
  const path = t.startsWith("/") ? t : `/${t}`;
  return `${origin}${path}`;
}
