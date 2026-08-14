"use client";

import { cn } from "@/lib/utils";

const BADGE_STYLES: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  enterprise: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  unlimited: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
};

interface PlanBadgeProps {
  planSlug: string;
  planName?: string;
  className?: string;
}

export function PlanBadge({ planSlug, planName, className }: PlanBadgeProps) {
  const displayName = planName || planSlug.charAt(0).toUpperCase() + planSlug.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium",
        BADGE_STYLES[planSlug] || BADGE_STYLES.free,
        className
      )}
    >
      {displayName}
    </span>
  );
}
