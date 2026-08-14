"use client";

import { cn } from "@/lib/utils";

interface UsageMeterProps {
  label: string;
  current: number;
  max: number; // -1 means unlimited
  className?: string;
}

export function UsageMeter({ label, current, max, className }: UsageMeterProps) {
  const isUnlimited = max === -1;
  const percent = isUnlimited ? 0 : Math.min(100, Math.round((current / max) * 100));
  const isNearLimit = !isUnlimited && percent >= 80;
  const isAtLimit = !isUnlimited && current >= max;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">
          {current} / {isUnlimited ? "\u221E" : max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isAtLimit
              ? "bg-destructive"
              : isNearLimit
                ? "bg-yellow-500"
                : "bg-foreground/50"
          )}
          style={{ width: isUnlimited ? "0%" : `${percent}%` }}
        />
      </div>
    </div>
  );
}
