import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  updateProfileIdentity,
  updateProfileLanguage,
  updateProfilePosterAddressPrivacy,
  updateProfilePosterLabels,
} from "@/app/dashboard/profile-actions";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/locale";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";

function firstQueryParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const OPTIONS: { value: SupportedLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese (Simplified)" },
  { value: "ru", label: "Русский" },
  { value: "es", label: "Español" },
];

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams?: { saved?: string | string[]; identity_error?: string | string[] };
}) {
  let currentLang: SupportedLocale = "en";
  let currentPosterLabels: "match" | "en" | "zh" = "match";
  let currentPosterAddressPrivacy = false;
  let canPersist = false;
  let slug = "";
  let name = "";
  let title = "";
  let brokerage = "";
  let bio = "";
  let accentHex = "#1c1917";

  if (isSupabaseServerConfigured()) {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      canPersist = true;
      const { data } = await supabase
        .from("profiles")
        .select(
          "language, poster_labels_locale, poster_address_privacy, slug, name, title, brokerage, bio, accent_hex",
        )
        .eq("id", user.id)
        .maybeSingle();
      currentLang = normalizeLocale(data?.language as string | null | undefined);
      const pl = (data?.poster_labels_locale as string | null | undefined)?.toLowerCase();
      currentPosterLabels = pl === "zh" ? "zh" : pl === "en" ? "en" : "match";
      currentPosterAddressPrivacy = Boolean(data?.poster_address_privacy);
      slug = (data?.slug as string | undefined) ?? "";
      name = (data?.name as string | undefined) ?? "";
      title = (data?.title as string | null | undefined) ?? "";
      brokerage = (data?.brokerage as string | undefined) ?? "";
      bio = (data?.bio as string | undefined) ?? "";
      const ah = data?.accent_hex as string | null | undefined;
      accentHex = ah && /^#[0-9A-Fa-f]{6}$/.test(ah) ? ah : "#1c1917";
    }
  }

  const identitySaved = firstQueryParam(searchParams?.saved) === "identity";
  const identityErrorRaw = firstQueryParam(searchParams?.identity_error);
  const identityError = identityErrorRaw ? safeDecodeURIComponent(identityErrorRaw) : null;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">
          Profile &amp; branding
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          This is what visitors see above your sold grid.
        </p>
      </div>

      {identitySaved ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          Identity saved.
        </p>
      ) : null}
      {identityError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
        >
          {identityError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Language</CardTitle>
          <CardDescription>
            Preferred language for new closings: public labels, sold-story page copy, and poster layout (Chinese uses a
            3:4 poster for WeChat-style feeds).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canPersist ? (
            <form action={updateProfileLanguage} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <label htmlFor="language" className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  Preferred language
                </label>
                <select
                  id="language"
                  name="language"
                  defaultValue={currentLang}
                  className="flex h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-50"
                >
                  {OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Save language
              </Button>
            </form>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Sign in with Supabase configured in{" "}
              <code className="rounded bg-stone-100 px-1 font-mono text-xs dark:bg-stone-900">.env.local</code> to
              persist language. Run the SQL migration that adds{" "}
              <code className="rounded bg-stone-100 px-1 font-mono text-xs dark:bg-stone-900">profiles.language</code>.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Poster labels</CardTitle>
          <CardDescription>
            Control English vs Chinese on generated posters. “Match each sale” uses the language saved on that closing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canPersist ? (
            <>
              <form action={updateProfilePosterLabels} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <label
                    htmlFor="poster_labels_locale"
                    className="text-sm font-medium text-stone-800 dark:text-stone-200"
                  >
                    Poster language
                  </label>
                  <select
                    id="poster_labels_locale"
                    name="poster_labels_locale"
                    defaultValue={currentPosterLabels}
                    className="flex h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-50"
                  >
                    <option value="match">Match each sale</option>
                    <option value="en">English (Instagram 1:1)</option>
                    <option value="zh">Chinese (3:4 — WeChat / Xiaohongshu)</option>
                  </select>
                </div>
                <Button type="submit" className="w-full sm:w-auto">
                  Save poster setting
                </Button>
              </form>
              <form
                action={updateProfilePosterAddressPrivacy}
                className="mt-6 space-y-3 border-t border-stone-200 pt-6 dark:border-stone-800"
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    name="poster_address_privacy"
                    value="on"
                    defaultChecked={currentPosterAddressPrivacy}
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:focus:ring-stone-600"
                  />
                  <span className="font-sans text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100">Poster privacy</span>
                    <span className="mt-1 block text-stone-500 dark:text-stone-400">
                      On generated posters only, remove the leading house number from the street line (e.g. 32 Winterwind
                      Ct → Winterwind Ct). Your city stays visible for community presence. The public profile and story
                      pages are unchanged.
                    </span>
                  </span>
                </label>
                <Button type="submit" variant="secondary" size="sm">
                  Save poster privacy
                </Button>
              </form>
            </>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Run migrations that add <code className="rounded bg-stone-100 px-1 font-mono text-xs dark:bg-stone-900">poster_labels_locale</code>{" "}
              and <code className="rounded bg-stone-100 px-1 font-mono text-xs dark:bg-stone-900">poster_address_privacy</code> to{" "}
              <code className="rounded bg-stone-100 px-1 font-mono text-xs dark:bg-stone-900">profiles</code>, then sign in.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identity</CardTitle>
          <CardDescription>
            Public slug, headshot, and brokerage line. If you change your handle, older share links (e.g. to your
            previous URL) will stop working.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canPersist ? (
            <form action={updateProfileIdentity} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="slug" className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  Handle
                </label>
                <div className="flex rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900">
                  <span className="flex items-center border-r border-stone-200 px-3 text-sm text-stone-500 dark:border-stone-800">
                    soldlog.com/
                  </span>
                  <Input
                    id="slug"
                    name="slug"
                    required
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    defaultValue={slug}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  Display name
                </label>
                <Input id="name" name="name" defaultValue={name} />
              </div>
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  Title
                </label>
                <Input id="title" name="title" defaultValue={title} />
              </div>
              <div className="space-y-2">
                <label htmlFor="brokerage" className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  Brokerage
                </label>
                <Input id="brokerage" name="brokerage" defaultValue={brokerage} />
              </div>
              <div className="space-y-2">
                <label htmlFor="bio" className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  defaultValue={bio}
                  className="flex w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-50"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="accent_hex" className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  Accent color
                </label>
                <Input
                  id="accent_hex"
                  name="accent_hex"
                  type="color"
                  className="h-11 w-20 cursor-pointer p-1"
                  defaultValue={accentHex}
                />
                <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                  If saving fails after a deploy, run the Supabase migration that adds{" "}
                  <code className="rounded bg-stone-100 px-1 font-mono text-[11px] dark:bg-stone-900">accent_hex</code>{" "}
                  to <code className="rounded bg-stone-100 px-1 font-mono text-[11px] dark:bg-stone-900">profiles</code>.
                </p>
              </div>
              <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                Save identity
              </Button>
            </form>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Sign in with Supabase configured in{" "}
              <code className="rounded bg-stone-100 px-1 font-mono text-xs dark:bg-stone-900">.env.local</code> to edit
              your public identity.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
