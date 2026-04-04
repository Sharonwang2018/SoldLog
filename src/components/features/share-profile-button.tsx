"use client";

import { useCallback, useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TriggerVariant = "default" | "compact" | "fab";

type ShareProfileButtonProps = {
  sharePath: string;
  title: string;
  text: string;
  className?: string;
  triggerVariant?: TriggerVariant;
};

function shareToWhatsApp(url: string, shareText: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(shareText);
  window.open(`https://wa.me/?text=${t}%20${u}`, "_blank", "noopener,noreferrer");
}

export function ShareProfileButton({
  sharePath,
  title,
  text,
  className = "",
  triggerVariant = "default",
}: ShareProfileButtonProps) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fullUrl = origin ? `${origin}${sharePath}` : sharePath;
  /** Web Share API (mobile Safari, Chrome Android, etc.) */
  const canNativeShare =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.share === "function";

  const nativeShare = useCallback(async () => {
    if (!canNativeShare) return false;
    try {
      await navigator.share({ title, text, url: fullUrl });
      return true;
    } catch (e) {
      const err = e as Error;
      if (err?.name === "AbortError") return true;
      return false;
    }
  }, [canNativeShare, fullUrl, text, title]);

  const onShare = useCallback(async () => {
    const ok = await nativeShare();
    if (ok) return;
    setOpen((v) => !v);
  }, [nativeShare]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen(true);
    }
  }, [fullUrl]);

  const triggerClass =
    triggerVariant === "default"
      ? "tap-highlight-none flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 text-[15px] font-medium tracking-tight text-white shadow-sm transition active:scale-[0.98] sm:min-h-0 sm:py-3.5 dark:bg-white dark:text-stone-900"
      : triggerVariant === "compact"
        ? "tap-highlight-none inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3 text-xs font-semibold text-white shadow-sm transition active:scale-[0.98] dark:bg-white dark:text-stone-900"
        : "tap-highlight-none inline-flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-white shadow-lg ring-4 ring-white/10 transition active:scale-[0.96] dark:bg-white dark:text-stone-900 dark:ring-stone-900/40";

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={onShare}
        className={triggerClass}
        aria-label={
          canNativeShare
            ? "Share profile using your device's share sheet"
            : "Share profile (link, WhatsApp, SMS, or copy)"
        }
      >
        <Share2
          className={cn(
            "shrink-0 opacity-90",
            triggerVariant === "default" && "h-[18px] w-[18px]",
            triggerVariant === "compact" && "h-3.5 w-3.5",
            triggerVariant === "fab" && "h-5 w-5",
          )}
          aria-hidden
        />
        {(triggerVariant === "default" || triggerVariant === "compact") && (
          <span>{triggerVariant === "compact" ? "Share" : "Share profile"}</span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-[60] mt-2 w-[min(100vw-2rem,280px)] rounded-2xl border border-stone-200/80 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95",
            triggerVariant === "default" ? "left-0 right-0" : "right-0",
            triggerVariant === "fab" && "right-0",
          )}
          role="dialog"
          aria-label="Share options"
        >
          <p className="mb-2 px-1 text-center text-xs text-stone-500 dark:text-stone-400">
            {canNativeShare ? "More ways to share" : "Share this profile"}
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                shareToWhatsApp(fullUrl, `${text} ${fullUrl}`);
                setOpen(false);
              }}
              className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-800 transition hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800"
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => {
                const body = encodeURIComponent(`${text}\n${fullUrl}`);
                window.location.href = `sms:?body=${body}`;
                setOpen(false);
              }}
              className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-800 transition hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800"
            >
              Messages (SMS)
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-800 transition hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800"
            >
              {copied ? "Copied link" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
