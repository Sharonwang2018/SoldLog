/**
 * Sold-story generation runs only on the server (Route Handler). Keys belong in `.env.local` — never expose in client code.
 *
 * Gemini: `@google/generative-ai` + `GOOGLE_GENERATIVE_AI_API_KEY` (or legacy `GEMINI_API_KEY`).
 * Model: `GOOGLE_GENERATIVE_AI_MODEL` / `GEMINI_MODEL` (default `gemini-2.0-flash`; `gemini-1.5-flash` may 404 on newer API surfaces).
 * Fallback: `OPENAI_API_KEY` when no Google key is set.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabasePublicUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";

/** Hard cap (Unicode graphemes); poster-safe. User-facing “120 字” ≈ grapheme clusters here. */
export const SOLD_STORY_MAX_GRAPHEMES = 120;

function googleGenerativeAiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || undefined
  );
}

/** IDs that often 404 on current `generativelanguage.googleapis.com` v1beta for AI Studio keys. */
const GEMINI_MODEL_DEPRECATED = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
]);

function geminiModelId(): string {
  const raw =
    process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash";
  if (GEMINI_MODEL_DEPRECATED.has(raw)) {
    return "gemini-2.0-flash";
  }
  return raw;
}

export type SoldStoryContext = {
  address: string;
  cityState: string;
  priceUsd: number;
  daysOnMarket: number;
  representedSide: string | null;
  /** BCP-47-ish tag from profile/record, e.g. en, zh */
  outputLocale: string;
  /** Public Supabase property-images URLs (same user); server fetches for vision models. */
  propertyImageUrls?: string[];
};

const MAX_GRAPHEMES = SOLD_STORY_MAX_GRAPHEMES;
const MAX_VISION_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function buildUserPrompt(ctx: SoldStoryContext, includePhotoNote: boolean): string {
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(ctx.priceUsd);

  const location = [ctx.address, ctx.cityState].filter(Boolean).join(", ");
  const side =
    ctx.representedSide?.trim() ||
    "(side not specified — write neutrally without claiming buyer/seller representation)";

  const localeHint =
    ctx.outputLocale === "zh"
      ? "Write the story in Chinese (Simplified)."
      : ctx.outputLocale === "es"
        ? "Write the story in Spanish."
        : ctx.outputLocale === "ru"
          ? "Write the story in Russian."
          : "Write the story in English.";

  return [
    `Property address: ${location}`,
    `Sold price: ${price}`,
    `Days on market: ${ctx.daysOnMarket}`,
    `Represented side (buyer / seller / context): ${side}`,
    "",
    localeHint,
    "Output: a single short paragraph only (no title, no bullet points, no quotation marks wrapping the whole text).",
    ...(includePhotoNote
      ? ["", "Listing photos are attached for visual reference (style and highlights)."]
      : []),
  ].join("\n");
}

const SYSTEM_PROMPT_ZH = `你是一位资深房产经纪专家。请根据用户消息中的房产成交数据与（如有）附图，撰写一段简短、专业、富有感染力的成交故事。

要求：严格控制在${MAX_GRAPHEMES}个Unicode字（字元/grapheme）以内；语气真诚；单段输出，不要标题、不要项目符号，不要给全文加引号。
遵循用户消息里关于输出语言的说明。不要编造成交数据中不存在的事实。`;

const VISION_ADDON_ZH = `

若提供了房源图片：请使用多模态能力分析装修风格（如现代、复古）、采光与空间氛围等，将图片中真实可见的元素自然融入文案；看不清或非房源场景时不要臆测。`;

function systemPrompt(hasVision: boolean): string {
  return hasVision ? SYSTEM_PROMPT_ZH + VISION_ADDON_ZH : SYSTEM_PROMPT_ZH;
}

