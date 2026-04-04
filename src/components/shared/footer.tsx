import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-stone-200/80 bg-stone-50/80 py-12 dark:border-stone-800 dark:bg-stone-950/80">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
            SoldLog
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            The portfolio layer for top-producing agents.
          </p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-stone-600 dark:text-stone-400">
          <Link href="/login" className="hover:text-stone-900 dark:hover:text-stone-100">
            Log in
          </Link>
          <Link href="/dashboard" className="hover:text-stone-900 dark:hover:text-stone-100">
            Dashboard
          </Link>
          <Link href="/jane-doe" className="hover:text-stone-900 dark:hover:text-stone-100">
            Demo profile
          </Link>
        </nav>
      </div>
      <p className="mt-8 text-center text-xs text-stone-400 dark:text-stone-600">
        © {new Date().getFullYear()} SoldLog. All rights reserved.
      </p>
    </footer>
  );
}
