"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SupportedLocale } from "@/lib/i18n/locale";
import {
  buildClosingBriefShareText,
  formatUsdCompact,
  type ClosingStatsPayload,
} from "@/lib/closing-stats";

const LANG_OPTIONS: { value: SupportedLocale | ""; label: string }[] = [
  { value: "", label: "English (default)" },
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese (Simplified)" },
  { value: "ru", label: "Русский" },
  { value: "es", label: "Español" },
];

function ytdDefaultRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const to = `${y}-${String(m).padStart(2, "0")}`;
  const from = `${y}-01`;
  return { from, to };
}

type ClosingBriefToolProps = {
  agentDisplayName: string;
};

export function ClosingBriefTool({ agentDisplayName }: ClosingBriefToolProps) {
  const initial = useMemo(() => ytdDefaultRange(), []);
  const [fromMonth, setFromMonth] = useState(initial.from);
  const [toMonth, setToMonth] = useState(initial.to);
  const [language, setLanguage] = useState<SupportedLocale | "">("");
  const [stats, setStats] = useState<ClosingStatsPayload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveLocale = language || "en";

  const load = useCallback(async () => {
    setError(null);
    setCopied(false);
    setPending(true);
    try {
      const q = new URLSearchParams({ from: fromMonth, to: toMonth });
      const res = await fetch(`/api/closing-stats?${q.toString()}`);
      const data = (await res.json()) as ClosingStatsPayload & { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setStats({
        startYmd: data.startYmd,
        endYmd: data.endYmd,
        from_month: data.from_month,
        to_month: data.to_month,
        count: data.count,
        total_volume_usd: data.total_volume_usd,
        by_city: Array.isArray(data.by_city) ? data.by_city : [],
      });
    } catch (e) {
      setStats(null);
      setError(e instanceof Error ? e.message : "Failed to load stats.");
    } finally {
      setPending(false);
    }
  }, [fromMonth, toMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareText = useMemo(() => {
    if (!stats) return "";
    return buildClosingBriefShareText(stats, effectiveLocale, agentDisplayName);
  }, [stats, effectiveLocale, agentDisplayName]);

  const copy = useCallback(async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [shareText]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date range</CardTitle>
          <CardDescription>
            Stats use each record&apos;s closing date when set; otherwise the record creation date.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="cb-from" className="text-sm font-medium text-stone-800 dark:text-stone-200">
              From (month)
            </label>
            <input
              id="cb-from"
              type="month"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              className={cn(
                "flex h-11 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm dark:border-stone-800 dark:bg-stone-950 dark:text-stone-50",
              )}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cb-to" className="text-sm font-medium text-stone-800 dark:text-stone-200">
              To (month)
            </label>
            <input
              id="cb-to"
              type="month"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
              className={cn(
                "flex h-11 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm dark:border-stone-800 dark:bg-stone-950 dark:text-stone-50",
              )}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cb-lang" className="text-sm font-medium text-stone-800 dark:text-stone-200">
              Share text language
            </label>
            <select
              id="cb-lang"
              value={language}
              onChange={(e) => setLanguage((e.target.value || "") as SupportedLocale | "")}
              className="flex h-11 max-w-md rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm dark:border-stone-800 dark:bg-stone-950 dark:text-stone-50"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value || "profile"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={() => void load()} disabled={pending} className="sm:mb-0.5">
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Refresh stats
              </>
            )}
          </Button>
        </CardContent>
        {error ? (
          <CardContent className="pt-0">
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          </CardContent>
        ) : null}
      </Card>

      {stats ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
              <CardDescription>
                {stats.startYmd} → {stats.endYmd} · {stats.count} closing{stats.count === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-stone-100 px-4 py-3 dark:bg-stone-900">
                  <dt className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    Total volume
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    {formatUsdCompact(stats.total_volume_usd, effectiveLocale)}
                  </dd>
                </div>
                <div className="rounded-xl bg-stone-100 px-4 py-3 dark:bg-stone-900">
                  <dt className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    Closings
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    {stats.count}
                  </dd>
                </div>
              </dl>

              {stats.by_city.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
                  <table className="w-full min-w-[280px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900/80">
                        <th className="px-3 py-2 font-medium text-stone-700 dark:text-stone-300">City / area</th>
                        <th className="px-3 py-2 font-medium text-stone-700 dark:text-stone-300">Count</th>
                        <th className="px-3 py-2 font-medium text-stone-700 dark:text-stone-300">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.by_city.map((row) => (
                        <tr
                          key={row.city_state}
                          className="border-b border-stone-100 last:border-0 dark:border-stone-800/80"
                        >
                          <td className="px-3 py-2 text-stone-900 dark:text-stone-100">{row.city_state}</td>
                          <td className="px-3 py-2 tabular-nums text-stone-700 dark:text-stone-300">{row.count}</td>
                          <td className="px-3 py-2 tabular-nums text-stone-700 dark:text-stone-300">
                            {formatUsdCompact(row.volume_usd, effectiveLocale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Share text</CardTitle>
                <CardDescription>For WeChat, email, or Instagram caption.</CardDescription>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void copy()}
              >
                <Copy className="h-4 w-4" aria-hidden />
                {copied ? "Copied" : "Copy"}
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap break-words rounded-xl bg-stone-100 p-4 text-sm text-stone-900 dark:bg-stone-900 dark:text-stone-100">
                {shareText}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
