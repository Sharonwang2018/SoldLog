import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClosingBriefTool } from "@/components/features/closing-brief-tool";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";

export default async function ClosingBriefToolPage() {
  let agentDisplayName = "";

  if (isSupabaseServerConfigured()) {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      agentDisplayName = (data?.name as string | undefined)?.trim() ?? "";
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Button variant="ghost" className="-ml-3 mb-2 h-auto px-3 py-1.5 text-stone-600 dark:text-stone-400" asChild>
          <Link href="/dashboard/tools" className="gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All tools
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">Closing brief</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Roll up your closings by month range, see volume by city, and copy a ready-to-post summary.
        </p>
      </div>

      <ClosingBriefTool agentDisplayName={agentDisplayName} />
    </div>
  );
}
