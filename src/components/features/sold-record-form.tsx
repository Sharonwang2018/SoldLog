"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FileText, ImagePlus, Loader2, Lock, Sparkles, Upload, Wand2 } from "lucide-react";
import { createSoldRecord } from "@/app/dashboard/sold-records-actions";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { Button } from "@/components/ui/button";
import { cn, randomStorageFileId } from "@/lib/utils";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/locale";
import { cropImageFileWithBox } from "@/lib/crop-image-file";

/** Client-side throttle: avoids burst clicks burning LLM quota (not a security boundary). */
const AI_SOLD_STORY_COOLDOWN_MS = 4000;
const AI_GENERATE_FETCH_TIMEOUT_MS = 55_000;
const EXTRACT_LISTING_COOLDOWN_MS = 5000;
const EXTRACT_FETCH_TIMEOUT_MS = 55_000;
const MAX_IMPORT_IMAGE_BYTES = 4 * 1024 * 1024;

const LANG_LABEL: Record<SupportedLocale, string> = {
  en: "English",
  zh: "Chinese",
  ru: "Русский",
  es: "Español",
};

function mapAiGenerateError(message: string, s: ReturnType<typeof aiUiStrings>): string {
  if (/GROQ_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY|API key|not set/i.test(message)) {
    return s.missingApiKey;
  }
  return message;
}

