"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      setError("Sign-in failed or the link expired. Please try again.");
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!configured) {
      setError("Add Supabase variables to .env.local in the project root.");
      return;
    }

    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const origin = window.location.origin;

      if (mode === "signin") {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signErr) {
          setError(signErr.message === "Invalid login credentials" ? "Invalid email or password." : signErr.message);
          return;
        }
        router.push(nextPath);
        router.refresh();
        return;
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          data: { display_name: displayName.trim() || undefined },
        },
      });

      if (signUpErr) {
        setError(signUpErr.message);
        return;
      }

      if (data.session) {
        router.push(nextPath);
        router.refresh();
        return;
      }

      setMessage("Account created. If email confirmation is enabled, check your inbox to verify before signing in.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (
        raw === "Failed to fetch" ||
        raw.includes("NetworkError") ||
        raw.includes("Load failed")
      ) {
        setError(
          "Could not reach Supabase (network error). Check: (1) NEXT_PUBLIC_SUPABASE_URL is exactly https://YOUR-PROJECT.supabase.co with no typo or trailing junk, (2) restart npm run dev after editing .env.local, (3) in Supabase Dashboard → Authentication → URL Configuration, add http://localhost:3001 (and your callback path) to Redirect URLs, (4) disable ad blockers / try another network or VPN if supabase.co is blocked.",
        );
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">Supabase not connected</p>
        <p className="mt-2 leading-relaxed text-amber-900/90 dark:text-amber-200/90">
          Copy <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">.env.example</code> to{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">.env.local</code>, add your
          project URL and anon key, then restart <code className="text-xs">npm run dev</code>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2 rounded-xl bg-stone-100 p-1 dark:bg-stone-900">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
            setMessage(null);
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            mode === "signin"
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setMessage(null);
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            mode === "signup"
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          }`}
        >
          Sign up
        </button>
      </div>

      {mode === "signup" && (
        <div className="space-y-2">
          <label htmlFor="displayName" className="text-sm font-medium text-stone-800 dark:text-stone-200">
            Display name (optional)
          </label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            placeholder="Shown in your dashboard"
          />
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-stone-800 dark:text-stone-200">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="you@brokerage.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-stone-800 dark:text-stone-200">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          placeholder="At least 6 characters"
        />
      </div>

      {mode === "signup" && (
        <div className="space-y-2">
          <label htmlFor="confirm" className="text-sm font-medium text-stone-800 dark:text-stone-200">
            Confirm password
          </label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            placeholder="Re-enter password"
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-stone-600 dark:text-stone-400">
        <Link href="/" className="font-medium text-stone-900 underline-offset-4 hover:underline dark:text-stone-100">
          Back to home
        </Link>
      </p>
    </form>
  );
}
