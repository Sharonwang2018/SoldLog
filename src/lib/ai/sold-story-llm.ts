/**
 * Sold-story generation runs only on the server (Route Handler). Keys belong in `.env.local` — never expose in client code.
 *
 * Primary: Groq OpenAI-compatible API — `GROQ_API_KEY`, optional `GROQ_MODEL` (default `llama-3.3-70b-versatile`),
 * `GROQ_VISION_MODEL` when listing photos are attached (default `meta-llama/llama-4-scout-17b-16e-instruct`), optional `GROQ_BASE_URL`.
 * Fallback: `@google/generative-ai` + `GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_*`, then `OPENAI_API_KEY`.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabasePublicUrl } from "@/lib/supabase/env";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/locale";
import { type RepresentationRole, inferRepresentationRole } from "@/lib/representation-role";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";

/** Minimum graphemes — marketing title + body should exceed this (CJK-friendly). */
export const SOLD_STORY_MIN_GRAPHEMES = 80;
/** Hard cap after model output (Unicode graphemes); allows title + 2–3 sentences. */
export const SOLD_STORY_MAX_GRAPHEMES = 380;

const LLM_MAX_OUT_TOKENS = 768;
const LLM_TEMPERATURE = 0.72;

function groqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY?.trim() || undefined;
}

const GROQ_BASE_DEFAULT = "https://api.groq.com/openai/v1";

function groqBaseUrl(): string {
  return (process.env.GROQ_BASE_URL?.trim() || GROQ_BASE_DEFAULT).replace(/\/+$/, "");
}

function groqTextModelId(): string {
  return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
}

function groqVisionModelId(): string {
  return process.env.GROQ_VISION_MODEL?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";
}

function googleGenerativeAiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || undefined
  );
}

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
  outputLocale: string;
  propertyImageUrls?: string[];
};

const MAX_VISION_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const VISION_APPENDIX = `
多模态规则：若附带房源照片，仅当能清楚识别为房屋室内或建筑外观时，可自然融入 1～2 处可见细节；否则整体忽略附图，且不得在文中提及「图片无关」「无法使用照片」等。
Multimodal: Use photos only when they clearly show this listing’s interiors or exteriors; otherwise ignore silently—never discuss mismatch or refusal.`;

export type { RepresentationRole } from "@/lib/representation-role";
export { inferRepresentationRole } from "@/lib/representation-role";

/** Listing DOM framed for buyer's agent: timeline = how efficiently clients secured this home. */
function buildDomHintBuyer(daysOnMarket: number, locale: SupportedLocale): string {
  if (locale === "zh") {
    if (daysOnMarket <= 14) {
      return "【买方·天数】周期紧凑：强调快速反应、帮客户抢先锁定满意房源与专业谈价。";
    }
    if (daysOnMarket <= 40) {
      return `【买方·天数】约 ${daysOnMarket} 天语境：重点写「高效锁定心仪房源」「圆梦安家」——例如 30 天左右可直接点出高效锁定，勿用「帮卖家溢价去化」话术；⏱️ 紧随这类表述。`;
    }
    if (daysOnMarket <= 75) {
      return "【买方·天数】中等周期：多轮带看/议价后顺利拿下，突出耐心陪跑与谈判节奏。";
    }
    return "【买方·天数】较长周期：强调始终与客户并肩、克服波折后仍拿下心仪之家，避免「光速抢购」。";
  }
  if (daysOnMarket <= 14) {
    return "[Buyer·DOM] Tight timeline—stress agility, winning the home your clients wanted, sharp negotiation.";
  }
  if (daysOnMarket <= 40) {
    return "[Buyer·DOM] ~This DOM—frame as how efficiently buyers secured the right home (e.g. ~30 days ⇒ “efficiently locked in the home they wanted”); NOT seller-marketing language; place ⏱️ with that idea.";
  }
  if (daysOnMarket <= 75) {
    return "[Buyer·DOM] Moderate timeline—showings, diligence, and negotiation until the keys were theirs.";
  }
  return "[Buyer·DOM] Longer journey—perseverance, advocacy, and a happy landing for the buyers; no “instant bidding war” hype.";
}