function aiUiStrings(locale: SupportedLocale) {
  switch (locale) {
    case "zh":
      return {
        generate: "✨ AI 生成",
        loading: "正在生成…",
        editReminder: "可直接在下方文本框里修改文案；满意后再点「Submit sale」保存。",
        hint: "文案语言与 Settings 中的首选语言一致。点「AI 生成」会写入下方文本框，您可随时改写。",
        photoVisionHint:
          "若已选择房源照片，生成时会先上传并由服务端调用多模态模型（如 Groq）分析装修风格与采光等，再写入故事。",
        needFields: "无法生成故事：请先在上方填写街道地址、售价与上市天数（或使用截图识别）。",
        aiStoryUsesAbove:
          "「AI 生成」会读取上方已填的地址、售价与上市天数，不会检查本框是否为空；请先完成上方必填项。",
        waitCooldown: "请稍等几秒再试，避免重复消耗生成额度。",
        missingApiKey: "服务端未配置 GROQ_API_KEY（或其它已支持的 LLM Key），请在 .env.local 中添加（勿提交到 Git）。",
        timeout: "请求超时，请稍后重试。",
        importTitle: "从截图快速填入（Redfin / Zillow 等）",
        importHelp:
          "上传含地址、价格、上市天数的页面截图，由 AI 识别并填入下方表单。请核对成交价与天数后再提交。",
        importButton: "识别并填入表单",
        importLoading: "正在识别截图…",
        importNeedFile: "请先选择一张截图。",
        importFileTooBig: "图片需小于 4MB。",
        importCooldown: "请稍等几秒再试。",
        importUseAsHero: "若自动截取失败或识别为整页，则用整张截图作为房源主图",
        importAutoCrop: "自动截取门户页上的房源主图（推荐；AI 定位大图区域后在浏览器内裁切）",
        importCropFailed: "未能可靠裁出主图。可在下方手动上传，或勾选「整页截图」备用。",
        importCropFullFrame: "未识别到单独主图区域（接近整页）。可勾选整页备用，或下方上传照片。",
        importCropOnlyButton: "仅截取房源主图",
        importCropLoading: "正在截取主图…",
        priceHintList: "识别为挂牌价/要价，若已是成交价请在「售价」处修改。",
        priceHintSold: "识别为成交价或成交相关价格，请确认金额无误。",
        priceHintEstimate: "识别为估价，请改为实际成交数据。",
      };
    case "es":
      return {
        generate: "✨ IA generar",
        loading: "Generando…",
        editReminder: "Puedes editar el texto en el cuadro antes de publicar.",
        hint: "La IA escribe en el cuadro de abajo; edítalo si quieres y luego envía.",
        photoVisionHint:
          "Si eliges foto, se sube y el servidor usa un modelo multimodal (p. ej. Groq) para el estilo del inmueble.",
        needFields: "No se puede generar la historia: indica arriba dirección, precio y días en mercado (o usa la captura).",
        aiStoryUsesAbove:
          "«IA generar» usa la dirección, precio y días que están arriba; completa esos campos primero.",
        waitCooldown: "Espera unos segundos antes de volver a generar.",
        missingApiKey: "Falta GROQ_API_KEY (u otra clave LLM configurada) en el servidor (.env.local).",
        timeout: "Tiempo de espera agotado. Inténtalo de nuevo.",
        importTitle: "Rellenar desde captura (Redfin, etc.)",
        importHelp:
          "Sube una captura con dirección, precio y días en mercado. La IA rellena el formulario; revisa precio final y DOM.",
        importButton: "Escanear y rellenar",
        importLoading: "Leyendo captura…",
        importNeedFile: "Elige una imagen primero.",
        importFileTooBig: "La imagen debe ser menor de 4MB.",
        importCooldown: "Espera unos segundos.",
        importUseAsHero: "Si el recorte automático falla, usar la captura completa como foto principal",
        importAutoCrop: "Recortar automáticamente la foto principal del anuncio (recomendado)",
        importCropFailed: "No se pudo recortar la foto. Sube una imagen abajo o usa la captura completa.",
        importCropFullFrame: "No hay foto principal clara; parece la página entera. Usa captura completa o sube foto.",
        importCropOnlyButton: "Solo recortar foto del anuncio",
        importCropLoading: "Recortando…",
        priceHintList: "Precio detectado como listado; confirma el precio de cierre.",
        priceHintSold: "Precio detectado como venta; verifica el importe.",
        priceHintEstimate: "Precio como estimación; introduce el cierre real.",
      };
    case "ru":
      return {
        generate: "✨ ИИ — создать",
        loading: "Генерация…",
        editReminder: "Текст можно править в поле ниже перед публикацией.",
        hint: "ИИ заполнит поле ниже — при необходимости отредактируйте и отправьте форму.",
        photoVisionHint:
          "При выборе фото оно загружается, сервер вызывает мультимодель (напр. Groq) для стиля интерьера.",
        needFields: "Нельзя сгенерировать текст: укажите выше адрес, цену и дни на рынке (или загрузите скриншот).",
        aiStoryUsesAbove:
          "Кнопка ИИ использует адрес, цену и дни из полей выше — сначала заполните их.",
        waitCooldown: "Подождите несколько секунд перед следующей генерацией.",
        missingApiKey: "На сервере не задан GROQ_API_KEY или другой ключ LLM (.env.local).",
        timeout: "Превышено время ожидания. Попробуйте снова.",
        importTitle: "Заполнить со скриншота (Redfin и др.)",
        importHelp:
          "Загрузите скриншот с адресом, ценой и днями на рынке. ИИ заполнит форму — проверьте цену и срок.",
        importButton: "Распознать и заполнить",
        importLoading: "Читаем скриншот…",
        importNeedFile: "Сначала выберите изображение.",
        importFileTooBig: "Файл должен быть меньше 4 МБ.",
        importCooldown: "Подождите несколько секунд.",
        importUseAsHero: "Если авто-обрезка не сработала — использовать весь скриншот как фото",
        importAutoCrop: "Авто-обрезка главного фото объявления (рекомендуется)",
        importCropFailed: "Не удалось вырезать фото. Загрузите снимок ниже или весь скриншот.",
        importCropFullFrame: "Отдельное фото не найдено (весь экран). Используйте полный скрин или загрузите фото.",
        importCropOnlyButton: "Только вырезать фото объявления",
        importCropLoading: "Обрезка…",
        priceHintList: "Цена как в объявлении — проверьте фактическую продажную.",
        priceHintSold: "Цена как продажная — проверьте сумму.",
        priceHintEstimate: "Похоже на оценку — укажите реальную цену сделки.",
      };
    default:
      return {
        generate: "✨ AI Generate",
        loading: "Generating…",
        editReminder: "Edit the story in the box below anytime before you publish.",
        hint: "Uses your preferred language from Settings. AI writes into the box below — tweak it, then submit to save.",
        photoVisionHint:
          "If you add a listing photo, it uploads first; the server calls a vision model (e.g. via Groq) for décor and light — API key stays server-side.",
        needFields:
          "Can't generate the story yet: fill in street address, sold price, and days on market above (or use screenshot import).",
        aiStoryUsesAbove:
          "“AI Generate” reads the address, price, and days on market from the fields above—not this box. Complete those first.",
        waitCooldown: "Wait a few seconds before generating again.",
        missingApiKey: "Server missing GROQ_API_KEY (or another configured LLM key) — add it to .env.local (never commit keys).",
        timeout: "Request timed out. Try again in a moment.",
        importTitle: "Quick-fill from a screenshot (Redfin, Zillow, etc.)",
        importHelp:
          "Upload a screenshot that shows the address, price, and days on market if visible. AI fills the form below — always verify sold price and DOM before publishing.",
        importButton: "Scan & fill form",
        importLoading: "Reading screenshot…",
        importNeedFile: "Choose a screenshot image first.",
        importFileTooBig: "Image must be under 4MB.",
        importCooldown: "Wait a few seconds before trying again.",
        importUseAsHero: "If auto-crop fails or the model only sees the full page, use the entire screenshot as the hero image",
        importAutoCrop: "Auto-crop the main listing photo from the screenshot (recommended; AI finds the hero, your browser crops)",
        importCropFailed: "Couldn’t isolate a clean hero shot. Upload a listing photo below, or enable the full-screenshot fallback.",
        importCropFullFrame: "No separate hero detected (looks like the full page). Enable full-screenshot fallback or upload below.",
        importCropOnlyButton: "Crop listing photo only",
        importCropLoading: "Cropping hero…",
        priceHintList: "Price read as list/ask — update to your actual sold price if different.",
        priceHintSold: "Price read as sold/closed — double-check the amount.",
        priceHintEstimate: "Price looks like an estimate — enter the real closing numbers.",
      };
  }
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[13px] font-medium uppercase tracking-[0.08em] text-stone-500 dark:text-stone-400"
    >
      {children}
    </label>
  );
}

