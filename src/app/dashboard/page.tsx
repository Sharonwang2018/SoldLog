import Link from "next/link";
import { PlusCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardClosingRow } from "@/components/features/dashboard-closing-row";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";

type ClosingRow = {
  id: string;
  slug: string;
  address: string;
  city_state: string;
  sold_story: string | null;
};

export default async function DashboardPage() {
  let publicSlug: string | null = null;
  let closings: ClosingRow[] = [];

  if (isSupabaseServerConfigured()) {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("slug").eq("id", user.id).maybeSingle();
      publicSlug = (data?.slug as string | undefined) ?? null;

      const { data: records } = await supabase
        .from("sold_records")
        .select("id, slug, address, city_state, sold_story")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });
      closings = (records as ClosingRow[] | null) ?? [];
    }
  } else {
    publicSlug = "jane-doe";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">
            Overview
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Manage your public profile and recent closings.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new" className="gap-2">
            <PlusCircle className="h-4 w-4" aria-hidden />
            New sold record
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Public URL</CardTitle>
            <CardDescription>Share this link on Instagram, email signatures, and more.</CardDescription>
          </CardHeader>
          <CardContent>
            {publicSlug ? (
              <>
                <p className="rounded-xl bg-stone-100 px-3 py-2 font-mono text-sm text-stone-800 dark:bg-stone-900 dark:text-stone-200">
                  soldlog.com/{publicSlug}
                </p>
                <Button variant="secondary" className="mt-3 w-full" asChild>
                  <Link href={`/${publicSlug}`} target="_blank" rel="noopener noreferrer">
                    Preview profile
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="rounded-xl bg-stone-100 px-3 py-2 font-mono text-sm text-stone-600 dark:bg-stone-400">
                  Sign in and save your handle in Settings to see your link here.
                </p>
                <Button variant="secondary" className="mt-3 w-full" asChild>
                  <Link href="/dashboard/settings">Open settings</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification</CardTitle>
            <CardDescription>Upload closing statements to unlock verified badges.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              2 of 3 demo listings verified. Complete uploads on each record.
            </p>
            <Button variant="outline" className="mt-3 w-full" asChild>
              <Link href="/dashboard/new">Add or edit record</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-stone-500" aria-hidden />
              <CardTitle className="text-base">Tools</CardTitle>
            </div>
            <CardDescription>
              Closing stats by month and city, listing promo from screenshots — separate from your sold-record archive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full sm:w-auto" asChild>
              <Link href="/dashboard/tools">Open tools</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {publicSlug && closings.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
            Your closings
          </h2>
          <ul className="space-y-3">
            {closings.map((r) => {
              const line = [r.address, r.city_state].filter(Boolean).join(", ");
              return (
                <DashboardClosingRow
                  key={r.id}
                  recordId={r.id}
                  headline={line || r.slug}
                  recordSlug={r.slug}
                  publicSlug={publicSlug}
                  soldStory={r.sold_story}
                />
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
