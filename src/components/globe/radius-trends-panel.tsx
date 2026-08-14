"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCw, MapPinOff } from "lucide-react";

interface GeoTrend {
  rank: number;
  topic: string;
  score: number;
  reason: string;
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  POLITICS: "text-red-400",
  MILITARY: "text-orange-400",
  FINANCE: "text-emerald-400",
  BUSINESS: "text-emerald-400",
  TECH: "text-cyan-400",
  CLIMATE: "text-lime-400",
  HEALTH: "text-pink-400",
  SPORTS: "text-violet-400",
};

export function RadiusTrendsPanel({ watchId, watchLabel }: { watchId: string | null; watchLabel: string | null }) {
  const [trends, setTrends] = useState<GeoTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signalCount, setSignalCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!watchId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/geo/trends?watchId=${watchId}&window=7d`);
      const data = await res.json();
      if (!res.ok) {
        setTrends([]);
        setMessage(data.error ?? "Failed to load trends");
      } else if (data.insufficient) {
        setTrends([]);
        setSignalCount(data.signalCount ?? 0);
        setMessage(data.message);
      } else {
        setTrends(data.trends ?? []);
        setSignalCount(data.signalCount ?? null);
      }
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }, [watchId]);

  useEffect(() => {
    setTrends([]);
    setSignalCount(null);
    setMessage(null);
    void load();
  }, [load]);

  if (!watchId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
        <MapPinOff className="h-5 w-5" />
        <p>No watch zone selected.</p>
        <p>Click SET RADIUS, pick a point on the globe, and save to see local trends.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
            ▓ {watchLabel ?? "Watch"}
          </div>
          {signalCount !== null && (
            <div className="font-mono text-[10px] text-muted-foreground">{signalCount} signals · 7d</div>
          )}
        </div>
        <button
          onClick={() => void load()}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-sm bg-muted" />
            ))}
            <p className="pt-1 text-center font-mono text-[10px] text-muted-foreground">
              RANKING LOCAL SIGNALS…
            </p>
          </div>
        )}

        {!loading && message && (
          <p className="p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">{message}</p>
        )}

        {!loading &&
          trends.map((t) => (
            <div key={t.rank} className="border-b border-border/60 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">#{t.rank}</span>
                <span className="min-w-0 flex-1 text-xs font-medium leading-snug">{t.topic}</span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    t.score >= 80 ? "text-red-400" : t.score >= 60 ? "text-yellow-400" : "text-emerald-400"
                  }`}
                >
                  {t.score}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className={`font-mono text-[9px] uppercase ${CATEGORY_COLORS[t.category] ?? "text-muted-foreground"}`}>
                  {t.category}
                </span>
                <span className="truncate text-[10px] text-muted-foreground" title={t.reason}>
                  {t.reason}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