const inputClass =
  "flex h-12 w-full rounded-xl border border-stone-200/90 bg-white px-4 text-[15px] text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-600 dark:focus:border-stone-600 dark:focus:ring-stone-800";

/** Textareas must not use `flex` / fixed `h-12` from single-line inputs — can confuse layout and editing on some browsers. */
const storyTextareaClass = cn(
  "block w-full min-h-[160px] resize-y rounded-xl border border-stone-200/90 bg-white px-4 py-3.5 text-[15px] leading-relaxed text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 placeholder:leading-relaxed focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-600 dark:focus:border-stone-600 dark:focus:ring-stone-800",
);

type DropVariant = "public" | "private";

function FileDropZone({
  id,
  accept,
  variant,
  title,
  subtitle,
  file,
  onFile,
  previewUrl,
}: {
  id: string;
  accept: string;
  variant: DropVariant;
  title: string;
  subtitle: string;
  file: File | null;
  onFile: (f: File | null) => void;
  previewUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const pick = useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      const ok = accept.split(",").some((raw) => {
        const t = raw.trim();
        if (t === "image/*") return f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic?)$/i.test(f.name);
        if (t === "application/pdf")
          return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
        return false;
      });
      if (ok) onFile(f);
    },
    [accept, onFile],
  );

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={cn(
          "tap-highlight-none relative w-full rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
          variant === "public" &&
            "border-stone-200/90 bg-stone-50/40 hover:border-stone-300 hover:bg-stone-50/80 dark:border-stone-800 dark:bg-stone-900/25 dark:hover:border-stone-700 dark:hover:bg-stone-900/50",
          variant === "private" &&
            "border-stone-300/70 bg-stone-100/30 hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900/50 dark:hover:border-stone-600",
          drag && "scale-[1.01] border-stone-500 bg-stone-100/60 dark:border-stone-500 dark:bg-stone-800/60",
        )}
      >
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              variant === "public"
                ? "bg-white text-stone-600 shadow-sm ring-1 ring-stone-200/80 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-800"
                : "bg-stone-200/80 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
            )}
          >
            {variant === "public" ? (
              <ImagePlus className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            ) : (
              <Lock className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            )}
          </span>
          <div>
            <p className="font-sans text-[15px] font-medium text-stone-900 dark:text-stone-100">{title}</p>
            <p className="mt-1 font-sans text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              {subtitle}
            </p>
          </div>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-stone-900/5 px-3 py-1 text-xs font-medium text-stone-600 dark:bg-white/10 dark:text-stone-300">
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Drag & drop or browse
          </span>
        </div>
        {variant === "public" && previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="mx-auto mt-6 max-h-48 rounded-xl object-cover shadow-md ring-1 ring-black/5"
          />
        )}
        {variant === "private" && file && (
          <p className="mt-6 flex items-center justify-center gap-2 font-sans text-sm font-medium text-stone-700 dark:text-stone-200">
            <FileText className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            {file.name}
          </p>
        )}
      </button>
    </div>
  );
}

