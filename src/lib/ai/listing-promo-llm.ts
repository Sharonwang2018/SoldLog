/**
 * Buyer-facing listing promo copy from a portal screenshot (WeChat / IG style) — server-only.
 */
import { runVisionLlm, type ListingScreenshotImagePart } from "@/lib/ai/sold-story-llm";
import type { SupportedLocale } from "@/lib/i18n/locale";

function buildListingPromoSystem(locale: SupportedLocale): string {
  const styleByLocale: Record<SupportedLocale, string> = {
    zh: `输出语言：简体中文。
风格：朋友圈 / 小红书「推房帖」—— 第一行吸睛标题带 emoji（如 🏡），含社区或亮点名 + 「新上市」等 + 完整地址（与截图一致）。
结构建议：
- 开头 1～2 段：点出「市场上同时满足 X+Y+Z 的不多」这类对比框架（勿空泛吹嘘）。
- 中间用带 emoji 的小标题分段（如 ✨ 户型房龄面积、🚗 通勤高速、🌳 社区公园商业、🏠 采光车库后院等——按截图里实际可见信息选 3～5 条，没有的不要编）。
- 一段「很多房子的问题是…要么…要么…」式对比，再收束到本套「均衡」。
- 结尾单独一行：📍 后接截图里可见的房源链接（Redfin short link、完整 URL 等——照抄，勿编造链接）。若有 Open House 时间则写清；没有则写温和 CTA（欢迎了解详情或预约看房）。
语气：专业、亲切、具体；禁止捏造截图中未出现的数字、学区排名、未显示的学校名、成交价承诺。价格若截图有则可提，否则不写具体价。`,
    en: `Output language: English.
Style: social “listing hype” post — first line: catchy headline with emoji (e.g. 🏡), neighborhood or hook + full address as shown.
Structure:
- Opening: why this combo of features is rare in the market (grounded in visible facts).
- Middle: 3–5 short sections with emoji headers (✨ layout/sqft/year, 🚗 commute, 🌳 parks/retail, 🏠 light/garage/yard — only what the screenshot supports).
- A “many homes are either X or Y” contrast, then why this one balances.
- Closing line: 📍 paste the exact listing URL if visible; never invent URLs. Open house if shown; otherwise a soft CTA.
Tone: warm, professional, specific. No invented stats, school names, or prices not on screen.`,
    es: `Idioma de salida: español.
Estilo: publicación tipo redes para compradores — título con emoji (ej. 🏡), barrio o gancho + dirección completa como en la captura.
Estructura similar a la versión en inglés: párrafo inicial, viñetas con emojis según datos visibles, contraste “muchos pisos son X o Y”, cierre con 📍 y URL exacta si aparece; sin inventar datos.`,
    ru: `Язык ответа: русский.
Стиль: пост для соцсетей о продаже — заголовок с эмодзи (например 🏡), район/акцент + полный адрес как на скриншоте.
Структура: вступление, блоки с эмодзи только по фактам с экрана, контраст «у многих объектов…», строка 📍 с точной ссылкой если видна; не выдумывать цифры и ссылки.`,
  };

  return `You are a real estate agent assistant helping draft shareable promotional copy for ACTIVE listings (buyers), not a closed sale story.

${styleByLocale[locale]}

Rules for ALL locales:
- Read only what is visible: address, beds/baths, sqft, year built, HOA, map hints, neighborhood labels, price if shown, listing URL, open house text.
- Output plain text only: no JSON, no markdown code fences, no bullet markdown required (line breaks and emoji are fine).
- Length: substantial but skimmable (similar to a strong long-form WeChat or carousel caption — roughly 400–1200 characters for Latin scripts; Chinese may use more characters naturally).`;
}

function buildListingPromoUser(audienceNote: string | null): string {
  let u =
    "Generate the full promotional post from this listing page screenshot. Use only facts you can read on the image; infer reasonable commute framing only when maps or city names clearly support it.";
  if (audienceNote?.trim()) {
    u += `\n\nAgent context (angle the pitch toward this buyer need; never contradict visible listing facts): ${audienceNote.trim()}`;
  }
  return u;
}

export async function generateListingPromoPosterCopy(params: {
  part: ListingScreenshotImagePart;
  outputLocale: SupportedLocale;
  audienceNote: string | null;
}): Promise<string> {
  const system = buildListingPromoSystem(params.outputLocale);
  const user = buildListingPromoUser(params.audienceNote);
  return runVisionLlm(params.part, system, user, { temperature: 0.78, maxTokens: 2800 });
}
