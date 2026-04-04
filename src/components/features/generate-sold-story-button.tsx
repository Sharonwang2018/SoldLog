"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AI_SOLD_STORY_COOLDOWN_MS = 4000;
const AI_GENERATE_FETCH_TIMEOUT_MS = 55_000;

type Props = {
  recordId: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
};

export function GenerateSoldStoryButton({ recordId, className, variant = "outline" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);
  const lastStartRef = useRef(0);

  async function run() {
    if (lockRef.current) return;
    const now = Date.now();
    if (now - lastStartRef.current < AI_SOLD_STORY_COOLDOWN_MS) {
      setError("Wait a few seconds before generating again.");
      return;
    }
    lastStartRef.current = now;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), AI_GENERATE_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({ recordId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        const msg = data.error || `Request failed (${res.status})`;
        if (/GOOGLE_GENERATIVE_AI_API_KEY|GEMINI_API_KEY|API key|not set/i.test(msg)) {
          throw new Error("Add GOOGLE_GENERATIVE_AI_API_KEY to .env.local on the server.");
        }
        throw new Error(msg);
      }
      router.refresh();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Request timed out. Try again.");
      } else if (e instanceof Error && e.name === "AbortError") {
        setError("Request timed out. Try again.");
      } else {
        setError(e instanceof Error ? e.message : "Could not generate story.");
      }
    } finally {
      clearTimeout(timeoutId);
      lockRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={busy}
        className="gap-2"
        onClick={run}
        aria-busy={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        )}
        {busy ? "Generating…" : "✨ AI Generate"}
      </Button>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
