"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const links: { href: string; label: string; note?: string }[] = [
  { href: "/", label: "Home" },
  { href: "/login", label: "Login" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/tools", label: "Tools" },
  { href: "/dashboard/tools/closing-brief", label: "Closing brief" },
  { href: "/dashboard/tools/listing-poster", label: "Listing promo" },
  { href: "/dashboard/new", label: "New sold record" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function MobileTestPanel() {
  const [info, setInfo] = useState<{
    w: number;
    h: number;
    dpr: number;
    touch: boolean;
    ua: string;
  } | null>(null);

  useEffect(() => {
    function read() {
      setInfo({
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        touch: typeof navigator !== "undefined" && navigator.maxTouchPoints > 0,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    }
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8 pb-16">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">Mobile test</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Large tap targets and quick jumps — use on your phone over Wi‑Fi (same LAN IP as dev server).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Viewport</CardTitle>
          <CardDescription>Updates on rotate / resize</CardDescription>
        </CardHeader>
        <CardContent>
          {info ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500 dark:text-stone-400">innerWidth × innerHeight</dt>
                <dd className="tabular-nums font-medium text-stone-900 dark:text-stone-100">
                  {info.w} × {info.h}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500 dark:text-stone-400">devicePixelRatio</dt>
                <dd className="tabular-nums font-medium text-stone-900 dark:text-stone-100">{info.dpr}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500 dark:text-stone-400">Touch</dt>
                <dd className="font-medium text-stone-900 dark:text-stone-100">{info.touch ? "Yes" : "No"}</dd>
              </div>
              <div className="pt-2">
                <dt className="text-xs text-stone-500 dark:text-stone-400">User-Agent</dt>
                <dd className="mt-1 break-all text-xs text-stone-700 dark:text-stone-300">{info.ua}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-stone-500">Loading…</p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Jump to
        </h2>
        <ul className="flex flex-col gap-2">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Button asChild className="h-12 w-full justify-center text-base" variant="secondary">
                <Link href={href}>{label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
