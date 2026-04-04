"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FileText, ImagePlus, Loader2, Lock, Sparkles, Upload } from "lucide-react";
import { createSoldRecord } from "@/app/dashboard/sold-records-actions";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/locale";

/** Client-side throttle: avoids burst clicks burning LLM quota (not a security boundary). */
const AI_SOLD_STORY_COOLDOWN_MS = 4000;
const AI_GENERATE_FETCH_TIMEOUT_MS = 55_000;

const LANG_LABEL: Record<SupportedLocale, string> = {
  en: "English",
  zh: "Chinese",
  ru: "Русский",
  es: "Español",
};

function mapAiGenerateError(message: string, s: ReturnType<typeof aiUiStrings>): string {
  if (/GOOGLE_GENERATIVE_AI_API_KEY|GEMINI_API_KEY|API key|not set/i.test(message)) {
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
        hint: "文案语言与 Settings 中的首选语言一致（也可在请求中指定）。生成结果会自动填入上方文本框；提交表单后保存。",
        photoVisionHint:
          "若已选择房源照片，生成时会先上传并由服务端调用 Gemini 多模态分析装修风格与采光等，再写入故事。",
        needFields: "请先填写地址、售价与上市天数。",
        waitCooldown: "请稍等几秒再试，避免重复消耗生成额度。",
        missingApiKey: "服务端未配置 GOOGLE_GENERATIVE_AI_API_KEY，请在 .env.local 中添加（勿提交到 Git）。",
        timeout: "请求超时，请稍后重试。",
      };
    case "es":
      return {
        generate: "✨ IA generar",
        loading: "Generando…",
        hint: "El texto se rellena automáticamente; guarda al publicar.",
        photoVisionHint:
          "Si eliges foto, se sube y el servidor usa Gemini multimodal para el estilo del inmueble.",
        needFields: "Indica dirección, precio y días en mercado.",
        waitCooldown: "Espera unos segundos antes de volver a generar.",
        missingApiKey: "Falta GOOGLE_GENERATIVE_AI_API_KEY en el servidor (.env.local).",
        timeout: "Tiempo de espera agotado. Inténtalo de nuevo.",
      };
    case "ru":
      return {
        generate: "✨ ИИ — создать",
        loading: "Генерация…",
        hint: "Текст подставится автоматически; сохраните форму.",
        photoVisionHint:
          "При выборе фото оно загружается, сервер вызывает Gemini для стиля интерьера.",
        needFields: "Укажите адрес, цену и дни на рынке.",
        waitCooldown: "Подождите несколько секунд перед следующей генерацией.",
        missingApiKey: "На сервере не задан GOOGLE_GENERATIVE_AI_API_KEY (.env.local).",
        timeout: "Превышено время ожидания. Попробуйте снова.",
      };
    default:
      return {
        generate: "✨ AI Generate",
        loading: "Generating…",
        hint: "Uses your preferred language from Settings. The story fills the box automatically; submit the form to save.",
        photoVisionHint:
          "If you add a listing photo, it uploads first; the server calls Gemini (multimodal) for décor and light — API key stays server-side.",
        needFields: "Add address, sold price, and days on market first.",
        waitCooldown: "Wait a few seconds before generating again.",
        missingApiKey: "Server missing GOOGLE_GENERATIVE_AI_API_KEY — add it to .env.local (never commit keys).",
        timeout: "Request timed out. Try again in a moment.",
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
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  /** Avoid re-uploading the same file on every AI run. */
  const propertyImageUrlCacheRef = useRef<{ key: string; url: string } | null>(null);
  const aiGenerateLockRef = useRef(false);
  const aiLastGenerateStartRef = useRef(0);

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

  function propertyFileCacheKey(f: File) {
    return `${f.name}:${f.size}:${f.lastModified}`;
  }

  type PropertyImageUploadResult =
    | { ok: true; url: string }
    | { ok: false; message: string };

  const uploadPropertyImageFile = useCallback(async (file: File): Promise<PropertyImageUploadResult> => {
    if (!configured) return { ok: false, message: "Supabase is not configured." };
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Not signed in." };
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
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
    const addrEl = document.getElementById("address") as HTMLInputElement | null;
    const daysEl = document.getElementById("days_on_market") as HTMLInputElement | null;
    const cityEl = document.getElementById("city_state") as HTMLInputElement | null;
    const sideEl = document.getElementById("represented_side") as HTMLSelectElement | null;
    const address = addrEl?.value?.trim() ?? "";
    const daysParsed = Number.parseInt(daysEl?.value ?? "", 10);
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
              city_state: cityEl?.value?.trim() ?? "",
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
  }, [priceDigits, agentLocale, propertyFile, uploadPropertyImageFile]);

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
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
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
      <section>
        <FieldLabel htmlFor="address">Street address</FieldLabel>
        <input
          id="address"
          name="address"
          required
          autoComplete="street-address"
          placeholder="123 Main Street"
          className={inputClass}
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
        </select>
      </section>

      <section>
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <FieldLabel htmlFor="sold_story">Sold story</FieldLabel>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={aiPending || isSubmitting}
            className="shrink-0 gap-2 self-start sm:self-auto"
            onClick={() => void runAiGenerate()}
            aria-busy={aiPending}
          >
            {aiPending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            )}
            {aiPending ? strings.loading : strings.generate}
          </Button>
        </div>
        <textarea
          id="sold_story"
          name="sold_story"
          rows={5}
          value={soldStory}
          onChange={(e) => setSoldStory(e.target.value)}
          placeholder="A short narrative for your public story page — the win, the neighborhood, or what made this closing special."
          className={cn(
            inputClass,
            "min-h-[140px] resize-y py-3.5 leading-relaxed placeholder:leading-relaxed",
          )}
        />
        {aiError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
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
          subtitle="PDF or image of your closing statement. Stored in a private bucket for admin review only."
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
