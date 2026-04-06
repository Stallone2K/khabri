"use client";

import { MarketRow, type MarketAsset } from "./market-row";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketSectionProps {
  title: string;
  assets: MarketAsset[];
  loading?: boolean;
  error?: string;
  onAssetClick?: (asset: MarketAsset) => void;
  onRetry?: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-border/40">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-14" />
          </div>
          <Skeleton className="h-6 w-20 hidden sm:block" />
          <div className="space-y-1.5 flex flex-col items-end">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MarketSection({
  title,
  assets,
  loading,
  error,
  onAssetClick,
  onRetry,
}: MarketSectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-3 mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
        {error && onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Retry
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="px-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          {assets.map((asset) => (
            <MarketRow
              key={asset.id}
              asset={asset}
              onClick={onAssetClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
