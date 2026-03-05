"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

interface TrendingItem {
  key: string;
  label: string;
  dimension: string;
  zScore: number;
  severity: string;
  currentValue: number;
  baselineMean: number;
  sparkline: number[];
}

export function TrendingPanel() {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/intelligence/trending?limit=10")
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Trending Signals</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {items.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {items.map((item) => (
            <TrendingCard key={item.key} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendingCard({ item }: { item: TrendingItem }) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate" title={item.label}>
          {item.label}
        </span>
        <SeverityBadge severity={item.severity} />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">z={item.zScore.toFixed(1)}</span>
        <span>{Math.round(item.currentValue)} signals/hr</span>
      </div>
      <MiniSparkline data={item.sparkline} severity={item.severity} />
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { color: string; label: string }> = {
    CRITICAL: { color: "text-red-500 border-red-500/40 bg-red-500/10", label: "CRITICAL" },
    HIGH: { color: "text-orange-500 border-orange-500/40 bg-orange-500/10", label: "HIGH" },
    ELEVATED: { color: "text-yellow-500 border-yellow-500/40 bg-yellow-500/10", label: "ELEVATED" },
  };
  const c = config[severity] || { color: "text-zinc-500 border-zinc-500/30", label: severity };

  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${c.color}`}>
      {c.label}
    </Badge>
  );
}

function MiniSparkline({ data, severity }: { data: number[]; severity: string }) {
  if (!data || data.length === 0) return <div className="h-6" />;

  const max = Math.max(...data, 1);
  const width = 100;
  const height = 24;

  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const strokeColor =
    severity === "CRITICAL" ? "text-red-500" :
    severity === "HIGH" ? "text-orange-500" : "text-yellow-500";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`w-full h-6 ${strokeColor}`} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
