import Link from "next/link";
import { BarChart3, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardToolsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">Tools</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Helpers for day-to-day marketing — separate from your sold-record archive.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-stone-600 dark:text-stone-400" aria-hidden />
            <CardTitle className="text-base">Closing brief</CardTitle>
          </div>
          <CardDescription>
            Count and volume by city for any month range, plus copy-paste marketing text for social or email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard/tools/closing-brief">Open closing brief</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-stone-600 dark:text-stone-400" aria-hidden />
            <CardTitle className="text-base">Listing promo copy</CardTitle>
          </div>
          <CardDescription>
            Upload a Redfin / Zillow / MLS screenshot and generate shareable buyer-facing copy in your language
            (WeChat-style Chinese, English, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard/tools/listing-poster">Open listing promo</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
