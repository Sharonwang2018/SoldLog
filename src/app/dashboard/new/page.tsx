import { SoldRecordForm } from "@/components/features/sold-record-form";
import { normalizeLocale } from "@/lib/i18n/locale";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";

export default async function DashboardNewSoldPage() {
  let preferredLanguage = "en";

  if (isSupabaseServerConfigured()) {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("language").eq("id", user.id).maybeSingle();
      preferredLanguage = normalizeLocale(data?.language as string | null | undefined);
    }
  }

  return (
    <div className="relative mx-auto max-w-2xl pb-16">
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-64 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(120,113,108,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(255,255,255,0.05),transparent)]" />

      <header className="relative mb-12 text-center sm:mb-14">
        <p className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
          Dashboard
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl dark:text-stone-50">
          New sold record
        </h1>
        <p className="mx-auto mt-4 max-w-md font-sans text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">
          The input flow agents use most — add a closing, story, and media. It appears on your public profile at{" "}
          <span className="whitespace-nowrap font-mono text-sm text-stone-800 dark:text-stone-200">/your-slug</span>.
        </p>
      </header>

      <div className="relative rounded-3xl border border-stone-200/80 bg-white/80 p-8 shadow-sm backdrop-blur-sm dark:border-stone-800/80 dark:bg-stone-950/60 sm:p-10">
        <SoldRecordForm preferredLanguage={preferredLanguage} />
      </div>
    </div>
  );
}
