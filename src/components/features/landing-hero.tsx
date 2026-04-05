"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,113,108,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.06),transparent)]" />

      <div className="relative mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/60 px-3 py-1 text-xs font-medium text-stone-600 backdrop-blur dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-300"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Built for top-producing agents
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl md:text-6xl dark:text-stone-50"
        >
          Your closed deals,
          <span className="block text-stone-600 dark:text-stone-400">in one stunning link.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 max-w-xl text-pretty text-lg text-stone-600 dark:text-stone-400"
        >
          SoldLog is the lightweight portfolio layer for US agents: recent closings, mobile-first
          profiles, and share-ready stories — without building a full website.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button size="lg" asChild>
            <Link href="/dashboard" className="gap-2">
              Open dashboard
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/jane-doe">View live demo</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
