import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "@/components/features/auth-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-stone-50 px-4 py-12 dark:bg-stone-950 sm:py-20">
      <Link
        href="/"
        className="mx-auto mb-10 font-display text-xl font-semibold text-stone-900 dark:text-stone-100"
      >
        SoldLog
      </Link>
      <Card className="mx-auto w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Account</CardTitle>
          <CardDescription>Sign in or create an account to manage your public profile and closings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
            <AuthForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
