"use client";

import { useEffect, useState } from "react";

interface Stats {
  signalsProcessed: number;
  criticalTrends: number;
  avgScore: number;
  trendVelocity: number;
  lastUpdate: string | null;
}

function timeAgoShort(dateString: string | null): string {
  if (!dateString) return "IDLE";
  const diffMin = Math.floor((Date.now() - new Date(dateString).getTime()) / 60_000);
  if (diffMin < 1) return "<1M";
  if (diffMin < 60) return `${diffMin}M`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}H`;
  return `${Math.floor(diffHr / 24)}D`;
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 border-l border-border pl-3 first:border-l-0 first:pl-0">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`text-xs font-bold ${tone ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

/** Bloomberg-style one-line stat readout above the globe. */
export function TerminalStatStrip({ trigger }: { trigger: number }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [trigger]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border bg-black/40 px-3 py-2 font-mono">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
        Khabri ▓ Terminal
      </span>
      <Stat label="Scanned" value={stats?.signalsProcessed ?? "—"} />
      <Stat
        label="Critical"
        value={stats?.criticalTrends ?? "—"}
        tone={stats && stats.criticalTrends > 0 ? "text-red-400" : undefined}
      />
      <Stat
        label="Temp"
        value={stats ? `${stats.avgScore}°` : "—"}
        tone={stats && stats.avgScore > 75 ? "text-orange-400" : "text-cyan-400"}
      />
      <Stat label="Vel" value={stats ? `${stats.trendVelocity}/h` : "—"} tone="text-violet-400" />
      <Stat label="Engine" value={timeAgoShort(stats?.lastUpdate ?? null)} tone="text-emerald-400" />
    </div>
  );
}
