"use client";

/**
 * The Monitor — Live View layout per MONITOR-PLAN.md:
 * ambient globe owning the left/center, data cards in the right rail,
 * everything auto-refreshing. No user action ever waits on anything.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MonitorRail } from "./monitor-rail";

const AmbientGlobe = dynamic(
  () => import("./ambient-globe").then((m) => m.AmbientGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center font-mono text-xs text-emerald-500/70">
        ▓ INITIALIZING WORLD…
      </div>
    ),
  },
);

export interface MonitorSummary {
  signals24h: number;
  signals7d: number;
  anomalies: { critical: number; high: number; elevated: number; total: number };
  topLocations: { name: string; countryCode: string; count: number; pct: number }[];
  topCategories: { name: string; count: number }[];
  lastSignalAt: string | null;
  lastCycleAt: string | null;
}

const REFRESH_MS = 60_000;

export function MonitorDashboard() {
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [heat, setHeat] = useState<{ lat: number; lng: number; count: number }[]>([]);
  const [anomalies, setAnomalies] = useState<
    { lat: number; lng: number; severity: string; zScore: number; label: string }[]
  >([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const [sumRes, heatRes, anomRes] = await Promise.allSettled([
        fetch("/api/monitor/summary").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/geo/heat?window=7d").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/geo/anomalies").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (!alive) return;

      if (sumRes.status === "fulfilled" && sumRes.value) setSummary(sumRes.value);
      if (heatRes.status === "fulfilled" && heatRes.value?.features) {
        setHeat(
          heatRes.value.features.map((f: any) => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            count: f.properties.count,
          })),
        );
      }
      if (anomRes.status === "fulfilled" && anomRes.value?.features) {
        setAnomalies(
          anomRes.value.features.map((f: any) => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            severity: f.properties.severity,
            zScore: f.properties.zScore,
            label: f.properties.label,
          })),
        );
      }
    };

    void load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-7rem)] lg:min-h-[540px] lg:flex-row">
      {/* globe owns the negative space */}
      <div className="relative h-[46vh] min-h-[320px] flex-1 min-w-0 lg:h-auto">
        <AmbientGlobe heat={heat} anomalies={anomalies} />
      </div>

      {/* data rail — Shopify Live View right side */}
      <div className="w-full shrink-0 overflow-y-auto lg:w-[320px]">
        <MonitorRail summary={summary} />
      </div>
    </div>
  );
}