/** Listing DOM framed for seller's agent: marketing, absorption, premium. */
function buildDomHintSeller(daysOnMarket: number, locale: SupportedLocale): string {
  if (locale === "zh") {
    if (daysOnMarket <= 7) {
      return "【卖方·天数】上市天数很短：市场追捧、果断锁定、去化极快；突出营销策略奏效。";
    }
    if (daysOnMarket <= 21) {
      return "【卖方·天数】上市天数较短：竞争激烈、高效去化、定价与曝光到位，可为卖方锁定优价/溢价叙事。";
    }
    if (daysOnMarket <= 45) {
      return "【卖方·天数】上市天数中等：稳健成交、合理周期内顺利签约，强调专业运营与价值呈现。";
    }
    return "【卖方·天数】上市天数较长：耐心经营、持续营销触达后圆满收官，避免与长 DOM 矛盾的「光速」表述。";
  }
  if (daysOnMarket <= 7) {
    return "[Seller·DOM] Very short listing DOM—strong demand, fast execution, marketing that delivered.";
  }
  if (daysOnMarket <= 21) {
    return "[Seller·DOM] Short DOM—competitive traction, positioning, and negotiation that optimized seller outcomes.";
  }
  if (daysOnMarket <= 45) {
    return "[Seller·DOM] Moderate DOM—solid marketing cadence and professional execution for the seller.";
  }
  return "[Seller·DOM] Longer DOM—persistence, refreshed exposure, successful close—no false “instant sale” hype.";
}

function buildDomHintNeutral(daysOnMarket: number, locale: SupportedLocale): string {
  if (locale === "zh") {
    if (daysOnMarket <= 21) {
      return "【天数·中性】成交节奏紧凑，客观描述时间线与专业推进。";
    }
    if (daysOnMarket <= 45) {
      return "【天数·中性】合理周期内促成签约，平衡描述过程与市场环境。";
    }
    return "【天数·中性】较长周期侧重持续跟进与最终顺利收尾，避免夸张表述。";
  }
  if (daysOnMarket <= 21) {
    return "[DOM·neutral] Brisk timeline—describe professionally without picking buyer-only or seller-only hype.";
  }
  if (daysOnMarket <= 45) {
    return "[DOM·neutral] Moderate timeline—balanced, factual tone.";
  }
  return "[DOM·neutral] Longer timeline—persistence and successful close without hype.";
}

function buildDomMarketHint(
  daysOnMarket: number,
  locale: SupportedLocale,
  role: RepresentationRole,
): string {
  if (role === "buyer") return buildDomHintBuyer(daysOnMarket, locale);
  if (role === "seller") return buildDomHintSeller(daysOnMarket, locale);
  if (role === "dual") return buildDomHintNeutral(daysOnMarket, locale);
  return buildDomHintNeutral(daysOnMarket, locale);
}

