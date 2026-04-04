import type { SupportedLocale } from "@/lib/i18n/locale";

/**
 * Placeholder for a future AI translation call. Returns deterministic demo text
 * so the dashboard flow works without API keys.
 */
export async function mockTranslateClosingNote(
  text: string,
  target: SupportedLocale,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || target === "en") return text;

  await new Promise((r) => setTimeout(r, 50));

  const banner: Partial<Record<SupportedLocale, string>> = {
    zh: "[Demo Chinese translation — connect a real translation API]",
    ru: "[Demo Russian translation — connect a real translation API]",
    es: "[Demo Spanish translation — connect a real translation API]",
  };

  const head = banner[target];
  if (!head) return text;

  return `${head}\n\n${trimmed}`;
}