type SoldRecordFormProps = {
  preferredLanguage?: string;
};

export function SoldRecordForm({ preferredLanguage = "en" }: SoldRecordFormProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const configured = isSupabaseConfigured();
  const agentLocale = normalizeLocale(preferredLanguage);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [propertyFile, setPropertyFile] = useState<File | null>(null);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [propertyPreview, setPropertyPreview] = useState<string | null>(null);
  /** Digits only; shown with commas when the field is not focused */
  const [priceDigits, setPriceDigits] = useState("");
  const [priceFocused, setPriceFocused] = useState(false);
  const [soldStory, setSoldStory] = useState("");
  const [addressValue, setAddressValue] = useState("");
  const [cityStateValue, setCityStateValue] = useState("");
  const [daysValue, setDaysValue] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [extractPending, setExtractPending] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [priceExtractHint, setPriceExtractHint] = useState<string | null>(null);
  const [autoCropPropertyPhoto, setAutoCropPropertyPhoto] = useState(true);
  const [useImportAsHero, setUseImportAsHero] = useState(false);
  const [cropHint, setCropHint] = useState<string | null>(null);
  const [cropOnlyPending, setCropOnlyPending] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  /** Avoid re-uploading the same file on every AI run. */
  const propertyImageUrlCacheRef = useRef<{ key: string; url: string } | null>(null);
  const aiGenerateLockRef = useRef(false);
  const aiLastGenerateStartRef = useRef(0);
  const extractLockRef = useRef(false);
  const extractLastStartRef = useRef(0);
  const soldStoryTextareaRef = useRef<HTMLTextAreaElement>(null);

  const strings = aiUiStrings(agentLocale);

  const priceDisplay =
    priceDigits === ""
      ? ""
      : priceFocused
        ? priceDigits
        : Number(priceDigits).toLocaleString("en-US");

  useEffect(() => {
    if (!propertyFile) {
      setPropertyPreview(null);
      propertyImageUrlCacheRef.current = null;
      return;
    }
    const url = URL.createObjectURL(propertyFile);
    setPropertyPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [propertyFile]);

  useEffect(() => {
    if (!importFile) {
      setImportPreview(null);
      return;
    }
    const url = URL.createObjectURL(importFile);
    setImportPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [importFile]);

  function propertyFileCacheKey(f: File) {
    return `${f.name}:${f.size}:${f.lastModified}`;
  }

  type PropertyImageUploadResult =
    | { ok: true; url: string }
    | { ok: false; message: string };

  function fileToImportPayload(file: File): Promise<{ mime_type: string; image_base64: string }> {
    if (file.size > MAX_IMPORT_IMAGE_BYTES) {
      return Promise.reject(new Error("MAX_SIZE"));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        const comma = data.indexOf(",");
        const image_base64 = comma >= 0 ? data.slice(comma + 1) : data;
        const mimeMatch = /^data:([^;]+);/i.exec(data);
        let mime =
          mimeMatch?.[1]?.trim().toLowerCase() === "image/jpg"
            ? "image/jpeg"
            : mimeMatch?.[1]?.trim().toLowerCase() || "";
        if (!mime.startsWith("image/")) {
          mime = file.type?.split(";")[0].trim().toLowerCase() || "image/jpeg";
          if (mime === "image/jpg") mime = "image/jpeg";
        }
        resolve({ mime_type: mime, image_base64 });
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  const applyScreenshotAsPropertyHero = useCallback(
    async (file: File) => {
      const s = aiUiStrings(agentLocale);
      propertyImageUrlCacheRef.current = null;
      if (!autoCropPropertyPhoto) {
        if (useImportAsHero) setPropertyFile(file);
        return;
      }
      try {
        const body = await fileToImportPayload(file);
        const res = await fetch("/api/crop-listing-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          error?: string;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          ok?: boolean;
        };
        if (!res.ok) throw new Error(data.error || "Crop API failed.");
        const box = {
          x: Number(data.x),
          y: Number(data.y),
          w: Number(data.w),
          h: Number(data.h),
        };
        if ([box.x, box.y, box.w, box.h].some((n) => Number.isNaN(n))) {
          throw new Error("Invalid crop box.");
        }
        const isFullFrame =
          box.w >= 0.9 && box.h >= 0.9 && box.x <= 0.08 && box.y <= 0.08;
        if (isFullFrame) {
          setCropHint(s.importCropFullFrame);
          if (useImportAsHero) setPropertyFile(file);
          return;
        }
        const cropped = await cropImageFileWithBox(file, box);
        setPropertyFile(cropped);
        setCropHint(null);
      } catch {
        setCropHint(s.importCropFailed);
        if (useImportAsHero) setPropertyFile(file);
      }
    },
    [agentLocale, autoCropPropertyPhoto, useImportAsHero],
  );

  const runCropPhotoOnly = useCallback(async () => {
    const s = aiUiStrings(agentLocale);
    setCropHint(null);
    if (!importFile) {
      setCropHint(s.importNeedFile);
      return;
    }
    if (importFile.size > MAX_IMPORT_IMAGE_BYTES) {
      setCropHint(s.importFileTooBig);
      return;
    }
    const now = Date.now();
    if (now - extractLastStartRef.current < EXTRACT_LISTING_COOLDOWN_MS) {
      setCropHint(s.importCooldown);
      return;
    }
    extractLastStartRef.current = now;
    setCropOnlyPending(true);
    try {
      await applyScreenshotAsPropertyHero(importFile);
    } finally {
      setCropOnlyPending(false);
    }
  }, [agentLocale, importFile, applyScreenshotAsPropertyHero]);

  const runExtractFromScreenshot = useCallback(async () => {
    const s = aiUiStrings(agentLocale);
    setExtractError(null);
    setPriceExtractHint(null);
    if (!importFile) {
      setExtractError(s.importNeedFile);
      return;
    }
    if (importFile.size > MAX_IMPORT_IMAGE_BYTES) {
      setExtractError(s.importFileTooBig);
      return;
    }
    if (extractLockRef.current) return;
    const now = Date.now();
    if (now - extractLastStartRef.current < EXTRACT_LISTING_COOLDOWN_MS) {
      setExtractError(s.importCooldown);
      return;
    }
    extractLastStartRef.current = now;
    extractLockRef.current = true;
    setExtractPending(true);
    try {
      const body = await fileToImportPayload(importFile);
      const ac = new AbortController();
      const timeoutId = window.setTimeout(() => ac.abort(), EXTRACT_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch("/api/extract-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          error?: string;
          address_line?: string;
          city_state?: string;
          price_usd?: number;
          days_on_market?: number | null;
          price_kind?: string;
        };
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        const addr = typeof data.address_line === "string" ? data.address_line.trim() : "";
        const city = typeof data.city_state === "string" ? data.city_state.trim() : "";
        const price = typeof data.price_usd === "number" && Number.isFinite(data.price_usd) ? data.price_usd : NaN;
        if (!addr || Number.isNaN(price) || price <= 0) {
          throw new Error("Could not read enough from the screenshot. Try a clearer crop.");
        }
        setAddressValue(addr);
        setCityStateValue(city);
        setPriceDigits(String(Math.floor(price)));
        if (data.days_on_market !== null && data.days_on_market !== undefined) {
          const d = Number.parseInt(String(data.days_on_market), 10);
          setDaysValue(Number.isNaN(d) ? "" : String(Math.max(0, d)));
        } else {
          setDaysValue("");
        }
        const pk = String(data.price_kind ?? "").toLowerCase();
        if (pk === "list") setPriceExtractHint(s.priceHintList);
        else if (pk === "sold") setPriceExtractHint(s.priceHintSold);
        else if (pk === "estimate") setPriceExtractHint(s.priceHintEstimate);
        else setPriceExtractHint(null);
        setCropHint(null);
        await applyScreenshotAsPropertyHero(importFile);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) {
      if ((e as Error)?.message === "MAX_SIZE") {
        setExtractError(s.importFileTooBig);
      } else if (e instanceof DOMException && e.name === "AbortError") {
        setExtractError(s.timeout);
      } else if (e instanceof Error && e.name === "AbortError") {
        setExtractError(s.timeout);
      } else {
        const msg = e instanceof Error ? e.message : "Extraction failed.";
        setExtractError(mapAiGenerateError(msg, s));
      }
    } finally {
      extractLockRef.current = false;
      setExtractPending(false);
    }
  }, [agentLocale, importFile, applyScreenshotAsPropertyHero]);

  const uploadPropertyImageFile = useCallback(async (file: File): Promise<PropertyImageUploadResult> => {
    if (!configured) return { ok: false, message: "Supabase is not configured." };
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Not signed in." };
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${randomStorageFileId()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(STORAGE_BUCKETS.propertyImages).upload(path, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (upErr) return { ok: false, message: upErr.message };
    const { data } = supabase.storage.from(STORAGE_BUCKETS.propertyImages).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  }, [configured]);

  const runAiGenerate = useCallback(async () => {
    const s = aiUiStrings(agentLocale);
    setAiError(null);
    const sideEl = document.getElementById("represented_side") as HTMLSelectElement | null;
    const address = addressValue.trim();
    const daysParsed = Number.parseInt(daysValue, 10);
    const daysOnMarket = Number.isNaN(daysParsed) ? NaN : Math.max(0, daysParsed);
    const priceUsd = Number.parseInt(priceDigits.replace(/\D/g, ""), 10);
    if (!address || Number.isNaN(priceUsd) || priceUsd < 0 || Number.isNaN(daysOnMarket)) {
      setAiError(s.needFields);
      return;
    }
    if (aiGenerateLockRef.current) return;
    const now = Date.now();
    if (now - aiLastGenerateStartRef.current < AI_SOLD_STORY_COOLDOWN_MS) {
      setAiError(s.waitCooldown);
      return;
    }
    aiLastGenerateStartRef.current = now;
    aiGenerateLockRef.current = true;
    setAiPending(true);
    try {
      let property_image_url: string | undefined;
      if (propertyFile) {
        const key = propertyFileCacheKey(propertyFile);
        let url =
          propertyImageUrlCacheRef.current?.key === key ? propertyImageUrlCacheRef.current.url : null;
        if (!url) {
          const up = await uploadPropertyImageFile(propertyFile);
          if (!up.ok) {
            setAiError(up.message);
            return;
          }
          url = up.url;
          propertyImageUrlCacheRef.current = { key, url };
        }
        property_image_url = url;
      }

      const ac = new AbortController();
      const timeoutId = window.setTimeout(() => ac.abort(), AI_GENERATE_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch("/api/generate-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            draft: {
              address,
              city_state: cityStateValue.trim(),
              price: priceUsd,
              days_on_market: daysOnMarket,
              represented_side: sideEl?.value?.trim() || null,
              language: agentLocale,
              ...(property_image_url ? { property_image_url } : {}),
            },
          }),
        });
        const data = (await res.json()) as { error?: string; soldStory?: string };
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        const text = data.soldStory?.trim();
        if (!text) throw new Error("Empty response");
        setSoldStory(text);
        queueMicrotask(() => {
          const el = soldStoryTextareaRef.current;
          el?.focus({ preventScroll: false });
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setAiError(s.timeout);
      } else if (e instanceof Error && e.name === "AbortError") {
        setAiError(s.timeout);
      } else {
        const msg = e instanceof Error ? e.message : "Generation failed.";
        setAiError(mapAiGenerateError(msg, s));
      }
    } finally {
      aiGenerateLockRef.current = false;
      setAiPending(false);
    }
  }, [addressValue, cityStateValue, daysValue, priceDigits, agentLocale, propertyFile, uploadPropertyImageFile]);

  async function uploadPropertyImage(file: File): Promise<string | null> {
    const r = await uploadPropertyImageFile(file);
    if (!r.ok) {
      setError(r.message);
      return null;
    }
    return r.url;
  }

  async function uploadVerificationDoc(file: File): Promise<string | null> {
    if (!configured) return null;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${user.id}/${randomStorageFileId()}.${ext}`;
    const contentType =
      file.type ||
      (ext === "pdf" || file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    const { error: upErr } = await supabase.storage.from(STORAGE_BUCKETS.verificationDocs).upload(path, file, {
      upsert: false,
      contentType,
    });
    if (upErr) {
      setError(upErr.message);
      return null;
    }
    return path;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    let propertyUrl = "";
    let verificationPath = "";

    setIsSubmitting(true);
    try {
      if (propertyFile) {
        const url = await uploadPropertyImage(propertyFile);
        if (!url) {
          setIsSubmitting(false);
          return;
        }
        propertyUrl = url;
      }

      if (verificationFile) {
        const path = await uploadVerificationDoc(verificationFile);
        if (!path) {
          setIsSubmitting(false);
          return;
        }
        verificationPath = path;
      }

      fd.set("property_image_url", propertyUrl);
      fd.set("verification_doc_url", verificationPath);
      fd.set("price", priceDigits);

      const result = await createSoldRecord(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard?created=${encodeURIComponent(result.recordSlug)}`);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-5 py-4 text-sm leading-relaxed text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100">
        Add <code className="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/50">.env.local</code>{" "}
        with Supabase keys to save closings to the database.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-12">
      <section className="space-y-4">
        <FieldLabel htmlFor="listing-import-drop">{strings.importTitle}</FieldLabel>
        <p className="font-sans text-sm leading-relaxed text-stone-600 dark:text-stone-400">{strings.importHelp}</p>
        <FileDropZone
          id="listing-import-drop"
          accept="image/*"
          variant="public"
          title="Listing portal screenshot"
          subtitle="PNG or JPEG — full page or crop with address, price, and DOM if shown."
          file={importFile}
          onFile={setImportFile}
          previewUrl={importPreview}
        />
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={autoCropPropertyPhoto}
            onChange={(e) => setAutoCropPropertyPhoto(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:focus:ring-stone-600"
          />
          <span className="font-sans text-sm text-stone-700 dark:text-stone-300">{strings.importAutoCrop}</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={useImportAsHero}
            onChange={(e) => setUseImportAsHero(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:focus:ring-stone-600"
          />
          <span className="font-sans text-sm text-stone-700 dark:text-stone-300">{strings.importUseAsHero}</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={extractPending || cropOnlyPending || isSubmitting || !importFile}
            className="gap-2"
            onClick={() => void runExtractFromScreenshot()}
            aria-busy={extractPending}
          >
            {extractPending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            )}
            {extractPending ? strings.importLoading : strings.importButton}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={extractPending || cropOnlyPending || isSubmitting || !importFile}
            className="gap-2"
            onClick={() => void runCropPhotoOnly()}
            aria-busy={cropOnlyPending}
          >
            {cropOnlyPending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            )}
            {cropOnlyPending ? strings.importCropLoading : strings.importCropOnlyButton}
          </Button>
        </div>
        {extractError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {extractError}
          </p>
        ) : null}
        {priceExtractHint ? (
          <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
            {priceExtractHint}
          </p>
        ) : null}
        {cropHint ? (
          <p className="rounded-xl border border-stone-200/90 bg-stone-50/90 px-3 py-2 text-sm text-stone-800 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200">
            {cropHint}
          </p>
        ) : null}
      </section>

      <section>
        <FieldLabel htmlFor="address">Street address</FieldLabel>
        <input
          id="address"
          name="address"
          required
          autoComplete="street-address"
          placeholder="123 Main Street"
          className={inputClass}
          value={addressValue}
          onChange={(e) => setAddressValue(e.target.value)}
        />
      </section>

      <section>
        <FieldLabel htmlFor="city_state">City &amp; state (optional)</FieldLabel>
        <input
          id="city_state"
          name="city_state"
          autoComplete="address-level2"
          placeholder="San Francisco, CA"
          className={inputClass}
          value={cityStateValue}
          onChange={(e) => setCityStateValue(e.target.value)}
        />
      </section>

      <section className="grid gap-10 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="price">Sold price (USD)</FieldLabel>
          <input
            id="price"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="1,850,000"
            className={cn(inputClass, "tabular-nums")}
            value={priceDisplay}
            onChange={(e) => setPriceDigits(e.target.value.replace(/\D/g, ""))}
            onFocus={() => setPriceFocused(true)}
            onBlur={() => setPriceFocused(false)}
            aria-label="Sold price in USD"
          />
        </div>
        <div>
          <FieldLabel htmlFor="days_on_market">Days on market</FieldLabel>
          <input
            id="days_on_market"
            name="days_on_market"
            required
            inputMode="numeric"
            placeholder="14"
            className={cn(inputClass, "tabular-nums")}
            value={daysValue}
            onChange={(e) => setDaysValue(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </section>

      <section>
        <FieldLabel htmlFor="represented_side">You represented (optional)</FieldLabel>
        <select
          id="represented_side"
          name="represented_side"
          className={cn(inputClass, "cursor-pointer")}
          defaultValue=""
        >
          <option value="">Prefer not to say</option>
          <option value="Buyer">Buyer</option>
          <option value="Seller">Seller</option>
          <option value="Both">Both (dual agency)</option>
        </select>
      </section>

      <section>
        <FieldLabel htmlFor="sold_story">Sold story</FieldLabel>
        <p className="mb-2 font-sans text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          {strings.aiStoryUsesAbove}
        </p>
        <p className="mb-3 font-sans text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {strings.editReminder}
        </p>
        <textarea
          ref={soldStoryTextareaRef}
          id="sold_story"
          name="sold_story"
          rows={6}
          value={soldStory}
          onChange={(e) => setSoldStory(e.target.value)}
          placeholder="A short narrative for your public story page — the win, the neighborhood, or what made this closing special."
          className={storyTextareaClass}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={aiPending || isSubmitting}
            className="shrink-0 gap-2"
            onClick={() => void runAiGenerate()}
            aria-busy={aiPending}
            aria-describedby={aiError ? "sold-story-ai-error" : undefined}
          >
            {aiPending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            )}
            {aiPending ? strings.loading : strings.generate}
          </Button>
        </div>
        {aiError ? (
          <p
            id="sold-story-ai-error"
            className="mt-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {aiError}
          </p>
        ) : null}
        {aiPending ? (
          <p className="mt-2 font-sans text-sm italic text-stone-500 dark:text-stone-400">{strings.loading}</p>
        ) : null}
        <p className="mt-3 font-sans text-xs leading-relaxed text-stone-500 dark:text-stone-400">{strings.hint}</p>
        <p className="mt-2 font-sans text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          {strings.photoVisionHint}
        </p>
        {agentLocale === "en" ? (
          <p className="mt-3 font-sans text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            Prefer Chinese, Russian, or Spanish labels on your public page and posters? Set your{" "}
            <Link href="/dashboard/settings" className="font-medium text-stone-800 underline-offset-2 hover:underline dark:text-stone-200">
              preferred language
            </Link>{" "}
            in Settings, then use the toggle below on your next record once it is not English.
          </p>
        ) : (
          <div className="mt-4 rounded-2xl border border-stone-200/90 bg-stone-50/60 px-4 py-4 dark:border-stone-800 dark:bg-stone-900/40">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="translate_to_my_language"
                value="on"
                className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:focus:ring-stone-600"
              />
              <span className="font-sans text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  Translate to my language ({LANG_LABEL[agentLocale]})
                </span>
                <span className="mt-1 block text-stone-500 dark:text-stone-400">
                  Runs a demo translator on your closing note before publish (replace with an AI API when ready). Your
                  profile language also drives poster fonts and layout (e.g. 3:4 for Chinese social apps).
                </span>
              </span>
            </label>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <FieldLabel htmlFor="property-drop">Property photo</FieldLabel>
        <FileDropZone
          id="property-drop"
          accept="image/*"
          variant="public"
          title="Listing hero image"
          subtitle="High-resolution JPEG, PNG, or WebP. Shown on your public profile."
          file={propertyFile}
          onFile={setPropertyFile}
          previewUrl={propertyPreview}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FieldLabel htmlFor="verification-drop">Closing statement</FieldLabel>
          <span className="mb-2 rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-600 dark:bg-stone-800 dark:text-stone-400">
            Private
          </span>
        </div>
        <FileDropZone
          id="verification-drop"
          accept="application/pdf,image/*"
          variant="private"
          title="Verification upload"
          subtitle="PDF or image of your closing statement. Stored privately; not shown on your public page."
          file={verificationFile}
          onFile={setVerificationFile}
          previewUrl={null}
        />
      </section>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-col-reverse gap-3 border-t border-stone-200/80 pt-10 dark:border-stone-800 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href="/dashboard"
          className="tap-highlight-none inline-flex h-12 items-center justify-center rounded-xl px-6 text-[15px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100"
        >
          Cancel
        </Link>
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileTap={!isSubmitting ? { scale: 0.985 } : undefined}
          className={cn(
            "relative h-12 min-w-[200px] overflow-hidden rounded-xl font-sans text-[15px] font-medium text-white shadow-sm transition",
            "bg-stone-900 hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100",
            isSubmitting && "cursor-wait opacity-95",
          )}
        >
          {isSubmitting && !reduceMotion && (
            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
              <motion.span
                className="absolute inset-y-0 w-[55%] bg-gradient-to-r from-transparent via-white/22 to-transparent dark:via-stone-900/12"
                initial={{ x: "-60%" }}
                animate={{ x: "220%" }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              />
            </span>
          )}
          <span className="relative flex items-center justify-center gap-2.5 px-8">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} aria-hidden />}
            {isSubmitting ? "Publishing…" : "Submit sale"}
          </span>
        </motion.button>
      </div>
    </form>
  );
}
