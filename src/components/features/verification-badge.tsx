import { FileText } from "lucide-react";
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
      aria-label="Closing document on file with SoldLog — informational only, not a legal or third-party endorsement."
      title="Closing document on file with SoldLog — informational only, not a legal or third-party endorsement."
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 backdrop-blur-sm",
        isDark
          ? "border-white/20 bg-black/50 text-white shadow-sm"
          : "border-slate-200/95 bg-white/95 text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
          isDark
            ? "border-white/25 bg-white/10"
            : "border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-800",
        )}
        aria-hidden
      >
        <FileText
          className={cn("h-4 w-4", isDark ? "text-white/90" : "text-slate-600 dark:text-slate-300")}
          strokeWidth={2.25}
        />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[9px] font-semibold uppercase tracking-[0.12em]",
            isDark ? "text-white/70" : "text-slate-500 dark:text-slate-400",
          )}
        >
          Doc on file
        </span>
        <span
          className={cn(
            "mt-0.5 text-[11px] font-semibold tracking-tight",
            isDark ? "text-white" : "text-slate-800 dark:text-slate-100",
          )}
        >
          SoldLog
        </span>
      </span>
    </span>
  );
}
