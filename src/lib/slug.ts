/** URL-safe slug for sold record paths: [a-z0-9-] */
export function slugifyRecordPart(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const t = s.slice(0, 48);
  return t.length >= 2 ? t : "sale";
}

export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