function buildRepresentationPerspective(role: RepresentationRole, locale: SupportedLocale): string {
  if (role === "seller") {
    return locale === "zh"
      ? "【叙事视角=卖方代理】通篇卖方经纪人口吻：侧重成交效率、营销策略与投放曝光、定价与谈判中为卖方争取理想结果与溢价空间；可写市场验证与卖方满意；勿写成「帮买家抢房」「圆梦买家」主导。"
      : "[Voice = seller’s agent] Prioritize closing efficiency, marketing strategy & reach, pricing power, and negotiation leverage for the seller—seller satisfaction & market proof; do NOT center “helped buyer win the bid” as the main arc.";
  }
  if (role === "buyer") {
    return locale === "zh"
      ? "【叙事视角=买方代理】通篇买方经纪人口吻：侧重帮客户抢到/锁定心仪房、圆梦家园、专业谈判与条款把控、买方省心与满意度；⏱️ 请按「买方拿下这套房的时间效率」解读数据——例如约 30 天可说「高效锁定心仪房源」；勿把重点写成卖方溢价营销或单方面去化。"
      : "[Voice = buyer’s agent] Prioritize securing the dream home, winning/improving the deal, negotiation skill, and buyer delight; read DOM as how efficiently buyers secured this home (e.g. ~30 days ⇒ “efficiently locked in the home they wanted”); do NOT lead with seller-premium / absorption jargon.";
  }
  if (role === "dual") {
    return locale === "zh"
      ? "【叙事视角=双边代理】同时代表买卖双方：语气必须公允、合规、专业；可写高效沟通、尊重双方诉求、促成达成一致与顺利交割；禁止片面抬高买方或卖方，禁止暗示不当利益或未披露冲突；⏱️/天数用中性、符合披露规范的表述。"
      : "[Voice = dual agency] You represented both parties: fair, ethical, professional—coordination, mutual respect, smooth close; no one-sided hype; no improper-conflict implications; describe DOM/timeline in neutral, compliant language.";
  }
  return locale === "zh"
    ? "【叙事视角=未指定代表方】专业、平衡，不夸大独家代表买方或卖方；DOM 可中性描述。"
    : "[Voice = unspecified] Balanced, professional; do not over-claim exclusive buyer or seller representation.";
}

function buildPriceTierHint(priceUsd: number, locale: SupportedLocale): string {
  if (priceUsd >= 2_000_000) {
    return locale === "zh"
      ? "【价位】高总价：可轻描高端/改善型市场语境，勿捏造奖项、成交纪录或未经验证的排名。"
      : "[Price] Premium segment framing is OK—no fake awards, records, or rankings.";
  }
  if (locale === "zh") {
    return "【价位】按给定成交价客观描述即可，避免与价格明显不符的「白菜价」「天价」等极端词。";
  }
  return "[Price] Describe the closed price professionally—avoid extremes that contradict the number.";
}

