"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, Menu, PlusCircle, Settings, Wrench, X } from "lucide-react";
import { signOut } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/new", label: "New sale", icon: PlusCircle },
  { href: "/dashboard/tools", label: "Tools", icon: Wrench },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

type DashboardShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
  supabaseConfigured?: boolean;
};

export function DashboardShell({
  children,
  userEmail,
  supabaseConfigured = true,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (href !== "/dashboard" && href !== "/dashboard/tools" && pathname.startsWith(href)) ||
          (href === "/dashboard/tools" && pathname.startsWith("/dashboard/tools"));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-stone-50 dark:bg-stone-950">
      {!supabaseConfigured && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Without Supabase env vars, auth is not enforced. Add{" "}
          <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/50">.env.local</code> for production.
        </div>
      )}
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-stone-200/80 bg-white/90 py-6 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/90 lg:flex">
          <Link
            href="/"
            className="mb-6 block px-6 font-display text-lg font-semibold text-stone-900 dark:text-stone-100"
          >
            SoldLog
          </Link>
          <div className="flex-1">
            <NavLinks />
          </div>
          <div className="mt-auto space-y-2 px-3 pt-8">
            {userEmail && (
              <p className="truncate px-3 text-xs text-stone-500 dark:text-stone-400" title={userEmail}>
                {userEmail}
              </p>
            )}
            {supabaseConfigured ? (
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="h-auto w-full justify-start px-3 py-2 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                >
                  Sign out
                </Button>
              </form>
            ) : (
              <Link
                href="/login"
                className="block rounded-xl px-3 py-2 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              >
                Sign in
              </Link>
            )}
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/80 bg-[var(--sl-header)] px-4 py-3 backdrop-blur-xl lg:hidden dark:border-stone-800">
            <Link href="/" className="font-display text-lg font-semibold">
              SoldLog
            </Link>
            <button
              type="button"
              className="tap-highlight-none inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 right-0 z-50 w-[min(100vw-3rem,320px)] border-l border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-950 lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
                <span className="text-sm font-semibold">Menu</span>
                <button
                  type="button"
                  className="tap-highlight-none inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-900"
                  aria-label="Close"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
              <div className="space-y-2 px-3 pb-6 pt-2">
                {userEmail && (
                  <p className="truncate px-3 text-xs text-stone-500 dark:text-stone-400">{userEmail}</p>
                )}
                {supabaseConfigured ? (
                  <form action={signOut}>
                    <Button
                      type="submit"
                      variant="ghost"
                      className="h-auto w-full justify-start px-3 py-2 text-sm text-stone-500"
                      onClick={() => setMobileOpen(false)}
                    >
                      Sign out
                    </Button>
                  </form>
                ) : (
                  <Link
                    href="/login"
                    className="block rounded-xl px-3 py-2 text-sm text-stone-500"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
