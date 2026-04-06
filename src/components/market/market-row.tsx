"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { SparklineChart } from "./sparkline-chart";

export interface MarketAsset {
  id: string;
  name: string;
  symbol: string;
  price: number;
  changePercent: number;
  sparkline: number[];
  image?: string;
  type: "crypto" | "forex" | "stock";
  extra?: Record<string, unknown>;
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (price >= 1) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

interface MarketRowProps {
  asset: MarketAsset;
  onClick?: (asset: MarketAsset) => void;
}

export function MarketRow({ asset, onClick }: MarketRowProps) {
  const positive = asset.changePercent >= 0;

  return (
    <button
      onClick={() => onClick?.(asset)}
      className="flex items-center w-full gap-3 px-3 py-3 hover:bg-accent/30 transition-colors border-b border-border/40 text-left cursor-pointer"
    >
      {/* Icon / Image */}
      <div className="shrink-0 h-8 w-8 rounded-full overflow-hidden bg-muted/50 flex items-center justify-center">
        {asset.image ? (
          <img
            src={asset.image}
            alt={asset.symbol}
            className="h-8 w-8 object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-muted-foreground">
            {asset.symbol.slice(0, 2)}
          </span>
        )}
      </div>

      {/* Name + Symbol */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{asset.name}</div>
        <div className="text-xs text-muted-foreground">{asset.symbol}</div>
      </div>

      {/* Sparkline */}
      <div className="hidden sm:block shrink-0">
        <SparklineChart data={asset.sparkline} positive={positive} />
      </div>

      {/* Price + Change */}
      <div className="text-right shrink-0 min-w-[90px]">
        <div className="text-sm font-mono font-semibold">
          ${formatPrice(asset.price)}
        </div>
        <div
          className={`flex items-center justify-end gap-0.5 text-xs ${
            positive ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {positive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {positive ? "+" : ""}
            {asset.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </button>
  );
}