function buildRegionalHint(address: string, cityState: string, locale: SupportedLocale): string {
  const hay = `${address}\n${cityState}`.toLowerCase();
  if (!hay.includes("san ramon")) return "";
  return locale === "zh"
    ? "【区域】文案出现 San Ramon / 圣拉蒙时：可在不与用户给定事实冲突的前提下，自然融入优质学区氛围、适合家庭定居、安静社区等东湾常见亮点；勿点名具体学校名称或排名，除非用户数据中提供。"
    : "[Area] When San Ramon appears: you may naturally mention family-friendly neighborhoods, reputable schools in general terms, and a peaceful community—stay generic; no specific school names or rankings unless provided.";
}

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

  const loc = normalizeLocale(ctx.outputLocale);
  const localeHint =
    loc === "zh"
      ? "输出语言：简体中文。"
      : loc === "es"
        ? "Output language: Spanish."
        : loc === "ru"
          ? "Output language: Russian."
          : "Output language: English.";

  const role = inferRepresentationRole(ctx.representedSide);
  const perspectiveHint = buildRepresentationPerspective(role, loc);
  const domHint = buildDomMarketHint(ctx.daysOnMarket, loc, role);
  const priceHint = buildPriceTierHint(ctx.priceUsd, loc);
  const regional = buildRegionalHint(ctx.address, ctx.cityState, loc);

  const processBlockZh =
    role === "buyer"
      ? "3) 第二块「成交过程」单独一段：买方视角——帮客户锁定/圆梦心仪家园、专业谈判与条款把控、买方满意与省心体验；叙事化，禁止纯数字堆砌；首次写出成交价时紧邻 💰；首次写出挂牌天数/周期时紧邻 ⏱️，并按买方拿下房源的效率来解读（非卖方去化口径）。"
      : role === "seller"
        ? "3) 第二块「成交过程」单独一段：卖方视角——营销策略、曝光与定位、谈判中为卖方争取理想价与成交效率；叙事化，禁止纯数字堆砌；首次写出成交价时紧邻 💰；首次写出上市天数/周期时紧邻 ⏱️。"
        : role === "dual"
          ? "3) 第二块「成交过程」单独一段：双边代理——公允呈现为买卖双方协调意向、专业撮合与安全交割；强调互信与合规，禁止片面站队；首次写出成交价时紧邻 💰；天数/周期紧邻 ⏱️，中性表述。"
          : "3) 第二块「成交过程」单独一段：平衡、专业地叙事撮合与谈判推进；禁止纯数字堆砌；首次写出成交价时紧邻 💰；首次写出天数/周期时紧邻 ⏱️。";

  const processBlockEn =
    role === "buyer"
      ? "3) Second block — buyer-agent story: securing the dream home, negotiation, buyer satisfaction—no data dump. 💰 near first price mention; ⏱️ near first DOM/timeline mention, read as buyer-side efficiency (not seller absorption jargon)."
      : role === "seller"
        ? "3) Second block — seller-agent story: marketing, exposure, positioning, negotiation for seller outcomes and efficiency. 💰 and ⏱️ as specified."
        : role === "dual"
          ? "3) Second block — dual agency: fair, ethical facilitation for both parties through closing—no one-sided spin. 💰 and ⏱️ as specified; neutral DOM wording."
          : "3) Second block — balanced deal narrative. 💰 and ⏱️ as specified.";

  return [
    `Property address: ${location}`,
    `Sold price: ${price}`,
    `Days on market: ${ctx.daysOnMarket}`,
    `Represented side (buyer / seller / context): ${side}`,
    "",
    perspectiveHint,
    domHint,
    priceHint,
    regional,
    "",
    "【海报/社交】在字数上限内写得紧凑、减少过长从句，便于海报节选与手机屏幕阅读。",
    "Poster/social: fit the grapheme cap; tight sentences—easy to crop for posters and mobile feeds.",
    "",
    localeHint,
    "",
    "输出结构（必须严格遵守——三块内容、段间必须空行）：",
    "1) 第一行仅「标题」：醒目、专业且热忱；开头使用 ✨；建议自然混入 🏡 体现「家/房源」（非强制）；必须点到地址中的门牌或街道关键词。",
    "2) 单独空一行（只含换行，不要空格行）。",
    processBlockZh,
    "4) 单独空一行。",
    "5) 第三块「感谢词」单独一段：诚恳致谢客户与各方信任，语气温暖；段末或收尾句旁可加 🙏 或 💖 等 1 个收尾表情（全文表情总数建议不超过 6 个，避免堆积）。",
    "",
    `6) 全文长度（Unicode 字元/grapheme）：至少 ${SOLD_STORY_MIN_GRAPHEMES}、至多约 ${SOLD_STORY_MAX_GRAPHEMES}；只能有上述三块，禁止第四主题段；禁止 Markdown 列表与项目符号；勿给全文加外层引号。`,
    "",
    "Output structure (MANDATORY — three blocks, blank line between blocks):",
    "1) Line 1: headline only — bold, warm, professional; must start with ✨; may add 🏡 if it fits naturally; include a clear address hook (street or number).",
    "2) Exactly one blank line.",
    processBlockEn,
    "4) Exactly one blank line.",
    "5) Third block — single thank-you paragraph: sincere gratitude to clients and trust; you may add one closing emoji such as 🙏 or 💖 (keep total emojis ~6 or fewer across the whole post).",
    "",
    `6) Length in graphemes: at least ${SOLD_STORY_MIN_GRAPHEMES}, at most ~${SOLD_STORY_MAX_GRAPHEMES}. Only these three blocks—no fourth section. No bullet lists; no wrapping the whole text in quotes.`,
    ...(includePhotoNote
      ? [
          "",
          "Optional photos: only use if clearly this listing; otherwise ignore with no commentary.",
        ]
      : []),
  ].join("\n");
}

