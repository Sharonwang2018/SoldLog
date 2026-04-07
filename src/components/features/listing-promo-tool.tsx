"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SupportedLocale } from "@/lib/i18n/locale";
import { MAX_LISTING_PROMO_IMAGE_BYTES } from "@/lib/constants/listing-promo-upload";
import { parseApiJsonResponse } from "@/lib/safe-response-json";
const FETCH_TIMEOUT_MS = 90_000;

const LANG_OPTIONS: { value: SupportedLocale | ""; label: string }[] = [
  { value: "", label: "Use my profile language" },
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese (Simplified)" },
  { value: "ru", label: "Русский" },
  { value: "es", label: "Español" },
];

function fileToPayload(file: File): Promise<{ mime_type: string; image_base64: string }> {
  if (file.size > MAX_LISTING_PROMO_IMAGE_BYTES) {
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

type ListingPromoToolProps = {
  defaultLanguage: SupportedLocale;
};

export function ListingPromoTool({ defaultLanguage }: ListingPromoToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState<SupportedLocale | "">("");
  const [audienceNote, setAudienceNote] = useState("");
  const [promo, setPromo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPickFile = useCallback((f: File | null) => {
    setFile(f);
    setPromo("");
    setError(null);
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    setCopied(false);
    if (!file) {
      setError("Choose a screenshot image first.");
      return;
    }
    setPending(true);
    try {
      const body = await fileToPayload(file);
      const payload = {
        ...body,
        ...(language ? { language } : {}),
        ...(audienceNote.trim() ? { audience_note: audienceNote.trim() } : {}),
      };
      const ac = new AbortController();
      const tid = window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch("/api/generate-listing-promo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ac.signal,
        });
        const data = await parseApiJsonResponse<{ error?: string; promo_text?: string }>(res);
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        const text = typeof data.promo_text === "string" ? data.promo_text.trim() : "";
        if (!text) throw new Error("Empty response from AI.");
        setPromo(text);
      } finally {
        clearTimeout(tid);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("did not match the expected pattern")) {
        setError(
          "Upload or response was rejected. Try a smaller screenshot (under ~2.5 MB) or try again in a moment.",
        );
      } else if ((e as Error)?.message === "MAX_SIZE") {
        setError(
          `Screenshot must be under ${(MAX_LISTING_PROMO_IMAGE_BYTES / (1024 * 1024)).toFixed(1)} MB (platform limit for uploads). Crop or compress and try again.`,
        );
      } else if (e instanceof DOMException && e.name === "AbortError") {
        setError("Request timed out — try a smaller image or again later.");
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    } finally {
      setPending(false);
    }
  }, [file, language, audienceNote]);

  const copy = useCallback(async () => {
    if (!promo) return;
    try {
      await navigator.clipboard.writeText(promo);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [promo]);

  const hintLocale =
    language || defaultLanguage === "zh" ? "zh" : defaultLanguage;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">From screenshot</CardTitle>
          <CardDescription>
            {hintLocale === "zh"
              ? "上传 Redfin / Zillow 等房源页截图；AI 根据画面上的文字生成可发朋友圈/群组的推荐文案。"
              : "Upload a listing page screenshot; AI reads visible text and drafts shareable buyer-facing copy."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="listing-promo-file" className="text-sm font-medium text-stone-800 dark:text-stone-200">
              Screenshot
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Max ~{(MAX_LISTING_PROMO_IMAGE_BYTES / (1024 * 1024)).toFixed(1)} MB — larger files may fail on mobile
              hosting limits.
            </p>
            <Input
              id="listing-promo-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="cursor-pointer"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Listing screenshot preview"
                className="mt-2 max-h-64 w-full rounded-xl border border-stone-200 object-contain dark:border-stone-800"
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="listing-promo-lang" className="text-sm font-medium text-stone-800 dark:text-stone-200">
              Output language
            </label>
            <select
              id="listing-promo-lang"
              value={language}
              onChange={(e) => setLanguage((e.target.value || "") as SupportedLocale | "")}
              className={cn(
                "flex h-11 w-full max-w-md rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 shadow-sm dark:border-stone-800 dark:bg-stone-950 dark:text-stone-50",
              )}
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value || "profile"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="listing-promo-audience" className="text-sm font-medium text-stone-800 dark:text-stone-200">
              Buyer context (optional)
            </label>
            <textarea
              id="listing-promo-audience"
              rows={3}
              value={audienceNote}
              onChange={(e) => setAudienceNote(e.target.value)}
              placeholder={
                hintLocale === "zh"
                  ? "例如：客户想买 San Ramon 的独立屋，重视学区与通勤…"
                  : "e.g. Buyer wants an SFH in San Ramon, cares about schools and commute…"
              }
              className={cn(
                "flex min-h-[88px] w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-600",
              )}
            />
          </div>

          <Button type="button" onClick={() => void generate()} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Generating…
              </>
            ) : (
              "Generate promo copy"
            )}
          </Button>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {promo ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Result</CardTitle>
              <CardDescription>Copy and paste into WeChat, Instagram, or email.</CardDescription>
            </div>
            <Button type="button" variant="secondary" size="sm" className="shrink-0 gap-1.5" onClick={() => void copy()}>
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? "Copied" : "Copy"}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-stone-100 p-4 text-sm text-stone-900 dark:bg-stone-900 dark:text-stone-100">
              {promo}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
