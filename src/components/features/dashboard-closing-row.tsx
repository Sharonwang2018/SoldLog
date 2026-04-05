"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { updateSoldRecordStory } from "@/app/dashboard/sold-records-actions";
import { GenerateSoldStoryButton } from "@/components/features/generate-sold-story-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  recordId: string;
  headline: string;
  recordSlug: string;
  publicSlug: string;
  soldStory: string | null;
};

export function DashboardClosingRow({ recordId, headline, recordSlug, publicSlug, soldStory }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(soldStory ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(soldStory ?? "");
  }, [soldStory, editing]);

  const storyTrim = soldStory?.trim() ?? "";
  const publicPath = `/${publicSlug}/${recordSlug}`;

  async function save() {
    setSaving(true);
    setError(null);
    const result = await updateSoldRecordStory(recordId, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950",
        "sm:flex-row sm:items-start sm:justify-between",
      )}
    >
      <div className="min-w-0 flex-1 space-y-3">
        <p className="font-medium text-stone-900 dark:text-stone-100">{headline}</p>

        {editing ? (
          <div className="space-y-2">
            <label htmlFor={`story-${recordId}`} className="sr-only">
              Sold story
            </label>
            <textarea
              id={`story-${recordId}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="block w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2.5 text-sm leading-relaxed text-stone-900 shadow-sm outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-500 dark:focus:ring-stone-800"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={saving} className="gap-2" onClick={() => void save()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {saving ? "Saving…" : "Save story"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setDraft(soldStory ?? "");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : storyTrim ? (
          <div className="rounded-xl bg-stone-50/90 px-3 py-3 dark:bg-stone-900/50">
            <p className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700 dark:text-stone-300">
              {storyTrim}
            </p>
          </div>
        ) : (
          <p className="text-sm italic text-stone-500 dark:text-stone-400">No sold story yet</p>
        )}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={publicPath}
            className="text-sm font-medium text-stone-700 underline-offset-4 hover:underline dark:text-stone-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            View public page
          </Link>
          {!editing ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-700 underline-offset-4 hover:underline dark:text-stone-300"
              onClick={() => {
                setEditing(true);
                setDraft(soldStory ?? "");
                setError(null);
              }}
            >
              <Pencil className="h-3.5 w-3.5 opacity-80" aria-hidden />
              Edit story
            </button>
          ) : null}
        </div>
      </div>

      <GenerateSoldStoryButton recordId={recordId} className="w-full shrink-0 sm:w-auto sm:pl-4" />
    </li>
  );
}
