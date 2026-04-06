"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SparklineChart } from "./sparkline-chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketAsset } from "./market-row";

interface SummaryCardProps {
  label: string;
  asset: MarketAsset | null;
  loading?: boolean;
  prefix?: string;
  onClick?: (asset: MarketAsset) => void;
}

function SummaryCard({ label, asset, loading, prefix = "$", onClick }: SummaryCardProps) {
  if (loading || !asset) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-3 w-16 mb-3" />
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  const positive = asset.changePercent >= 0;

  return (
    <Card
      className="cursor-pointer hover:bg-accent/30 transition-colors"
      onClick={() => asset && onClick?.(asset)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          {positive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-xl font-bold font-mono">
              {prefix}
              {asset.price >= 1000
                ? asset.price.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })
                : asset.price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </div>
            <div
              className={`text-xs font-medium mt-0.5 ${
                positive ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {positive ? "+" : ""}
              {asset.changePercent.toFixed(2)}%
            </div>
          </div>
          {asset.sparkline.length > 1 && (
            <SparklineChart
              data={asset.sparkline}
              positive={positive}
              width={64}
              height={28}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface MarketSummaryCardsProps {
  sp500: MarketAsset | null;
  bitcoin: MarketAsset | null;
  localIndex: MarketAsset | null;
  localCurrency: MarketAsset | null;
  localIndexLabel: string;
  localCurrencyLabel: string;
  loading: boolean;
  onAssetClick?: (asset: MarketAsset) => void;
}

export function MarketSummaryCards({
  sp500,
  bitcoin,
  localIndex,
  localCurrency,
  localIndexLabel,
  localCurrencyLabel,
  loading,
  onAssetClick,
}: MarketSummaryCardsProps) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="S&P 500" asset={sp500} loading={loading} onClick={onAssetClick} />
      <SummaryCard label="Bitcoin" asset={bitcoin} loading={loading} onClick={onAssetClick} />
      <SummaryCard label={localIndexLabel} asset={localIndex} loading={loading} onClick={onAssetClick} />
      <SummaryCard
        label={localCurrencyLabel}
        asset={localCurrency}
        loading={loading}
        prefix=""
        onClick={onAssetClick}
      />
    </div>
  );
}
