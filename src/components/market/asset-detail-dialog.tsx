"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { MarketAsset } from "./market-row";

interface AssetDetailDialogProps {
  asset: MarketAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-background/95 border rounded-lg shadow-xl p-2 text-xs backdrop-blur-sm">
      <span className="font-mono font-bold">
        ${payload[0].value?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
      </span>
    </div>
  );
};

export function AssetDetailDialog({
  asset,
  open,
  onOpenChange,
}: AssetDetailDialogProps) {
  if (!asset) return null;

  const positive = asset.changePercent >= 0;
  const chartData = asset.sparkline.map((value, i) => ({
    idx: i,
    price: value,
  }));

  const minPrice = Math.min(...asset.sparkline);
  const maxPrice = Math.max(...asset.sparkline);
  const padding = (maxPrice - minPrice) * 0.05 || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {asset.image && (
              <img
                src={asset.image}
                alt={asset.symbol}
                className="h-8 w-8 rounded-full"
              />
            )}
            <div>
              <DialogTitle>{asset.name}</DialogTitle>
              <DialogDescription>{asset.symbol}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Price */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold font-mono">
            {asset.currencyPrefix ?? "$"}
            {asset.price.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: asset.price < 1 ? 6 : 2,
            })}
          </span>
          <span
            className={`flex items-center gap-1 text-sm font-medium ${
              positive ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {positive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {positive ? "+" : ""}
            {asset.changePercent.toFixed(2)}%
          </span>
        </div>

        {/* Chart */}
        {chartData.length > 1 && (
          <div className="h-48 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="idx" hide />
                <YAxis
                  domain={[minPrice - padding, maxPrice + padding]}
                  hide
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={positive ? "#10b981" : "#ef4444"}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Extra details */}
        {asset.type === "crypto" && asset.extra && (
          <div className="grid grid-cols-2 gap-3 text-sm border-t border-border/50 pt-3">
            {asset.extra.marketCap && (
              <div>
                <span className="text-xs text-muted-foreground">Market Cap</span>
                <div className="font-mono font-semibold">
                  {formatLargeNumber(asset.extra.marketCap as number)}
                </div>
              </div>
            )}
            {asset.extra.volume24h && (
              <div>
                <span className="text-xs text-muted-foreground">
                  24h Volume
                </span>
                <div className="font-mono font-semibold">
                  {formatLargeNumber(asset.extra.volume24h as number)}
                </div>
              </div>
            )}
          </div>
        )}

        {asset.type === "stock" && asset.extra && (
          <div className="grid grid-cols-2 gap-3 text-sm border-t border-border/50 pt-3">
            {asset.extra.change !== undefined && (
              <div>
                <span className="text-xs text-muted-foreground">Change</span>
                <div
                  className={`font-mono font-semibold ${
                    (asset.extra.change as number) >= 0
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  {(asset.extra.change as number) >= 0 ? "+" : ""}
                  {(asset.extra.change as number).toFixed(2)}
                </div>
              </div>
            )}
            {asset.extra.currency && (
              <div>
                <span className="text-xs text-muted-foreground">Currency</span>
                <div className="font-mono font-semibold">
                  {asset.extra.currency as string}
                </div>
              </div>
            )}
          </div>
        )}

        {asset.type === "forex" && asset.extra?.inverseRate && (
          <div className="text-sm border-t border-border/50 pt-3">
            <span className="text-xs text-muted-foreground">Inverse Rate</span>
            <div className="font-mono font-semibold">
              {(asset.extra.inverseRate as number).toFixed(6)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
