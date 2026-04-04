"use client";

import { useCallback, useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SharePropertyButtonProps = {
  /** Full path e.g. /jane-doe/sf-pac-heights */
  storyPath: string;
  title: string;
  text: string;
  className?: string;
};

function shareToWhatsApp(url: string, shareText: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(shareText);
  window.open(`https://wa.me/?text=${t}%20${u}`, "_blank", "noopener,noreferrer");
}

export function SharePropertyButton({ storyPath, title, text, className }: SharePropertyButtonProps) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fullUrl = origin ? `${origin}${storyPath}` : storyPath;
  /** Web Share API */
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

  const onShare = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const ok = await nativeShare();
      if (ok) return;
      setOpen((v) => !v);
    },
    [nativeShare],
  );

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen(true);
    }
  }, [fullUrl]);

  return (
    <div className={cn("relative", className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onShare}
        className="tap-highlight-none inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-md backdrop-blur-sm transition hover:bg-white dark:bg-stone-900/95 dark:text-stone-50 dark:hover:bg-stone-900"
        aria-label={
          canNativeShare
            ? "Share this sale using your device's share sheet"
            : "Share this sale (link, WhatsApp, SMS, or copy)"
        }
      >
        <Share2 className="h-[18px] w-[18px]" aria-hidden />
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 z-[60] mb-2 w-56 rounded-2xl border border-stone-200/80 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95"
          role="dialog"
          aria-label="Share sale"
        >
          <p className="mb-2 px-1 text-center text-xs text-stone-500 dark:text-stone-400">
            {canNativeShare ? "More ways to share" : "Share this sale"}
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
