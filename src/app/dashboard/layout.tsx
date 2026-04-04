import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";

/** Always resolve auth from cookies on each request — avoids stale RSC cache after Server Action redirects. */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseServerConfigured()) {
    return (
      <DashboardShell userEmail={null} supabaseConfigured={false}>
        {children}
      </DashboardShell>
    );
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <DashboardShell userEmail={user.email ?? undefined} supabaseConfigured>
      {children}
    </DashboardShell>
  );
}
