"use client";

import { ShareProfileButton } from "@/components/features/share-profile-button";
import { isUsableContactHref } from "@/components/shared/contact-href";
import { cn } from "@/lib/utils";

type MobileContactAgentBarProps = {
  contactHref?: string | null;
  sharePath: string;
  shareTitle: string;
  shareText: string;
};

export function MobileContactAgentBar({
  contactHref,
  sharePath,
  shareTitle,
  shareText,
}: MobileContactAgentBarProps) {
  const hasContact = isUsableContactHref(contactHref);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[100] border-t border-stone-200/70 bg-[var(--sl-header)]/95 px-4 pt-3 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl md:hidden dark:border-stone-800/80",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      {hasContact ? (
        <a
          href={contactHref}
          className="tap-highlight-none flex h-[3.25rem] w-full items-center justify-center rounded-2xl bg-stone-900 text-[15px] font-semibold tracking-tight text-white shadow-md transition active:scale-[0.99] dark:bg-white dark:text-stone-900"
        >
          Contact Agent
        </a>
      ) : (
        <div className="[&_button]:min-h-[3.25rem] [&_button]:w-full [&_button]:rounded-2xl [&_button]:text-[15px] [&_button]:font-semibold">
          <ShareProfileButton sharePath={sharePath} title={shareTitle} text={shareText} />
        </div>
      )}
    </div>
  );
}
