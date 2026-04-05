import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListingPromoTool } from "@/components/features/listing-promo-tool";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/locale";

export default async function ListingPosterToolPage() {
  let defaultLanguage: SupportedLocale = "en";
  if (isSupabaseServerConfigured()) {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("language").eq("id", user.id).maybeSingle();
      defaultLanguage = normalizeLocale(data?.language as string | null | undefined);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" className="-ml-3 mb-2 h-auto px-3 py-1.5 text-stone-600 dark:text-stone-400" asChild>
            <Link href="/dashboard/tools" className="gap-2 text-sm">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All tools
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">Listing promo</h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Turn a portal screenshot into polished marketing copy for your buyers.
          </p>
        </div>
      </div>

      <ListingPromoTool defaultLanguage={defaultLanguage} />
    </div>
  );
}
