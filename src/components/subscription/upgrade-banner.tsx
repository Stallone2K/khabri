"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UpgradeBannerProps {
  resource: string;
  current: number;
  max: number;
  className?: string;
}

export function UpgradeBanner({ resource, current, max, className }: UpgradeBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border border-yellow-500/25 bg-yellow-500/5 px-4 py-3",
        className
      )}
    >
      <div>
        <p className="text-sm font-medium text-yellow-400">
          {resource} limit reached
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You&apos;ve used {current} of {max} {resource.toLowerCase()} on your current plan.
        </p>
      </div>
      <Link
        href="/pricing"
        className="flex items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
      >
        Upgrade
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
