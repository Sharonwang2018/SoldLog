import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type VerificationBadgeProps = {
  className?: string;
  /** Use on dark imagery / hero overlays */
  variant?: "default" | "on-dark";
};

export function VerificationBadge({ className, variant = "default" }: VerificationBadgeProps) {
  const isDark = variant === "on-dark";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 shadow-md backdrop-blur-sm",
        isDark
          ? "border-amber-400/50 bg-slate-950/75 text-amber-50"
          : "border-amber-300/60 bg-gradient-to-b from-amber-50/95 to-amber-100/90 text-slate-900 dark:border-amber-500/35 dark:from-slate-900/90 dark:to-slate-950/95 dark:text-amber-50",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          "border border-amber-400/60 bg-gradient-to-b from-amber-200/90 to-amber-500/90 dark:from-amber-300/90 dark:to-amber-600/90",
          "shadow-[0_0_14px_rgba(245,158,11,0.55),0_0_28px_rgba(245,158,11,0.25)]",
        )}
        aria-hidden
      >
        <Shield className="h-4 w-4 text-amber-950 drop-shadow-sm dark:text-amber-950" strokeWidth={2.25} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-800/90 dark:text-amber-200/90">
          Verified by
        </span>
        <span className="mt-0.5 text-[11px] font-semibold tracking-tight text-slate-900 dark:text-amber-50">
          SoldLog
        </span>
      </span>
    </span>
  );
}
