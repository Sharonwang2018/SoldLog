"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShareProfileButton } from "@/components/features/share-profile-button";
import { isUsableContactHref } from "@/components/shared/contact-href";
import { cn } from "@/lib/utils";

type AgentStickyHeaderProps = {
  agentSlug: string;
  displayName: string;
  avatarSrc: string;
  avatarAlt: string;
  shareTitle: string;
  shareText: string;
  contactHref?: string | null;
};

export function AgentStickyHeader({
  agentSlug,
  displayName,
  avatarSrc,
  avatarAlt,
  shareTitle,
  shareText,
  contactHref,
}: AgentStickyHeaderProps) {
  const [visible, setVisible] = useState(false);
  const showContact = isUsableContactHref(contactHref);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 56);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.header
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "fixed left-0 right-0 top-0 z-40 border-b border-slate-200/80 bg-[var(--sl-header)]/95 backdrop-blur-xl dark:border-slate-800/80",
          )}
        >
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] sm:h-[3.75rem] sm:px-6">
            <Link
              href={`/${agentSlug}`}
              className="tap-highlight-none flex min-w-0 flex-1 items-center gap-3"
              aria-label={`${displayName} profile`}
            >
              <div className="relative aspect-square h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200/80 dark:ring-slate-700/80">
                <Image
                  src={avatarSrc}
                  alt={avatarAlt}
                  width={72}
                  height={72}
                  className="h-full w-full min-h-0 min-w-0 object-cover object-center"
                />
              </div>
              <span className="truncate font-sans text-sm font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </span>
            </Link>

            {showContact ? (
              <a
                href={contactHref}
                className="tap-highlight-none inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 font-sans text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 md:hidden dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                Contact
              </a>
            ) : (
              <div className="w-[128px] shrink-0 md:hidden">
                <ShareProfileButton
                  sharePath={`/${agentSlug}`}
                  title={shareTitle}
                  text={shareText}
                  triggerVariant="compact"
                />
              </div>
            )}
            <div className="hidden w-[128px] shrink-0 sm:w-[148px] md:block">
              <ShareProfileButton
                sharePath={`/${agentSlug}`}
                title={shareTitle}
                text={shareText}
                triggerVariant="compact"
              />
            </div>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