/** Supabase public object URL under property-images/{userId}/… */
export function isTrustedPropertyImageUrl(urlStr: string, userId: string): boolean {
  const base = getSupabasePublicUrl().replace(/\/+$/, "");
  if (!base || !userId) return false;
  const prefix = `${base}/storage/v1/object/public/${STORAGE_BUCKETS.propertyImages}/`;
  if (!urlStr.startsWith(prefix)) return false;
  let path: string;
  try {
    path = new URL(urlStr).pathname;
  } catch {
    return false;
  }
  const marker = `/storage/v1/object/public/${STORAGE_BUCKETS.propertyImages}/`;
  const idx = path.indexOf(marker);
  if (idx === -1) return false;
  const rest = path.slice(idx + marker.length);
  const first = rest.split("/").filter(Boolean)[0];
  return first === userId;
}

type VisionPart = { mimeType: string; base64: string };

async function fetchImageAsVisionPart(url: string): Promise<VisionPart | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return null;
    const len = res.headers.get("content-length");
    if (len && Number.parseInt(len, 10) > MAX_IMAGE_BYTES) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) return null;
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const mime =
      ct === "image/jpeg" || ct === "image/jpg"
        ? "image/jpeg"
        : ct === "image/png" || ct === "image/webp" || ct === "image/gif"
          ? ct
          : null;
    if (!mime) return null;
    const base64 = Buffer.from(buf).toString("base64");
    return { mimeType: mime, base64 };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function loadVisionParts(urls: string[]): Promise<VisionPart[]> {
  const out: VisionPart[] = [];
  const slice = urls.slice(0, MAX_VISION_IMAGES);
  for (const u of slice) {
    const part = await fetchImageAsVisionPart(u);
    if (part) out.push(part);
  }
  return out;
}

function truncateToMaxGraphemes(s: string, max: number): string {
  const trimmed = s.trim().replace(/^["'「」]|["'「」]$/g, "").trim();
  try {
    const seg = new Intl.Segmenter("und", { granularity: "grapheme" });
    const parts: string[] = [];
    let n = 0;
    for (const { segment } of Array.from(seg.segment(trimmed))) {
      if (n >= max) break;
      parts.push(segment);
      n++;
    }
    return parts.join("").trim();
  } catch {
    return trimmed.slice(0, max);
  }
}

async function callGemini(userText: string, visionParts: VisionPart[]): Promise<string> {
  const key = googleGenerativeAiKey();
  if (!key) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) is not set.");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: geminiModelId(),
    systemInstruction: systemPrompt(visionParts.length > 0),
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 256,
    },
  });

  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = [userText];
  for (const p of visionParts) {
    parts.push({
      inlineData: {
        data: p.base64,
        mimeType: p.mimeType,
      },
    });
  }

  const result = await model.generateContent(parts);
  let text: string;
  try {
    text = result.response.text();
  } catch {
    throw new Error("Empty or blocked response from Gemini.");
  }
  if (!text.trim()) throw new Error("Empty response from Gemini");
  return text;
}

async function callOpenAI(userText: string, visionParts: VisionPart[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [{ type: "text", text: userText }];
  for (const p of visionParts) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${p.mimeType};base64,${p.base64}`, detail: "low" },
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      max_tokens: 256,
      messages: [
        { role: "system", content: systemPrompt(visionParts.length > 0) },
        { role: "user", content: userContent },
      ],
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text?.trim()) throw new Error("Empty response from OpenAI");
  return text;
}

/**
 * Prefer Gemini when `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` is set; otherwise OpenAI.
 */
export async function generateSoldStoryWithLlm(ctx: SoldStoryContext): Promise<string> {
  const requested = (ctx.propertyImageUrls ?? []).filter(Boolean).slice(0, MAX_VISION_IMAGES);
  const visionParts = requested.length > 0 ? await loadVisionParts(requested) : [];
  const userText = buildUserPrompt(ctx, visionParts.length > 0);
  let raw: string;
  if (googleGenerativeAiKey()) {
    raw = await callGemini(userText, visionParts);
  } else if (process.env.OPENAI_API_KEY?.trim()) {
    raw = await callOpenAI(userText, visionParts);
  } else {
    throw new Error(
      "Set GOOGLE_GENERATIVE_AI_API_KEY (recommended) or GEMINI_API_KEY for Gemini, or OPENAI_API_KEY as fallback.",
    );
  }
  return truncateToMaxGraphemes(raw, MAX_GRAPHEMES);
}