function buildSystemInstruction(
  locale: SupportedLocale,
  hasVision: boolean,
  role: RepresentationRole,
): string {
  const vision = hasVision ? VISION_APPENDIX : "";

  const voiceZh =
    role === "seller"
      ? "代表方=卖方：通篇突出成交效率、营销策略与为卖方争取的定价/溢价结果。"
      : role === "buyer"
        ? "代表方=买方：通篇突出帮客户锁定心仪房、圆梦安家、谈判实力与买方满意；DOM 作「买方拿下房的效率」解读（如三十天可说高效锁定）。"
        : role === "dual"
          ? "代表方=买卖双方：口吻公允合规，突出专业撮合、尊重双方与顺利交割；勿片面偏袒。"
          : "代表方未指定：口吻平衡专业，勿单边夸大。";

  const voiceEn =
    role === "seller"
      ? "Represented side = seller: foreground efficiency, marketing leverage, and seller pricing outcomes."
      : role === "buyer"
        ? "Represented side = buyer: foreground securing the dream home, negotiation, buyer joy; interpret DOM as buyer-side efficiency (e.g. ~30 days ⇒ efficiently locked in)."
        : role === "dual"
          ? "Represented both parties (dual agency): fair, ethical tone—professional coordination and a smooth close; no favoritism."
          : "Represented side unknown: stay balanced; no overstated sole-agency claims.";

  const zh = `你是顶尖房地产「成交喜报」营销文案顾问，擅长朋友圈、业主群、短视频配文。

版式（输出正文必须可直接粘贴）：共三块——①标题行 ②空行 ③成交过程一段 ④空行 ⑤感谢词一段；段与段之间必须有空行，便于阅读。

叙事视角（由用户数据决定，必须遵守）：${voiceZh}

Emoji：标题侧以 ✨ 开头，可适度加入 🏡；写到价格时带 💰、写到天数/周期时带 ⏱️；感谢段末可用 🙏 等收尾；总数适中，忌刷屏。

写作目标：事实一致；语气专业、热忱、有感染力；禁止整段只罗列数字；篇幅适合海报/社媒截取。

硬性禁止：
- 附图仅为参考；禁止拒写、禁止解释图片不匹配、禁止提及「不是此房」「无关图片」等。
- 禁止以道歉、免责、元说明开头；禁止编造未提供的学校名、具体小区配套数据、奖项。
- 代表方未明确时，中性表述，不越权声称独家代表买方或卖方。

${vision}`;

  const en = `You are a top-tier real estate marketing copywriter crafting celebratory “just sold” social posts.

Format (paste-ready): exactly THREE blocks—(1) headline line, (2) blank line, (3) one narrative paragraph on how the deal happened, (4) blank line, (5) one thank-you paragraph. There MUST be empty lines between blocks.

Narrative voice (follow user data — mandatory): ${voiceEn}

Emoji: headline starts with ✨; add 🏡 if natural; place 💰 beside the first natural mention of sold price and ⏱️ beside the first natural mention of days on market / timeline; end thanks with something like 🙏 or 💖; keep emoji modest (about six or fewer total).

Goals: Truthful facts only; professional, warm, persuasive—never a cold number dump; length must work for posters/social crops.

Hard rules:
- Photos are optional cues only—never refuse, never discuss “wrong image,” never mention ignoring photos.
- No invented school names, rankings, awards, or neighborhood stats.
- If representation side is unspecified, stay neutral.

${vision}`;

  const esRuLine =
    locale === "es"
      ? "\nWrite the entire output in Spanish: same three-block layout, blank lines, emojis (✨ 🏡 💰 ⏱️ + closing thanks), poster-friendly length; match buyer-, seller-, or dual-agency voice exactly as in the user message."
      : locale === "ru"
        ? "\nWrite the entire output in Russian: same three-block layout, blank lines, emojis (✨ 🏡 💰 ⏱️ + closing thanks), poster-friendly length; match buyer-, seller-, or dual-agency voice exactly as in the user message."
        : "";

  if (locale === "zh") return zh;
  if (locale === "en") return en;
  return en + esRuLine;
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

type ChatMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" } }
    >;

async function callOpenAiCompatibleChat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  userText: string;
  visionParts: VisionPart[];
  providerLabel: string;
  systemInstruction: string;
  /** Lower for structured JSON extraction. */
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const url = `${params.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const userContent: ChatMessageContent =
    params.visionParts.length === 0
      ? params.userText
      : (() => {
          const parts: Array<
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string; detail: "low" } }
          > = [{ type: "text", text: params.userText }];
          for (const p of params.visionParts) {
            parts.push({
              type: "image_url",
              image_url: { url: `data:${p.mimeType};base64,${p.base64}`, detail: "low" },
            });
          }
          return parts;
        })();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature ?? LLM_TEMPERATURE,
      max_tokens: params.maxTokens ?? LLM_MAX_OUT_TOKENS,
      messages: [
        { role: "system", content: params.systemInstruction },
        { role: "user", content: userContent },
      ],
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `${params.providerLabel} HTTP ${res.status}`);
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text?.trim()) throw new Error(`Empty response from ${params.providerLabel}`);
  return text;
}

async function callGroq(
  userText: string,
  visionParts: VisionPart[],
  systemInstruction: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const key = groqApiKey();
  if (!key) {
    throw new Error("GROQ_API_KEY is not set.");
  }
  const model = visionParts.length > 0 ? groqVisionModelId() : groqTextModelId();
  return callOpenAiCompatibleChat({
    baseUrl: groqBaseUrl(),
    apiKey: key,
    model,
    userText,
    visionParts,
    providerLabel: "Groq",
    systemInstruction,
    temperature: opts?.temperature,
    maxTokens: opts?.maxTokens,
  });
}

async function callGemini(
  userText: string,
  visionParts: VisionPart[],
  systemInstruction: string,
  opts?: { temperature?: number; maxOutputTokens?: number },
): Promise<string> {
  const key = googleGenerativeAiKey();
  if (!key) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) is not set.");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: geminiModelId(),
    systemInstruction,
    generationConfig: {
      temperature: opts?.temperature ?? LLM_TEMPERATURE,
      maxOutputTokens: opts?.maxOutputTokens ?? LLM_MAX_OUT_TOKENS,
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

async function callOpenAI(
  userText: string,
  visionParts: VisionPart[],
  systemInstruction: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return callOpenAiCompatibleChat({
    baseUrl: "https://api.openai.com/v1",
    apiKey: key,
    model,
    userText,
    visionParts,
    providerLabel: "OpenAI",
    systemInstruction,
    temperature: opts?.temperature,
    maxTokens: opts?.maxTokens,
  });
}

/**
 * Prefer Groq when `GROQ_API_KEY` is set; otherwise Gemini when Google key is set; otherwise OpenAI.
 */
export async function generateSoldStoryWithLlm(ctx: SoldStoryContext): Promise<string> {
  const requested = (ctx.propertyImageUrls ?? []).filter(Boolean).slice(0, MAX_VISION_IMAGES);
  const visionParts = requested.length > 0 ? await loadVisionParts(requested) : [];
  const userText = buildUserPrompt(ctx, visionParts.length > 0);
  const loc = normalizeLocale(ctx.outputLocale);
  const role = inferRepresentationRole(ctx.representedSide);
  const systemInstruction = buildSystemInstruction(loc, visionParts.length > 0, role);
  let raw: string;
  if (groqApiKey()) {
    raw = await callGroq(userText, visionParts, systemInstruction);
  } else if (googleGenerativeAiKey()) {
    raw = await callGemini(userText, visionParts, systemInstruction);
  } else if (process.env.OPENAI_API_KEY?.trim()) {
    raw = await callOpenAI(userText, visionParts, systemInstruction);
  } else {
    throw new Error(
      "Set GROQ_API_KEY for Groq (recommended), or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY for Gemini, or OPENAI_API_KEY.",
    );
  }
  return truncateToMaxGraphemes(raw, SOLD_STORY_MAX_GRAPHEMES);
}

// --- Listing screenshot → form fields (Redfin / Zillow / MLS, etc.) ----------------------------

export type ListingScreenshotExtract = {
  address_line: string;
  city_state: string;
  price_usd: number;
  days_on_market: number | null;
  price_kind: "list" | "sold" | "estimate" | "unknown";
};

export type ListingScreenshotImagePart = { mimeType: string; base64: string };

const LISTING_EXTRACT_SYSTEM = `You extract structured listing data from screenshots of property portals (Redfin, Zillow, Realtor.com, regional MLS, Chinese apps, etc.).
Respond with ONLY valid JSON — no markdown code fences, no extra text.
Required shape:
{"address_line":"street number and street name only (no city)","city_state":"City, ST or City, Region as shown","price_usd":0,"days_on_market":null,"price_kind":"list"}
Rules:
- price_usd: integer USD from the main prominent price (prefer list/asking; use sold/closed price only if clearly labeled and list price is absent).
- days_on_market: integer if DOM, "days on site", "time on Redfin", etc. is visible; otherwise null (not 0).
- price_kind: exactly one of list | sold | estimate | unknown
If unsure, best-effort guess; never invent a price — if no price visible, use price_usd 0 (caller will reject).`;

function parseListingExtractJson(text: string): ListingScreenshotExtract {
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s);
  if (fence) s = fence[1].trim();
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(s) as Record<string, unknown>;
  } catch {
    throw new Error("AI returned invalid JSON; try again with a clearer screenshot.");
  }
  const address_line = String(o.address_line ?? "").trim();
  const city_state = String(o.city_state ?? "").trim();
  const price_usd = Number.parseInt(String(o.price_usd ?? "").replace(/\D/g, ""), 10);
  let days_on_market: number | null = null;
  if (o.days_on_market !== null && o.days_on_market !== undefined && o.days_on_market !== "") {
    const d = Number.parseInt(String(o.days_on_market), 10);
    if (!Number.isNaN(d) && d >= 0) days_on_market = d;
  }
  const pk = String(o.price_kind ?? "unknown").toLowerCase();
  const price_kind: ListingScreenshotExtract["price_kind"] =
    pk === "list" || pk === "sold" || pk === "estimate" ? pk : "unknown";
  if (!address_line || Number.isNaN(price_usd) || price_usd <= 0) {
    throw new Error("Could not read address or price from image.");
  }
  return { address_line, city_state, price_usd, days_on_market, price_kind };
}

/** Vision-only: reads one screenshot and returns fields for dashboard “new sold record”. */
export async function extractListingFromScreenshotVision(
  part: ListingScreenshotImagePart,
): Promise<ListingScreenshotExtract> {
  const userText =
    "Extract listing fields from this screenshot. Output ONLY the single JSON object described in your instructions.";
  const vp: VisionPart = { mimeType: part.mimeType, base64: part.base64 };
  const extractOpts = { temperature: 0.12, maxTokens: 480 } as const;
  const geminiOpts = { temperature: 0.12, maxOutputTokens: 512 } as const;
  let raw: string;
  if (groqApiKey()) {
    raw = await callGroq(userText, [vp], LISTING_EXTRACT_SYSTEM, extractOpts);
  } else if (googleGenerativeAiKey()) {
    raw = await callGemini(userText, [vp], LISTING_EXTRACT_SYSTEM, geminiOpts);
  } else if (process.env.OPENAI_API_KEY?.trim()) {
    raw = await callOpenAI(userText, [vp], LISTING_EXTRACT_SYSTEM, extractOpts);
  } else {
    throw new Error(
      "Set GROQ_API_KEY for Groq (recommended), or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY for Gemini, or OPENAI_API_KEY.",
    );
  }
  return parseListingExtractJson(raw);
}

// --- Screenshot → bounding box for main listing hero (client crops locally) -----------------

export type ListingHeroCropBox = { x: number; y: number; w: number; h: number };

const HERO_CROP_SYSTEM = `You analyze a screenshot of a real-estate listing page (Redfin, Zillow, Realtor.com, MLS, etc.).
Find the single MAIN large hero photo of the property (house exterior or primary interior). Ignore: maps, street maps, agent headshots, logos, tiny thumbnail strips, charts, ads.
Respond with ONLY valid JSON — no markdown fences, no extra text.
Shape: {"x":0,"y":0,"w":1,"h":1}
Meaning: x,y,w,h are normalized 0–1 relative to the FULL screenshot width and height. (x,y) is the top-left corner of the crop rectangle; w and h are width and height as fractions of the full image.
Tight box around the hero image with a small margin if needed. If there is no clear single hero photo, return {"x":0,"y":0,"w":1,"h":1} (full frame).`;

function parseHeroCropBoxJson(text: string): ListingHeroCropBox {
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s);
  if (fence) s = fence[1].trim();
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(s) as Record<string, unknown>;
  } catch {
    throw new Error("AI returned invalid crop JSON.");
  }
  const num = (v: unknown) => Number.parseFloat(String(v));
  let x = num(o.x);
  let y = num(o.y);
  let w = num(o.w ?? o.width);
  let h = num(o.h ?? o.height);
  if (Number.isNaN(x)) x = 0;
  if (Number.isNaN(y)) y = 0;
  if (Number.isNaN(w) || w <= 0) w = 1;
  if (Number.isNaN(h) || h <= 0) h = 1;
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  w = Math.max(0.04, Math.min(1, w));
  h = Math.max(0.04, Math.min(1, h));
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  return { x, y, w, h };
}

/** Vision: normalized crop box for the listing hero; browser applies crop to avoid shipping pixels twice. */
export async function extractListingHeroCropBoxVision(
  part: ListingScreenshotImagePart,
): Promise<ListingHeroCropBox> {
  const userText =
    "Locate the main listing hero photo in this screenshot. Output ONLY the JSON object per your instructions.";
  const vp: VisionPart = { mimeType: part.mimeType, base64: part.base64 };
  const opts = { temperature: 0.1, maxTokens: 280 } as const;
  const geminiOpts = { temperature: 0.1, maxOutputTokens: 320 } as const;
  let raw: string;
  if (groqApiKey()) {
    raw = await callGroq(userText, [vp], HERO_CROP_SYSTEM, opts);
  } else if (googleGenerativeAiKey()) {
    raw = await callGemini(userText, [vp], HERO_CROP_SYSTEM, geminiOpts);
  } else if (process.env.OPENAI_API_KEY?.trim()) {
    raw = await callOpenAI(userText, [vp], HERO_CROP_SYSTEM, opts);
  } else {
    throw new Error(
      "Set GROQ_API_KEY for Groq (recommended), or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY for Gemini, or OPENAI_API_KEY.",
    );
  }
  return parseHeroCropBoxJson(raw);
}

/**
 * Generic vision call (one image) — same provider order as other listing vision helpers.
 * For marketing/extraction tasks that return free-form text (not sold-story grapheme caps).
 */
export async function runVisionLlm(
  part: ListingScreenshotImagePart,
  systemInstruction: string,
  userText: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const vp: VisionPart = { mimeType: part.mimeType, base64: part.base64 };
  const temperature = opts?.temperature ?? 0.75;
  const maxTokens = opts?.maxTokens ?? 2500;
  const geminiOpts = { temperature, maxOutputTokens: maxTokens };
  let raw: string;
  if (groqApiKey()) {
    raw = await callGroq(userText, [vp], systemInstruction, { temperature, maxTokens });
  } else if (googleGenerativeAiKey()) {
    raw = await callGemini(userText, [vp], systemInstruction, geminiOpts);
  } else if (process.env.OPENAI_API_KEY?.trim()) {
    raw = await callOpenAI(userText, [vp], systemInstruction, { temperature, maxTokens });
  } else {
    throw new Error(
      "Set GROQ_API_KEY for Groq (recommended), or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY for Gemini, or OPENAI_API_KEY.",
    );
  }
  return raw.trim();
}

